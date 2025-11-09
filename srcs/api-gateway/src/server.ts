/**
 * @file API Gateway Server
 * @description Central entry point for all microservices
 * - JWT verification from cookies and headers
 * - Rate limiting
 * - Request routing with cookie forwarding
 * - Logging
 */

import Fastify from 'fastify';
import { config } from 'dotenv';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { createAuthDecorators } from './middleware/auth.middleware.js';
import { buildTargetUrl, extractHeaders, shouldForwardBody } from './utils/proxy.utils.js';
import type { FastifyRequest, FastifyReply } from 'fastify';

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
  trustProxy: true
});

// Register plugins
await fastify.register(cors, {
  origin: process.env['CORS_ORIGIN'] || 'https://localhost',
  credentials: true
});

await fastify.register(helmet, {
  contentSecurityPolicy: false
});

// Cookie support (must be registered before JWT)
await fastify.register(cookie, {
  secret: process.env['JWT_SECRET'],
  parseOptions: {}
});

// JWT plugin with cookie support
await fastify.register(jwt, {
  secret: process.env['JWT_SECRET'] || 'your-jwt-secret-change-me',
  cookie: {
    cookieName: 'accessToken',
    signed: false
  }
});

// Create authentication decorators
createAuthDecorators(fastify);

// Swagger documentation
await fastify.register(swagger, {
  swagger: {
    info: {
      title: 'ft_transcendence API Gateway',
      description: 'Microservices API Gateway',
      version: '1.0.0'
    },
    host: process.env['DOMAIN'],
    schemes: ['https'],
    consumes: ['application/json'],
    produces: ['application/json'],
    securityDefinitions: {
      Bearer: {
        type: 'apiKey',
        name: 'Authorization',
        in: 'header'
      }
    }
  }
});

await fastify.register(swaggerUi, {
  routePrefix: '/api/documentation',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: false
  }
});

// Health check
fastify.get('/health', async () => {
  return {
    status: 'healthy',
    service: 'api-gateway',
    timestamp: new Date().toISOString()
  };
});

/**
 * Proxy middleware - forwards requests to target service
 * Properly handles cookies and authentication
 */
async function proxyRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  targetUrl: string,
  stripPrefix: string = '/api'
): Promise<void> {
  try {
    // Build headers for forwarding
    const forwardHeaders = extractHeaders(
      request.headers,
      request.ip,
      request.user?.id
    );

    // Construct target URL
    const fullUrl = buildTargetUrl(request.url, targetUrl, stripPrefix);

    fastify.log.debug({ method: request.method, targetUrl: fullUrl }, 'Proxying request');

    const response = await fetch(fullUrl, {
      method: request.method,
      headers: forwardHeaders,
      body: shouldForwardBody(request.method)
        ? JSON.stringify(request.body)
        : undefined
    });

    // Forward Set-Cookie headers from backend to client
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      reply.header('set-cookie', setCookieHeader);
    }

    // Parse response
    const contentType = response.headers.get('content-type') || '';
    let data: unknown;

    if (contentType.includes('application/json')) {
      data = await response.json().catch(() => null);
    } else {
      data = await response.text();
    }

    reply.code(response.status).send(data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    fastify.log.error({ error: errorMessage }, 'Proxy request failed');
    reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to proxy request',
      statusCode: 500
    });
  }
}

// Route: Gateway health check
fastify.get('/api/health', async () => {
  return {
    status: 'healthy',
    gateway: 'operational',
    services: {
      auth: process.env['AUTH_SERVICE_URL'],
      user: process.env['USER_SERVICE_URL'],
      game: process.env['GAME_SERVICE_URL']
    },
    timestamp: new Date().toISOString()
  };
});

// ========== AUTH SERVICE ROUTES (No JWT required) ==========

fastify.all('/api/auth/*', async (request, reply) => {
  await proxyRequest(
    request,
    reply,
    process.env['AUTH_SERVICE_URL'] || 'http://auth-service:3001',
    '/api/auth'
  );
});

// ========== USER SERVICE ROUTES ==========

fastify.get('/api/users/:id', {
  preHandler: fastify.optionalAuth
}, async (request, reply) => {
  await proxyRequest(
    request,
    reply,
    process.env['USER_SERVICE_URL'] || 'http://user-service:3002'
  );
});

fastify.get('/api/users/search', {
  preHandler: fastify.authenticate
}, async (request, reply) => {
  await proxyRequest(
    request,
    reply,
    process.env['USER_SERVICE_URL'] || 'http://user-service:3002'
  );
});

fastify.all('/api/users/*', {
  preHandler: fastify.authenticate
}, async (request, reply) => {
  await proxyRequest(
    request,
    reply,
    process.env['USER_SERVICE_URL'] || 'http://user-service:3002'
  );
});

// ========== FRIEND SERVICE ROUTES (all require auth) ==========

