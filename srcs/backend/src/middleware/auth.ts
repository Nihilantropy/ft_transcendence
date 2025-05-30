/**
 * @brief JWT authentication middleware
 * 
 * @description Validates JWT tokens and protects routes
 */

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';
import { db } from '../services/database';
import { AppError } from '../plugins/errorHandler';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: number;
      username: string;
    };
  }
}

/**
 * @brief Extract JWT token from Authorization header
 * 
 * @param authHeader Authorization header value
 * @return JWT token or null
 */
const extractToken = (authHeader: string | undefined): string | null => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
};

/**
 * @brief Verify JWT token
 * 
 * @param token JWT token string
 * @return Decoded payload or null
 */
const verifyToken = (token: string): any | null => {
  try {
    return jwt.verify(token, config.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

/**
 * @brief Authentication middleware plugin
 * 
 * @param fastify Fastify instance
 * @return Promise<void>
 */
export const authMiddleware: FastifyPluginAsync = async (fastify) => {
  /**
   * @brief Authenticate user from JWT token
   * 
   * @param request Fastify request
   * @param reply Fastify reply
   * @return Promise<void>
   */
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = extractToken(request.headers.authorization);
    
    if (!token) {
      throw new AppError(401, 'Authentication required', 'MISSING_TOKEN');
    }

    const payload = verifyToken(token);
    if (!payload) {
      throw new AppError(401, 'Invalid or expired token', 'INVALID_TOKEN');
    }

    // Verify user exists in database
    const user = await db.getUserById(payload.id);
    if (!user) {
      throw new AppError(401, 'User not found', 'USER_NOT_FOUND');
    }

    // Attach user to request
    request.user = {
      id: user.id,
      username: user.username,
    };
  });

  /**
   * @brief Optional authentication - doesn't fail if no token
   * 
   * @param request Fastify request
   * @param reply Fastify reply
   * @return Promise<void>
   */
  fastify.decorate('optionalAuth', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = extractToken(request.headers.authorization);
    
    if (token) {
      const payload = verifyToken(token);
      if (payload) {
        const user = await db.getUserById(payload.id);
        if (user) {
          request.user = {
            id: user.id,
            username: user.username,
          };
        }
      }
    }
  });
};