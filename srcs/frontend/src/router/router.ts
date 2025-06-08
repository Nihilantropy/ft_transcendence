/**
 * @brief Main SPA router implementation using History API
 * 
 * @description Browser History API-based router for single page application.
 * Handles navigation without external dependencies.
 * 
 * Phase B1 implementation - Complete Router class functionality.
 * 
 * FILE: src/router/router.ts (REPLACES EXISTING PLACEHOLDER)
 */

import type {
  RouteHandler,
  NavigationOptions,
  RouteChangeEvent,
  RouteChangeListener,
  RouterOptions,
  RouteRegistration,
  RouteMatch
} from '../types/router.types'

/**
 * @brief Main Router class for SPA navigation
 * 
 * @description Implements client-side routing using Browser History API.
 * Provides route registration, navigation, parameter extraction, and browser integration.
 */
export class Router {
  /** Map of registered routes: pattern -> registration data */
  private routes: Map<string, RouteRegistration> = new Map()
  
  /** Current active route path */
  private currentRoute: string = '/'
  
  /** Set of route change event listeners */
  private listeners: Set<RouteChangeListener> = new Set()
  
  /** Router configuration options */
  private options: RouterOptions
  
  /** Whether router has been initialized */
  private initialized: boolean = false
  
  /** Base path prefix for all routes */
  private basePath: string

  /**
   * @brief Initialize router with configuration options
   * 
   * @param options - Router configuration options
   * 
   * @description Creates router instance with specified configuration.
   * Must call init() before router can handle navigation.
   */
  constructor(options: RouterOptions = {}) {
    this.options = {
      basePath: '',
      handleInitialRoute: true,
      notFoundRoute: '/404',
      ...options
    }
    
    this.basePath = this.options.basePath || ''
    this.currentRoute = this.getCurrentPath()
    
    console.log('🧭 Router created with options:', this.options)
  }

  /**
   * @brief Initialize router and start listening for navigation
   * 
   * @description Sets up History API event listeners and handles initial route.
   * Must be called before router can handle navigation events.
   */
  init(): void {
    if (this.initialized) {
      console.warn('Router already initialized')
      return
    }

    // Set up browser navigation event listeners
    this.setupEventListeners()
    
    // Handle initial route if configured to do so
    if (this.options.handleInitialRoute) {
      this.handleRoute(this.getCurrentPath(), 'push', true)
    }
    
    this.initialized = true
    console.log('✅ Router initialized and listening for navigation')
  }

  /**
   * @brief Register a route handler
   * 
   * @param pattern - Route pattern (e.g., '/game/:id', '/profile')
   * @param handler - Route handler function to call when matched
   * 
   * @description Registers route pattern with handler function.
   * Supports dynamic parameters using :param syntax.
   */
  addRoute(pattern: string, handler: RouteHandler): void {
    // Normalize the route pattern
    const normalizedPattern = this.normalizePath(pattern)
    
    // Compile pattern to regex and extract parameter names
    const { matcher, paramNames } = this.compilePattern(normalizedPattern)
    
    // Create route registration
    const registration: RouteRegistration = {
      pattern: normalizedPattern,
      handler,
      matcher,
      paramNames
    }
    
    // Store registration
    this.routes.set(normalizedPattern, registration)
    
    console.log(`🗺️  Route registered: ${normalizedPattern}`, {
      paramNames: paramNames.length > 0 ? paramNames : 'none'
    })
  }

  /**
   * @brief Navigate to a new route
   * 
   * @param path - Target route path
   * @param options - Navigation options
   * 
   * @description Navigates to specified path using History API.
   * Updates browser history and triggers route handlers.
   */
  navigate(path: string, options: NavigationOptions = {}): void {
    if (!this.initialized) {
      console.error('Router not initialized. Call router.init() first.')
      return
    }

    const normalizedPath = this.normalizePath(path)
    const fullPath = this.basePath + normalizedPath
    
    // Skip navigation if already on same route (unless replacing)
    if (normalizedPath === this.currentRoute && !options.replace) {
      console.log(`🧭 Already on route: ${normalizedPath}`)
      return
    }

    const previousRoute = this.currentRoute
    
    try {
      // Update browser history using History API
      if (options.replace) {
        window.history.replaceState(options.state || null, '', fullPath)
      } else {
        window.history.pushState(options.state || null, '', fullPath)
      }
      
      // Handle route change unless silent
      if (!options.silent) {
        this.handleRoute(normalizedPath, options.replace ? 'replace' : 'push')
      } else {
        // Update current route silently
        this.currentRoute = normalizedPath
      }
      
      console.log(`🧭 Navigated ${options.replace ? '(replace)' : '(push)'}: ${previousRoute} → ${normalizedPath}`)
      
    } catch (error) {
      console.error('Navigation failed:', error)
      this.handleNavigationError(error as Error, normalizedPath)
    }
  }

