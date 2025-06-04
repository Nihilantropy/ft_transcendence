/**
 * @brief User-related type definitions
 * 
 * @description Types for user profiles, authentication, and social features.
 * Integrates with User Management Service types.
 */

// User Profile Types (to be implemented when User Management Service is ready)
// export interface User {
//   id: string
//   username: string
//   email: string
//   displayName: string
//   avatar?: string
//   isOnline: boolean
//   lastSeen: Date
//   createdAt: Date
//   preferences: UserPreferences
// }

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

// User Statistics Types (to be implemented later)
// export interface UserStats {
//   totalGames: number
//   wins: number
//   losses: number
//   winRate: number
//   currentStreak: number
//   bestStreak: number
//   rank: number
//   points: number
// }

// export interface MatchHistory {
//   id: string
//   opponent: User
//   result: 'win' | 'loss'
//   score: { user: number, opponent: number }
//   duration: number
//   playedAt: Date
//   gameMode: string
// }

// Placeholder for development
export const USER_TYPES_PLACEHOLDER = 'User types will be implemented when User Management Service is ready'