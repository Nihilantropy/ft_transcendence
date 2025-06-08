/**
 * @brief Router-specific type definitions for ft_transcendence
 * 
 * @description TypeScript interfaces for SPA routing system using History API.
 * Phase B1 implementation - Router class foundation types.
 * 
 * FILE: src/types/router.types.ts (NEW FILE)
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
}

/**
 * @brief Internal route registration data
 * 
 * @description Internal structure used by Router for route management.
 * Not exposed in public API.
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
}

/**
 * @brief Route match result
 * 
 * @description Result of internal route matching operation.
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
}