/**
 * @brief Game-related routes for Pong
 */

import { FastifyPluginAsync } from 'fastify';
import { RawData } from 'ws';

interface CreateGameBody {
  player1: string;
  player2: string;
  gameType?: 'pong' | 'tournament';
}

interface UpdateScoreBody {
  player1Score: number;
  player2Score: number;
}

/**
 * @brief Parse WebSocket message safely
 * 
 * @param message Raw WebSocket message data
 * @return Parsed message object or null if invalid
 */
const parseWebSocketMessage = (message: RawData): any | null => {
  try {
    return JSON.parse(message.toString());
  } catch (error) {
    return null;
  }
};

export const gameRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * @brief Create a new game
   * 
   * @param request - Contains game creation data
   * @return New game information
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

    // TODO: Create game in database
    const game = {
      id: 1,
      player1,
      player2,
      gameType,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    return { game };
  });

  /**
   * @brief Get game by ID
   * 
   * @param request - Contains game ID
   * @return Game information
   */
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;

    // TODO: Get game from database
    const game = {
      id: parseInt(id),
      player1: 'player1',
      player2: 'player2',
      player1Score: 0,
      player2Score: 0,
      status: 'in_progress',
      createdAt: new Date().toISOString(),
    };

    return { game };
  });

  /**
   * @brief Update game score
   * 
   * @param request - Contains game ID and new scores
   * @return Updated game information
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
    const { id } = request.params;
    const { player1Score, player2Score } = request.body;

    // TODO: Update game in database
    const game = {
      id: parseInt(id),
      player1Score,
      player2Score,
      updatedAt: new Date().toISOString(),
    };

    return { game };
  });

  /**
   * @brief List active games
   * 
   * @return List of active games
   */
  fastify.get('/active', async (request, reply) => {
    // TODO: Get active games from database
    const games = [
      {
        id: 1,
        player1: 'player1',
        player2: 'player2',
        status: 'in_progress',
      },
    ];

    return { games };
  });

  /**
   * @brief WebSocket endpoint for real-time game updates
   */
  fastify.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, (connection, req) => {
      /**
       * @brief Handle incoming WebSocket messages
       * 
       * @param message Raw message data from WebSocket
       * @return void
       */
      connection.socket.on('message', (message: RawData) => {
        // Parse message safely
        const data = parseWebSocketMessage(message);
        
        if (!data) {
          connection.socket.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format',
          }));
          return;
        }
        
        // Echo message back for now
        connection.socket.send(JSON.stringify({
          type: 'echo',
          data,
        }));
      });

      // Send initial connection message
      connection.socket.send(JSON.stringify({
        type: 'connected',
        timestamp: Date.now(),
      }));
    });
  });
};