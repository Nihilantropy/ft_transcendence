/**
 * @brief Main Fastify server with database and WebSocket integration
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import websocket from '@fastify/websocket';
import { config, validateConfig } from './config/config';
import { db } from './services/database';
import { authMiddleware } from './middleware/auth';
import { healthRoutes } from './routes/health';
import { apiRoutes } from './routes/api';
import { authRoutes } from './routes/auth';
import { gameRoutes } from './routes/game';
import { errorHandler } from './plugins/errorHandler';

/**
 * @brief Initialize and configure Fastify server
 */
const buildServer = () => {
  const fastify = Fastify({
    logger: true,
    trustProxy: true,
  });

  // Register security plugins
  fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "wss:", "https:"],
      },
    },
  });

  fastify.register(cors, {
    origin: config.CORS_ORIGIN,
    credentials: true,
  });

  fastify.register(websocket);
  fastify.register(errorHandler);
  fastify.register(authMiddleware);

  // Register routes
  fastify.register(healthRoutes, { prefix: '/api' });
  fastify.register(apiRoutes, { prefix: '/api' });
  fastify.register(authRoutes, { prefix: '/api/auth' });
  fastify.register(gameRoutes, { prefix: '/api/game' });

  return fastify;
};

/**
 * @brief Start the server with database initialization
 */
const start = async () => {
  try {
    validateConfig();
    
    // Initialize database
    await db.connect();
    
    const server = buildServer();
    
    // Graceful shutdown
    const gracefulShutdown = async () => {
      server.log.info('Shutting down gracefully...');
      await db.close();
      await server.close();
      process.exit(0);
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
    
    await server.listen({
      port: config.PORT,
      host: config.HOST,
    });
    
    server.log.info(`🚀 Server running at ${config.HOST}:${config.PORT}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

if (require.main === module) {
  start();
}

export { buildServer };