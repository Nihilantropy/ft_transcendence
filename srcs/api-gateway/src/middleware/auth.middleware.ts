/**
 * @file Authentication Middleware
 * @description JWT verification decorators for route protection
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Create authentication decorators for Fastify instance
 */
export function createAuthDecorators(fastify: FastifyInstance): void {
  /**
   * Authenticate decorator - requires valid JWT
   */
  fastify.decorate('authenticate', async function(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
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

  /**
   * Optional auth decorator - doesn't fail if no token
   */
  fastify.decorate('optionalAuth', async function(
    request: FastifyRequest,
    _reply: FastifyReply
  ): Promise<void> {
    try {
      await request.jwtVerify();
    } catch (err) {
      // Silently fail - route can check if request.user exists
      request.user = null;
    }
  });
}
