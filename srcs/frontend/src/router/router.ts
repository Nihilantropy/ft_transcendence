/**
 * @brief Simplified Router implementation for ft_transcendence
 * 
 * @description Basic SPA router with simple auth guards only.
 * Removed complex guard system for roadmap compliance.
 * 
 * FILE: src/router/router.ts (SIMPLIFIED)
 */

import type {
  RouteHandler,
  RouteConfig,
  NavigationOptions,
  RouteChangeEvent,
  RouteChangeListener,
  RouterOptions
} from './schemas/router.schemas'

/**
 * @brief Simplified Router class for SPA navigation
 * 
 * @description Implements client-side routing using Browser History API.
 * Simple auth checking without complex guard system.
 */
export class Router {
  /** Map of registered routes: pattern -> route config */
  private routes: Map<string, RouteConfig> = new Map()
  
  /** Current active route path */
  private currentPath: string = ''
  
  /** Set of route change event listeners */
  private listeners: Set<RouteChangeListener> = new Set()
  
  /** Base path prefix for all routes */
  private basePath: string
  
  /** Default fallback route */
  private fallbackRoute: string

  /**
   * @brief Initialize router with configuration options
   * 
   * @param options - Router configuration options
   * 
   * @description Creates router instance with specified configuration.
   * Also sets up global authentication error handling for stale tokens.
   */
  constructor(options: RouterOptions = {}) {
    this.basePath = options.basePath || ''
    this.fallbackRoute = options.fallbackRoute || '/'
    
    // Listen for browser navigation
    window.addEventListener('popstate', this.handlePopState.bind(this))
    
    // ✅ CRITICAL: Listen for authentication errors (401)
    // When user's token is invalid or user is deleted from DB,
    // the API service will dispatch this event to trigger logout
    window.addEventListener('auth:unauthorized', (event: Event) => {
      const customEvent = event as CustomEvent
      console.warn('🔐 Authentication lost:', customEvent.detail?.message || 'Session expired')
      
      // Clear any stale data
      localStorage.removeItem('ft_user')
      
      // Redirect to login
      this.navigate('/login', { replace: true })
    })
    
    console.log('🧭 Simplified Router created')
  }

  /**
   * @brief Register a route handler
   * 
   * @param path - Route path pattern (e.g., '/game/:id', '/profile')
   * @param handler - Route handler function to call when matched
   * @param options - Optional route configuration
   * 
   * @description Registers route pattern with handler function.
   * Supports dynamic parameters using :param syntax and basic auth.
   */
  register(path: string, handler: RouteHandler, options: Partial<RouteConfig> = {}): void {
    const route: RouteConfig = {
      path,
      handler,
      requiresAuth: options.requiresAuth || false,
      redirect: options.redirect,
      meta: options.meta,
      title: options.title
    }
    
    this.routes.set(path, route)
    console.log(`🗺️  Route registered: ${path}`, {
      requiresAuth: route.requiresAuth || false
    })
  }

  /**
   * @brief Navigate to path with simple auth check
   */
  async navigate(path: string, options: NavigationOptions = {}): Promise<void> {
    // Don't handle API routes in frontend router
    if (this.isApiRoute(path)) {
      console.warn('🚨 Attempted to navigate to API route via frontend router:', path)
      console.warn('API routes should be accessed via fetch/HTTP requests, not navigation')
      return
    }
    
    // Separate path from query parameters for route matching
    const [pathname, queryString] = path.split('?')
    const route = this.findMatchingRoute(pathname)
    
    if (!route) {
      console.warn(`No route found for path: ${pathname}, redirecting to 404`)
      return this.navigate('/404', { replace: true })
    }

    // Simple auth check (replaces complex guard system)
    if (!this.canAccessRoute(route)) {
      const redirectPath = route.redirect || '/login'
      console.log(`Access denied to ${pathname}, redirecting to ${redirectPath}`)
      return this.navigate(redirectPath)
    }

    // Update browser history with full path (including query parameters)
    const fullPath = this.basePath + path
    if (options.replace) {
      window.history.replaceState(options.state, '', fullPath)
    } else {
      window.history.pushState(options.state, '', fullPath)
    }

    // Execute route with full path (including query parameters)
    await this.executeRoute(route, path)
  }

  /**
   * @brief Simple auth check (replaces complex guard system)
   */
  private canAccessRoute(route: RouteConfig): boolean {
    if (!route.requiresAuth) {
      return true
    }

    // Simple check - replace with your auth logic
    return this.isUserAuthenticated()
  }

