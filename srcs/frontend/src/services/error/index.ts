/**
 * @brief Error handling services barrel export
 * 
 * @description Exports the simplified error handling system with catchErrorTyped.
 */

export { catchErrorTyped } from './catchError'
export { CustomError } from './CustomErrors'

// WebSocket-specific error handling (for real-time game features)
export { 
  WebSocketConnectionError,
  GameRoomError,
  GameStateError,
  PlayerActionError,
  RoomManagementError,
  WebSocketErrorHandler,
  webSocketErrorHandler,
  WebSocketErrorUtils,
  GAME_ERROR_TYPES
} from './WebsocketErrorHandler'

export type { GameErrorContext } from './WebsocketErrorHandler'
