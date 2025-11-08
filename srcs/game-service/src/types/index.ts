/**
 * @file Type definitions for Game Service
 * @description Centralized TypeScript types for Pong game logic
 */

import { FastifyRequest } from 'fastify';
import { Database } from 'better-sqlite3';

// ========== Fastify Module Augmentation ==========

declare module 'fastify' {
  interface FastifyInstance {
    db: Database;
  }
}

// ========== JWT & Auth Types ==========

export interface JWTPayload {
  id: number;
  username: string;
  email: string;
}

export interface AuthenticatedRequest extends FastifyRequest {
  user: JWTPayload;
}

// ========== Game Mode Types ==========

export type GameMode = 'local' | 'multiplayer' | 'ai' | 'tournament';
export type GameStatus = 'waiting' | 'ready' | 'playing' | 'paused' | 'finished' | 'cancelled';
export type PlayerSide = 'left' | 'right';

// ========== Game Configuration ==========

export interface GameConfig {
  canvasWidth: number;
  canvasHeight: number;
  paddleWidth: number;
  paddleHeight: number;
  ballSize: number;
  paddleSpeed: number;
  maxBallSpeed: number;
  scoreToWin: number;
  tickRate: number;  // Server ticks per second (60)
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  canvasWidth: 800,
  canvasHeight: 600,
  paddleWidth: 10,
  paddleHeight: 100,
  ballSize: 10,
  paddleSpeed: 5,
  maxBallSpeed: 8,
  scoreToWin: 5,
  tickRate: 60
};

// ========== Position & Vector Types ==========

export interface Vector2D {
  x: number;
  y: number;
}

export interface Velocity extends Vector2D {
  // Velocity in pixels per tick
}

// ========== Game Entity Types ==========

export interface Paddle {
  side: PlayerSide;
  y: number;  // Y position (x is fixed per side)
  height: number;
  width: number;
  velocity: number;  // -1 (up), 0 (stopped), 1 (down)
}

export interface Ball {
  position: Vector2D;
  velocity: Velocity;
  size: number;
  speed: number;  // Current speed magnitude
}

export interface Score {
  left: number;
  right: number;
}

// ========== Player Types ==========

export interface Player {
  id: number;
  username: string;
  side: PlayerSide;
  isReady: boolean;
  isConnected: boolean;
  lastInputTime?: number;
}

export interface AIPlayer extends Player {
  difficulty: 'easy' | 'medium' | 'hard';
  lastThinkTime: number;  // Last time AI computed (1-second constraint)
  targetY: number;  // Predicted ball Y position
}

// ========== Game State Types ==========

export interface GameState {
  id: string;
  mode: GameMode;
  status: GameStatus;
  config: GameConfig;

  // Players
  leftPlayer: Player | AIPlayer | null;
  rightPlayer: Player | AIPlayer | null;

  // Game entities
  ball: Ball;
  leftPaddle: Paddle;
  rightPaddle: Paddle;
  score: Score;

  // Timing
  startTime?: number;
  endTime?: number;
  lastTickTime: number;
  tickCount: number;

  // Winner
  winnerId?: number;
}

// ========== Input Types ==========

export type InputAction = 'up' | 'down' | 'stop';

export interface PlayerInput {
  playerId: number;
  action: InputAction;
  timestamp: number;
}

// ========== Match Making Types ==========

export interface MatchmakingQueue {
  userId: number;
  username: string;
  skillRating: number;  // ELO rating
  queueTime: number;
}

// ========== Tournament Types ==========

export type TournamentStatus = 'registering' | 'in_progress' | 'completed' | 'cancelled';

