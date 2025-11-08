/**
 * @file Main types export for ft_transcendence frontend
 * @description Central export point for all type definitions
 */

// Friends types
export * from './friends.types'

// Game types
export * from './game.types'

// Notification types
export * from './notification.types'

// Store types (explicit exports to avoid GameState conflict)
export type {
  AppState,
  UIState,
  AuthState,
  AuthUser,
  GameMode,
  GameScore
} from './store.types'

// Add other type exports here as needed
