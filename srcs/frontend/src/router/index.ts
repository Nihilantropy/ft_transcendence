/**
 * @brief Simplified router barrel export
 * 
 * @description Central export point for simplified routing system.
 * Removed complex guard exports for roadmap compliance.
 * 
 * FILE: src/router/index.ts (SIMPLIFIED)
 */

// Export Router class and singleton instance
export { Router, router } from './router'

// Export router types and schemas
export type {
  RouteHandler,
  RouteConfig,
  NavigationOptions,
  RouteChangeEvent,
  RouteChangeListener,
  RouterOptions
} from './schemas/router.schemas'

export {
  RouteConfigSchema,
  NavigationOptionsSchema,
  RouteChangeEventSchema,
  RouterOptionsSchema,
  validateRouteConfig,
  validateNavigationOptions,
  validateRouterOptions,
  safeParseRouteConfig,
  safeParseNavigationOptions,
  safeParseRouterOptions
} from './schemas/router.schemas'

// Route configuration function
export { configureRoutes } from './routes'

// Usage examples:
// import { Router, router, configureRoutes } from '@/router'
// import type { RouteHandler, RouteConfig } from '@/router'
// import { RouteConfigSchema, validateRouteConfig } from '@/router'