  /**
   * @brief Go back in browser history
   * 
   * @description Triggers browser back navigation.
   * Route change will be handled by popstate event listener.
   */
  back(): void {
    if (!this.initialized) {
      console.error('Router not initialized')
      return
    }
    
    console.log('🔙 Browser back navigation')
    window.history.back()
  }

  /**
   * @brief Go forward in browser history
   * 
   * @description Triggers browser forward navigation.
   * Route change will be handled by popstate event listener.
   */
  forward(): void {
    if (!this.initialized) {
      console.error('Router not initialized')
      return
    }
    
    console.log('🔜 Browser forward navigation')
    window.history.forward()
  }

  /**
   * @brief Add route change listener
   * 
   * @param listener - Route change callback function
   * @return Unsubscribe function to remove the listener
   * 
   * @description Registers listener for route change events.
   * Returns function to remove the listener and prevent memory leaks.
   */
  onRouteChange(listener: RouteChangeListener): () => void {
    this.listeners.add(listener)
    
    console.log(`📡 Route change listener added (total: ${this.listeners.size})`)
    
    // Return unsubscribe function
    return () => {
      const removed = this.listeners.delete(listener)
      if (removed) {
        console.log(`📡 Route change listener removed (total: ${this.listeners.size})`)
      }
      return removed
    }
  }

  /**
   * @brief Get current active route path
   * 
   * @return Current route path string
   * 
   * @description Returns the currently active route path.
   */
  getCurrentRoute(): string {
    return this.currentRoute
  }

  /**
   * @brief Get route parameters for current route
   * 
   * @return URL parameters object
   * 
   * @description Extracts and returns parameters from current route.
   */
  getCurrentParams(): Record<string, string> {
    const match = this.matchRoute(this.currentRoute)
    return match.params
  }

  /**
   * @brief Get query parameters from current URL
   * 
   * @return Query parameters object
   * 
   * @description Parses and returns query string parameters from current URL.
   */
  getCurrentQuery(): Record<string, string> {
    return this.parseQuery(window.location.search)
  }

  /**
   * @brief Cleanup router resources
   * 
   * @description Removes event listeners and cleans up router.
   * Should be called when router is no longer needed.
   */
  destroy(): void {
    if (!this.initialized) {
      return
    }

    // Remove browser event listeners
    window.removeEventListener('popstate', this.onPopState)
    
    // Clear all listeners and routes
    this.listeners.clear()
    this.routes.clear()
    
    this.initialized = false
    console.log('🧭 Router destroyed and cleaned up')
  }

  /**
   * @brief Handle browser back/forward navigation
   * 
   * @param event - PopState event from browser
   * 
   * @description Handles browser navigation events (back/forward buttons).
   * Updates current route and triggers route handlers.
   */
  private onPopState = (event: PopStateEvent): void => {
    const newPath = this.getCurrentPath()
    console.log('🔄 PopState event:', { 
      from: this.currentRoute, 
      to: newPath, 
      state: event.state 
    })
    
    // Handle the route change as a 'pop' navigation
    this.handleRoute(newPath, 'pop')
  }

  /**
   * @brief Set up browser event listeners
   * 
   * @description Configures popstate listener for browser navigation events.
   */
  private setupEventListeners(): void {
    window.addEventListener('popstate', this.onPopState)
    console.log('👂 Browser navigation listeners setup')
  }

  /**
   * @brief Handle route change and execute handlers
   * 
   * @param path - New route path
   * @param type - Type of navigation that occurred
   * @param isInitial - Whether this is the initial route load
   * 
   * @description Processes route change and triggers appropriate handlers.
   */
  private async handleRoute(path: string, type: 'push' | 'replace' | 'pop', isInitial: boolean = false): Promise<void> {
    const previousRoute = this.currentRoute
    const match = this.matchRoute(path)
    
    try {
      if (match.matched && match.route) {
        // Update current route
        this.currentRoute = path
        
        // Execute route handler
        console.log(`🎯 Executing route handler for: ${path}`)
        await match.route.handler(match.params, match.query)
        
        // Notify listeners (unless initial load)
        if (!isInitial) {
          this.notifyRouteChange({
            from: previousRoute,
            to: path,
            params: match.params,
            query: match.query,
            type
          })
        }
        
        console.log(`✅ Route handled successfully: ${path}`)
        
      } else {
        // Handle 404 - route not found
        console.warn(`🚫 No route matched for: ${path}`)
        await this.handleNotFound(path)
      }
      
    } catch (error) {
      console.error('🚨 Route handler error:', error)
      this.handleRouteError(error as Error, path)
    }
  }

