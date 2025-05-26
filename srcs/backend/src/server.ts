/**
 * @brief Main Fastify server entry point for ft_transcendence
 * 
 * @description Initializes Fastify server with TypeScript, routes, and plugins
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import websocket from '@fastify/websocket';
import { config } from './config/config';
import { healthRoutes } from './routes/health';
import { apiRoutes } from './routes/api';
import { authRoutes } from './routes/auth';
import { gameRoutes } from './routes/game';
import { errorHandler } from './plugins/errorHandler';

/**
 * @brief Initialize and configure Fastify server
 * 
 * @return Configured Fastify instance
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

  // Register CORS
  fastify.register(cors, {
    origin: config.CORS_ORIGIN,
    credentials: true,
  });

  // Register WebSocket support
  fastify.register(websocket);

  // Register error handler
  fastify.register(errorHandler);

  // Register routes
  fastify.register(healthRoutes, { prefix: '/api' });
  fastify.register(apiRoutes, { prefix: '/api' });
  fastify.register(authRoutes, { prefix: '/api/auth' });
  fastify.register(gameRoutes, { prefix: '/api/game' });

  // Graceful shutdown
  const gracefulShutdown = async () => {
    fastify.log.info('Shutting down gracefully...');
    await fastify.close();
    process.exit(0);
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);

  return fastify;
};

/**
 * @brief Start the Fastify server
 * 
 * @description Initializes server and starts listening on configured port
 */
const start = async () => {
  const server = buildServer();
  
  try {
    await server.listen({
      port: config.PORT,
      host: config.HOST,
    });
    
    server.log.info(`🚀 Server running at ${config.HOST}:${config.PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

// Start server if this file is run directly
if (require.main === module) {
  start();
}

export { buildServer };