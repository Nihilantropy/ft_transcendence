/**
 * @brief Main router barrel export
 * 
 * @description Central export point for routing system.
 * Provides clean imports for router, routes, and guards.
 * 
 * Phase B1 implementation - Router class complete.
 * 
 * FILE: src/router/index.ts (UPDATES EXISTING)
 */

// Export Router class and singleton instance
export { Router, router } from './router'

// Export router types for external use
export type {
  RouteHandler,
  NavigationOptions,
  RouteChangeEvent,
  RouteChangeListener,
  RouterOptions
} from '../types/router.types'

// Route definitions and guards (placeholders for future phases)
export * from './routes'
export * from './guards'

// This allows imports like:
// import { Router, router } from '@/router'
// import type { RouteHandler, NavigationOptions } from '@/router'