fastify.all('/api/friends', {
  preHandler: fastify.authenticate
}, async (request, reply) => {
  await proxyRequest(
    request,
    reply,
    process.env['USER_SERVICE_URL'] || 'http://user-service:3002'
  );
});

fastify.all('/api/friends/*', {
  preHandler: fastify.authenticate
}, async (request, reply) => {
  await proxyRequest(
    request,
    reply,
    process.env['USER_SERVICE_URL'] || 'http://user-service:3002'
  );
});

// ========== STATS SERVICE ROUTES ==========

fastify.get('/api/stats/:id', {
  preHandler: fastify.optionalAuth
}, async (request, reply) => {
  await proxyRequest(
    request,
    reply,
    process.env['USER_SERVICE_URL'] || 'http://user-service:3002'
  );
});

fastify.get('/api/stats/leaderboard', {
  preHandler: fastify.optionalAuth
}, async (request, reply) => {
  await proxyRequest(
    request,
    reply,
    process.env['USER_SERVICE_URL'] || 'http://user-service:3002'
  );
});

// ========== GAME SERVICE ROUTES ==========

fastify.get('/api/games', {
  preHandler: fastify.optionalAuth
}, async (request, reply) => {
  await proxyRequest(
    request,
    reply,
    process.env['GAME_SERVICE_URL'] || 'http://game-service:3003'
  );
});

fastify.post('/api/games', {
  preHandler: fastify.authenticate
}, async (request, reply) => {
  await proxyRequest(
    request,
    reply,
    process.env['GAME_SERVICE_URL'] || 'http://game-service:3003'
  );
});

fastify.get('/api/games/stats', {
  preHandler: fastify.optionalAuth
}, async (request, reply) => {
  await proxyRequest(
    request,
    reply,
    process.env['GAME_SERVICE_URL'] || 'http://game-service:3003'
  );
});

fastify.get('/api/games/:id', {
  preHandler: fastify.optionalAuth
}, async (request, reply) => {
  await proxyRequest(
    request,
    reply,
    process.env['GAME_SERVICE_URL'] || 'http://game-service:3003'
  );
});

fastify.all('/api/games/*', {
  preHandler: fastify.authenticate
}, async (request, reply) => {
  await proxyRequest(
    request,
    reply,
    process.env['GAME_SERVICE_URL'] || 'http://game-service:3003'
  );
});

// ========== CATCH-ALL ROUTE (404 for undefined API routes) ==========

fastify.all('/api/*', {
  preHandler: fastify.authenticate
}, async (request, reply) => {
  reply.code(404).send({
    error: 'Not Found',
    message: `API route ${request.method} ${request.url} not found`,
    statusCode: 404,
    availableRoutes: [
      '/api/auth/*',
      '/api/users/*',
      '/api/friends/*',
      '/api/stats/*',
      '/api/games/*'
    ]
  });
});

// 404 handler
fastify.setNotFoundHandler((request, reply) => {
  reply.code(404).send({
    error: 'Not Found',
    message: `Route ${request.method} ${request.url} not found`,
    statusCode: 404
  });
});

// Error handler
fastify.setErrorHandler((error, _request, reply) => {
  fastify.log.error(error);
  reply.code(error.statusCode || 500).send({
    error: error.name || 'Internal Server Error',
    message: error.message || 'An unexpected error occurred',
    statusCode: error.statusCode || 500
  });
});

// Graceful shutdown
async function gracefulShutdown(signal: string): Promise<void> {
  fastify.log.info(`Received ${signal}, shutting down gracefully...`);
  try {
    await fastify.close();
    fastify.log.info('Server closed');
    process.exit(0);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    fastify.log.error({ error: errorMessage }, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
async function start(): Promise<void> {
  try {
    const port = parseInt(process.env['PORT'] || '8001', 10);
    const host = process.env['HOST'] || '0.0.0.0';

    await fastify.listen({ port, host });
    fastify.log.info(`🚀 API Gateway running on http://${host}:${port}`);
    fastify.log.info(`📚 API Documentation: http://${host}:${port}/api/documentation`);
    fastify.log.info(`🔌 Routing Configuration:`);
    fastify.log.info(`   /api/auth/*       → ${process.env['AUTH_SERVICE_URL'] || 'http://auth-service:3001'}`);
    fastify.log.info(`   /api/users/*      → ${process.env['USER_SERVICE_URL'] || 'http://user-service:3002'}`);
    fastify.log.info(`   /api/friends/*    → ${process.env['USER_SERVICE_URL'] || 'http://user-service:3002'}`);
    fastify.log.info(`   /api/stats/*      → ${process.env['USER_SERVICE_URL'] || 'http://user-service:3002'}`);
    fastify.log.info(`   /api/games/*      → ${process.env['GAME_SERVICE_URL'] || 'http://game-service:3003'}`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    fastify.log.error(errorMessage);
    process.exit(1);
  }
}

start();
