/**
 * @brief Authentication store for ft_transcendence
 * 
 * @description Manages user authentication state, JWT tokens, and user sessions.
 * Integrates with browser localStorage for token persistence.
 * 
 * Phase B2.2 implementation extending BaseStore<AuthState>.
 */

import { BaseStore } from './BaseStore'
import type { AuthState, AuthUser } from '../types/store.types'

/**
 * @brief Authentication state management store
 * 
 * @description Concrete implementation of BaseStore for user authentication.
 * Handles login/logout, token management, and user session persistence.
 */
export class AuthStore extends BaseStore<AuthState> {
  private readonly STORAGE_KEY = 'ft_transcendence_auth'

  /**
   * @brief Initialize authentication store
   * 
   * @description Creates store with default unauthenticated state.
   * Attempts to restore session from localStorage.
   */
  constructor() {
    const initialState: AuthState = {
      isAuthenticated: false,
      user: null,
      token: null,
      expiresAt: null,
      loading: false,
      error: null,
      isOAuthFlow: false
    }

    super(initialState, 'AuthStore')
    
    // Try to restore session from storage
    this.restoreSession()
  }

  /**
   * @brief Set loading state
   * 
   * @param loading - Loading state
   * @param error - Optional error to clear
   * 
   * @description Updates loading state and optionally clears errors.
   */
  setLoading(loading: boolean, error: string | null = null): void {
    this.setState({ loading, error })
  }

  /**
   * @brief Set authentication error
   * 
   * @param error - Error message
   * 
   * @description Sets error state and stops loading.
   */
  setError(error: string): void {
    this.setState({ 
      error, 
      loading: false 
    })
  }

  /**
   * @brief Clear authentication error
   * 
   * @description Removes current error state.
   */
  clearError(): void {
    this.setState({ error: null })
  }

  /**
   * @brief Log in user with credentials
   * 
   * @param user - User profile data
   * @param token - JWT access token
   * @param expiresIn - Token expiration time in seconds
   * 
   * @description Sets authenticated state and persists session to storage.
   */
  login(user: AuthUser, token: string, expiresIn: number): void {
    const expiresAt = Date.now() + (expiresIn * 1000)
    
    const authState: Partial<AuthState> = {
      isAuthenticated: true,
      user,
      token,
      expiresAt,
      loading: false,
      error: null
    }

    this.setState(authState)
    this.persistSession()
  }

  /**
   * @brief Log out current user
   * 
   * @description Clears authentication state and removes persisted session.
   */
  logout(): void {
    const authState: Partial<AuthState> = {
      isAuthenticated: false,
      user: null,
      token: null,
      expiresAt: null,
      loading: false,
      error: null
    }

    this.setState(authState)
    this.clearSession()
  }

  /**
   * @brief Update user profile information
   * 
   * @param updates - Partial user data to update
   * 
   * @description Updates current user profile without affecting authentication.
   */
  updateUser(updates: Partial<AuthUser>): void {
    const currentState = this.getState()
    
    if (!currentState.user) {
      return
    }

    const updatedUser: AuthUser = {
      ...currentState.user,
      ...updates
    }

    this.setState({ user: updatedUser })
    this.persistSession()
  }

  /**
   * @brief Refresh authentication token
   * 
   * @param newToken - New JWT token
   * @param expiresIn - New expiration time in seconds
   * 
   * @description Updates token without changing user state.
   */
  refreshToken(newToken: string, expiresIn: number): void {
    const expiresAt = Date.now() + (expiresIn * 1000)
    
    this.setState({ 
      token: newToken, 
      expiresAt 
    })
    
    this.persistSession()
  }

  /**
   * @brief Check if current token is expired
   * 
   * @return True if token is expired or missing
   * 
   * @description Validates token expiration against current time.
   */
  isTokenExpired(): boolean {
    const state = this.getState()
    
    if (!state.token || !state.expiresAt) {
      return true
    }

    return Date.now() >= state.expiresAt
  }

  /**
   * @brief Get current user (convenience method)
   * 
   * @return Current user or null
   * 
   * @description Helper to get current user without full state.
   */
  getCurrentUser(): AuthUser | null {
    return this.getState().user
  }

  /**
   * @brief Get current token (convenience method)
   * 
   * @return Current JWT token or null
   * 
   * @description Helper to get current token for API requests.
   */
  getToken(): string | null {
    const state = this.getState()
    
    if (this.isTokenExpired()) {
      return null
    }

    return state.token
  }

  /**
   * @brief Check if user is authenticated (convenience method)
   * 
   * @return True if user is authenticated with valid token
   * 
   * @description Helper to check authentication status.
   */
  isAuthenticated(): boolean {
    const state = this.getState()
    return state.isAuthenticated && !this.isTokenExpired()
  }

  /**
   * @brief Persist session to localStorage
   * 
   * @description Saves current authentication state to browser storage.
   */
  private persistSession(): void {
    try {
      const state = this.getState()
      
      if (state.isAuthenticated && state.user && state.token) {
        const sessionData = {
          user: state.user,
          token: state.token,
          expiresAt: state.expiresAt
        }
        
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessionData))
      }
    } catch (error) {
      console.warn('Failed to persist auth session:', error)
    }
  }

  /**
   * @brief Restore session from localStorage
   * 
   * @description Attempts to restore authentication state from browser storage.
   */
  private restoreSession(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      
      if (!stored) {
        return
      }

      const sessionData = JSON.parse(stored)
      
      // Validate session data
      if (!sessionData.user || !sessionData.token || !sessionData.expiresAt) {
        this.clearSession()
        return
      }

      // Check if token is expired
      if (Date.now() >= sessionData.expiresAt) {
        this.clearSession()
        return
      }

      // Restore authentication state
      this.setState({
        isAuthenticated: true,
        user: sessionData.user,
        token: sessionData.token,
        expiresAt: sessionData.expiresAt
      })

    } catch (error) {
      console.warn('Failed to restore auth session:', error)
      this.clearSession()
    }
  }

  /**
   * @brief Clear persisted session
   * 
   * @description Removes authentication data from browser storage.
   */
  private clearSession(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY)
    } catch (error) {
      console.warn('Failed to clear auth session:', error)
    }
  }
}

// Export singleton instance
export const authStore = new AuthStore()