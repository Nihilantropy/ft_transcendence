/**
 * @brief Game-specific Error Handler for ft_transcendence
 * 
 * @description Provides specialized error handling for WebSocket game events and real-time game operations.
 * Uses the catchErrorTyped pattern for consistent error handling.
 */

import { catchErrorTyped } from './catchError'
import { CustomError } from './CustomErrors'

/**
 * @brief WebSocket and Game-specific error classes
 */
export class WebSocketConnectionError extends CustomError {
  constructor(message?: string) {
    super(message || 'WebSocket connection error', -2); // Custom negative codes for WebSocket errors
  }
}

export class GameRoomError extends CustomError {
  constructor(message?: string) {
    super(message || 'Game room error', -3);
  }
}

export class GameStateError extends CustomError {
  constructor(message?: string) {
    super(message || 'Game state error', -4);
  }
}

export class PlayerActionError extends CustomError {
  constructor(message?: string) {
    super(message || 'Player action error', -5);
  }
}

export class RoomManagementError extends CustomError {
  constructor(message?: string) {
    super(message || 'Room management error', -6);
  }
}

/**
 * @brief Game-specific error context
 */
export interface GameErrorContext {
  gameId?: string
  playerId?: string
  eventType?: string
  component?: string
  isRealTime?: boolean
  timestamp?: number
}

/**
 * @brief Game error categories
 */
export const GAME_ERROR_TYPES = {
  CONNECTION: 'game_connection',
  WEBSOCKET: 'game_websocket',
  GAME_STATE: 'game_state',
  PLAYER_ACTION: 'player_action',
  ROOM_MANAGEMENT: 'room_management',
  SYNCHRONIZATION: 'synchronization'
} as const

/**
 * @brief WebSocket Error Handler using catchErrorTyped pattern
 */
export class WebSocketErrorHandler {
  private static instance: WebSocketErrorHandler

  private constructor() {}

  /**
   * @brief Get singleton instance
   */
  public static getInstance(): WebSocketErrorHandler {
    if (!WebSocketErrorHandler.instance) {
      WebSocketErrorHandler.instance = new WebSocketErrorHandler()
    }
    return WebSocketErrorHandler.instance
  }

  /**
   * @brief Handle WebSocket operations with error catching
   */
  async executeWebSocketOperation<T>(
    operation: () => Promise<T>,
    context: GameErrorContext = {}
  ): Promise<{ success: boolean; data?: T; message?: string }> {
    const [error, data] = await catchErrorTyped(
      operation(),
      [WebSocketConnectionError, GameRoomError, GameStateError, PlayerActionError, RoomManagementError]
    );

    if (error) {
      const errorMessage = this.getGameErrorMessage(error, context);
      console.error(`🎮 WebSocket operation failed in ${context.component || 'WebSocketService'}:`, {
        error: error.message,
        code: error.code,
        context
      });

      return {
        success: false,
        message: errorMessage
      };
    }

    return {
      success: true,
      data
    };
  }

  /**
   * @brief Get user-friendly error message based on error type
   */
  private getGameErrorMessage(error: CustomError, context: GameErrorContext): string {
    const gameId = context.gameId ? ` (Game: ${context.gameId})` : '';

    if (error instanceof WebSocketConnectionError) {
      if (error.message.includes('not connected')) {
        return `🔌 Connection lost. Reconnecting for real-time gameplay...${gameId}`;
      }
      return `🎮 Real-time connection issue. Some features may be limited.${gameId}`;
    }

    if (error instanceof GameRoomError) {
      if (error.message.includes('join')) {
        return `🚪 Unable to join game. The room might be full or no longer available.${gameId}`;
      }
      if (error.message.includes('leave')) {
        return `🚪 Unable to leave game cleanly. You may need to refresh.${gameId}`;
      }
      return `🚪 Room error. Please try again or create a new game.${gameId}`;
    }

    if (error instanceof GameStateError) {
      return `📊 Game state sync issue. The game state may be temporarily inconsistent.${gameId}`;
    }

    if (error instanceof PlayerActionError) {
      if (error.message.includes('ready')) {
        return `✋ Unable to mark as ready. Please try again.${gameId}`;
      }
      if (error.message.includes('move')) {
        return `🏓 Move not registered. Check your connection.${gameId}`;
      }
      return `🎮 Action failed. Please try again.${gameId}`;
    }

    if (error instanceof RoomManagementError) {
      return `🚪 Room management error. Please try again or create a new game.${gameId}`;
    }

    // Default message for other CustomErrors
    return `🎮 Something went wrong. Please try again.${gameId}`;
  }

