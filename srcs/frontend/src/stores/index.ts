/**
 * @brief Main stores barrel export
 * 
 * @description Central export point for all state management stores.
 * Provides clean imports for state stores throughout the application.
 * 
 * Phase B2.2: Complete store implementations ready for use
 */

// Base Store Class - Phase B2.1 implementation
export { BaseStore } from './BaseStore'
export type { StateListener, UnsubscribeFunction } from './BaseStore'

// Concrete Store Implementations - Phase B2.2 implementation
export { AuthStore, authStore } from './auth.store'
export { GameStore, gameStore } from './game.store'
export { UIStore, uiStore } from './ui.store'
export { AppStore, appStore } from './app.store'
export { FriendsStore, friendsStore } from './friends.store'

// Store State Types
export type {
  AuthState,
  AuthUser,
  GameState,
  GameSession,
  GamePlayer,
  GameScore,
  GameSettings,
  GameMode,
  GameStatus,
  UIState,
  AppState
} from '../types/store.types'

// This allows imports like:
// import { BaseStore, authStore, gameStore } from '@/stores'
// import { AuthState, GameState } from '@/stores'
// import { runStoreTests } from '@/stores'