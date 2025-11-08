/**
 * @file User Service Server
 * @description Main entry point for user-service microservice
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { config } from 'dotenv';
import { DatabaseService } from './services/database.service.js';
import { userRoutes } from './routes/user.routes.js';
import { friendRoutes } from './routes/friend.routes.js';
import { statsRoutes } from './routes/stats.routes.js';

// Load environment variables
config();

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

// Initialize database
const dbDir = process.env['DB_DIR'] || '/app/db-data';
const dbFile = process.env['DB_FILE'] || 'ft_transcendence.db';
const dbPath = `${dbDir}/${dbFile}`;

fastify.log.info(`Database path: ${dbPath}`);
const db = new DatabaseService(dbPath);

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
}

// Register routes
async function registerRoutes() {
  // Health check
  fastify.get('/health', async () => {
    return {
      status: 'healthy',
      service: 'user-service',
      timestamp: new Date().toISOString(),
      database: 'connected'
    };
  });

  // User routes
  await fastify.register(async (instance) => {
    await userRoutes(instance, db);
  }, { prefix: '/users' });

  // Friend routes
  await fastify.register(async (instance) => {
    await friendRoutes(instance, db);
  }, { prefix: '/friends' });

  // Stats routes
  await fastify.register(async (instance) => {
    await statsRoutes(instance, db);
  }, { prefix: '/stats' });
}

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  fastify.log.info(`Received ${signal}, shutting down gracefully...`);

  try {
    // Close database connection
    db.close();
    fastify.log.info('Database connection closed');

    // Stop accepting new requests
    await fastify.close();
    fastify.log.info('Server closed');

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
    const port = parseInt(process.env['PORT'] || '3002', 10);
    const host = process.env['HOST'] || '0.0.0.0';

    // Start listening
    await fastify.listen({ port, host });

    fastify.log.info(`🚀 User Service running on http://${host}:${port}`);
    fastify.log.info(`Health check: http://${host}:${port}/health`);
    fastify.log.info(`Environment: ${process.env['NODE_ENV'] || 'development'}`);

    // Log available routes
    fastify.log.info('Available routes:');
    fastify.log.info('  GET    /health');
    fastify.log.info('  GET    /users/me');
    fastify.log.info('  PUT    /users/me');
    fastify.log.info('  GET    /users/:id');
    fastify.log.info('  POST   /users/avatar');
    fastify.log.info('  GET    /users/search');
    fastify.log.info('  POST   /friends/request');
    fastify.log.info('  GET    /friends/requests');
    fastify.log.info('  GET    /friends/requests/sent');
    fastify.log.info('  POST   /friends/accept/:id');
    fastify.log.info('  POST   /friends/decline/:id');
    fastify.log.info('  GET    /friends');
    fastify.log.info('  DELETE /friends/:id');
    fastify.log.info('  POST   /friends/block/:id');
    fastify.log.info('  POST   /friends/unblock/:id');
    fastify.log.info('  GET    /friends/blocked');
    fastify.log.info('  GET    /stats/:id');
    fastify.log.info('  GET    /stats/leaderboard');
  } catch (error) {
    fastify.log.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Start the server
start();
