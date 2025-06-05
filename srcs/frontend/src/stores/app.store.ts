/**
 * @brief Global application store for ft_transcendence
 * 
 * @description Manages top-level application state and cross-cutting concerns.
 * Handles global loading, errors, connectivity, and initialization.
 * 
 * Phase B2.2 implementation extending BaseStore<AppState>.
 */

import { BaseStore } from './BaseStore'
import type { AppState } from '../types/store.types'

/**
 * @brief Global application state management store
 * 
 * @description Concrete implementation of BaseStore for application-wide state.
 * Handles initialization, routing, connectivity, and global error states.
 */
export class AppStore extends BaseStore<AppState> {
  private readonly DEBUG_KEY = 'ft_transcendence_debug'

  /**
   * @brief Initialize application store
   * 
   * @description Creates store with default application state.
   * Sets up connectivity monitoring and debug mode detection.
   */
  constructor() {
    const initialState: AppState = {
      theme: 'dark', // Gaming default
      loading: false,
      error: null,
      isOnline: this.detectOnlineStatus(),
      currentRoute: this.getCurrentRoute(),
      initialized: false,
      debugMode: this.getDebugMode()
    }

    super(initialState, 'AppStore')
    
    // Set up connectivity monitoring
    this.setupConnectivityListeners()
    
    // Set up route monitoring
    this.setupRouteListeners()
  }

  /**
   * @brief Set application loading state
   * 
   * @param loading - Loading state
   * @param error - Optional error to clear when loading starts
   * 
   * @description Updates global loading state and optionally clears errors.
   */
  setLoading(loading: boolean, error: string | null = null): void {
    this.setState({ loading, error })
  }

  /**
   * @brief Set global application error
   * 
   * @param error - Error message
   * 
   * @description Sets global error state and stops loading.
   */
  setError(error: string): void {
    this.setState({ 
      error, 
      loading: false 
    })
  }

  /**
   * @brief Clear global error
   * 
   * @description Removes current global error state.
   */
  clearError(): void {
    this.setState({ error: null })
  }

  /**
   * @brief Set application theme
   * 
   * @param theme - Theme preference ('dark' or 'light')
   * 
   * @description Updates global theme preference.
   */
  setTheme(theme: 'dark' | 'light'): void {
    this.setState({ theme })
  }

  /**
   * @brief Set online connectivity status
   * 
   * @param isOnline - Online status
   * 
   * @description Updates connectivity state and clears errors if back online.
   */
  setOnlineStatus(isOnline: boolean): void {
    this.setState({ 
      isOnline,
      // Clear network errors when back online
      error: isOnline && this.getState().error?.includes('network') ? null : this.getState().error
    })
  }

  /**
   * @brief Set current application route
   * 
   * @param route - Current route path
   * 
   * @description Updates current route state for navigation tracking.
   */
  setCurrentRoute(route: string): void {
    this.setState({ currentRoute: route })
  }

  /**
   * @brief Mark application as initialized
   * 
   * @description Sets initialization flag to true after app setup complete.
   */
  setInitialized(): void {
    this.setState({ 
      initialized: true,
      loading: false 
    })
  }

  /**
   * @brief Reset application to uninitialized state
   * 
   * @description Resets app state for restart or logout scenarios.
   */
  resetApplication(): void {
    this.setState({
      loading: false,
      error: null,
      initialized: false,
      currentRoute: '/'
    })
  }

  /**
   * @brief Toggle debug mode
   * 
   * @description Toggles debug mode and persists to storage.
   */
  toggleDebugMode(): void {
    const newDebugMode = !this.getState().debugMode
    this.setState({ debugMode: newDebugMode })
    this.persistDebugMode(newDebugMode)
  }

  /**
   * @brief Set debug mode
   * 
   * @param enabled - Debug mode enabled state
   * 
   * @description Sets debug mode and persists to storage.
   */
  setDebugMode(enabled: boolean): void {
    this.setState({ debugMode: enabled })
    this.persistDebugMode(enabled)
  }

  /**
   * @brief Check if application is ready (convenience method)
   * 
   * @return True if app is initialized and not loading
   * 
   * @description Helper to check if app is ready for user interaction.
   */
  isReady(): boolean {
    const state = this.getState()
    return state.initialized && !state.loading
  }

  /**
   * @brief Check if application has errors (convenience method)
   * 
   * @return True if there are global errors
   * 
   * @description Helper to check error state.
   */
  hasError(): boolean {
    return this.getState().error !== null
  }

  /**
   * @brief Get current theme (convenience method)
   * 
   * @return Current theme preference
   * 
   * @description Helper to get current theme.
   */
  getCurrentTheme(): 'dark' | 'light' {
    return this.getState().theme
  }

  /**
   * @brief Check online status (convenience method)
   * 
   * @return True if application is online
   * 
   * @description Helper to check connectivity status.
   */
  isOnline(): boolean {
    return this.getState().isOnline
  }

  /**
   * @brief Get current route (convenience method)
   * 
   * @return Current route path
   * 
   * @description Helper to get current route.
   */
  getCurrentRoute(): string {
    if (typeof window === 'undefined') {
      return '/'
    }
    return window.location.pathname
  }

  /**
   * @brief Detect initial online status
   * 
   * @return True if browser reports online status
   * 
   * @description Uses navigator.onLine to detect connectivity.
   */
  private detectOnlineStatus(): boolean {
    if (typeof navigator === 'undefined') {
      return true // Assume online in SSR
    }
    return navigator.onLine
  }

  /**
   * @brief Set up connectivity event listeners
   * 
   * @description Adds online/offline event listeners for connectivity monitoring.
   */
  private setupConnectivityListeners(): void {
    if (typeof window === 'undefined') {
      return
    }

    const handleOnline = () => {
      this.setOnlineStatus(true)
    }

    const handleOffline = () => {
      this.setOnlineStatus(false)
      this.setError('Connection lost. Please check your internet connection.')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    // Store cleanup function (would be called on store disposal)
    // this.cleanup = () => {
    //   window.removeEventListener('online', handleOnline)
    //   window.removeEventListener('offline', handleOffline)
    // }
  }

  /**
   * @brief Set up route change listeners
   * 
   * @description Adds popstate listener for route change tracking.
   */
  private setupRouteListeners(): void {
    if (typeof window === 'undefined') {
      return
    }

    const handleRouteChange = () => {
      this.setCurrentRoute(window.location.pathname)
    }

    window.addEventListener('popstate', handleRouteChange)
    
    // Store cleanup function (would be called on store disposal)
    // this.routeCleanup = () => window.removeEventListener('popstate', handleRouteChange)
  }

  /**
   * @brief Get debug mode from storage
   * 
   * @return Debug mode enabled state
   * 
   * @description Retrieves debug mode preference from localStorage.
   */
  private getDebugMode(): boolean {
    try {
      const stored = localStorage.getItem(this.DEBUG_KEY)
      return stored === 'true'
    } catch (error) {
      return false
    }
  }

  /**
   * @brief Persist debug mode to storage
   * 
   * @param enabled - Debug mode enabled state
   * 
   * @description Saves debug mode preference to localStorage.
   */
  private persistDebugMode(enabled: boolean): void {
    try {
      localStorage.setItem(this.DEBUG_KEY, enabled.toString())
    } catch (error) {
      console.warn('Failed to persist debug mode:', error)
    }
  }
}

// Export singleton instance
export const appStore = new AppStore()