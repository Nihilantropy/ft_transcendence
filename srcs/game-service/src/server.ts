/**
 * @file Game Service Server
 * @description Main entry point for game-service microservice
 * Handles: Game logic, matchmaking, AI, tournaments
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { config } from 'dotenv';
import { DatabaseService } from './services/database.service.js';
import { GameService } from './services/GameService.js';
import { gameRoutes } from './routes/game.routes.js';
import { tournamentRoutes } from './routes/tournament.routes.js';

// Load environment variables
config();

// Initialize services
const dbPath = process.env['DATABASE_PATH'] || '/app/db-data/ft_transcendence.db';
const db = new DatabaseService(dbPath);
const gameService = new GameService(db);

// Create Fastify instance
const fastify = Fastify({
  logger: {
    level: process.env['LOG_LEVEL'] || 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
        colorize: true
      }
    }
  }
});

// Register plugins
async function registerPlugins() {
  // CORS
  await fastify.register(cors, {
    origin: process.env['CORS_ORIGIN'] || 'https://localhost',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  });

  // Security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  });

  // Cookie support (for JWT)
  await fastify.register(cookie, {
    secret: process.env['COOKIE_SECRET'] || process.env['JWT_SECRET'],
    parseOptions: {}
  });

  // Rate limiting
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '15 minutes',
    cache: 10000,
    allowList: ['127.0.0.1'],
    redis: undefined
  });

  // JWT plugin (same secret as auth-service for verification)
  await fastify.register(jwt, {
    secret: process.env['JWT_SECRET'] || 'your-jwt-secret-change-in-production',
    cookie: {
      cookieName: 'accessToken',
      signed: false
    }
  });

  // WebSocket support
  await fastify.register(websocket);

  // Add database to fastify instance for use in routes
  fastify.decorate('db', db.getDb());
}

// Register routes
async function registerRoutes() {
  // Health check
  fastify.get('/health', async () => {
    return {
      status: 'healthy',
      service: 'game-service',
      timestamp: new Date().toISOString(),
      activeGames: gameService.getActiveGamesCount(),
      features: {
        localGame: true,
        multiplayer: true,
        ai: true,
        tournaments: true,
        anonymousTournaments: true
      }
    };
  });

  // Register game REST API routes
  await gameRoutes(fastify, gameService);

  // Register tournament routes (public endpoints for anonymous participation)
  await fastify.register(tournamentRoutes, { prefix: '/tournaments' });

  // WebSocket endpoint for real-time game
  fastify.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, (socket) => {
      fastify.log.info('WebSocket connection established');

      // Register connection with GameService
      gameService.handleConnection(socket);
    });
  });
}

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  fastify.log.info(`Received ${signal}, shutting down gracefully...`);

  try {
    // Stop accepting new requests
    await fastify.close();
    fastify.log.info('Server closed');

    // Close database connection
    db.close();
    fastify.log.info('Database connection closed');

    process.exit(0);
  } catch (error) {
    fastify.log.error({ error }, 'Error during shutdown');
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled rejection handler
process.on('unhandledRejection', (error) => {
  fastify.log.error({ error }, 'Unhandled rejection');
  process.exit(1);
});

// Start server
async function start() {
  try {
    // Register plugins
    await registerPlugins();
    fastify.log.info('Plugins registered');

    // Register routes
    await registerRoutes();
    fastify.log.info('Routes registered');

    // Get port and host from environment
    const port = parseInt(process.env['PORT'] || '3003', 10);
    const host = process.env['HOST'] || '0.0.0.0';

    // Start listening
    await fastify.listen({ port, host });

    fastify.log.info(`🚀 Game Service running on http://${host}:${port}`);
    fastify.log.info(`Health check: http://${host}:${port}/health`);
    fastify.log.info(`WebSocket: ws://${host}:${port}/ws`);
    fastify.log.info(`Environment: ${process.env['NODE_ENV'] || 'development'}`);

    // Log available routes
    fastify.log.info('Available routes:');
    fastify.log.info('  GET    /health - Service health check');
    fastify.log.info('Game routes:');
    fastify.log.info('  POST   /games - Create new game');
    fastify.log.info('  GET    /games - List active games');
    fastify.log.info('  GET    /games/:id - Get game details');
    fastify.log.info('  DELETE /games/:id - Delete game');
    fastify.log.info('  GET    /games/stats - Game statistics');
    fastify.log.info('Tournament routes (PUBLIC - no auth required):');
    fastify.log.info('  POST   /tournaments/create - Create tournament (anonymous)');
    fastify.log.info('  POST   /tournaments/:id/join - Join tournament (anonymous)');
    fastify.log.info('  GET    /tournaments - List active tournaments');
    fastify.log.info('  GET    /tournaments/:id - Get tournament details');
    fastify.log.info('Tournament routes (AUTHENTICATED):');
    fastify.log.info('  POST   /tournaments/create/authenticated - Create as user');
    fastify.log.info('  POST   /tournaments/:id/start - Start tournament');
    fastify.log.info('WebSocket:');
    fastify.log.info('  WS     /ws - WebSocket for real-time gameplay');
  } catch (error) {
    fastify.log.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Start the server
start();
