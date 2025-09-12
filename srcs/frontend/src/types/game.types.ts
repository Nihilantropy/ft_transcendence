/**
 * @brief Game-specific type definitions
 * 
 * @description Types for Pong game logic, state, and interactions.
 * Coordinates with server-side game engine types.
 */

// Game State Types (Active for current implementation)
export interface GameState {
  ball: BallState
  paddles: PaddleState
  score: Score
  settings: GameSettings
  status: GameStatus
  timer: number
  gameId?: string
}

export interface BallState {
  x: number
  y: number
  velocityX: number
  velocityY: number
  speed: number
  radius?: number
}

export interface PaddleState {
  player1: { y: number; speed: number; height?: number }
  player2: { y: number; speed: number; height?: number }
}

export interface Score {
  player1: number
  player2: number
  maxScore: number
}

// Game Configuration Types (Active for current implementation)
export interface GameSettings {
  ballSpeed: number
  paddleSpeed: number
  maxScore: number
  powerUpsEnabled: boolean
  customizations?: GameCustomizations
  difficulty?: 'easy' | 'medium' | 'hard'
}

export interface GameCustomizations {
  ballColor: string
  paddleColor: string
  fieldColor: string
  powerUps?: PowerUp[]
}

export interface PowerUp {
  id: string
  type: 'speed_boost' | 'size_change' | 'multi_ball'
  duration: number
  effect: Record<string, any>
}

// Game Event Types (Active for current implementation)
export type GameStatus = 'waiting' | 'starting' | 'playing' | 'paused' | 'finished'
export type GameMode = 'singleplayer' | 'multiplayer' | 'ai' | 'tournament'
export type InputAction = 'paddle_up' | 'paddle_down' | 'pause' | 'resume'

// Game Event Handlers (Active for current implementation)
export type GameEventHandler = (event: GameEvent) => void

export interface GameEvent {
  type: 'ball_update' | 'paddle_update' | 'score_update' | 'game_start' | 'game_end' | 'pause' | 'resume'
  data: any
  timestamp: number
  gameId?: string
}

// Game Controls
export interface GameControls {
  up: string
  down: string
  pause: string
}

// Game Statistics
export interface GameStats {
  duration: number
  ballHits: number
  paddleHits: number
  maxBallSpeed: number
  averageBallSpeed: number
}

// Game Result
export interface GameResult {
  gameId: string
  winner: string
  loser: string
  finalScore: Score
  duration: number
  gameMode: GameMode
  stats: GameStats
  createdAt: Date
}