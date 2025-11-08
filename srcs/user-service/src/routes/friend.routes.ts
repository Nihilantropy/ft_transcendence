/**
 * @file Friend Routes
 * @description Friend requests, friendships, and blocking endpoints
 */

import { FastifyInstance } from 'fastify';
import { DatabaseService } from '../services/database.service.js';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import type { AuthenticatedRequest, FriendRequestBody } from '../types/index.js';
import {
  friendRequestSchema,
  friendRequestIdParamSchema,
  friendRequestStatusSchema,
  userIdParamSchema,
  friendRequestResponseSchema,
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
 * Register friend routes
 */
export async function friendRoutes(
  fastify: FastifyInstance,
  db: DatabaseService
): Promise<void> {
  /**
   * POST /friends/request
   * Send a friend request
   */
  fastify.post<{ Body: FriendRequestBody }>('/request', {
    onRequest: authenticateJWT,
    schema: {
      body: friendRequestSchema.body,
      response: {
        201: friendRequestResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema,
        409: errorResponseSchema,
        500: errorResponseSchema
      }
    }
  }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const fromUserId = authReq.user.id;
    const { to_user_id, message } = request.body;

    try {
      // Can't send request to yourself
      if (fromUserId === to_user_id) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Cannot send friend request to yourself',
          statusCode: 400
        });
      }

      // Check if target user exists
      const targetUser = db.findUserById(to_user_id);
      if (!targetUser || !targetUser.is_active) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'User not found',
          statusCode: 404
        });
      }

      // Send friend request (database service handles all validation)
      const friendRequest = db.sendFriendRequest(fromUserId, to_user_id, message);

      return reply.code(201).send(friendRequest);
    } catch (error: any) {
      fastify.log.error(error);

      // Handle specific errors from database service
      if (error.message.includes('already exists')) {
        return reply.code(409).send({
          error: 'Conflict',
          message: error.message,
          statusCode: 409
        });
      }

      if (error.message.includes('Already friends')) {
        return reply.code(409).send({
          error: 'Conflict',
          message: 'Already friends with this user',
          statusCode: 409
        });
      }

      if (error.message.includes('Cannot send friend request')) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: 'Cannot send friend request to this user',
          statusCode: 403
        });
      }

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to send friend request',
        statusCode: 500
      });
    }
  });

  /**
   * GET /friends/requests
   * Get pending friend requests (received)
   */
  fastify.get<{ Querystring: { status?: string } }>('/requests', {
    onRequest: authenticateJWT,
    schema: {
      querystring: friendRequestStatusSchema.querystring,
      response: {
        200: {
          type: 'array',
          items: friendRequestResponseSchema
        },
        401: errorResponseSchema,
        500: errorResponseSchema
      }
    }
  }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const userId = authReq.user.id;
    const { status } = request.query;

    try {
      const requests = db.getFriendRequests(userId, status);
      return reply.code(200).send(requests);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve friend requests',
        statusCode: 500
      });
    }
  });

  /**
   * GET /friends/requests/sent
   * Get sent friend requests
   */
  fastify.get('/requests/sent', {
    onRequest: authenticateJWT,
    schema: {
      response: {
        200: {
          type: 'array',
          items: friendRequestResponseSchema
        },
        401: errorResponseSchema,
        500: errorResponseSchema
      }
    }
  }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const userId = authReq.user.id;

    try {
      const requests = db.getSentFriendRequests(userId);
      return reply.code(200).send(requests);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve sent friend requests',
        statusCode: 500
      });
    }
  });

  /**
   * POST /friends/accept/:id
   * Accept a friend request
   */
  fastify.post<{ Params: { id: number } }>('/accept/:id', {
    onRequest: authenticateJWT,
    schema: {
      params: friendRequestIdParamSchema.params,
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        },
        401: errorResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema,
        409: errorResponseSchema,
        500: errorResponseSchema
      }
    }
  }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const userId = authReq.user.id;
    const { id: requestId } = request.params;

    try {
      db.acceptFriendRequest(requestId, userId);

      return reply.code(200).send({
        message: 'Friend request accepted'
      });
    } catch (error: any) {
      fastify.log.error(error);

      if (error.message.includes('not found')) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Friend request not found',
          statusCode: 404
        });
      }

      if (error.message.includes('Not authorized')) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: 'Not authorized to accept this request',
          statusCode: 403
        });
      }

      if (error.message.includes('already processed')) {
        return reply.code(409).send({
          error: 'Conflict',
          message: 'Request already processed',
          statusCode: 409
        });
      }

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to accept friend request',
        statusCode: 500
      });
    }
  });

  /**
   * POST /friends/decline/:id
   * Decline a friend request
   */
  fastify.post<{ Params: { id: number } }>('/decline/:id', {
    onRequest: authenticateJWT,
    schema: {
      params: friendRequestIdParamSchema.params,
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        },
        401: errorResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema,
        500: errorResponseSchema
      }
    }
  }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const userId = authReq.user.id;
    const { id: requestId } = request.params;

    try {
      db.declineFriendRequest(requestId, userId);

      return reply.code(200).send({
        message: 'Friend request declined'
      });
    } catch (error: any) {
      fastify.log.error(error);

      if (error.message.includes('not found')) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Friend request not found',
          statusCode: 404
        });
      }

      if (error.message.includes('Not authorized')) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: 'Not authorized to decline this request',
          statusCode: 403
        });
      }

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to decline friend request',
        statusCode: 500
      });
    }
  });

  /**
   * GET /friends
   * Get list of friends
   */
  fastify.get('/', {
    onRequest: authenticateJWT,
    schema: {
      response: {
        200: {
          type: 'array',
          items: userResponseSchema
        },
        401: errorResponseSchema,
        500: errorResponseSchema
      }
    }
  }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const userId = authReq.user.id;

    try {
      const friends = db.getFriends(userId);
      const sanitizedFriends = friends.map(sanitizeUser);

      return reply.code(200).send(sanitizedFriends);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve friends list',
        statusCode: 500
      });
    }
  });

  /**
   * DELETE /friends/:id
   * Remove a friend
   */
  fastify.delete<{ Params: { id: number } }>('/:id', {
    onRequest: authenticateJWT,
    schema: {
      params: userIdParamSchema.params,
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        },
        401: errorResponseSchema,
        404: errorResponseSchema,
        500: errorResponseSchema
      }
    }
  }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const userId = authReq.user.id;
    const { id: friendId } = request.params;

    try {
      // Check if they are friends
      if (!db.areFriends(userId, friendId)) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Not friends with this user',
          statusCode: 404
        });
      }

      db.removeFriend(userId, friendId);

      return reply.code(200).send({
        message: 'Friend removed successfully'
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to remove friend',
        statusCode: 500
      });
    }
  });

  /**
   * POST /friends/block/:id
   * Block a user
   */
  fastify.post<{ Params: { id: number } }>('/block/:id', {
    onRequest: authenticateJWT,
    schema: {
      params: userIdParamSchema.params,
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        },
        400: errorResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
        500: errorResponseSchema
      }
    }
  }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const userId = authReq.user.id;
    const { id: blockedUserId } = request.params;

    try {
      // Check if user exists
      const targetUser = db.findUserById(blockedUserId);
      if (!targetUser) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'User not found',
          statusCode: 404
        });
      }

      db.blockUser(userId, blockedUserId);

      return reply.code(200).send({
        message: 'User blocked successfully'
      });
    } catch (error: any) {
      fastify.log.error(error);

      if (error.message.includes('Cannot block yourself')) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Cannot block yourself',
          statusCode: 400
        });
      }

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to block user',
        statusCode: 500
      });
    }
  });

  /**
   * POST /friends/unblock/:id
   * Unblock a user
   */
  fastify.post<{ Params: { id: number } }>('/unblock/:id', {
    onRequest: authenticateJWT,
    schema: {
      params: userIdParamSchema.params,
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        },
        401: errorResponseSchema,
        500: errorResponseSchema
      }
    }
  }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const userId = authReq.user.id;
    const { id: blockedUserId } = request.params;

    try {
      db.unblockUser(userId, blockedUserId);

      return reply.code(200).send({
        message: 'User unblocked successfully'
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to unblock user',
        statusCode: 500
      });
    }
  });

  /**
   * GET /friends/blocked
   * Get list of blocked users
   */
  fastify.get('/blocked', {
    onRequest: authenticateJWT,
    schema: {
      response: {
        200: {
          type: 'array',
          items: userResponseSchema
        },
        401: errorResponseSchema,
        500: errorResponseSchema
      }
    }
  }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const userId = authReq.user.id;

    try {
      const blockedUsers = db.getBlockedUsers(userId);
      const sanitizedUsers = blockedUsers.map(sanitizeUser);

      return reply.code(200).send(sanitizedUsers);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve blocked users',
        statusCode: 500
      });
    }
  });
}