export interface Tournament {
  id: string;
  name: string;
  status: TournamentStatus;
  maxPlayers: number;  // Must be power of 2 (4, 8, 16, 32)
  participants: TournamentParticipant[];
  bracket: TournamentBracket;
  winnerId?: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface TournamentParticipant {
  userId?: number;  // Optional: null for anonymous participants
  username?: string;  // Optional: only present for authenticated users
  alias: string;  // Tournament alias (REQUIRED for all participants)
  sessionId?: string;  // Session ID for anonymous users
  seed: number;  // Bracket seeding position
  eliminated: boolean;
  participantType: 'authenticated' | 'anonymous';  // Participant type flag
}

export interface TournamentMatch {
  id: string;
  round: number;
  matchNumber: number;
  // Player 1 identification (either userId or participantId from tournament_participants table)
  player1Id?: number;  // userId for authenticated, or tournament_participants.id for any player
  player1Alias?: string;  // Display alias for player 1
  // Player 2 identification
  player2Id?: number;  // userId for authenticated, or tournament_participants.id for any player
  player2Alias?: string;  // Display alias for player 2
  // Winner identification
  winnerId?: number;  // tournament_participants.id of the winner
  winnerAlias?: string;  // Display alias for winner
  gameId?: string;  // Reference to actual game
  status: 'pending' | 'in_progress' | 'completed';
}

export interface TournamentBracket {
  rounds: number;  // Number of rounds (e.g., 8 players = 3 rounds)
  matches: TournamentMatch[];
}

// ========== Database Types ==========

export interface GameRecord {
  id: string;
  mode: GameMode;
  player1_id: number;
  player2_id?: number;
  player1_score: number;
  player2_score: number;
  winner_id?: number;
  duration: number;  // Duration in milliseconds
  created_at: string;
  completed_at?: string;
}

export interface GameStats {
  userId: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  averageScore: number;
  highestScore: number;
  totalPlayTime: number;  // In milliseconds
  skillRating: number;  // ELO rating
}

// ========== WebSocket Message Types ==========

export interface GameMessage {
  type: GameMessageType;
  payload: any;
}

export type GameMessageType =
  // Client -> Server
  | 'join_game'
  | 'ready'
  | 'input'
  | 'pause'
  | 'resume'
  | 'leave_game'

  // Server -> Client
  | 'game_created'
  | 'player_joined'
  | 'player_ready'
  | 'game_starting'
  | 'game_state'
  | 'game_paused'
  | 'game_resumed'
  | 'game_ended'
  | 'player_disconnected'
  | 'error';

// Message payloads
export interface JoinGamePayload {
  gameId: string;
  userId: number;
  username: string;
}

export interface InputPayload {
  action: InputAction;
  timestamp: number;
}

export interface GameStatePayload {
  ball: Ball;
  leftPaddle: Paddle;
  rightPaddle: Paddle;
  score: Score;
  tickCount: number;
}

export interface GameEndedPayload {
  winnerId: number;
  finalScore: Score;
  duration: number;
}

// ========== API Request/Response Types ==========

export interface CreateGameRequest {
  mode: GameMode;
  playerId?: number;
  opponentId?: number;  // For direct challenge
  aiDifficulty?: 'easy' | 'medium' | 'hard';
}

export interface CreateGameResponse {
  gameId: string;
  mode: GameMode;
  status: GameStatus;
  joinUrl: string;
}

export interface GetGameResponse {
  game: GameState;
}

export interface CreateTournamentRequest {
  name: string;
  maxPlayers: number;
}

export interface JoinTournamentRequest {
  tournamentId: string;
  userId?: number;  // Optional: only for authenticated users
  alias: string;  // Required: display name for tournament
  sessionId?: string;  // Optional: for tracking anonymous users
}

// ========== AI Types ==========

export interface AIDecision {
  action: InputAction;
  confidence: number;  // 0-1, how confident AI is
  targetY: number;  // Where AI thinks ball will be
}

export interface AIPrediction {
  ballY: number;  // Predicted ball Y at paddle X
  bounces: number;  // Number of wall bounces in prediction
  timeToReach: number;  // Milliseconds until ball reaches paddle
}
