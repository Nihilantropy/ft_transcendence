/**
 * @brief Main types barrel export
 * 
 * @description Central export point for all TypeScript type definitions.
 * Provides clean imports for types throughout the application.
 */

// Re-export core types
export * from './global.types'
export * from './api.types'
export * from './game.types'
export * from './user.types'
export * from './router.types'

// Re-export store types with explicit naming to avoid conflicts
export type {
  AuthState,
  AuthUser,
  GameState as StoreGameState,
  GameSession,
  GamePlayer,
  GameScore,
  GameSettings as StoreGameSettings,
  UIState,
  UINotification,
  AppState,
  ID,
  Timestamp,
  EventCallback
} from './store.types'

// Utility re-exports for convenience
export type { Theme, GameMode, GameStatus } from './global.types'
export type { ApiResponse, ApiError, HttpMethod, ResponseStatus } from './api.types'
export type { GameState, BallState, PaddleState, Score, GameEvent } from './game.types'
export type { UserProfile, UserStats, Achievement, GameHistory } from './user.types'
export type { RouteConfig, RouteHandler, NavigationOptions } from './router.types'

// This allows clean imports like:
// import { User, Game, ApiResponse } from '@/types'
// import { GameState, UserStats } from '@/types'
// import type { RouteHandler, GameEvent } from '@/types'