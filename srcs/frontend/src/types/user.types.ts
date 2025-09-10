/**
 * @brief User-related type definitions
 * 
 * @description Types for user profiles, authentication, and social features.
 * Integrates with User Management Service types.
 */

// User Profile Types
export interface UserProfile {
  id: string
  username: string
  email: string
  displayName?: string
  avatar?: string
  isOnline: boolean
  lastSeen?: Date
  createdAt?: Date
  stats: UserStats
  achievements: Achievement[]
  recentGames: GameHistory[]
}

// export interface UserPreferences {
//   language: string
//   theme: 'dark' | 'light'
//   notifications: boolean
//   accessibility: AccessibilitySettings
// }

// export interface AccessibilitySettings {
//   highContrast: boolean
//   reducedMotion: boolean
//   screenReader: boolean
//   fontSize: 'small' | 'medium' | 'large'
// }

// Authentication Types (to be implemented when Auth Service is ready)
// export interface AuthUser extends User {
//   token: string
//   refreshToken: string
//   expiresAt: Date
//   permissions: Permission[]
// }

// export interface Permission {
//   action: string
//   resource: string
// }

// Social Features Types (to be implemented when User Management Service is ready)
// export interface Friend {
//   id: string
//   user: User
//   status: 'pending' | 'accepted' | 'blocked'
//   since: Date
// }

// export interface FriendRequest {
//   id: string
//   from: User
//   to: User
//   message?: string
//   createdAt: Date
// }

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