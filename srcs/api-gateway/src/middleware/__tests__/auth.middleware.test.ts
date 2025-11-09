import { describe, it, expect, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import { createAuthDecorators } from '../auth.middleware.js';

describe('auth.middleware', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });

    await app.register(jwt, {
      secret: 'test-secret'
    });

    createAuthDecorators(app);
  });

  describe('authenticate decorator', () => {
    it('should allow request with valid JWT', async () => {
      const token = app.jwt.sign({ id: 1, email: 'test@example.com' });

      app.get('/protected', {
        preHandler: app.authenticate
      }, async (request) => {
        return { userId: request.user?.id };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({ userId: 1 });
    });

    it('should reject request without JWT', async () => {
      app.get('/protected', {
        preHandler: app.authenticate
      }, async () => {
        return { success: true };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/protected'
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Unauthorized');
    });

    it('should reject request with invalid JWT', async () => {
      app.get('/protected', {
        preHandler: app.authenticate
      }, async () => {
        return { success: true };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'Bearer invalid-token'
        }
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Unauthorized');
    });
  });

  describe('optionalAuth decorator', () => {
    it('should allow request with valid JWT and set user', async () => {
      const token = app.jwt.sign({ id: 1, email: 'test@example.com' });

      app.get('/optional', {
        preHandler: app.optionalAuth
      }, async (request) => {
        return { userId: request.user?.id || null };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/optional',
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({ userId: 1 });
    });

    it('should allow request without JWT and set user to null', async () => {
      app.get('/optional', {
        preHandler: app.optionalAuth
      }, async (request) => {
        return { userId: request.user?.id || null };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/optional'
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({ userId: null });
    });

    it('should allow request with invalid JWT and set user to null', async () => {
      app.get('/optional', {
        preHandler: app.optionalAuth
      }, async (request) => {
        return { userId: request.user?.id || null };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/optional',
        headers: {
          authorization: 'Bearer invalid-token'
        }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({ userId: null });
    });
  });
});
