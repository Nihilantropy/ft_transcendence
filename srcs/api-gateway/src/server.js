/**
 * @file API Gateway Server
 * @description Central entry point for all microservices
 * - JWT verification from cookies
 * - Rate limiting
 * - Request routing with cookie forwarding
 * - Logging
 */

import Fastify from 'fastify';
import dotenv from 'dotenv';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

dotenv.config();

// Create Fastify instance
const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
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
  origin: process.env.CORS_ORIGIN || 'https://localhost',
  credentials: true
});

await fastify.register(helmet, {
  contentSecurityPolicy: false
});

await fastify.register(rateLimit, {
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || 60000
});

// Cookie support (must be registered before JWT)
await fastify.register(cookie, {
  secret: process.env.JWT_SECRET,
  parseOptions: {}
});

// JWT plugin with cookie support
await fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'your-jwt-secret-change-me',
  cookie: {
    cookieName: 'accessToken',
    signed: false
  }
});

// Swagger documentation
await fastify.register(swagger, {
  swagger: {
    info: {
      title: 'ft_transcendence API Gateway',
      description: 'Microservices API Gateway',
      version: '1.0.0'
    },
    host: 'localhost',
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
fastify.get('/health', async (request, reply) => {
  return {
    status: 'healthy',
    service: 'api-gateway',
    timestamp: new Date().toISOString()
  };
});

// JWT verification decorator (reads from cookie)
fastify.decorate('authenticate', async function(request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({
      error: 'Unauthorized',
      message: 'Invalid or missing authentication token',
      statusCode: 401
    });
  }
});

// Optional authentication (doesn't fail if no token)
fastify.decorate('optionalAuth', async function(request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    // Silently fail - route can check if request.user exists
    request.user = null;
  }
});

/**
 * Proxy middleware - forwards requests to target service
 * Properly handles cookies and authentication
 */
async function proxyRequest(request, reply, targetUrl, stripPrefix = '/api') {
  try {
    // Build headers for forwarding
    const forwardHeaders = {
      'content-type': request.headers['content-type'] || 'application/json',
      'x-forwarded-for': request.ip,
      'x-forwarded-proto': 'https'
    };

    // Forward cookies (especially JWT tokens)
    if (request.headers.cookie) {
      forwardHeaders['cookie'] = request.headers.cookie;
    }

    // Forward user ID if available (from JWT)
    if (request.user?.id) {
      forwardHeaders['x-user-id'] = String(request.user.id);
    }

    // Construct target URL (remove prefix)
    const targetPath = request.url.replace(stripPrefix, '');
    const fullUrl = targetUrl + targetPath;

    fastify.log.debug({ method: request.method, targetUrl: fullUrl }, 'Proxying request');

    const response = await fetch(fullUrl, {
      method: request.method,
      headers: forwardHeaders,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : JSON.stringify(request.body)
    });

    // Forward Set-Cookie headers from backend to client
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      reply.header('set-cookie', setCookieHeader);
    }

    // Parse response
    const contentType = response.headers.get('content-type') || '';
    let data;

    if (contentType.includes('application/json')) {
      data = await response.json().catch(() => null);
    } else {
      data = await response.text();
    }

    reply.code(response.status).send(data);
  } catch (error) {
    fastify.log.error({ error: error.message }, 'Proxy request failed');
    reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to proxy request',
      statusCode: 500
    });
  }
}

// Route: Gateway health check
fastify.get('/api/health', async (request, reply) => {
  return {
    status: 'healthy',
    gateway: 'operational',
    services: {
      auth: process.env.AUTH_SERVICE_URL,
      user: process.env.USER_SERVICE_URL,
      game: process.env.GAME_SERVICE_URL || 'http://game-service:3003'
    },
    timestamp: new Date().toISOString()
  };
});

// ========== AUTH SERVICE ROUTES (No JWT required) ==========

// Auth endpoints - no authentication required
fastify.all('/api/auth/*', async (request, reply) => {
  await proxyRequest(request, reply, process.env.AUTH_SERVICE_URL || 'http://auth-service:3001', '/api/auth');
});

// ========== USER SERVICE ROUTES ==========

// Public user profile (GET only, optional auth)
fastify.get('/api/users/:id', {
  preHandler: fastify.optionalAuth
}, async (request, reply) => {
  await proxyRequest(request, reply, process.env.USER_SERVICE_URL || 'http://user-service:3002');
});

