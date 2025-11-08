/**
 * @file Game Service
 * @description Manages all active games and WebSocket connections
 */

import { GameManager } from '../engine/GameManager.js';
import { DatabaseService } from './database.service.js';
import { GameMode, GameMessage, InputPayload, JoinGamePayload } from '../types/index.js';
import type { WebSocket } from 'ws';

interface GameConnection {
  gameId: string;
  userId: number;
  username: string;
  socket: WebSocket;
}

export class GameService {
  private games: Map<string, GameManager>;
  private connections: Map<WebSocket, GameConnection>;
  private db: DatabaseService;

  constructor(db: DatabaseService) {
    this.games = new Map();
    this.connections = new Map();
    this.db = db;
  }

  /**
   * Create a new game
   */
  createGame(mode: GameMode, player1Id: number, player2Id?: number): GameManager {
    const game = new GameManager(mode);

    // Store in database if multiplayer or AI
    if (mode === 'multiplayer' || mode === 'ai') {
      this.db.createGame(mode, player1Id, player2Id || null);
    }

    this.games.set(game.getGameId(), game);
    return game;
  }

  /**
   * Get game by ID
   */
  getGame(gameId: string): GameManager | undefined {
    return this.games.get(gameId);
  }

  /**
   * Delete game
   */
  deleteGame(gameId: string): void {
    const game = this.games.get(gameId);
    if (game) {
      game.destroy();
      this.games.delete(gameId);
    }
  }

