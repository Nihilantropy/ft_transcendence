/**
 * @file Auth Middleware
 * @description JWT verification middleware for protected routes
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import type { AuthenticatedRequest, JWTPayload } from '../types/index.js';

export async function authenticateJWT(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Verify JWT token
    const payload = await request.jwtVerify<JWTPayload>();

    // Attach user data to request
    (request as AuthenticatedRequest).user = payload;
  } catch (error) {
    reply.code(401).send({
      error: 'Unauthorized',
      message: 'Invalid or missing authentication token',
      statusCode: 401
    });
  }
}
