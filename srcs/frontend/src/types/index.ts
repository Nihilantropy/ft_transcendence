/**
 * @brief Main types barrel export
 * 
 * @description Central export point for all TypeScript type definitions.
 * Provides clean imports for types throughout the application.
 */

// Re-export all type categories
export * from './global.types'
export * from './api.types'
export * from './game.types'
export * from './user.types'
export * from './router.types'

// This allows imports like:
// import { User, Game, ApiResponse } from '@/types'
// import { GameState, UserStats } from '@/types'