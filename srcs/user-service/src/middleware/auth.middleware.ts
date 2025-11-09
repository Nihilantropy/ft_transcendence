/**
 * @file Authentication Middleware
 * @description JWT verification for protected routes
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { JWTPayload } from '../types/index.js';

/**
 * Authenticate JWT token from cookie or Authorization header
 */
export async function authenticateJWT(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Verify JWT (from @fastify/jwt)
    const payload = await request.jwtVerify() as JWTPayload;

    // Attach user to request
    (request as any).user = payload;
  } catch (error) {
    reply.code(401).send({
      error: 'Unauthorized',
      message: 'Invalid or missing authentication token',
      statusCode: 401
    });
  }
}

/**
 * Optional authentication (doesn't fail if no token)
 */
export async function optionalAuth(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  try {
    const payload = await request.jwtVerify() as JWTPayload;
    (request as any).user = payload;
  } catch {
    // No token or invalid token - continue without user
    (request as any).user = null;
  }
}
