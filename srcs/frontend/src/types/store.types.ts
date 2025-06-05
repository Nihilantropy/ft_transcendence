/**
 * @brief State type definitions for ft_transcendence stores
 * 
 * @description TypeScript interfaces for all application state management.
 * These interfaces define the shape of state objects used in concrete stores.
 * 
 * Phase B2.2 implementation for app-specific state management.
 */

// Re-export existing types
export type { ID, Timestamp, EventCallback } from './global.types'

/**
 * @brief Authentication state interface
 * 
 * @description Manages user authentication status, tokens, and user profile.
 * Integrates with future backend authentication service.
 */
export interface AuthState {
  /** Whether user is currently authenticated */
  isAuthenticated: boolean
  
  /** Current user information (null if not authenticated) */
  user: AuthUser | null
  
  /** JWT access token (null if not authenticated) */
  token: string | null
  
  /** Token expiration timestamp (null if no token) */
  expiresAt: number | null
  
  /** Authentication loading state */
  loading: boolean
  
  /** Last authentication error */
  error: string | null
}

/**
 * @brief Authenticated user information
 * 
 * @description User profile data available after successful authentication.
 */
export interface AuthUser {
  /** Unique user identifier */
  id: string
  
  /** User's chosen username */
  username: string
  
  /** User's email address */
  email: string
  
  /** Display name for UI */
  displayName: string
  
  /** Profile avatar URL (optional) */
  avatar?: string
  
  /** Account creation timestamp */
  createdAt: Date
  
  /** Last seen timestamp */
  lastSeen: Date
}

/**
 * @brief Game session state interface
 * 
 * @description Manages current game state, players, and real-time game data.
 * Coordinates with server-side game engine.
 */
export interface GameState {
  /** Current active game session (null if no game) */
  currentGame: GameSession | null
  
  /** Current game mode */
  gameMode: GameMode
  
  /** Whether actively playing a game */
  isPlaying: boolean
  
  /** Current game status */
  status: GameStatus
  
  /** Game loading state */
  loading: boolean
  
  /** Last game error */
  error: string | null
}

/**
 * @brief Active game session data
 * 
 * @description Real-time game session information.
 */
export interface GameSession {
  /** Unique game session ID */
  id: string
  
  /** Game type */
  type: 'classic' | 'tournament' | 'ai'
  
  /** Players in the game */
  players: GamePlayer[]
  
  /** Current score */
  score: GameScore
  
  /** Game settings */
  settings: GameSettings
  
  /** Session start time */
  startedAt: Date
}

/**
 * @brief Game player information
 * 
 * @description Player data for active game sessions.
 */
export interface GamePlayer {
  /** Player ID */
  id: string
  
  /** Player username */
  username: string
  
  /** Player paddle position (0-100) */
  paddlePosition: number
  
  /** Whether player is ready */
  isReady: boolean
  
  /** Whether player is AI */
  isAI: boolean
}

/**
 * @brief Game score tracking
 * 
 * @description Current game score state.
 */
export interface GameScore {
  /** Player 1 score */
  player1: number
  
  /** Player 2 score */
  player2: number
  
  /** Maximum score to win */
  maxScore: number
}

/**
 * @brief Game settings
 * 
 * @description Configurable game parameters.
 */
export interface GameSettings {
  /** Ball speed multiplier */
  ballSpeed: number
  
  /** Paddle speed multiplier */
  paddleSpeed: number
  
  /** Whether power-ups are enabled */
  powerUpsEnabled: boolean
  
  /** Game difficulty (for AI) */
  difficulty: 'easy' | 'medium' | 'hard'
}

/**
 * @brief Game mode types
 */
export type GameMode = 'singleplayer' | 'multiplayer' | 'tournament' | 'ai'

/**
 * @brief Game status types
 */
export type GameStatus = 'idle' | 'waiting' | 'starting' | 'playing' | 'paused' | 'finished'

/**
 * @brief UI state interface
 * 
 * @description Manages user interface state, modals, and user preferences.
 */
export interface UIState {
  /** Whether running on mobile device */
  isMobile: boolean
  
  /** Current screen breakpoint */
  breakpoint: 'mobile' | 'tablet' | 'desktop'
  
  /** Whether sidebar is open */
  sidebarOpen: boolean
  
  /** Currently active modal (null if none) */
  activeModal: string | null
  
  /** Active notifications */
  notifications: UINotification[]
  
  /** User language preference */
  language: string
  
  /** User theme preference */
  theme: 'dark' | 'light'
  
  /** Accessibility settings */
  accessibility: AccessibilitySettings
}

/**
 * @brief UI notification data
 * 
 * @description In-app notification information.
 */
export interface UINotification {
  /** Unique notification ID */
  id: string
  
  /** Notification type */
  type: 'info' | 'success' | 'warning' | 'error'
  
  /** Notification title */
  title: string
  
  /** Notification message */
  message: string
  
  /** Whether notification auto-dismisses */
  autoDismiss: boolean
  
  /** Notification creation time */
  createdAt: Date
}

/**
 * @brief Accessibility settings
 * 
 * @description User accessibility preferences.
 */
export interface AccessibilitySettings {
  /** High contrast mode enabled */
  highContrast: boolean
  
  /** Reduced motion preference */
  reducedMotion: boolean
  
  /** Screen reader optimization */
  screenReader: boolean
  
  /** Font size preference */
  fontSize: 'small' | 'medium' | 'large'
}

/**
 * @brief Global application state interface
 * 
 * @description Top-level application state and cross-cutting concerns.
 */
export interface AppState {
  /** Application theme */
  theme: 'dark' | 'light'
  
  /** Global loading state */
  loading: boolean
  
  /** Global error state */
  error: string | null
  
  /** Network connectivity status */
  isOnline: boolean
  
  /** Current route path */
  currentRoute: string
  
  /** Application initialization status */
  initialized: boolean
  
  /** Debug mode enabled */
  debugMode: boolean
}