// User search (requires auth)
fastify.get('/api/users/search', {
  preHandler: fastify.authenticate
}, async (request, reply) => {
  await proxyRequest(request, reply, process.env.USER_SERVICE_URL || 'http://user-service:3002');
});

// All other user endpoints (require auth)
fastify.all('/api/users/*', {
  preHandler: fastify.authenticate
}, async (request, reply) => {
  await proxyRequest(request, reply, process.env.USER_SERVICE_URL || 'http://user-service:3002');
});

// ========== FRIEND SERVICE ROUTES (all require auth) ==========

// Base friends route (list all friends)
fastify.all('/api/friends', {
  preHandler: fastify.authenticate
}, async (request, reply) => {
  await proxyRequest(request, reply, process.env.USER_SERVICE_URL || 'http://user-service:3002');
});

// All friends sub-routes
fastify.all('/api/friends/*', {
  preHandler: fastify.authenticate
}, async (request, reply) => {
  await proxyRequest(request, reply, process.env.USER_SERVICE_URL || 'http://user-service:3002');
});

// ========== STATS SERVICE ROUTES ==========

// Public stats (GET only, optional auth)
fastify.get('/api/stats/:id', {
  preHandler: fastify.optionalAuth
}, async (request, reply) => {
  await proxyRequest(request, reply, process.env.USER_SERVICE_URL || 'http://user-service:3002');
});

// Leaderboard (public, optional auth)
fastify.get('/api/stats/leaderboard', {
  preHandler: fastify.optionalAuth
}, async (request, reply) => {
  await proxyRequest(request, reply, process.env.USER_SERVICE_URL || 'http://user-service:3002');
});

// ========== GAME SERVICE ROUTES ==========

// List games (public, optional auth)
fastify.get('/api/games', {
  preHandler: fastify.optionalAuth
}, async (request, reply) => {
  await proxyRequest(request, reply, process.env.GAME_SERVICE_URL || 'http://game-service:3003');
});

// Create game (requires auth)
fastify.post('/api/games', {
  preHandler: fastify.authenticate
}, async (request, reply) => {
  await proxyRequest(request, reply, process.env.GAME_SERVICE_URL || 'http://game-service:3003');
});

// Game stats (public, optional auth)
fastify.get('/api/games/stats', {
  preHandler: fastify.optionalAuth
}, async (request, reply) => {
  await proxyRequest(request, reply, process.env.GAME_SERVICE_URL || 'http://game-service:3003');
});

// Get specific game (public, optional auth)
fastify.get('/api/games/:id', {
  preHandler: fastify.optionalAuth
}, async (request, reply) => {
  await proxyRequest(request, reply, process.env.GAME_SERVICE_URL || 'http://game-service:3003');
});

// All other game endpoints (require auth)
fastify.all('/api/games/*', {
  preHandler: fastify.authenticate
}, async (request, reply) => {
  await proxyRequest(request, reply, process.env.GAME_SERVICE_URL || 'http://game-service:3003');
});

// ========== CATCH-ALL ROUTE (404 for undefined API routes) ==========

// All other API endpoints not matched above
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
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  reply.code(error.statusCode || 500).send({
    error: error.name || 'Internal Server Error',
    message: error.message || 'An unexpected error occurred',
    statusCode: error.statusCode || 500
  });
});

// Graceful shutdown
async function gracefulShutdown(signal) {
  fastify.log.info(`Received ${signal}, shutting down gracefully...`);
  try {
    await fastify.close();
    fastify.log.info('Server closed');
    process.exit(0);
  } catch (error) {
    fastify.log.error({ error }, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT) || 8001;
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });
    fastify.log.info(`🚀 API Gateway running on http://${host}:${port}`);
    fastify.log.info(`📚 API Documentation: http://${host}:${port}/api/documentation`);
    fastify.log.info(`🔌 Routing Configuration:`);
    fastify.log.info(`   /api/auth/*       → ${process.env.AUTH_SERVICE_URL || 'http://auth-service:3001'}`);
    fastify.log.info(`   /api/users/*      → ${process.env.USER_SERVICE_URL || 'http://user-service:3002'}`);
    fastify.log.info(`   /api/friends/*    → ${process.env.USER_SERVICE_URL || 'http://user-service:3002'}`);
    fastify.log.info(`   /api/stats/*      → ${process.env.USER_SERVICE_URL || 'http://user-service:3002'}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
