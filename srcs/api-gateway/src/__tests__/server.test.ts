import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import { createAuthDecorators } from '../middleware/auth.middleware.js';

describe('API Gateway Server Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    // Register required plugins
    await app.register(cookie, {
      secret: 'test-secret'
    });

    await app.register(jwt, {
      secret: 'test-secret',
      cookie: {
        cookieName: 'accessToken',
        signed: false
      }
    });

    // Create auth decorators
    createAuthDecorators(app);

    // Add health check route
    app.get('/health', async () => {
      return {
        status: 'healthy',
        service: 'api-gateway',
        timestamp: new Date().toISOString()
      };
    });

    // Add protected route
    app.get('/api/protected', {
      preHandler: app.authenticate
    }, async (request) => {
      return { userId: request.user?.id };
    });

    // Add optional auth route
    app.get('/api/optional', {
      preHandler: app.optionalAuth
    }, async (request) => {
      return { userId: request.user?.id || null };
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe('healthy');
      expect(body.service).toBe('api-gateway');
    });
  });

  describe('Protected Routes', () => {
    it('should access protected route with valid JWT', async () => {
      const token = app.jwt.sign({ id: 1, email: 'test@example.com' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/protected',
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.userId).toBe(1);
    });

    it('should reject protected route without JWT', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/protected'
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Unauthorized');
    });
  });

  describe('Optional Auth Routes', () => {
    it('should access optional route with valid JWT', async () => {
      const token = app.jwt.sign({ id: 1, email: 'test@example.com' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/optional',
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.userId).toBe(1);
    });

    it('should access optional route without JWT', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/optional'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.userId).toBeNull();
    });
  });
});