  /**
   * Handle WebSocket connection
   */
  handleConnection(socket: WebSocket): void {
    console.log('New WebSocket connection');

    socket.on('message', (data) => {
      try {
        const message: GameMessage = JSON.parse(data.toString());
        this.handleMessage(socket, message);
      } catch (error) {
        console.error('Failed to parse message:', error);
        this.sendError(socket, 'Invalid message format');
      }
    });

    socket.on('close', () => {
      this.handleDisconnect(socket);
    });

    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(socket: WebSocket, message: GameMessage): void {
    switch (message.type) {
      case 'join_game':
        this.handleJoinGame(socket, message.payload as JoinGamePayload);
        break;

      case 'ready':
        this.handleReady(socket);
        break;

      case 'input':
        this.handleInput(socket, message.payload as InputPayload);
        break;

      case 'pause':
        this.handlePause(socket);
        break;

      case 'resume':
        this.handleResume(socket);
        break;

      case 'leave_game':
        this.handleLeaveGame(socket);
        break;

      default:
        this.sendError(socket, `Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle player joining game
   */
  private handleJoinGame(socket: WebSocket, payload: JoinGamePayload): void {
    const { gameId, userId, username } = payload;

    const game = this.games.get(gameId);
    if (!game) {
      this.sendError(socket, 'Game not found');
      return;
    }

    // Add player to game
    const side = game.addPlayer(userId, username);
    if (!side) {
      this.sendError(socket, 'Game is full');
      return;
    }

    // Store connection
    this.connections.set(socket, { gameId, userId, username, socket });

    // Send confirmation
    this.send(socket, {
      type: 'player_joined',
      payload: { side, gameState: game.getState() }
    });

    // Broadcast to other players
    this.broadcastToGame(gameId, {
      type: 'player_joined',
      payload: { userId, username, side }
    }, socket);

    // Start broadcasting game state
    this.startGameStateBroadcast(gameId);
  }

  /**
   * Handle player ready
   */
  private handleReady(socket: WebSocket): void {
    const connection = this.connections.get(socket);
    if (!connection) return;

    const game = this.games.get(connection.gameId);
    if (!game) return;

    game.setPlayerReady(connection.userId, true);

    // Broadcast ready status
    this.broadcastToGame(connection.gameId, {
      type: 'player_ready',
      payload: { userId: connection.userId }
    });

    // Check if game is starting
    if (game.getStatus() === 'playing') {
      this.broadcastToGame(connection.gameId, {
        type: 'game_starting',
        payload: { startTime: Date.now() }
      });
    }
  }

  /**
   * Handle player input
   */
  private handleInput(socket: WebSocket, payload: InputPayload): void {
    const connection = this.connections.get(socket);
    if (!connection) return;

    const game = this.games.get(connection.gameId);
    if (!game) return;

    game.handleInput(connection.userId, payload.action);
  }

  /**
   * Handle pause
   */
  private handlePause(socket: WebSocket): void {
    const connection = this.connections.get(socket);
    if (!connection) return;

    const game = this.games.get(connection.gameId);
    if (!game) return;

    game.pauseGame();

    this.broadcastToGame(connection.gameId, {
      type: 'game_paused',
      payload: {}
    });
  }

  /**
   * Handle resume
   */
  private handleResume(socket: WebSocket): void {
    const connection = this.connections.get(socket);
    if (!connection) return;

    const game = this.games.get(connection.gameId);
    if (!game) return;

    game.resumeGame();

    this.broadcastToGame(connection.gameId, {
      type: 'game_resumed',
      payload: {}
    });
  }

  /**
   * Handle leave game
   */
  private handleLeaveGame(socket: WebSocket): void {
    this.handleDisconnect(socket);
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(socket: WebSocket): void {
    const connection = this.connections.get(socket);
    if (!connection) return;

    // Broadcast disconnect
    this.broadcastToGame(connection.gameId, {
      type: 'player_disconnected',
      payload: { userId: connection.userId }
    }, socket);

    // End game if in progress
    const game = this.games.get(connection.gameId);
    if (game && game.getStatus() === 'playing') {
      this.endGame(connection.gameId, 'Player disconnected');
    }

    // Remove connection
    this.connections.delete(socket);
  }

  /**
   * Start broadcasting game state (60Hz)
   */
  private startGameStateBroadcast(gameId: string): void {
    const game = this.games.get(gameId);
    if (!game) return;

    const interval = setInterval(() => {
      if (game.getStatus() !== 'playing') {
        clearInterval(interval);

        // Check if game ended
        if (game.getStatus() === 'finished') {
          this.handleGameEnd(gameId);
        }
        return;
      }

      // Broadcast game state
      const state = game.getStatePayload();
      this.broadcastToGame(gameId, {
        type: 'game_state',
        payload: state
      });
    }, 1000 / 60); // 60Hz
  }

  /**
   * Handle game end
   */
  private handleGameEnd(gameId: string): void {
    const game = this.games.get(gameId);
    if (!game) return;

    const duration = game.getDuration();
    const winnerId = game.getWinnerId();
    const score = game.getScore();

    // Save to database
    if (game.getMode() === 'multiplayer') {
      this.db.completeGame(
        gameId,
        score.left,
        score.right,
        winnerId || null,
        duration
      );
    }

    // Broadcast game ended
    this.broadcastToGame(gameId, {
      type: 'game_ended',
      payload: {
        winnerId,
        finalScore: score,
        duration
      }
    });

    // Cleanup after delay
    setTimeout(() => {
      this.deleteGame(gameId);
    }, 5000);
  }

  /**
   * End game manually
   */
  private endGame(gameId: string, reason: string): void {
    const game = this.games.get(gameId);
    if (!game) return;

    this.broadcastToGame(gameId, {
      type: 'game_ended',
      payload: { reason }
    });

    this.deleteGame(gameId);
  }

  /**
   * Send message to socket
   */
  private send(socket: WebSocket, message: GameMessage): void {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  /**
   * Send error message
   */
  private sendError(socket: WebSocket, message: string): void {
    this.send(socket, {
      type: 'error',
      payload: { message }
    });
  }

  /**
   * Broadcast message to all players in game
   */
  private broadcastToGame(gameId: string, message: GameMessage, exclude?: WebSocket): void {
    this.connections.forEach((connection, socket) => {
      if (connection.gameId === gameId && socket !== exclude) {
        this.send(socket, message);
      }
    });
  }

  /**
   * Get active games count
   */
  getActiveGamesCount(): number {
    return this.games.size;
  }

  /**
   * Get all active game IDs
   */
  getActiveGameIds(): string[] {
    return Array.from(this.games.keys());
  }
}
