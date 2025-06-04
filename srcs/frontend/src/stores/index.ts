/**
 * @brief Main stores barrel export
 * 
 * @description Central export point for all state management stores.
 * Provides clean imports for state stores throughout the application.
 */

// Re-export all stores
export * from './app.store'
export * from './auth.store'
export * from './game.store'
export * from './ui.store'

// Base Store Class (to be implemented in Phase B2)
// export { BaseStore } from './BaseStore'

// This allows imports like:
// import { appStore, authStore } from '@/stores'
// import { gameStore, uiStore } from '@/stores'