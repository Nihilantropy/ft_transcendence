import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TournamentService } from '../services/TournamentService.js';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import {
  AuthenticatedRequest,
  CreateTournamentRequest,
  JoinTournamentRequest
} from '../types/index.js';

/**
 * Tournament Routes
 *
 * PUBLIC ENDPOINTS (no authentication required):
 * - POST /tournaments/create (anonymous tournament creation)
 * - POST /tournaments/:id/join (anonymous participation)
 * - GET /tournaments (list active tournaments)
 * - GET /tournaments/:id (get tournament details)
 *
 * AUTHENTICATED ENDPOINTS (require JWT):
 * - POST /tournaments/create/authenticated (create with user account)
 * - POST /tournaments/:id/start (start tournament - creator only)
 */

export async function tournamentRoutes(
  fastify: FastifyInstance,
  _opts: any
): Promise<void> {
  const tournamentService = new TournamentService(fastify.db);

  // =====================================================================
  // PUBLIC ENDPOINTS - No authentication required
  // =====================================================================

  /**
   * Create tournament (anonymous or authenticated)
   * POST /tournaments/create
   *
   * Allows anyone to create a tournament, with or without an account
   */
  fastify.post(
    '/create',
    {
      schema: {
        description: 'Create a new tournament (public endpoint)',
        tags: ['tournaments'],
        body: {
          type: 'object',
          required: ['name', 'maxPlayers'],
          properties: {
            name: {
              type: 'string',
              minLength: 3,
              maxLength: 100,
              description: 'Tournament name'
            },
            maxPlayers: {
              type: 'number',
              enum: [2, 4, 8, 16, 32],
              description: 'Maximum number of players (must be power of 2)'
            }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              tournament: { type: 'object' }
            }
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as CreateTournamentRequest;

        // Create tournament without userId (anonymous)
        const tournament = tournamentService.createTournament(body);

        return reply.status(200).send({
          success: true,
          tournament
        });
      } catch (error: any) {
        return reply.status(400).send({
          success: false,
          error: error.message
        });
      }
    }
  );

  /**
   * Join tournament (anonymous or authenticated)
   * POST /tournaments/:id/join
   *
   * Allows anyone to join with an alias, optionally with their user account
   */
  fastify.post(
    '/:id/join',
    {
      schema: {
        description: 'Join a tournament (public endpoint)',
        tags: ['tournaments'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Tournament ID' }
          }
        },
        body: {
          type: 'object',
          required: ['alias'],
          properties: {
            alias: {
              type: 'string',
              minLength: 1,
              maxLength: 50,
              description: 'Display alias for tournament'
            },
            userId: {
              type: 'number',
              description: 'Optional: user ID if authenticated'
            },
            sessionId: {
              type: 'string',
              description: 'Optional: session ID for anonymous users'
            }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              participant: { type: 'object' }
            }
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' }
            }
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const body = request.body as JoinTournamentRequest;

        // Generate session ID if not provided (for anonymous users)
        const sessionId =
          body.sessionId || `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const participant = tournamentService.joinTournament({
          tournamentId: id,
          userId: body.userId,
          alias: body.alias,
          sessionId
        });

        return reply.status(200).send({
          success: true,
          participant,
          sessionId // Return sessionId so client can track their participation
        });
      } catch (error: any) {
        const statusCode = error.message.includes('not found') ? 404 : 400;
        return reply.status(statusCode).send({
          success: false,
          error: error.message
        });
      }
    }
  );

  /**
   * Get active tournaments
   * GET /tournaments
   *
   * List all active tournaments (public endpoint)
   */
  fastify.get(
    '/',
    {
      schema: {
        description: 'Get all active tournaments (public endpoint)',
        tags: ['tournaments'],
        response: {
          200: {
            type: 'object',
            properties: {
              tournaments: { type: 'array' }
            }
          }
        }
      }
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const tournaments = tournamentService.getActiveTournaments();

        return reply.status(200).send({
          success: true,
          tournaments
        });
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          error: error.message
        });
      }
    }
  );

  /**
   * Get tournament details
   * GET /tournaments/:id
   *
   * Get details of a specific tournament (public endpoint)
   */
  fastify.get(
    '/:id',
    {
      schema: {
        description: 'Get tournament details (public endpoint)',
        tags: ['tournaments'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Tournament ID' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              tournament: { type: 'object' }
            }
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const tournament = tournamentService.getTournamentById(id);

        if (!tournament) {
          return reply.status(404).send({
            success: false,
            error: 'Tournament not found'
          });
        }

        return reply.status(200).send({
          success: true,
          tournament
        });
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          error: error.message
        });
      }
    }
  );

  // =====================================================================
  // AUTHENTICATED ENDPOINTS - Require JWT token
  // =====================================================================

  /**
   * Create tournament as authenticated user
   * POST /tournaments/create/authenticated
   *
   * Create tournament linked to user account
   */
  fastify.post(
    '/create/authenticated',
    {
      preHandler: authenticateJWT,
      schema: {
        description: 'Create tournament as authenticated user',
        tags: ['tournaments', 'authenticated'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name', 'maxPlayers'],
          properties: {
            name: { type: 'string', minLength: 3, maxLength: 100 },
            maxPlayers: { type: 'number', enum: [2, 4, 8, 16, 32] }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              tournament: { type: 'object' }
            }
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' }
            }
          },
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const authReq = request as AuthenticatedRequest;
        const body = request.body as CreateTournamentRequest;
        const userId = authReq.user?.id;

        if (!userId) {
          return reply.status(401).send({
            success: false,
            error: 'Unauthorized'
          });
        }

        const tournament = tournamentService.createTournament(body, userId);

        return reply.status(200).send({
          success: true,
          tournament
        });
      } catch (error: any) {
        return reply.status(400).send({
          success: false,
          error: error.message
        });
      }
    }
  );

  /**
   * Start tournament
   * POST /tournaments/:id/start
   *
   * Start a tournament and generate bracket
   * (Only creator or admin can start)
   */
  fastify.post(
    '/:id/start',
    {
      preHandler: authenticateJWT,
      schema: {
        description: 'Start a tournament',
        tags: ['tournaments', 'authenticated'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Tournament ID' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              tournament: { type: 'object' }
            }
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' }
            }
          },
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' }
            }
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const authReq = request as AuthenticatedRequest;
        const { id } = request.params as { id: string };
        const userId = authReq.user?.id;

        if (!userId) {
          return reply.status(401).send({
            success: false,
            error: 'Unauthorized'
          });
        }

        // TODO: Check if user is creator or admin
        // For now, any authenticated user can start any tournament

        const tournament = tournamentService.startTournament(id);

        return reply.status(200).send({
          success: true,
          tournament
        });
      } catch (error: any) {
        const statusCode = error.message.includes('not found') ? 404 : 400;
        return reply.status(statusCode).send({
          success: false,
          error: error.message
        });
      }
    }
  );
}
