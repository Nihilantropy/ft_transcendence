/**
 * @brief Fastify server for ft_transcendence backend
 * 
 * @description Main server entry point with integrated Socket.IO:
 * - Health check endpoint
 * - CORS configuration  
 * - Basic error handling
 * - Socket.IO integration on SAME port as REST API
 * - Environment-aware logging configuration
 */

import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import { Server as SocketIOServer } from 'socket.io'
import cookie from '@fastify/cookie'
import 'dotenv/config'
import database from './database.js'
import { logger, createLoggerConfig } from './logger.js'
import { registerRoutes } from './routes/index.js'
import swaggerPlugin from './plugins/swagger.js'
import errorHandlerPlugin from './plugins/error-handler.js'

/**
 * @brief Initialize centralized logger
 */
const environment = process.env.NODE_ENV || 'development'
const logLevel = process.env.LOG_LEVEL || (environment === 'development' ? 'info' : 'warn')
logger.initialize(environment, logLevel)

/**
 * @brief Initialize Fastify with centralized logger configuration
 */
const fastify = Fastify({
  logger: createLoggerConfig(environment, logLevel)
})

// Set Fastify logger in centralized logger for consistency
logger.setFastifyLogger(fastify.log)

// Register plugins (removed @fastify/websocket - using Socket.IO instead)
await fastify.register(helmet, {
  contentSecurityPolicy: false // Disable CSP for development
})

await fastify.register(cors, {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
})

await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute'
})

await fastify.register(cookie, {
  secret: process.env.COOKIE_SECRET || 'your-32-character-secret-key-here!',
  parseOptions: {}
})

// Register Swagger plugin (must be before routes registration)
await fastify.register(swaggerPlugin)

await fastify.register(errorHandlerPlugin)

// Register all application routes
await registerRoutes(fastify)

/**
 * @brief Initialize Socket.IO with Fastify server
 * 
 * @param {Object} fastify - Fastify server instance
 * @return {SocketIOServer} Socket.IO server instance
 */
function initializeSocketIO(fastify) {
  const io = new SocketIOServer(fastify.server, {
    cors: {
      origin: 'https://localhost', // ✅ FIXED: Use nginx proxy URL
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling'], // Support both transports for reliability
    pingTimeout: 60000,
    pingInterval: 25000
  })

  // Socket.IO connection handling
  io.on('connection', (socket) => {
    fastify.log.info(`🔌 Client connected: ${socket.id}`)
    
    // Basic connection events
    socket.on('disconnect', (reason) => {
      fastify.log.info(`🔌 Client disconnected: ${socket.id}, reason: ${reason}`)
    })
    
    socket.on('error', (error) => {
      fastify.log.error(`🔌 Socket error for ${socket.id}:`, error)
    })
    
    // ✅ Connection test events
    socket.on('ping', (data) => {
      socket.emit('pong', { timestamp: Date.now(), ...data })
    })
    
    // ✅ Friend system events (matching frontend interface)
    socket.on('friend:request', (data) => {
      fastify.log.info(`👥 Friend request from ${socket.id}:`, data)
      // Echo back with received format
      socket.emit('friend:request_received', { requestId: data.requestId, fromUser: data.fromUser })
    })
    
    socket.on('friend:accept', (data) => {
      fastify.log.info(`👥 Friend accept from ${socket.id}:`, data)
      socket.emit('friend:request_accepted', { requestId: data.requestId, user: data.user })
    })
    
    socket.on('friend:decline', (data) => {
      fastify.log.info(`👥 Friend decline from ${socket.id}:`, data)
      socket.emit('friend:request_declined', { requestId: data.requestId })
    })
    
    // ✅ User status events
    socket.on('user:status_update', (data) => {
      fastify.log.info(`👤 User status update from ${socket.id}:`, data)
      socket.broadcast.emit('user:status_change', { userId: socket.id, status: data.status })
    })
    
    // ✅ Game events (matching frontend GameService)
    socket.on('game:join', (data) => {
      fastify.log.info(`🎮 Game join from ${socket.id}:`, data)
      socket.join(`game:${data.gameId}`)
      socket.emit('game:start', { gameId: data.gameId, gameState: { status: 'starting' } })
    })
    
    socket.on('game:leave', (data) => {
      fastify.log.info(`🎮 Game leave from ${socket.id}:`, data)
      socket.leave(`game:${data.gameId}`)
    })
    
    socket.on('game:ready', (data) => {
      fastify.log.info(`🎮 Player ready from ${socket.id}:`, data)
      const startData = { gameId: data.gameId, gameState: { status: 'playing' } }
      socket.emit('game:start', startData)  // Echo back to sender
      socket.to(`game:${data.gameId}`).emit('game:start', startData)  // Broadcast to others
    })
    
    socket.on('game:move', (data) => {
      fastify.log.info(`🎮 Game move from ${socket.id}:`, data)
      // Echo back to sender for testing AND broadcast to others in room
      const updateData = { gameId: data.gameId, gameState: data.move }
      socket.emit('game:update', updateData)  // Send back to sender
      socket.to(`game:${data.gameId}`).emit('game:update', updateData)  // Broadcast to others
    })
    
    socket.on('game:pause', (data) => {
      fastify.log.info(`🎮 Game pause from ${socket.id}:`, data)
      const pauseData = { gameId: data.gameId }
      socket.emit('game:pause', pauseData)  // Echo back to sender
      socket.to(`game:${data.gameId}`).emit('game:pause', pauseData)  // Broadcast to others
    })

    socket.on('game:resume', (data) => {
      fastify.log.info(`🎮 Game resume from ${socket.id}:`, data)
      const resumeData = { gameId: data.gameId }
      socket.emit('game:resume', resumeData)  // Echo back to sender
      socket.to(`game:${data.gameId}`).emit('game:resume', resumeData)  // Broadcast to others
    })    // ✅ Notification events
    socket.on('notification:send', (data) => {
      fastify.log.info(`📢 Notification send from ${socket.id}:`, data)
      socket.emit('notification:received', { notification: data.notification })
    })
    
    socket.on('notification:read', (data) => {
      fastify.log.info(`📖 Notification read from ${socket.id}:`, data)
      // Acknowledge the read
    })
    
    // ✅ Connection state changes
    socket.emit('connection:state_change', { state: 'connected' })
    socket.emit('user:online', { userId: socket.id, status: 'online' })
    
    // ✅ Handle connection cleanup
    socket.on('disconnect', () => {
      socket.broadcast.emit('user:offline', { userId: socket.id, lastSeen: new Date().toISOString() })
    })
  })
  fastify.log.info(`🔌 Socket.IO integrated on same port`)
  fastify.log.info(`📡 WebSocket transports: websocket, polling`)
  return io
}

// Start server
const start = async () => {
  try {
    // Initialize database connection first
    logger.info('🗄️ Initializing database connection...')
    
    await database.connect()
    logger.info('✅ Database connection established')
    
    const HOST = '0.0.0.0'
    const PORT = process.env.PORT || 8000
    
    // Start Fastify server
    await fastify.listen({ host: HOST, port: parseInt(PORT) })
    logger.info(`🚀 Backend server ready at http://${HOST}:${PORT}`)
    initializeSocketIO(fastify)

  } catch (err) {
    logger.error('❌ Server startup failed', { error: err.message, stack: err.stack })
    process.exit(1)
  }
}

start()