  /**
   * @brief Check if user is authenticated
   * 
   * @description Uses cookie-based authentication where tokens are stored in httpOnly cookies
   * and NOT accessible from JavaScript. We check for user data in localStorage which is set
   * during login. The actual token validation happens on the backend for each API request.
   */
  private isUserAuthenticated(): boolean {
    try {
      // Note: Access tokens are in httpOnly cookies (not accessible from JS)
      // We can only check if user data exists in localStorage
      const userJson = localStorage.getItem('ft_user')
      
      if (!userJson) {
        console.log('🔐 Auth check result: NOT_AUTHENTICATED (no user data)')
        return false
      }
      
      // Validate user data structure
      try {
        const user = JSON.parse(userJson)
        const isAuthenticated = !!(user && user.id && user.username)
        
        console.log('🔐 Auth check result:', isAuthenticated ? 'AUTHENTICATED' : 'NOT_AUTHENTICATED (invalid user data)')
        return isAuthenticated
      } catch (parseError) {
        console.warn('🔐 Auth check result: NOT_AUTHENTICATED (corrupted user data)')
        // Clear corrupted data
        localStorage.removeItem('ft_user')
        return false
      }
    } catch (error) {
      console.error('Failed to check auth status:', error)
      return false
    }
  }

  /**
   * @brief Find matching route for path
   */
  private findMatchingRoute(path: string): RouteConfig | null {
    // Simple exact match first
    if (this.routes.has(path)) {
      return this.routes.get(path)!
    }

    // Pattern matching for dynamic routes (simplified)
    for (const [pattern, route] of this.routes) {
      if (this.matchesPattern(path, pattern)) {
        return route
      }
    }

    // Check for catchall route (*)
    if (this.routes.has('*')) {
      return this.routes.get('*')!
    }

    return null
  }

  /**
   * @brief Simple pattern matching
   */
  private matchesPattern(path: string, pattern: string): boolean {
    if (pattern === path) return true
    
    // Simple :param matching
    const patternParts = pattern.split('/')
    const pathParts = path.split('/')
    
    if (patternParts.length !== pathParts.length) return false
    
    return patternParts.every((part, i) => 
      part.startsWith(':') || part === pathParts[i]
    )
  }

  /**
   * @brief Extract parameters from path
   */
  private extractParams(path: string, pattern: string): Record<string, string> {
    const params: Record<string, string> = {}
    const patternParts = pattern.split('/')
    const pathParts = path.split('/')
    
    patternParts.forEach((part, i) => {
      if (part.startsWith(':')) {
        const paramName = part.slice(1)
        params[paramName] = pathParts[i] || ''
      }
    })
    
    return params
  }

  /**
   * @brief Execute route handler
   */
  private async executeRoute(route: RouteConfig, path: string): Promise<void> {
    const params = this.extractParams(path, route.path)
    const query = this.parseQueryString(window.location.search)
    
    // Notify listeners
    const event: RouteChangeEvent = {
      from: this.currentPath || null,
      to: path,
      params,
      query
    }
    
    this.currentPath = path
    this.notifyListeners(event)
    
    // Execute handler
    try {
      await route.handler(params, query)
    } catch (error) {
      console.error(`Error executing route handler for ${path}:`, error)
    }
  }

  /**
   * @brief Handle browser back/forward buttons
   */
  private handlePopState(_event: PopStateEvent): void {
    const path = window.location.pathname.replace(this.basePath, '') || '/'
    
    // Ignore API routes - they should be handled by the backend, not the frontend router
    if (this.isApiRoute(path)) {
      console.log('🌐 Ignoring API route for frontend router:', path)
      return
    }
    
    const route = this.findMatchingRoute(path)
    if (route) {
      this.executeRoute(route, path)
    }
  }

  /**
   * @brief Check if a path is an API route that should not be handled by frontend router
   */
  private isApiRoute(path: string): boolean {
    return path.startsWith('/api/') || path === '/api'
  }

  /**
   * @brief Parse query string
   */
  private parseQueryString(search: string): Record<string, string> {
    const params = new URLSearchParams(search)
    const result: Record<string, string> = {}
    
    for (const [key, value] of params) {
      result[key] = value
    }
    
    return result
  }

  /**
   * @brief Add route change listener
   */
  addListener(listener: RouteChangeListener): void {
    this.listeners.add(listener)
  }

  /**
   * @brief Remove route change listener
   */
  removeListener(listener: RouteChangeListener): void {
    this.listeners.delete(listener)
  }

  /**
   * @brief Notify all listeners of route change
   */
  private notifyListeners(event: RouteChangeEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        console.error('Error in route change listener:', error)
      }
    })
  }

  /**
   * @brief Get current path
   */
  getCurrentPath(): string {
    return this.currentPath
  }

  /**
   * @brief Start router (call after registering routes)
   */
  start(): void {
    const path = window.location.pathname.replace(this.basePath, '') || '/'
    
    // Ignore API routes - they should be handled by the backend, not the frontend router
    if (this.isApiRoute(path)) {
      console.log('🌐 Ignoring API route for frontend router on start:', path)
      return
    }
    
    // Preserve query parameters (important for OAuth callbacks)
    const fullPath = path + window.location.search
    this.navigate(fullPath, { replace: true })
  }
}

// Export singleton router instance for application use
export const router = new Router()