  /**
   * @brief Match route pattern against path
   * 
   * @param path - Path to match against registered routes
   * @return Route match result
   * 
   * @description Finds matching route registration for given path.
   */
  private matchRoute(path: string): RouteMatch {
    const normalizedPath = this.normalizePath(path)
    const query = this.parseQuery(window.location.search)
    
    // Try to match each registered route
    for (const [pattern, registration] of this.routes) {
      const match = normalizedPath.match(registration.matcher)
      
      if (match) {
        // Extract parameters from matched groups
        const params: Record<string, string> = {}
        registration.paramNames.forEach((name, index) => {
          params[name] = decodeURIComponent(match[index + 1] || '')
        })
        
        console.log(`✅ Route matched: ${pattern}`, { params, query })
        
        return {
          matched: true,
          route: registration,
          params,
          query
        }
      }
    }
    
    // No route matched
    console.log(`❌ No route matched for: ${normalizedPath}`)
    return {
      matched: false,
      params: {},
      query
    }
  }

  /**
   * @brief Compile route pattern to regex
   * 
   * @param pattern - Route pattern string with :param syntax
   * @return Compiled matcher regex and parameter names
   * 
   * @description Converts route pattern to regex for matching.
   * Supports :param syntax for dynamic segments.
   */
  private compilePattern(pattern: string): { matcher: RegExp; paramNames: string[] } {
    const paramNames: string[] = []
    
    // Escape special regex characters and replace :param with capture groups
    const regexPattern = pattern
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
      .replace(/\\:([^/]+)/g, (match, paramName) => {
        paramNames.push(paramName)
        return '([^/]+)' // Capture group for parameter
      })
    
    // Create exact match regex (must match entire path)
    const matcher = new RegExp(`^${regexPattern}$`)
    
    return { matcher, paramNames }
  }

  /**
   * @brief Normalize path format
   * 
   * @param path - Path to normalize
   * @return Normalized path string
   * 
   * @description Ensures consistent path format by handling slashes.
   */
  private normalizePath(path: string): string {
    if (!path || path === '/') {
      return '/'
    }
    
    // Remove trailing slash and ensure leading slash
    return ('/' + path).replace(/\/+/g, '/').replace(/\/$/, '') || '/'
  }

  /**
   * @brief Get current path from window location
   * 
   * @return Current path without base path prefix
   * 
   * @description Extracts current path from browser location.
   */
  private getCurrentPath(): string {
    let path = window.location.pathname
    
    // Remove base path if present
    if (this.basePath && path.startsWith(this.basePath)) {
      path = path.slice(this.basePath.length)
    }
    
    return this.normalizePath(path)
  }

  /**
   * @brief Parse query string into key-value object
   * 
   * @param queryString - Query string to parse (including leading ?)
   * @return Query parameters as key-value object
   * 
   * @description Converts URL query string to JavaScript object.
   */
  private parseQuery(queryString: string): Record<string, string> {
    const params: Record<string, string> = {}
    
    if (!queryString || queryString.length <= 1) {
      return params
    }
    
    // Remove leading '?' and split into pairs
    const pairs = queryString.slice(1).split('&')
    
    for (const pair of pairs) {
      const [key, value] = pair.split('=')
      if (key) {
        params[decodeURIComponent(key)] = decodeURIComponent(value || '')
      }
    }
    
    return params
  }

  /**
   * @brief Handle 404 not found scenarios
   * 
   * @param path - Path that was not found
   * 
   * @description Handles cases where no route matches the current path.
   */
  private async handleNotFound(path: string): Promise<void> {
    console.warn(`🚫 Route not found: ${path}`)
    
    // Redirect to 404 route if configured and not already there
    if (this.options.notFoundRoute && path !== this.options.notFoundRoute) {
      console.log(`🔄 Redirecting to 404 route: ${this.options.notFoundRoute}`)
      this.navigate(this.options.notFoundRoute, { replace: true })
    } else {
      // Update current route even if no handler
      this.currentRoute = path
      console.log(`📍 Updated current route to: ${path} (no handler)`)
    }
  }

  /**
   * @brief Handle errors that occur during route processing
   * 
   * @param error - Error that occurred
   * @param path - Path where error occurred
   * 
   * @description Handles errors during route handler execution.
   */
  private handleRouteError(error: Error, path: string): void {
    console.error(`🚨 Route error at ${path}:`, error)
    
    // Could implement error page navigation here
    // this.navigate('/error', { replace: true, state: { error: error.message } })
  }

  /**
   * @brief Handle errors during navigation attempts
   * 
   * @param error - Navigation error that occurred
   * @param path - Target path that failed
   * 
   * @description Handles errors during navigation operations.
   */
  private handleNavigationError(error: Error, path: string): void {
    console.error(`🚨 Navigation error to ${path}:`, error)
    
    // Could implement fallback navigation or error reporting here
  }

  /**
   * @brief Notify all route change listeners
   * 
   * @param event - Route change event data
   * 
   * @description Calls all registered route change listeners with event data.
   */
  private notifyRouteChange(event: RouteChangeEvent): void {
    console.log(`📡 Notifying ${this.listeners.size} route change listeners`)
    
    this.listeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        console.error('🚨 Route change listener error:', error)
      }
    })
  }
}

// Export singleton router instance for application use
export const router = new Router()