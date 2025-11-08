/**
 * @file User Routes
 * @description Profile management, search, and avatar upload endpoints
 */

import { FastifyInstance } from 'fastify';
import { DatabaseService } from '../services/database.service.js';
import { authenticateJWT, optionalAuth } from '../middleware/auth.middleware.js';
import type { AuthenticatedRequest, ProfileUpdateBody, SearchQuery } from '../types/index.js';
import {
  profileUpdateSchema,
  avatarUploadSchema,
  searchQuerySchema,
  userIdParamSchema,
  userResponseSchema,
  errorResponseSchema
} from '../schemas/user.schema.js';

/**
 * Sanitize user data - remove sensitive fields
 */
function sanitizeUser(user: any) {
  const { password_hash, two_factor_secret, backup_codes, ...sanitized } = user;
  return sanitized;
}

/**
 * Register user routes
 */
export async function userRoutes(
  fastify: FastifyInstance,
  db: DatabaseService
): Promise<void> {
  /**
   * GET /users/me
   * Get current authenticated user's profile
   */
  fastify.get('/me', {
    onRequest: authenticateJWT,
    schema: {
      response: {
        200: userResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
        500: errorResponseSchema
      }
    }
  }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const userId = authReq.user.id;

    try {
      const user = db.findUserById(userId);

      if (!user) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'User not found',
          statusCode: 404
        });
      }

      return reply.code(200).send(sanitizeUser(user));
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve user profile',
        statusCode: 500
      });
    }
  });

  /**
   * PUT /users/me
   * Update current user's profile
   */
  fastify.put<{ Body: ProfileUpdateBody }>('/me', {
    onRequest: authenticateJWT,
    schema: {
      body: profileUpdateSchema.body,
      response: {
        200: userResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        409: errorResponseSchema,
        500: errorResponseSchema
      }
    }
  }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const userId = authReq.user.id;
    const updates = request.body;

    try {
      // Validate username uniqueness if changing
      if (updates.username) {
        const existing = db.findUserByUsername(updates.username);
        if (existing && existing.id !== userId) {
          return reply.code(409).send({
            error: 'Conflict',
            message: 'Username already taken',
            statusCode: 409
          });
        }
      }

      // Validate avatar if provided
      if (updates.avatar_base64) {
        // Check if it's valid base64
        if (!/^data:image\/(jpeg|jpg|png|gif);base64,/.test(updates.avatar_base64)) {
          return reply.code(400).send({
            error: 'Bad Request',
            message: 'Invalid avatar format. Must be base64-encoded JPEG, PNG, or GIF',
            statusCode: 400
          });
        }

        // Check size (base64 is ~1.37x original, so 10MB base64 = ~7.3MB image)
        if (updates.avatar_base64.length > 10 * 1024 * 1024) {
          return reply.code(400).send({
            error: 'Bad Request',
            message: 'Avatar too large. Maximum size is 7MB',
            statusCode: 400
          });
        }
      }

      // Update user
      db.updateUser(userId, updates);

      // Fetch updated user
      const updatedUser = db.findUserById(userId);

      return reply.code(200).send(sanitizeUser(updatedUser));
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update user profile',
        statusCode: 500
      });
    }
  });

  /**
   * GET /users/:id
   * Get public user profile by ID
   */
  fastify.get<{ Params: { id: number } }>('/:id', {
    onRequest: optionalAuth,
    schema: {
      params: userIdParamSchema.params,
      response: {
        200: userResponseSchema,
        404: errorResponseSchema,
        500: errorResponseSchema
      }
    }
  }, async (request, reply) => {
    const { id } = request.params;

    try {
      const user = db.findUserById(id);

      if (!user) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'User not found',
          statusCode: 404
        });
      }

      // Check if user is active
      if (!user.is_active) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'User not found',
          statusCode: 404
        });
      }

      return reply.code(200).send(sanitizeUser(user));
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve user profile',
        statusCode: 500
      });
    }
  });

  /**
   * POST /users/avatar
   * Upload avatar (base64)
   */
  fastify.post<{ Body: { avatar_base64: string } }>('/avatar', {
    onRequest: authenticateJWT,
    schema: {
      body: avatarUploadSchema.body,
      response: {
        200: userResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        500: errorResponseSchema
      }
    }
  }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const userId = authReq.user.id;
    const { avatar_base64 } = request.body;

    try {
      // Validate avatar format
      if (!/^data:image\/(jpeg|jpg|png|gif);base64,/.test(avatar_base64)) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Invalid avatar format. Must be base64-encoded JPEG, PNG, or GIF',
          statusCode: 400
        });
      }

      // Check size
      if (avatar_base64.length > 10 * 1024 * 1024) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Avatar too large. Maximum size is 7MB',
          statusCode: 400
        });
      }

      // Update user avatar
      db.updateUser(userId, { avatar_base64 });

      // Fetch updated user
      const updatedUser = db.findUserById(userId);

      return reply.code(200).send(sanitizeUser(updatedUser));
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to upload avatar',
        statusCode: 500
      });
    }
  });

  /**
   * GET /users/search
   * Search users by username or email
   */
  fastify.get<{ Querystring: SearchQuery & { limit?: number } }>('/search', {
    onRequest: authenticateJWT,
    schema: {
      querystring: searchQuerySchema.querystring,
      response: {
        200: {
          type: 'array',
          items: userResponseSchema
        },
        400: errorResponseSchema,
        401: errorResponseSchema,
        500: errorResponseSchema
      }
    }
  }, async (request, reply) => {
    const { q, limit = 20 } = request.query;

    try {
      if (!q || q.trim().length === 0) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Search query cannot be empty',
          statusCode: 400
        });
      }

      const users = db.searchUsers(q, limit);
      const sanitizedUsers = users.map(sanitizeUser);

      return reply.code(200).send(sanitizedUsers);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to search users',
        statusCode: 500
      });
    }
  });
}
