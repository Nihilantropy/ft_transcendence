/**
 * @file Authentication Middleware
 * @description JWT verification middleware for protected routes
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import type { JWTPayload } from '../types/index.js';

/**
 * Authenticates JWT token from httpOnly cookie
 * Verifies token signature and extracts user payload
 *
 * @param request - Fastify request object
 * @param reply - Fastify reply object
 */
export async function authenticateJWT(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Verify JWT token from cookie (set by @fastify/jwt plugin)
    const payload = await request.jwtVerify() as JWTPayload;

    // Attach user data to request for route handlers
    (request as any).user = payload;
  } catch (error) {
    // Token missing, invalid, or expired
    reply.code(401).send({
      error: 'Unauthorized',
      message: 'Invalid or missing authentication token',
      statusCode: 401
    });
  }
}

/**
 * Optional authentication - does not reject if token is missing
 * Used for routes that work differently for authenticated vs anonymous users
 *
 * @param request - Fastify request object
 * @param reply - Fastify reply object
 */
export async function optionalAuth(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  try {
    const payload = await request.jwtVerify() as JWTPayload;
    (request as any).user = payload;
  } catch (_error) {
    // Silently fail - route can check if request.user exists
    (request as any).user = null;
  }
}
