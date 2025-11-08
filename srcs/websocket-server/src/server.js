/**
 * @file WebSocket Server
 * @description Real-time communication server for ft_transcendence
 * - Socket.IO event handling
 * - JWT authentication
 * - Game events (move, ready, state updates)
 * - Friend status updates
 * - Chat messaging
 * - Notifications
 */

import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import pino from 'pino';
import dotenv from 'dotenv';

dotenv.config();

// Logger setup
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
      colorize: true
    }
  }
});

// Create HTTP server for health check
const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'websocket-server',
      timestamp: new Date().toISOString(),
      connections: io.engine.clientsCount
    }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

// Create Socket.IO server
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'https://localhost',
    credentials: true,
    methods: ['GET', 'POST']
  },
  path: '/socket.io/',
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Store active connections and game rooms
const userSockets = new Map(); // userId -> socketId
const gameRooms = new Map();   // roomId -> { player1, player2, state }
const chatRooms = new Map();   // roomId -> Set<userId>

/**
 * JWT Authentication Middleware
 */
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      logger.warn({ socketId: socket.id }, 'Connection attempt without token');
      return next(new Error('Authentication token missing'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id || decoded.userId;
    socket.username = decoded.username;

    logger.info({ userId: socket.userId, username: socket.username, socketId: socket.id }, 'User authenticated');
    next();
  } catch (error) {
    logger.error({ error: error.message, socketId: socket.id }, 'Authentication failed');
    next(new Error('Authentication failed'));
  }
});

/**
 * Connection Handler
 */
