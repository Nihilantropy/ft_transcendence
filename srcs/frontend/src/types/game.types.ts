/**
 * @file Game type definitions for ft_transcendence
 * @description Type definitions for game system, sessions, and gameplay
 */

/**
 * @brief Score interface
 */
export interface Score {
  player1: number
  player2: number
  maxScore?: number
}

/**
 * @brief Game types
 */
export type GameType = 'classic' | 'tournament' | 'ai'

/**
 * @brief Game status
 */
export type GameStatus = 'waiting' | 'ready' | 'playing' | 'paused' | 'finished' | 'cancelled'

/**
 * @brief Player data in game
 */
export interface GamePlayer {
  id: number
  username: string
  avatar?: string
  ready: boolean
  score?: number
  paddlePosition?: number
}

/**
 * @brief Game settings
 */
export interface GameSettings {
  ballSpeed: number
  paddleSpeed: number
  maxScore?: number
  enablePowerups?: boolean
  powerUpsEnabled?: boolean // Alias for compatibility
  difficulty?: string
}

/**
 * @brief Ball state
 */
export interface BallState {
  x: number
  y: number
  velocityX: number
  velocityY: number
  radius?: number
}

/**
 * @brief Paddle state
 */
export interface PaddleState {
  y: number
  height?: number
  width?: number
}

/**
 * @brief Game state
 */
export interface GameState {
  ball: BallState
  paddle1: PaddleState
  paddle2: PaddleState
  score: {
    player1: number
    player2: number
  }
  timestamp: number
}

/**
 * @brief Game session
 */
export interface GameSession {
  id: string
  type: GameType
  status: GameStatus
  players: GamePlayer[]
  settings: GameSettings
  state?: GameState
  score?: Score // Current score
  winnerId?: number
  createdAt: Date | string
  startedAt?: Date | string
  finishedAt?: Date | string
}

/**
 * @brief Tournament data
 */
export interface Tournament {
  id: string
  name: string
  status: 'registration' | 'in-progress' | 'finished'
  participants: GamePlayer[]
  currentRound: number
  totalRounds: number
  matches: GameSession[]
  winnerId?: number
  createdAt: Date | string
}

/**
 * @brief Match result
 */
export interface MatchResult {
  gameId: string
  winnerId: number
  loserId: number
  score: {
    winner: number
    loser: number
  }
  duration: number
  finishedAt: Date | string
}
