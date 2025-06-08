/**
 * @brief Route guard implementations for ft_transcendence
 * 
 * @description Functional route guards for authentication, authorization,
 * and navigation protection. Phase B1.4 complete implementation.
 * 
 * FILE: src/router/guards.ts (REPLACES EXISTING PLACEHOLDER)
 */

import type { RouteGuard, RouteConfig } from '../types/router.types'
import { authStore } from '../stores/auth.store'

/**
 * @brief Navigation context interface for guards
 * 
 * @description Additional context information available to guards.
 */
export interface NavigationContext {
  from: string
  to: string
  route: RouteConfig
}

/**
 * @brief Authentication guard for protected routes
 * 
 * @description Ensures only authenticated users can access protected routes.
 * Integrates with authStore to check authentication status and token validity.
 */
export class AuthGuard implements RouteGuard {
  /** Redirect path for unauthenticated users */
  readonly redirect = '/login'

  /**
   * @brief Check if user is authenticated and can access route
   * 
   * @param route - Target route configuration
   * @param path - Current path being navigated to
   * @return Promise<boolean> - Whether navigation is allowed
   * 
   * @description Verifies user authentication status and token validity.
   * Allows access only to authenticated users with valid tokens.
   */
  async canActivate(route: RouteConfig, path: string): Promise<boolean> {
    console.log(`🔐 AuthGuard: Checking authentication for ${path}`)
    
    try {
      // Check if user is authenticated
      const isAuthenticated = authStore.isAuthenticated()
      
      if (!isAuthenticated) {
        console.log(`🚫 AuthGuard: User not authenticated for ${path}`)
        return false
      }
      
      // Check if token is expired
      if (authStore.isTokenExpired()) {
        console.log(`🚫 AuthGuard: Token expired for ${path}`)
        
        // Logout user with expired token
        authStore.logout()
        return false
      }
      
      console.log(`✅ AuthGuard: Authentication verified for ${path}`)
      return true
      
    } catch (error) {
      console.error('🚨 AuthGuard: Error checking authentication:', error)
      return false
    }
  }
}

/**
 * @brief Guest guard for guest-only routes
 * 
 * @description Ensures only non-authenticated users can access guest routes.
 * Prevents authenticated users from accessing login/register pages.
 */
export class GuestGuard implements RouteGuard {
  /** Redirect path for authenticated users */
  readonly redirect = '/dashboard'

  /**
   * @brief Check if user is a guest and can access route
   * 
   * @param route - Target route configuration  
   * @param path - Current path being navigated to
   * @return Promise<boolean> - Whether navigation is allowed
   * 
   * @description Allows access only to non-authenticated users.
   * Prevents authenticated users from accessing guest-only pages.
   */
  async canActivate(route: RouteConfig, path: string): Promise<boolean> {
    console.log(`👤 GuestGuard: Checking guest access for ${path}`)
    
    try {
      // Check if user is NOT authenticated
      const isAuthenticated = authStore.isAuthenticated()
      
      if (isAuthenticated) {
        console.log(`🚫 GuestGuard: User already authenticated, blocking ${path}`)
        return false
      }
      
      console.log(`✅ GuestGuard: Guest access allowed for ${path}`)
      return true
      
    } catch (error) {
      console.error('🚨 GuestGuard: Error checking guest status:', error)
      // Allow access on error (fail open for guest routes)
      return true
    }
  }
}

/**
 * @brief Game session guard for active game routes
 * 
 * @description Ensures user has an active game session to access game routes.
 * Prevents access to game pages without an active game.
 */
export class GameSessionGuard implements RouteGuard {
  /** Redirect path for users without active game */
  readonly redirect = '/game'

