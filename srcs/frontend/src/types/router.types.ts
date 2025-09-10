/**
 * @brief Simplified Router types for ft_transcendence
 * 
 * @description Basic routing system following roadmap requirements.
 * Removed complex guard system for simplicity.
 * 
 * FILE: src/types/router.types.ts (SIMPLIFIED)
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
 * @brief Route configuration interface
 * 
 * @description Simplified route configuration with basic auth requirement.
 */
export interface RouteConfig {
  /** Route URL pattern */
  path: string
  
  /** Route handler function */
  handler: RouteHandler
  
  /** Simple auth requirement (replaces complex guards) */
  requiresAuth?: boolean
  
  /** Redirect path if access denied */
  redirect?: string
  
  /** Route metadata */
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
  
  /** Additional state to pass with navigation */
  state?: any
}

/**
 * @brief Route change event data
 * 
 * @description Event data passed to route change listeners.
 */
export interface RouteChangeEvent {
  /** Previous route path */
  from: string | null
  
  /** New route path */
  to: string
  
  /** URL parameters extracted from route pattern */
  params: Record<string, string>
  
  /** Query string parameters */
  query: Record<string, string>
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
  
  /** Default route when no match found */
  fallbackRoute?: string
}