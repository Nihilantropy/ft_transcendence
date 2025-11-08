/**
 * @file Game Routes
 * @description REST API endpoints for game management
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { GameService } from '../services/GameService.js';
import { GameMode } from '../types/index.js';
import { authenticateJWT } from '../middleware/auth.middleware.js';

interface CreateGameBody {
  mode: GameMode;
  opponentId?: number;
}

interface JoinGameParams {
  id: string;
}

export async function gameRoutes(
  fastify: FastifyInstance,
  gameService: GameService
): Promise<void> {
  /**
   * Create new game
   * POST /games
   */
  fastify.post<{ Body: CreateGameBody }>(
    '/games',
    {
      onRequest: [authenticateJWT],
      schema: {
        body: {
          type: 'object',
          required: ['mode'],
          properties: {
            mode: {
              type: 'string',
              enum: ['local', 'multiplayer', 'ai', 'tournament']
            },
            opponentId: { type: 'number' }
          }
        },
        response: {
          201: {
            type: 'object',
            properties: {
              gameId: { type: 'string' },
              mode: { type: 'string' },
              status: { type: 'string' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Body: CreateGameBody }>, reply: FastifyReply) => {
      const user = (request as any).user;
      const { mode, opponentId } = request.body;

      try {
        const game = gameService.createGame(mode, user.userId, opponentId);

        // Add AI player if AI mode
        if (mode === 'ai') {
          game.addAIPlayer('right', 'medium');
        }

        reply.code(201).send({
          gameId: game.getGameId(),
          mode: game.getMode(),
          status: game.getStatus()
        });
      } catch (error: any) {
        reply.code(400).send({
          error: 'Bad Request',
          message: error.message,
          statusCode: 400
        });
      }
    }
  );

  /**
   * Get active games
   * GET /games
   */
  fastify.get(
    '/games',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              games: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    mode: { type: 'string' },
                    status: { type: 'string' },
                    playerCount: { type: 'number' }
                  }
                }
              }
            }
          }
        }
      }
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const gameIds = gameService.getActiveGameIds();

      const games = gameIds.map(id => {
        const game = gameService.getGame(id);
        if (!game) return null;

        const state = game.getState();
        return {
          id,
          mode: game.getMode(),
          status: game.getStatus(),
          playerCount: (state.leftPlayer ? 1 : 0) + (state.rightPlayer ? 1 : 0)
        };
      }).filter(Boolean);

      reply.send({ games });
    }
  );

  /**
   * Get game details
   * GET /games/:id
   */
  fastify.get<{ Params: JoinGameParams }>(
    '/games/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              mode: { type: 'string' },
              status: { type: 'string' },
              state: { type: 'object' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Params: JoinGameParams }>, reply: FastifyReply) => {
      const { id } = request.params;
      const game = gameService.getGame(id);

      if (!game) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Game not found',
          statusCode: 404
        });
      }

      reply.send({
        id: game.getGameId(),
        mode: game.getMode(),
        status: game.getStatus(),
        state: game.getState()
      });
    }
  );

  /**
   * Delete/cancel game
   * DELETE /games/:id
   */
  fastify.delete<{ Params: JoinGameParams }>(
    '/games/:id',
    {
      onRequest: [authenticateJWT],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Params: JoinGameParams }>, reply: FastifyReply) => {
      const { id } = request.params;
      const game = gameService.getGame(id);

      if (!game) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Game not found',
          statusCode: 404
        });
      }

      gameService.deleteGame(id);

      reply.send({
        message: 'Game deleted successfully'
      });
    }
  );

  /**
   * Get game statistics
   * GET /games/stats
   */
  fastify.get(
    '/games/stats',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              activeGames: { type: 'number' },
              totalGames: { type: 'number' }
            }
          }
        }
      }
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      reply.send({
        activeGames: gameService.getActiveGamesCount(),
        totalGames: gameService.getActiveGamesCount() // TODO: Add total from DB
      });
    }
  );
}