  /**
   * @brief Check if user has active game session
   * 
   * @param route - Target route configuration
   * @param path - Current path being navigated to  
   * @return Promise<boolean> - Whether navigation is allowed
   * 
   * @description Verifies user has an active game session.
   * Required for accessing game play pages.
   */
  async canActivate(route: RouteConfig, path: string): Promise<boolean> {
    console.log(`🎮 GameSessionGuard: Checking game session for ${path}`)
    
    try {
      // Import gameStore dynamically to avoid circular imports
      const { gameStore } = await import('../stores/game.store')
      
      // Check if user has active game
      const hasActiveGame = gameStore.isGameActive()
      
      if (!hasActiveGame) {
        console.log(`🚫 GameSessionGuard: No active game session for ${path}`)
        return false
      }
      
      console.log(`✅ GameSessionGuard: Active game session verified for ${path}`)
      return true
      
    } catch (error) {
      console.error('🚨 GameSessionGuard: Error checking game session:', error)
      return false
    }
  }
}

/**
 * @brief Admin guard for admin-only routes (future use)
 * 
 * @description Ensures only admin users can access admin routes.
 * Placeholder for future admin functionality.
 */
export class AdminGuard implements RouteGuard {
  /** Redirect path for non-admin users */
  readonly redirect = '/unauthorized'

  /**
   * @brief Check if user has admin privileges
   * 
   * @param route - Target route configuration
   * @param path - Current path being navigated to
   * @return Promise<boolean> - Whether navigation is allowed
   * 
   * @description Checks user admin status. Currently returns false
   * as admin functionality is not yet implemented.
   */
  async canActivate(route: RouteConfig, path: string): Promise<boolean> {
    console.log(`👮 AdminGuard: Checking admin access for ${path}`)
    
    try {
      // Future: Check user role/permissions
      // const user = authStore.getCurrentUser()
      // return user?.role === 'admin'
      
      console.log(`🚫 AdminGuard: Admin functionality not yet implemented`)
      return false
      
    } catch (error) {
      console.error('🚨 AdminGuard: Error checking admin status:', error)
      return false
    }
  }
}

/**
 * @brief Create authentication guard instance
 * 
 * @return AuthGuard instance
 * 
 * @description Factory function for creating AuthGuard instances.
 */
export function createAuthGuard(): AuthGuard {
  return new AuthGuard()
}

/**
 * @brief Create guest guard instance
 * 
 * @return GuestGuard instance
 * 
 * @description Factory function for creating GuestGuard instances.
 */
export function createGuestGuard(): GuestGuard {
  return new GuestGuard()
}

/**
 * @brief Create game session guard instance
 * 
 * @return GameSessionGuard instance
 * 
 * @description Factory function for creating GameSessionGuard instances.
 */
export function createGameSessionGuard(): GameSessionGuard {
  return new GameSessionGuard()
}

/**
 * @brief Create admin guard instance
 * 
 * @return AdminGuard instance
 * 
 * @description Factory function for creating AdminGuard instances.
 */
export function createAdminGuard(): AdminGuard {
  return new AdminGuard()
}

// Ready-to-use guard instances for immediate application use
export const authGuard = createAuthGuard()
export const guestGuard = createGuestGuard()
export const gameSessionGuard = createGameSessionGuard()
export const adminGuard = createAdminGuard()

/**
 * @brief Convenience function for auth-required routes
 * 
 * @return Array containing AuthGuard
 * 
 * @description Helper function for quickly protecting routes with authentication.
 */
export function requireAuth(): RouteGuard[] {
  return [authGuard]
}

/**
 * @brief Convenience function for guest-only routes
 * 
 * @return Array containing GuestGuard
 * 
 * @description Helper function for quickly setting guest-only routes.
 */
export function guestOnly(): RouteGuard[] {
  return [guestGuard]
}

/**
 * @brief Convenience function for game session routes
 * 
 * @return Array containing AuthGuard and GameSessionGuard
 * 
 * @description Helper function for protecting game pages with auth + active session.
 */
export function requireGameSession(): RouteGuard[] {
  return [authGuard, gameSessionGuard]
}

/**
 * @brief Convenience function for admin routes
 * 
 * @return Array containing AuthGuard and AdminGuard
 * 
 * @description Helper function for protecting admin pages.
 */
export function requireAdmin(): RouteGuard[] {
  return [authGuard, adminGuard]
}