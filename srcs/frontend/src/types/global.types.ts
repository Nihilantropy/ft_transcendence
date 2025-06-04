/**
 * @brief Global TypeScript type definitions
 * 
 * @description Core types used throughout the application.
 * Defines fundamental interfaces for User, Game, Tournament, etc.
 */

// Core User Types (to be implemented in Phase B2)
// export interface User {
//   id: string
//   username: string
//   email: string
//   avatar?: string
//   isOnline: boolean
//   createdAt: Date
//   stats: UserStats
// }

// export interface UserStats {
//   wins: number
//   losses: number
//   winRate: number
//   totalGames: number
//   rank: number
// }

// Core Game Types (to be implemented in Phase G1)
// export interface Game {
//   id: string
//   type: 'classic' | 'tournament' | 'ai'
//   status: 'waiting' | 'playing' | 'finished'
//   players: Player[]
//   settings: GameSettings
//   createdAt: Date
// }

// export interface Player {
//   id: string
//   user: User
//   paddlePosition: number
//   score: number
//   isReady: boolean
// }

// Core Tournament Types (to be implemented later)
// export interface Tournament {
//   id: string
//   name: string
//   status: 'registration' | 'active' | 'finished'
//   participants: User[]
//   bracket: TournamentBracket
//   startDate: Date
// }

// Utility Types
export type ID = string
export type Timestamp = number
export type EventCallback<T = any> = (data: T) => void

// Placeholder for development
export const GLOBAL_TYPES_PLACEHOLDER = 'Global types will be implemented in Phase B2'