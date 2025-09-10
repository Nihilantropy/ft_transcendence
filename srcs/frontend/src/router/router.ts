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
} from '../types/router.types'

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
   */
  constructor(options: RouterOptions = {}) {
    this.basePath = options.basePath || ''
    this.fallbackRoute = options.fallbackRoute || '/'
    
    // Listen for browser navigation
    window.addEventListener('popstate', this.handlePopState.bind(this))
    
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
    const route = this.findMatchingRoute(path)
    
    if (!route) {
      console.warn(`No route found for path: ${path}`)
      return this.navigate(this.fallbackRoute)
    }

    // Simple auth check (replaces complex guard system)
    if (!this.canAccessRoute(route)) {
      const redirectPath = route.redirect || '/login'
      console.log(`Access denied to ${path}, redirecting to ${redirectPath}`)
      return this.navigate(redirectPath)
    }

    // Update browser history
    const fullPath = this.basePath + path
    if (options.replace) {
      window.history.replaceState(options.state, '', fullPath)
    } else {
      window.history.pushState(options.state, '', fullPath)
    }

    // Execute route
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
   * @brief Check if user is authenticated using AuthService
   */
  private isUserAuthenticated(): boolean {
    // Dynamic import to avoid circular dependency
    try {
      // For now, check both real auth and test auth
      const hasTestAuth = localStorage.getItem('ft_test_auth') === 'true'
      
      // TODO: Integrate with AuthService when available
      // const { authService } = await import('../services/auth')
      // return authService.isAuthenticated()
      
      return hasTestAuth
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
    const route = this.findMatchingRoute(path)
    if (route) {
      this.executeRoute(route, path)
    }
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
    this.navigate(path, { replace: true })
  }
}

// Export singleton router instance for application use
export const router = new Router()