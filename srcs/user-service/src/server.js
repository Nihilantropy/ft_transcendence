/**
 * @file User Service Server
 * @description Microservice for user profiles, friends, and stats
 */

import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import dotenv from 'dotenv'
import { logger } from './logger.js'
import db from './database.js'

// Load environment variables
dotenv.config()

// Create Fastify instance with logger
const fastify = Fastify({
  logger,
  trustProxy: true,
  bodyLimit: 10485760 // 10MB for avatar uploads
})

// Register CORS
await fastify.register(cors, {
  origin: process.env.CORS_ORIGIN || 'https://localhost',
  credentials: true
})

// Register Helmet for security headers
await fastify.register(helmet, {
  contentSecurityPolicy: false
})

// Register multipart for file uploads
await fastify.register(multipart, {
  limits: {
    fieldNameSize: 100,
    fieldSize: 100,
    fields: 10,
    fileSize: 5 * 1024 * 1024, // 5MB max file size
    files: 1,
    headerPairs: 2000
  }
})

// Register Swagger documentation
await fastify.register(swagger, {
  swagger: {
    info: {
      title: 'User Service API',
      description: 'Microservice for user profiles, friends, and statistics',
      version: '1.0.0'
    },
    host: 'localhost:3002',
    schemes: ['http', 'https'],
    consumes: ['application/json', 'multipart/form-data'],
    produces: ['application/json'],
    securityDefinitions: {
      Bearer: {
        type: 'apiKey',
        name: 'Authorization',
        in: 'header',
        description: 'JWT token from API Gateway (forwarded via x-user-id header)'
      }
    }
  }
})

await fastify.register(swaggerUi, {
  routePrefix: '/documentation',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: false
  }
})

// Database decorator (make db available in routes)
fastify.decorate('db', db)

// Health check route
fastify.get('/health', async (request, reply) => {
  try {
    // Test database connection
    const result = db.prepare('SELECT COUNT(*) as count FROM users').get()

    return {
      status: 'healthy',
      service: 'user-service',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        userCount: result.count
      }
    }
  } catch (error) {
    logger.error('Health check failed:', error)
    return reply.code(503).send({
      status: 'unhealthy',
      service: 'user-service',
      timestamp: new Date().toISOString(),
      error: error.message
    })
  }
})

// Import and register routes
import profileRoutes from './routes/profile.routes.js'
import friendRoutes from './routes/friend.routes.js'
import statsRoutes from './routes/stats.routes.js'

await fastify.register(profileRoutes)
await fastify.register(friendRoutes, { prefix: '/friends' })
await fastify.register(statsRoutes, { prefix: '/stats' })

// 404 handler
fastify.setNotFoundHandler((request, reply) => {
  reply.code(404).send({
    success: false,
    error: 'Not Found',
    message: `Route ${request.method} ${request.url} not found`,
    statusCode: 404
  })
})

// Error handler
fastify.setErrorHandler((error, request, reply) => {
  logger.error({
    error: error.message,
    stack: error.stack,
    url: request.url,
    method: request.method
  }, 'Request error')

  reply.code(error.statusCode || 500).send({
    success: false,
    error: error.name || 'Internal Server Error',
    message: error.message || 'An unexpected error occurred',
    statusCode: error.statusCode || 500
  })
})

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT) || 3002
    const host = process.env.HOST || '0.0.0.0'

    await fastify.listen({ port, host })

    logger.info(`🚀 User Service running on http://${host}:${port}`)
    logger.info(`📚 API Documentation: http://${host}:${port}/documentation`)
    logger.info(`🏥 Health Check: http://${host}:${port}/health`)
  } catch (err) {
    logger.error('Failed to start server:', err)
    process.exit(1)
  }
}

start()
