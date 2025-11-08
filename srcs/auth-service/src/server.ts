/**
 * @file Auth Service Server
 * @description Main entry point for the Authentication microservice
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { config } from 'dotenv';
import path from 'path';
import { DatabaseService } from './services/database.service.js';
import { authRoutes } from './routes/auth.routes.js';
import { oauthRoutes } from './routes/oauth.routes.js';

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
  },
  ajv: {
    customOptions: {
      removeAdditional: 'all', // Remove additional properties not defined in schema
      coerceTypes: true, // Coerce types based on schema
      useDefaults: true // Apply default values from schema
    }
  }
});

// Database setup
const dbPath = path.join(
  process.env['DB_DIR'] || '/app/db-data',
  process.env['DB_FILE'] || 'ft_transcendence.db'
);
const db = new DatabaseService(dbPath);

// Register plugins
await fastify.register(cors, {
  origin: process.env['CORS_ORIGIN'] || 'https://localhost',
  credentials: true
});

// Cookie support for secure JWT storage
await fastify.register(cookie, {
  secret: process.env['COOKIE_SECRET'] || process.env['JWT_SECRET'] || 'your-cookie-secret-change-in-production',
  parseOptions: {}
});

await fastify.register(helmet, {
  contentSecurityPolicy: false
});

// Rate limiting to prevent brute force attacks
await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '15 minutes',
  cache: 10000,
  allowList: ['127.0.0.1'],
  redis: undefined
});

// JWT plugin with cookie support
await fastify.register(jwt, {
  secret: process.env['JWT_SECRET'] || 'your-jwt-secret-change-in-production',
  sign: {
    expiresIn: process.env['JWT_EXPIRES_IN'] || '15m'
  },
  cookie: {
    cookieName: 'accessToken',
    signed: false
  }
});

// Decorate fastify with database instance
fastify.decorate('db', db);

// Global error handler
fastify.setErrorHandler((error, _request, reply) => {
  fastify.log.error(error);

  // Validation errors
  if (error.validation) {
    return reply.code(400).send({
      error: 'ValidationError',
      message: 'Request validation failed',
      details: error.validation,
      statusCode: 400
    });
  }

  // JWT errors
  if (error.message.includes('jwt') || error.message.includes('token')) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
      statusCode: 401
    });
  }

  // Default error response
  return reply.code(error.statusCode || 500).send({
    error: error.name || 'InternalServerError',
    message: error.message || 'An unexpected error occurred',
    statusCode: error.statusCode || 500
  });
});

// Health check endpoint
fastify.get('/health', async () => {
  return {
    status: 'healthy',
    service: 'auth-service',
    timestamp: new Date().toISOString()
  };
});

// Register auth routes
await fastify.register(
  async (instance) => {
    await authRoutes(instance, db);
    await oauthRoutes(instance, db);
  },
  { prefix: '' }
);

// Start server
async function start() {
  try {
    const port = parseInt(process.env['PORT'] || '3001', 10);
    const host = process.env['HOST'] || '0.0.0.0';

    await fastify.listen({ port, host });

    fastify.log.info(`🚀 Auth Service running on http://${host}:${port}`);
    fastify.log.info(`🏥 Health check: http://${host}:${port}/health`);
    fastify.log.info(`🔐 JWT expires in: ${process.env['JWT_EXPIRES_IN'] || '15m'}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  fastify.log.info('SIGTERM received, closing server gracefully');
  await fastify.close();
  db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  fastify.log.info('SIGINT received, closing server gracefully');
  await fastify.close();
  db.close();
  process.exit(0);
});

// Cleanup expired OAuth states every hour
setInterval(() => {
  db.cleanupExpiredStates();
}, 60 * 60 * 1000);

start();
