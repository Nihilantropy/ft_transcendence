/**
 * @brief User interface store for ft_transcendence (FIXED VERSION)
 * 
 * @description Manages UI state, modals, notifications, and user preferences.
 * Handles responsive design state and accessibility settings.
 * 
 * Phase B2.2 implementation extending BaseStore<UIState>.
 */

import { BaseStore } from './BaseStore'
import type { UIState, UINotification, AccessibilitySettings } from '../types/store.types'

/**
 * @brief User interface state management store
 * 
 * @description Concrete implementation of BaseStore for UI state.
 * Handles modals, notifications, responsive design, and user preferences.
 */
export class UIStore extends BaseStore<UIState> {
  private readonly PREFERENCES_KEY = 'ft_transcendence_ui_preferences'
  private notificationCounter = 0

  /**
   * @brief Initialize UI store (FIXED VERSION)
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
      notifications: [],
      language: 'en', // Will be updated after super()
      theme: 'dark', // Gaming theme default
      accessibility: {
        highContrast: false,
        reducedMotion: false, // Will be updated after super()
        screenReader: false,
        fontSize: 'medium'
      }
    }

    // Call super() FIRST with static initial state
    super(initialState, 'UIStore')
    
    // NOW we can call methods that use 'this'
    // Update state with dynamic detection
    this.setState({
      isMobile: this.detectMobile(),
      breakpoint: this.detectBreakpoint(),
      language: this.detectLanguage(),
      accessibility: {
        ...this.getState().accessibility,
        reducedMotion: this.detectReducedMotion()
      }
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
   * @brief Add notification
   * 
   * @param type - Notification type
   * @param title - Notification title
   * @param message - Notification message
   * @param autoDismiss - Whether to auto-dismiss (default: true)
   * @return Notification ID for manual dismissal
   * 
   * @description Adds new notification to the notification list.
   */
  addNotification(
    type: 'info' | 'success' | 'warning' | 'error',
    title: string,
    message: string,
    autoDismiss: boolean = true
  ): string {
    const notification: UINotification = {
      id: `notification-${++this.notificationCounter}`,
      type,
      title,
      message,
      autoDismiss,
      createdAt: new Date()
    }

    const currentState = this.getState()
    const updatedNotifications = [...currentState.notifications, notification]
    
    this.setState({ notifications: updatedNotifications })

    // Auto-dismiss after 5 seconds if enabled
    if (autoDismiss) {
      setTimeout(() => {
        this.removeNotification(notification.id)
      }, 5000)
    }

    return notification.id
  }

  /**
   * @brief Remove notification
   * 
   * @param notificationId - ID of notification to remove
   * 
   * @description Removes specific notification from the list.
   */
  removeNotification(notificationId: string): void {
    const currentState = this.getState()
    const updatedNotifications = currentState.notifications.filter(
      notification => notification.id !== notificationId
    )
    
    this.setState({ notifications: updatedNotifications })
  }

  /**
   * @brief Clear all notifications
   * 
   * @description Removes all notifications from the list.
   */
  clearNotifications(): void {
    this.setState({ notifications: [] })
  }

  /**
   * @brief Set language preference
   * 
   * @param language - Language code (e.g., 'en', 'fr', 'es', 'it')
   * 
   * @description Updates language preference and persists to storage.
   */
  setLanguage(language: string): void {
    this.setState({ language })
    this.persistPreferences()
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
   * @brief Update accessibility settings
   * 
   * @param settings - Partial accessibility settings to update
   * 
   * @description Updates accessibility settings and persists to storage.
   */
  updateAccessibility(settings: Partial<AccessibilitySettings>): void {
    const currentState = this.getState()
    const updatedSettings: AccessibilitySettings = {
      ...currentState.accessibility,
      ...settings
    }
    
    this.setState({ accessibility: updatedSettings })
    this.persistPreferences()
  }

  /**
   * @brief Get current notification count (convenience method)
   * 
   * @return Number of active notifications
   * 
   * @description Helper to get notification count.
   */
  getNotificationCount(): number {
    return this.getState().notifications.length
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
   * @brief Detect user language preference
   * 
   * @return Detected language code
   * 
   * @description Uses browser language with fallback to 'en'.
   */
  private detectLanguage(): string {
    if (typeof navigator === 'undefined') {
      return 'en'
    }
    
    const browserLang = navigator.language.split('-')[0]
    const supportedLanguages = ['en', 'fr', 'es', 'it']
    
    return supportedLanguages.includes(browserLang) ? browserLang : 'en'
  }

  /**
   * @brief Detect reduced motion preference
   * 
   * @return True if user prefers reduced motion
   * 
   * @description Checks CSS media query for motion preference.
   */
  private detectReducedMotion(): boolean {
    if (typeof window === 'undefined') {
      return false
    }
    
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
        language: state.language,
        theme: state.theme,
        accessibility: state.accessibility
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
        language: preferences.language || this.getState().language,
        theme: preferences.theme || this.getState().theme,
        accessibility: {
          ...this.getState().accessibility,
          ...preferences.accessibility
        }
      })

    } catch (error) {
      console.warn('Failed to restore UI preferences:', error)
    }
  }
}

// Export singleton instance
export const uiStore = new UIStore()