io.on('connection', (socket) => {
  const userId = socket.userId;
  const username = socket.username;

  logger.info({ userId, username, socketId: socket.id }, 'Client connected');

  // Store user socket mapping
  userSockets.set(userId, socket.id);

  // Emit user online status to friends
  socket.broadcast.emit('user:online', { userId, username });

  /**
   * Friend System Events
   */
  socket.on('friend:request', async (data) => {
    logger.info({ from: userId, to: data.toUserId }, 'Friend request sent');
    const targetSocketId = userSockets.get(data.toUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('friend:request_received', {
        fromUserId: userId,
        fromUsername: username,
        timestamp: new Date().toISOString()
      });
    }
  });

  socket.on('friend:accept', async (data) => {
    logger.info({ from: userId, to: data.fromUserId }, 'Friend request accepted');
    const targetSocketId = userSockets.get(data.fromUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('friend:accepted', {
        userId,
        username,
        timestamp: new Date().toISOString()
      });
    }
  });

  socket.on('friend:decline', async (data) => {
    logger.info({ from: userId, to: data.fromUserId }, 'Friend request declined');
    const targetSocketId = userSockets.get(data.fromUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('friend:declined', {
        userId,
        timestamp: new Date().toISOString()
      });
    }
  });

  socket.on('friend:remove', async (data) => {
    logger.info({ from: userId, to: data.friendId }, 'Friend removed');
    const targetSocketId = userSockets.get(data.friendId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('friend:removed', {
        userId,
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * Game Events
   */
  socket.on('game:join', async (data) => {
    const roomId = data.roomId;
    logger.info({ userId, roomId }, 'User joining game room');

    socket.join(roomId);

    if (!gameRooms.has(roomId)) {
      gameRooms.set(roomId, {
        player1: { userId, socketId: socket.id, ready: false },
        player2: null,
        state: 'waiting'
      });
    } else {
      const room = gameRooms.get(roomId);
      if (!room.player2) {
        room.player2 = { userId, socketId: socket.id, ready: false };
        room.state = 'lobby';
        gameRooms.set(roomId, room);

        // Notify both players that opponent joined
        io.to(roomId).emit('game:player_joined', {
          player1: room.player1.userId,
          player2: room.player2.userId,
          roomId
        });
      }
    }
  });

  socket.on('game:ready', async (data) => {
    const roomId = data.roomId;
    const room = gameRooms.get(roomId);

    if (!room) {
      logger.warn({ userId, roomId }, 'Room not found');
      return;
    }

    logger.info({ userId, roomId }, 'Player ready');

    // Mark player as ready
    if (room.player1?.userId === userId) {
      room.player1.ready = true;
    } else if (room.player2?.userId === userId) {
      room.player2.ready = true;
    }

    // Check if both players are ready
    if (room.player1?.ready && room.player2?.ready) {
      room.state = 'playing';
      gameRooms.set(roomId, room);

      logger.info({ roomId }, 'Game starting');
      io.to(roomId).emit('game:start', {
        roomId,
        player1: room.player1.userId,
        player2: room.player2.userId,
        timestamp: new Date().toISOString()
      });
    } else {
      // Notify other player that this player is ready
      socket.to(roomId).emit('game:player_ready', { userId });
    }
  });

  socket.on('game:move', async (data) => {
    const roomId = data.roomId;
    logger.debug({ userId, roomId, direction: data.direction }, 'Player move');

    // Broadcast move to other players in room
    socket.to(roomId).emit('game:move', {
      userId,
      direction: data.direction,
      timestamp: Date.now()
    });
  });

  socket.on('game:update', async (data) => {
    const roomId = data.roomId;
    logger.debug({ roomId, state: data.state }, 'Game state update');

    // Broadcast game state to all players in room
    io.to(roomId).emit('game:update', {
      state: data.state,
      timestamp: Date.now()
    });
  });

  socket.on('game:pause', async (data) => {
    const roomId = data.roomId;
    logger.info({ userId, roomId }, 'Game paused');

    const room = gameRooms.get(roomId);
    if (room) {
      room.state = 'paused';
      gameRooms.set(roomId, room);
    }

    io.to(roomId).emit('game:paused', { userId, timestamp: Date.now() });
  });

  socket.on('game:resume', async (data) => {
    const roomId = data.roomId;
    logger.info({ userId, roomId }, 'Game resumed');

    const room = gameRooms.get(roomId);
    if (room) {
      room.state = 'playing';
      gameRooms.set(roomId, room);
    }

    io.to(roomId).emit('game:resumed', { timestamp: Date.now() });
  });

  socket.on('game:end', async (data) => {
    const roomId = data.roomId;
    logger.info({ roomId, winner: data.winner }, 'Game ended');

    io.to(roomId).emit('game:finished', {
      winner: data.winner,
      finalScore: data.finalScore,
      timestamp: Date.now()
    });

    // Clean up room
    gameRooms.delete(roomId);
  });

  socket.on('game:leave', async (data) => {
    const roomId = data.roomId;
    logger.info({ userId, roomId }, 'User leaving game room');

    socket.leave(roomId);

    const room = gameRooms.get(roomId);
    if (room) {
      // Notify other player that opponent left
      socket.to(roomId).emit('game:player_left', { userId });

      // Clean up room if both players left
      if (room.player1?.socketId === socket.id) {
        room.player1 = null;
      } else if (room.player2?.socketId === socket.id) {
        room.player2 = null;
      }

      if (!room.player1 && !room.player2) {
        gameRooms.delete(roomId);
      } else {
        gameRooms.set(roomId, room);
      }
    }
  });

  /**
   * Chat Events
   */
  socket.on('chat:join', async (data) => {
    const roomId = data.roomId;
    logger.info({ userId, roomId }, 'User joining chat room');

    socket.join(`chat:${roomId}`);

    if (!chatRooms.has(roomId)) {
      chatRooms.set(roomId, new Set());
    }
    chatRooms.get(roomId).add(userId);

    socket.to(`chat:${roomId}`).emit('chat:user_joined', { userId, username });
  });

  socket.on('chat:message', async (data) => {
    const roomId = data.roomId;
    logger.info({ userId, roomId, messageLength: data.message?.length }, 'Chat message sent');

    io.to(`chat:${roomId}`).emit('chat:message', {
      userId,
      username,
      message: data.message,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('chat:leave', async (data) => {
    const roomId = data.roomId;
    logger.info({ userId, roomId }, 'User leaving chat room');

    socket.leave(`chat:${roomId}`);

    if (chatRooms.has(roomId)) {
      chatRooms.get(roomId).delete(userId);
      if (chatRooms.get(roomId).size === 0) {
        chatRooms.delete(roomId);
      }
    }

    socket.to(`chat:${roomId}`).emit('chat:user_left', { userId, username });
  });

  /**
   * Notification Events
   */
  socket.on('notification:send', async (data) => {
    logger.info({ from: userId, to: data.toUserId, type: data.type }, 'Notification sent');

    const targetSocketId = userSockets.get(data.toUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('notification:received', {
        fromUserId: userId,
        fromUsername: username,
        type: data.type,
        message: data.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  socket.on('notification:read', async (data) => {
    logger.debug({ userId, notificationId: data.notificationId }, 'Notification marked as read');
    // This could trigger a database update via API call if needed
  });

  /**
   * User Status Events
   */
  socket.on('user:status_update', async (data) => {
    logger.info({ userId, status: data.status }, 'User status updated');

    // Broadcast status update to user's friends
    socket.broadcast.emit('user:status_changed', {
      userId,
      status: data.status,
      timestamp: new Date().toISOString()
    });
  });

  /**
   * Ping/Pong for connection health
   */
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });

  /**
   * Disconnection Handler
   */
  socket.on('disconnect', (reason) => {
    logger.info({ userId, username, socketId: socket.id, reason }, 'Client disconnected');

    // Remove user from active connections
    userSockets.delete(userId);

    // Emit user offline status to friends
    socket.broadcast.emit('user:offline', { userId, username });

    // Clean up any game rooms this user was in
    for (const [roomId, room] of gameRooms.entries()) {
      if (room.player1?.socketId === socket.id || room.player2?.socketId === socket.id) {
        logger.info({ userId, roomId }, 'Cleaning up game room after disconnect');
        socket.to(roomId).emit('game:player_disconnected', { userId });

        // Remove player from room
        if (room.player1?.socketId === socket.id) {
          room.player1 = null;
        }
        if (room.player2?.socketId === socket.id) {
          room.player2 = null;
        }

        // Delete room if empty
        if (!room.player1 && !room.player2) {
          gameRooms.delete(roomId);
        } else {
          gameRooms.set(roomId, room);
        }
      }
    }

    // Clean up chat rooms
    for (const [roomId, users] of chatRooms.entries()) {
      if (users.has(userId)) {
        users.delete(userId);
        socket.to(`chat:${roomId}`).emit('chat:user_left', { userId, username });
        if (users.size === 0) {
          chatRooms.delete(roomId);
        }
      }
    }
  });
});

// Start server
const PORT = parseInt(process.env.PORT) || 3100;
const HOST = process.env.HOST || '0.0.0.0';

httpServer.listen(PORT, HOST, () => {
  logger.info(`🚀 WebSocket Server running on http://${HOST}:${PORT}`);
  logger.info(`📡 Socket.IO path: /socket.io/`);
  logger.info(`🏥 Health check: http://${HOST}:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});
