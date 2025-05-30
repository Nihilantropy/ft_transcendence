/**
 * @brief Game routes with database integration and WebSocket support
 */

import { FastifyPluginAsync } from 'fastify';
import { db } from '../services/database';
import { wsService } from '../services/websocketService';
import { AppError } from '../plugins/errorHandler';

interface CreateGameBody {
  player1: string;
  player2: string;
  gameType?: 'pong' | 'tournament';
}

interface UpdateScoreBody {
  player1Score: number;
  player2Score: number;
}

export const gameRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * @brief Create a new game
   */
  fastify.post<{ Body: CreateGameBody }>('/create', {
    schema: {
      body: {
        type: 'object',
        required: ['player1', 'player2'],
        properties: {
          player1: { type: 'string' },
          player2: { type: 'string' },
          gameType: { type: 'string', enum: ['pong', 'tournament'] },
        },
      },
    },
  }, async (request, reply) => {
    const { player1, player2, gameType = 'pong' } = request.body;

    // Get or create players
    let player1User = await db.getUserByUsername(player1);
    let player2User = await db.getUserByUsername(player2);

    if (!player1User) {
      throw new AppError(404, `Player ${player1} not found`, 'PLAYER_NOT_FOUND');
    }
    if (!player2User) {
      throw new AppError(404, `Player ${player2} not found`, 'PLAYER_NOT_FOUND');
    }

    const game = await db.createGame({
      player1_id: player1User.id,
      player2_id: player2User.id,
      player1_score: 0,
      player2_score: 0,
      game_type: gameType,
      status: 'pending',
    });

    return { game };
  });

  /**
   * @brief Get game by ID
   */
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const gameId = parseInt(request.params.id);
    const game = await db.getGameById(gameId);

    if (!game) {
      throw new AppError(404, 'Game not found', 'GAME_NOT_FOUND');
    }

    return { game };
  });

  /**
   * @brief Update game score
   */
  fastify.put<{ 
    Params: { id: string }, 
    Body: UpdateScoreBody 
  }>('/:id/score', {
    schema: {
      body: {
        type: 'object',
        required: ['player1Score', 'player2Score'],
        properties: {
          player1Score: { type: 'number', minimum: 0 },
          player2Score: { type: 'number', minimum: 0 },
        },
      },
    },
  }, async (request, reply) => {
    const gameId = parseInt(request.params.id);
    const { player1Score, player2Score } = request.body;

    const game = await db.updateGameScore(gameId, player1Score, player2Score);
    if (!game) {
      throw new AppError(404, 'Game not found', 'GAME_NOT_FOUND');
    }

    return { game };
  });

  /**
   * @brief List active games
   */
  fastify.get('/active', async (request, reply) => {
    const games = await db.getActiveGames();
    return { games };
  });

  /**
   * @brief WebSocket endpoint for real-time game updates
   */
  fastify.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, (connection, req) => {
      // Extract user from query or auth header (simplified)
      const userId = req.query?.userId ? parseInt(req.query.userId as string) : undefined;
      
      wsService.addConnection(connection.socket, userId);
    });
  });
};