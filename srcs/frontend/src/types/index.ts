/**
 * @brief Core TypeScript interfaces for ft_transcendence
 * 
 * @description Type definitions for game, user, and API structures
 */

export interface Player {
  id: number;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  isOnline: boolean;
}

export interface GameState {
  id: number;
  player1: Player;
  player2: Player;
  ball: Ball;
  paddles: Paddle[];
  score: Score;
  status: 'waiting' | 'playing' | 'paused' | 'finished';
  startTime?: Date;
  endTime?: Date;
}

export interface Ball {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  radius: number;
}

export interface Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
  velocityY: number;
  playerId: number;
}

export interface Score {
  player1: number;
  player2: number;
  maxScore: number;
}

export interface Tournament {
  id: number;
  name: string;
  status: 'pending' | 'active' | 'finished';
  participants: TournamentParticipant[];
  maxPlayers: number;
  createdAt: Date;
}

export interface TournamentParticipant {
  id: number;
  playerId?: number;
  alias: string;
  position?: number;
  eliminated: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface WebSocketMessage {
  type: 'game_update' | 'player_move' | 'game_start' | 'game_end' | 'error';
  data: any;
  timestamp: number;
}

export type Route = '/' | '/game' | '/tournament' | '/profile';

export interface GameConfig {
  canvasWidth: number;
  canvasHeight: number;
  paddleWidth: number;
  paddleHeight: number;
  paddleSpeed: number;
  ballRadius: number;
  ballSpeed: number;
  maxScore: number;
}