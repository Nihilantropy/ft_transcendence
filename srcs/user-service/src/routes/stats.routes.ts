/**
 * @file Stats Routes
 * @description User game statistics endpoints
 */

import { FastifyInstance } from 'fastify';
import { DatabaseService } from '../services/database.service.js';
import { optionalAuth } from '../middleware/auth.middleware.js';
import {
  userIdParamSchema,
  userStatsResponseSchema,
  errorResponseSchema
} from '../schemas/user.schema.js';

/**
 * Register stats routes
 */
export async function statsRoutes(
  fastify: FastifyInstance,
  db: DatabaseService
): Promise<void> {
  /**
   * GET /stats/:id
   * Get user statistics
   */
  fastify.get<{ Params: { id: number } }>('/:id', {
    onRequest: optionalAuth,
    schema: {
      params: userIdParamSchema.params,
      response: {
        200: userStatsResponseSchema,
        404: errorResponseSchema,
        500: errorResponseSchema
      }
    }
  }, async (request, reply) => {
    const { id: userId } = request.params;

    try {
      // Check if user exists
      const user = db.findUserById(userId);
      if (!user || !user.is_active) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'User not found',
          statusCode: 404
        });
      }

      // Get stats (initialize if not exists)
      let stats = db.getUserStats(userId);

      if (!stats) {
        // Initialize stats for user
        db.initializeUserStats(userId);
        stats = db.getUserStats(userId);
      }

      if (!stats) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Statistics not found',
          statusCode: 404
        });
      }

      return reply.code(200).send(stats);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve user statistics',
        statusCode: 500
      });
    }
  });

  /**
   * GET /stats/leaderboard
   * Get top players (future implementation)
   * For now, returns empty array as game service isn't implemented yet
   */
  fastify.get('/leaderboard', {
    schema: {
      response: {
        200: {
          type: 'array',
          items: userStatsResponseSchema
        },
        500: errorResponseSchema
      }
    }
  }, async (_request, reply) => {
    try {
      // TODO: Implement leaderboard when game service is ready
      // For now, return empty array
      return reply.code(200).send([]);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve leaderboard',
        statusCode: 500
      });
    }
  });
}
