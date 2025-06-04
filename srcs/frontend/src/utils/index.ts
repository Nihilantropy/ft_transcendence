/**
 * @brief Main utilities barrel export
 * 
 * @description Central export point for all utility functions and constants.
 * Provides clean imports for utilities throughout the application.
 */

// Re-export all utility categories
export * from './helpers'
export * from './validators'
export * from './formatters'
export * from './constants'

// This allows imports like:
// import { debounce, isValidEmail, formatDate } from '@/utils'
// import { ROUTES, GAME_CONFIG } from '@/utils'