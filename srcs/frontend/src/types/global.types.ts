/**
 * @brief Global TypeScript type definitions
 * 
 * @description Core types used throughout the application.
 * Defines fundamental interfaces for User, Game, Tournament, etc.
 */

// Utility Types - Already active
export type ID = string
export type Timestamp = number
export type EventCallback<T = any> = (data: T) => void

// Base User Types (Active for current implementation)
export interface User {
  id: string
  username: string
  email: string
  displayName?: string
  avatar?: string
  isOnline: boolean
  createdAt: Date
  lastSeen?: Date
  twoFactorAuth?: TwoFactorAuthStatus
}

// Two-Factor Authentication Types
export interface TwoFactorAuthStatus {
  enabled: boolean
  setupComplete: boolean
  backupCodesGenerated: boolean
  lastUsed?: Date
}

export interface UserStats {
  gamesPlayed: number
  gamesWon: number
  gamesLost: number
  winRate: number
  ranking: number
  totalScore: number
  currentStreak?: number
  bestStreak?: number
}

// Core Game Types (Basic implementation for current phase)
export interface Game {
  id: string
  type: 'classic' | 'tournament' | 'ai'
  status: 'waiting' | 'playing' | 'finished'
  players: Player[]
  createdAt: Date
  finishedAt?: Date
}

export interface Player {
  id: string
  username: string
  paddlePosition: number
  score: number
  isReady: boolean
  isAI?: boolean
}

// Tournament Types (Future implementation)
export interface Tournament {
  id: string
  name: string
  status: 'registration' | 'active' | 'finished'
  participants: User[]
  maxParticipants: number
  startDate: Date
  endDate?: Date
}

// Additional utility types
export type Theme = 'dark' | 'light'
export type GameMode = 'singleplayer' | 'tournament' | 'ai'
export type GameStatus = 'idle' | 'waiting' | 'starting' | 'playing' | 'paused' | 'finished'