  /**
   * @brief Check if error requires game disconnection
   */
  public shouldDisconnectGame(error: CustomError): boolean {
    return error instanceof WebSocketConnectionError && error.message.includes('critical');
  }

  /**
   * @brief Check if error allows continuing the game
   */
  public canContinueGame(error: CustomError): boolean {
    return !(error instanceof WebSocketConnectionError) || 
           !error.message.includes('critical');
  }

  /**
   * @brief Create game context for error handling
   */
  public createGameContext(
    gameId?: string,
    playerId?: string,
    eventType?: string,
    component?: string
  ): GameErrorContext {
    return {
      gameId,
      playerId,
      eventType,
      component: component || 'GameSystem',
      isRealTime: true,
      timestamp: Date.now()
    };
  }
}

// Export singleton instance
export const webSocketErrorHandler = WebSocketErrorHandler.getInstance();

/**
 * @brief Utility functions for common game error scenarios using catchErrorTyped
 */
export const WebSocketErrorUtils = {
  /**
   * @brief Handle WebSocket game connection
   */
  async connectToGame(
    connectOperation: () => Promise<any>,
    gameId?: string
  ): Promise<{ success: boolean; data?: any; message?: string }> {
    const context = webSocketErrorHandler.createGameContext(
      gameId,
      undefined,
      'connect',
      'WebSocketGameService'
    );

    return webSocketErrorHandler.executeWebSocketOperation(connectOperation, context);
  },

  /**
   * @brief Handle player actions
   */
  async executePlayerAction<T>(
    action: () => Promise<T>,
    playerId?: string,
    gameId?: string,
    actionType?: string
  ): Promise<{ success: boolean; data?: T; message?: string }> {
    const context = webSocketErrorHandler.createGameContext(
      gameId,
      playerId,
      actionType,
      'PlayerActionService'
    );

    return webSocketErrorHandler.executeWebSocketOperation(action, context);
  },

  /**
   * @brief Handle room operations
   */
  async executeRoomOperation<T>(
    roomOperation: () => Promise<T>,
    gameId?: string,
    operationType?: string
  ): Promise<{ success: boolean; data?: T; message?: string }> {
    const context = webSocketErrorHandler.createGameContext(
      gameId,
      undefined,
      operationType,
      'RoomManagementService'
    );

    return webSocketErrorHandler.executeWebSocketOperation(roomOperation, context);
  },

  /**
   * @brief Handle game state operations
   */
  async executeGameStateOperation<T>(
    stateOperation: () => Promise<T>,
    gameId?: string
  ): Promise<{ success: boolean; data?: T; message?: string }> {
    const context = webSocketErrorHandler.createGameContext(
      gameId,
      undefined,
      'state_sync',
      'GameStore'
    );

    return webSocketErrorHandler.executeWebSocketOperation(stateOperation, context);
  },

  /**
   * @brief Create specific WebSocket errors based on error type
   */
  createWebSocketError: (message: string, type: 'connection' | 'room' | 'state' | 'action' | 'management'): CustomError => {
    switch (type) {
      case 'connection':
        return new WebSocketConnectionError(message);
      case 'room':
        return new GameRoomError(message);
      case 'state':
        return new GameStateError(message);
      case 'action':
        return new PlayerActionError(message);
      case 'management':
        return new RoomManagementError(message);
      default:
        return new CustomError(message, -1);
    }
  }
};