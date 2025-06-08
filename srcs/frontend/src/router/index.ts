/**
 * @brief Main router barrel export with Route Guards support
 * 
 * @description Central export point for routing system including guards.
 * Phase B1.4 implementation - Complete router with guard system.
 * 
 * FILE: src/router/index.ts (UPDATES EXISTING)
 */

// Export Router class and singleton instance
export { Router, router } from './router'

// Export all guard classes and instances
export {
  AuthGuard,
  GuestGuard,
  GameSessionGuard,
  AdminGuard,
  authGuard,
  guestGuard,
  gameSessionGuard,
  adminGuard,
  createAuthGuard,
  createGuestGuard,
  createGameSessionGuard,
  createAdminGuard,
  requireAuth,
  guestOnly,
  requireGameSession,
  requireAdmin
} from './guards'

// Export router types for external use
export type {
  RouteHandler,
  RouteGuard,
  GuardResult,
  RouteConfig,
  RouteRegistrationOptions,
  NavigationOptions,
  RouteChangeEvent,
  RouteChangeListener,
  RouterOptions,
  RouteRegistration,
  RouteMatch,
  NavigationContext
} from '../types/router.types'

// Route definitions (still placeholders for future phases)
export * from './routes'

// This allows imports like:
// import { Router, router, authGuard, requireAuth } from '@/router'
// import type { RouteHandler, RouteGuard } from '@/router'