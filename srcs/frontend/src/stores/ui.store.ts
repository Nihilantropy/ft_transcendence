/**
 * @brief User interface store for ft_transcendence (FIXED VERSION)
 * 
 * @description Manages UI state, modals, notifications, and user preferences.
 * Handles responsive design state and accessibility settings.
 * 
 * Phase B2.2 implementation extending BaseStore<UIState>.
 */

import { BaseStore } from './BaseStore'
import type { UIState } from '../types/store.types'

/**
 * @brief User interface state management store
 * 
 * @description Concrete implementation of BaseStore for UI state.
 * Handles modals, notifications, responsive design, and user preferences.
 */
export class UIStore extends BaseStore<UIState> {
  private readonly PREFERENCES_KEY = 'ft_transcendence_ui_preferences'

  /**
   * @brief Initialize UI store
   * 
   * @description Creates store with responsive default state.
   * Detects initial device type and restores user preferences.
   */
  constructor() {
    // Create initial state with static defaults first
    const initialState: UIState = {
      isMobile: false, // Will be updated after super()
      breakpoint: 'desktop', // Will be updated after super()
      sidebarOpen: false,
      activeModal: null,
      theme: 'dark', // Gaming theme default
    }

    // Call super() FIRST with static initial state
    super(initialState, 'UIStore')
    
    // NOW we can call methods that use 'this'
    // Update state with dynamic detection
    this.setState({
      isMobile: this.detectMobile(),
      breakpoint: this.detectBreakpoint(),
    })
    
    // Set up responsive listeners
    this.setupResponsiveListeners()
    
    // Restore user preferences
    this.restorePreferences()
  }

  /**
   * @brief Update responsive breakpoint
   * 
   * @param width - Current window width
   * 
   * @description Updates breakpoint and mobile state based on window width.
   */
  updateBreakpoint(width: number): void {
    const isMobile = width < 768
    const breakpoint = width < 768 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop'
    
    this.setState({ 
      isMobile, 
      breakpoint,
      // Close sidebar on mobile when switching breakpoints
      sidebarOpen: this.getState().sidebarOpen && !isMobile
    })
  }

  /**
   * @brief Toggle sidebar open/closed
   * 
   * @description Toggles sidebar visibility state.
   */
  toggleSidebar(): void {
    const currentState = this.getState()
    this.setState({ sidebarOpen: !currentState.sidebarOpen })
  }

  /**
   * @brief Set sidebar state
   * 
   * @param open - Whether sidebar should be open
   * 
   * @description Directly sets sidebar visibility state.
   */
  setSidebar(open: boolean): void {
    this.setState({ sidebarOpen: open })
  }

  /**
   * @brief Open modal
   * 
   * @param modalId - Modal identifier
   * 
   * @description Opens specified modal and closes any existing modal.
   */
  openModal(modalId: string): void {
    this.setState({ activeModal: modalId })
  }

  /**
   * @brief Close active modal
   * 
   * @description Closes currently active modal.
   */
  closeModal(): void {
    this.setState({ activeModal: null })
  }

  /**
   * @brief Set theme preference
   * 
   * @param theme - Theme preference ('dark' or 'light')
   * 
   * @description Updates theme preference and persists to storage.
   */
  setTheme(theme: 'dark' | 'light'): void {
    this.setState({ theme })
    this.persistPreferences()
  }

  /**
   * @brief Check if mobile device (convenience method)
   * 
   * @return True if on mobile device
   * 
   * @description Helper to check mobile state.
   */
  isMobileDevice(): boolean {
    return this.getState().isMobile
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
   * @brief Detect if mobile device
   * 
   * @return True if mobile device detected
   * 
   * @description Uses window width to detect mobile device.
   */
  private detectMobile(): boolean {
    if (typeof window === 'undefined') {
      return false
    }
    return window.innerWidth < 768
  }

  /**
   * @brief Detect current breakpoint
   * 
   * @return Current responsive breakpoint
   * 
   * @description Determines breakpoint based on window width.
   */
  private detectBreakpoint(): 'mobile' | 'tablet' | 'desktop' {
    if (typeof window === 'undefined') {
      return 'desktop'
    }
    
    const width = window.innerWidth
    if (width < 768) return 'mobile'
    if (width < 1024) return 'tablet'
    return 'desktop'
  }

  /**
   * @brief Set up responsive design listeners
   * 
   * @description Adds window resize listener for responsive updates.
   */
  private setupResponsiveListeners(): void {
    if (typeof window === 'undefined') {
      return
    }

    const handleResize = () => {
      this.updateBreakpoint(window.innerWidth)
    }

    window.addEventListener('resize', handleResize)
    
    // Store cleanup function (would be called on store disposal)
    // this.cleanup = () => window.removeEventListener('resize', handleResize)
  }

  /**
   * @brief Persist UI preferences to localStorage
   * 
   * @description Saves UI preferences to browser storage.
   */
  private persistPreferences(): void {
    try {
      const state = this.getState()
      const preferences = {
        theme: state.theme,
      }
      
      localStorage.setItem(this.PREFERENCES_KEY, JSON.stringify(preferences))
    } catch (error) {
      console.warn('Failed to persist UI preferences:', error)
    }
  }

  /**
   * @brief Restore UI preferences from localStorage
   * 
   * @description Attempts to restore UI preferences from browser storage.
   */
  private restorePreferences(): void {
    try {
      const stored = localStorage.getItem(this.PREFERENCES_KEY)
      
      if (!stored) {
        return
      }

      const preferences = JSON.parse(stored)
      
      this.setState({
        theme: preferences.theme || this.getState().theme,
      })

    } catch (error) {
      console.warn('Failed to restore UI preferences:', error)
    }
  }
}

// Export singleton instance
export const uiStore = new UIStore()