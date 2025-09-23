/**
 * @brief User-related type definitions
 * 
 * @description Types for user profiles, authentication, and social features.
 * Integrates with User Management Service types.
 */

import type { TwoFactorAuthStatus } from "./global.types"
import type { Friend, OnlineStatus, FriendRequest } from "./friends.types"

// User Profile Types
export interface UserProfile {
  id: string
  username: string
  email: string
  displayName?: string
  avatar?: string
  isOnline: boolean
  onlineStatus: OnlineStatus
  lastSeen?: Date
  createdAt?: Date
  stats: UserStats
  achievements: Achievement[]
  recentGames: GameHistory[]
  twoFactorAuth?: TwoFactorAuthStatus
  // Social features
  friends?: Friend[]
  friendRequests?: {
    incoming: FriendRequest[]
    outgoing: FriendRequest[]
  }
  friendsCount?: number
}

export interface TwoFactorSetupData {
  secret: string
  qrCodeUrl: string
  backupCodes: string[]
  manualEntryKey: string
}

export interface TwoFactorVerification {
  token: string
  backupCode?: string
}

// User Statistics Types
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

export interface GameHistory {
  id: string
  opponent: string
  result: 'win' | 'loss'
  score: string
  date: string
  duration?: number
  gameMode?: string
}

export interface Achievement {
  id: string
  name: string
  description: string
  earned: boolean
  dateEarned?: string
}

// Placeholder for development
export const USER_TYPES_PLACEHOLDER = 'User types will be implemented when User Management Service is ready'