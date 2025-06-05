/**
 * @brief Main stores barrel export
 * 
 * @description Central export point for all state management stores.
 * Provides clean imports for state stores throughout the application.
 * 
 * Phase B2.1: BaseStore<T> implementation complete
 */

// Base Store Class - Phase B2.1 implementation
export { BaseStore } from './BaseStore'
export type { StateListener, UnsubscribeFunction } from './BaseStore'

// Concrete Store Implementations (to be implemented in Phase B2.2)
// export * from './app.store'
// export * from './auth.store'
// export * from './game.store'
// export * from './ui.store'

// This allows imports like:
// import { BaseStore, StateListener } from '@/stores'
// import { appStore, authStore } from '@/stores' (when implemented)