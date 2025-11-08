/**
 * @file Store state type definitions for ft_transcendence
 * @description Type definitions for store state management
 */

import type {
  GameSession,
  GameSettings
} from './game.types'

/**
 * @brief Application-wide state
 */
export interface AppState {
  isInitialized?: boolean
  initialized: boolean
  isLoading?: boolean
  loading: boolean
  error: string | null
  isOnline: boolean
  lastActivity?: Date | null
  debugMode: boolean
  theme: 'light' | 'dark'
  currentRoute: string
}

/**
 * @brief UI state (modals, notifications, etc.)
 */
export interface UIState {
  showNavigation?: boolean
  activeModal: string | null
  sidebarCollapsed?: boolean
  sidebarOpen: boolean
  isMobile: boolean
  breakpoint: string
  theme: 'light' | 'dark'
  notifications?: Array<{
    id: string
    message: string
    type: 'info' | 'success' | 'warning' | 'error'
    timestamp: Date
  }>
}

/**
 * @brief Authentication user data
 */
export interface AuthUser {
  id: number
  email: string
  username: string
  displayName?: string
  avatar?: string
  emailVerified: boolean
  twoFactorEnabled: boolean
  roles?: string[]
  createdAt: Date | string
}

/**
 * @brief Authentication state
 */
export interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading?: boolean
  loading: boolean
  error: string | null
  accessToken?: string | null
  token: string | null
  refreshToken?: string | null
  tokenExpiry?: Date | number | null
  expiresAt: Date | number | null
  lastAuthCheck?: Date | null
  isOAuthFlow?: boolean
}

/**
 * @brief Game state for store
 * @description Extended game state for client-side store management
 */
export interface GameState {
  currentSession?: GameSession | null
  currentGame: GameSession | null
  isSearching?: boolean
  isConnected?: boolean
  isPlaying: boolean
  status: string
  loading: boolean
  gameMode: string
  error: string | null
  localSettings?: GameSettings
  recentMatches?: GameSession[]
}

/**
 * @brief Game mode type
 */
export type GameMode = 'local' | 'online' | 'ai' | 'tournament'

/**
 * @brief Game score (re-exported for convenience)
 */
export interface GameScore {
  player1: number
  player2: number
  maxScore?: number
}

// Re-export game types for convenience (avoiding GameState conflict with game.types)
export type { GameSession, GameSettings }
export type { GamePlayer, GameStatus, GameType } from './game.types'
