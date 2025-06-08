/**
 * @brief Router-specific type definitions for ft_transcendence (UPDATED with Guards)
 * 
 * @description TypeScript interfaces for SPA routing system using History API.
 * Phase B1.4 implementation - Adding route guard support to existing router foundation.
 * 
 * FILE: src/types/router.types.ts (REPLACES EXISTING FILE)
 */

/**
 * @brief Route handler function signature
 * 
 * @param params - URL parameters extracted from route pattern
 * @param query - Query string parameters
 * @return Promise or void for async/sync route handling
 * 
 * @description Function called when route is matched and navigated to.
 */
export interface RouteHandler {
  (params: Record<string, string>, query: Record<string, string>): Promise<void> | void
}

/**
 * @brief Route guard interface for access control
 * 
 * @description Defines contract for route protection logic.
 * Guards can be synchronous or asynchronous.
 */
export interface RouteGuard {
  /**
   * @brief Check if navigation to route is allowed
   * 
   * @param route - Route configuration being accessed
   * @param path - Current path being navigated to
   * @return Boolean or Promise<boolean> indicating if access is allowed
   */
  canActivate(route: RouteConfig, path: string): boolean | Promise<boolean>
  
  /** Optional redirect path when access is denied */
  redirect?: string
}

/**
 * @brief Result of guard execution
 * 
 * @description Contains the result of guard checks and optional redirect information.
 */
export interface GuardResult {
  /** Whether navigation is allowed */
  allowed: boolean
  
  /** Optional redirect path if navigation is denied */
  redirect?: string
  
  /** Guard that denied access (for debugging) */
  deniedBy?: RouteGuard
}

/**
 * @brief Route configuration interface
 * 
 * @description Extended route configuration with guard support.
 */
export interface RouteConfig {
  /** Route URL pattern */
  path: string
  
  /** Route handler function */
  handler: RouteHandler
  
  /** Optional route guards for access control */
  guards?: RouteGuard[]
  
  /** Shorthand for authentication requirement */
  requiresAuth?: boolean
  
  /** Additional route metadata */
  meta?: Record<string, any>
  
  /** Human-readable route title */
  title?: string
}

/**
 * @brief Route registration options
 * 
 * @description Options for registering routes with guard support.
 */
export interface RouteRegistrationOptions {
  /** Route guards to apply */
  guards?: RouteGuard[]
  
  /** Shorthand for authentication requirement */
  requiresAuth?: boolean
  
  /** Additional route metadata */
  meta?: Record<string, any>
  
  /** Human-readable route title */
  title?: string
}

/**
 * @brief Router navigation options
 * 
 * @description Options for programmatic navigation using router.navigate().
 */
export interface NavigationOptions {
  /** Replace current history entry instead of pushing new one */
  replace?: boolean
  
  /** State object to store with history entry */
  state?: any
  
  /** Whether to trigger route handlers (default: false) */
  silent?: boolean
  
  /** Skip guard execution for this navigation */
  skipGuards?: boolean
}

/**
 * @brief Route change event data
 * 
 * @description Event data passed to route change listeners.
 */
export interface RouteChangeEvent {
  /** Previous route path */
  from: string
  
  /** New route path */
  to: string
  
  /** URL parameters extracted from route pattern */
  params: Record<string, string>
  
  /** Query string parameters */
  query: Record<string, string>
  
  /** Type of navigation that triggered the change */
  type: 'push' | 'replace' | 'pop'
  
  /** Whether navigation was blocked by guards */
  blocked?: boolean
  
  /** Guard result if navigation was processed */
  guardResult?: GuardResult
}

/**
 * @brief Route change listener function
 * 
 * @param event - Route change event data
 * 
 * @description Function called when route changes occur.
 */
export type RouteChangeListener = (event: RouteChangeEvent) => void

/**
 * @brief Router initialization options
 * 
 * @description Configuration options for Router constructor.
 */
export interface RouterOptions {
  /** Base path for all routes (default: '') */
  basePath?: string
  
  /** Whether to handle initial route on startup (default: true) */
  handleInitialRoute?: boolean
  
  /** Default route to redirect to on 404 (default: '/404') */
  notFoundRoute?: string
  
  /** Global guards to apply to all routes */
  globalGuards?: RouteGuard[]
}

/**
 * @brief Internal route registration data (UPDATED)
 * 
 * @description Internal structure used by Router for route management.
 * Enhanced with guard support.
 */
export interface RouteRegistration {
  /** Original route pattern string */
  pattern: string
  
  /** Route handler function */
  handler: RouteHandler
  
  /** Compiled route matcher regex */
  matcher: RegExp
  
  /** Parameter names extracted from pattern */
  paramNames: string[]
  
  /** Route guards for access control */
  guards: RouteGuard[]
  
  /** Route metadata */
  meta: Record<string, any>
  
  /** Route title */
  title?: string
}

/**
 * @brief Route match result (UPDATED)
 * 
 * @description Result of internal route matching operation.
 * Enhanced with guard support.
 */
export interface RouteMatch {
  /** Whether a route was successfully matched */
  matched: boolean
  
  /** The route registration that matched (if any) */
  route?: RouteRegistration
  
  /** Extracted URL parameters */
  params: Record<string, string>
  
  /** Query string parameters */
  query: Record<string, string>
  
  /** Route configuration for guard execution */
  routeConfig?: RouteConfig
}

/**
 * @brief Navigation context for guards
 * 
 * @description Provides context information to guards during navigation.
 */
export interface NavigationContext {
  /** Source route path */
  from: string
  
  /** Target route path */
  to: string
  
  /** Route configuration being navigated to */
  route: RouteConfig
  
  /** URL parameters */
  params: Record<string, string>
  
  /** Query parameters */
  query: Record<string, string>
  
  /** Navigation type */
  type: 'push' | 'replace' | 'pop'
}