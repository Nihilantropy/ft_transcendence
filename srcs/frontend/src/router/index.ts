/**
 * @brief Main router barrel export
 * 
 * @description Central export point for routing system.
 * Provides clean imports for router, routes, and guards.
 */

// Re-export all router components
export * from './router'
export * from './routes'
export * from './guards'

// This allows imports like:
// import { router, routes, authGuard } from '@/router'
// import { Router, RouteConfig } from '@/router'