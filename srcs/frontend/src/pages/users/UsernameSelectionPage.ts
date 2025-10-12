/**
 * @file Username Selection Page component for ft_transcendence
 * 
 * @description Simple page for new users to choose their username after email verification.
 * Features real-time availability checking, validation, seamless backend integration,
 * and pre-fills the current username for users who already have one.
 */

import { Component } from '../../components/base/Component'
import { userService } from '../../services/user'
import { authService } from '../../services/auth/AuthService'
import { showPopup } from '../../components/ui/Popup'
import { router } from '../../router/router'

export interface UsernameSelectionPageProps {
  /** Custom CSS classes */
  className?: string
}

export interface UsernameSelectionPageState {
  /** Current username input value */
  username: string
  /** Initial username (pre-filled from current user) */
  initialUsername: string
  /** Loading state for submission */
  isSubmitting: boolean
  /** Loading state for availability check */
  isChecking: boolean
  /** Availability check result */
  availabilityStatus: 'idle' | 'checking' | 'available' | 'unavailable' | 'invalid'
  /** Availability message from backend */
  availabilityMessage: string | null
  /** Error message */
  errorMessage: string | null
  /** Validation errors */
  validationError: string | null
  /** Whether page is loading initial data */
  isLoading: boolean
}

/**
 * @brief Username selection page component
 * 
 * @description Simple component for new users to choose their username with
 * real-time validation and availability checking.
 */
export class UsernameSelectionPage extends Component<UsernameSelectionPageProps, UsernameSelectionPageState> {

  private checkTimeout: number | null = null
  private lastFocusedElement: string | null = null

  constructor(props: UsernameSelectionPageProps = {}) {
    super(props, {
      username: '',
      initialUsername: '',
      isSubmitting: false,
      isChecking: false,
      availabilityStatus: 'idle',
      availabilityMessage: null,
      errorMessage: null,
      validationError: null,
      isLoading: true
    })
    
    // Load current user's username on initialization
    this.loadCurrentUsername()
  }

  /**
   * @brief Load current user's username and pre-fill input
   */
  private async loadCurrentUsername(): Promise<void> {
    try {
      console.log('📡 Loading current user data...')
      const currentUser = authService.getCurrentUser()
      
      if (currentUser && currentUser.username) {
        console.log('✅ Pre-filling username:', currentUser.username)
        
        // Pre-fill the username and mark as available (it's their current username)
        this.setState({
          username: currentUser.username,
          initialUsername: currentUser.username,
          availabilityStatus: 'available',
          availabilityMessage: 'This is your current username',
          isLoading: false
        })
      } else {
        // No username yet (shouldn't happen but handle gracefully)
        this.setState({ isLoading: false })
      }
    } catch (error) {
      console.error('❌ Error loading current user:', error)
      // Continue without pre-filling
      this.setState({ isLoading: false })
    }
  }

  /**
   * @brief Validate username format
   */
  private validateUsername(username: string): string | null {
    if (!username) {
      return null // No error for empty input
    }
    
    if (username.length < 3) {
      return 'Username must be at least 3 characters'
    }
    
    if (username.length > 20) {
      return 'Username must not exceed 20 characters'
    }
    
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return 'Username can only contain letters, numbers, underscores, and hyphens'
    }
    
    return null
  }

  /**
   * @brief Handle username input change with debounced availability check
   */
  private async handleUsernameChange(username: string): Promise<void> {
    this.setState({ 
      username,
      validationError: null,
      availabilityStatus: 'idle'
    })
    
    // Clear previous timeout
    if (this.checkTimeout !== null) {
      clearTimeout(this.checkTimeout)
    }
    
    // Validate format first
    const validationError = this.validateUsername(username)
    if (validationError) {
      this.setState({ 
        validationError,
        availabilityStatus: 'invalid'
      })
      return
    }
    
    // Skip availability check if username is too short
    if (username.length < 3) {
      return
    }
    
    // Debounce availability check (500ms)
    this.checkTimeout = window.setTimeout(() => {
      this.checkUsernameAvailability(username)
    }, 500)
  }

  /**
   * @brief Check username availability with backend
   */
  private async checkUsernameAvailability(username: string): Promise<void> {
    this.setState({ 
      isChecking: true,
      availabilityStatus: 'checking'
    })
    
    try {
      console.log('🔍 Checking username availability:', username)
      const response = await userService.checkUsernameAvailability(username)
      
      this.setState({
        isChecking: false,
        availabilityStatus: response.available ? 'available' : 'unavailable',
        availabilityMessage: response.message
      })
      
      console.log(response.available ? '✅' : '❌', 'Username availability:', response.message)
    } catch (error: any) {
      console.error('❌ Error checking username:', error)
      this.setState({
        isChecking: false,
        availabilityStatus: 'idle',
        errorMessage: error.message || 'Failed to check username availability'
      })
    }
  }

  /**
   * @brief Handle username submission
   */
  private async handleSubmit(): Promise<void> {
    const { username, isSubmitting, availabilityStatus } = this.state
    
    // Prevent multiple submissions
    if (isSubmitting) {
      return
    }
    
    // Validate username
    const validationError = this.validateUsername(username)
    if (validationError) {
      this.setState({ validationError })
      showPopup(validationError)
      return
    }
    
    // Check if username is available
    if (availabilityStatus !== 'available') {
      showPopup('Please choose an available username')
      return
    }
    
    this.setState({ 
      isSubmitting: true,
      errorMessage: null
    })
    
    try {
      console.log('📝 Submitting username:', username)
      const response = await userService.updateUsername(username)
      
      if (response.success && response.user) {
        console.log('✅ Username set successfully:', response.user.username)
        showPopup(`Welcome, ${response.user.username}! Your profile is ready.`)
        
        // Redirect to profile page
        setTimeout(() => {
          router.navigate('/profile')
        }, 1500)
      } else {
        throw new Error(response.message || 'Failed to set username')
      }
    } catch (error: any) {
      console.error('❌ Error setting username:', error)
      const errorMessage = error.message || 'Failed to set username'
      
      this.setState({
        isSubmitting: false,
        errorMessage
      })
      
      showPopup(`Error: ${errorMessage}`)
    }
  }

  /**
   * @brief Render availability indicator
   */
  private renderAvailabilityIndicator(): string {
    const { availabilityStatus, availabilityMessage, validationError, isChecking } = this.state
    
    if (validationError) {
      return `
        <div class="mt-2 text-sm text-red-400 flex items-center gap-2">
          <span>❌</span>
          <span>${validationError}</span>
        </div>
      `
    }
    
    if (isChecking || availabilityStatus === 'checking') {
      return `
        <div class="mt-2 text-sm text-yellow-400 flex items-center gap-2">
          <span class="animate-pulse">🔍</span>
          <span>Checking availability...</span>
        </div>
      `
    }
    
    if (availabilityStatus === 'available') {
      return `
        <div class="mt-2 text-sm text-green-400 flex items-center gap-2">
          <span>✅</span>
          <span>${availabilityMessage || 'Username is available!'}</span>
        </div>
      `
    }
    
    if (availabilityStatus === 'unavailable') {
      return `
        <div class="mt-2 text-sm text-red-400 flex items-center gap-2">
          <span>❌</span>
          <span>${availabilityMessage || 'Username is not available'}</span>
        </div>
      `
    }
    
    return ''
  }

  /**
   * @brief Render component
   */
  public render(): string {
    const { className = '' } = this.props
    const { username, isSubmitting, availabilityStatus, isLoading } = this.state
    
    // Show loading state while fetching current username
    if (isLoading) {
      return `
        <div class="min-h-screen bg-black text-green-400 font-mono py-8 px-4 ${className}">
          <div class="flex items-center justify-center min-h-full">
            <div class="w-full max-w-md p-8 border border-green-600 rounded-lg bg-green-900/10 backdrop-blur-sm">
              <div class="text-center">
                <div class="text-6xl mb-6 animate-pulse">🏷️</div>
                <h1 class="text-2xl font-bold mb-4 text-green-400">
                  Loading...
                </h1>
                <p class="text-green-500">
                  Preparing your profile
                </p>
              </div>
            </div>
          </div>
        </div>
      `
    }
    
    const isValid = availabilityStatus === 'available'
    const canSubmit = isValid && !isSubmitting && username.length >= 3
    
    return `
      <div class="min-h-screen bg-black text-green-400 font-mono py-8 px-4 ${className}">
        <div class="flex items-center justify-center min-h-full">
          <div class="w-full max-w-md p-8 border border-green-600 rounded-lg bg-green-900/10 backdrop-blur-sm">
            <div class="text-center mb-8">
              <div class="text-6xl mb-6">🏷️</div>
              <h1 class="text-3xl font-bold mb-4 text-green-400">
                Choose Your Username
              </h1>
              <p class="text-green-500 mb-2">
                Pick a unique username for your profile.
              </p>
              <p class="text-sm text-gray-400">
                3-20 characters, letters, numbers, underscores, and hyphens only
              </p>
            </div>

            <div class="space-y-6">
              <!-- Username Input -->
              <div>
                <label class="block text-sm font-medium text-green-400 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  data-username-input
                  value="${username}"
                  placeholder="Enter your username"
                  maxlength="20"
                  class="w-full px-4 py-3 bg-black border border-green-600 rounded-lg text-green-400 placeholder-green-700 focus:outline-none focus:border-green-400 transition-colors"
                  ${isSubmitting ? 'disabled' : ''}
                />
                ${this.renderAvailabilityIndicator()}
              </div>

              <!-- Submit Button -->
              <button
                data-submit
                class="w-full px-6 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                ${!canSubmit ? 'disabled' : ''}
              >
                ${isSubmitting ? '⏳ Setting Username...' : '✅ Confirm Username'}
              </button>

              <!-- Help Text -->
              <div class="text-center text-xs text-gray-500 space-y-1">
                <p>💡 Choose carefully - you can change it later in settings</p>
                <p>🔒 Your username will be visible to other players</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  }

  /**
   * @brief Mount component and set up event listeners
   */
  public mount(container: HTMLElement): void {
    container.innerHTML = this.render()
    this.element = container.firstElementChild as HTMLElement
    this.mounted = true
    this.afterMount()
  }

  /**
   * @brief After mount lifecycle - set up event listeners
   */
  protected afterMount(): void {
    if (!this.element) {
      return
    }
    this.setupEventListeners(this.element)
    this.restoreFocus()
  }

  /**
   * @brief Save currently focused element before re-render
   */
  private saveFocus(): void {
    const activeElement = document.activeElement as HTMLElement
    if (activeElement && this.element?.contains(activeElement)) {
      // Save data attribute identifier
      this.lastFocusedElement = 
        activeElement.getAttribute('data-username-input') !== null ? 'data-username-input' :
        null
    }
  }

  /**
   * @brief Restore focus after re-render
   */
  private restoreFocus(): void {
    if (this.lastFocusedElement && this.element) {
      const elementToFocus = this.element.querySelector(`[${this.lastFocusedElement}]`) as HTMLElement
      if (elementToFocus) {
        // Restore focus and cursor position
        setTimeout(() => {
          elementToFocus.focus()
          // Restore cursor to end for input elements
          if (elementToFocus instanceof HTMLInputElement) {
            const len = elementToFocus.value.length
            elementToFocus.setSelectionRange(len, len)
          }
        }, 0)
      }
    }
  }

  /**
   * @brief Override setState to save focus before re-render
   */
  protected setState(stateUpdates: Partial<UsernameSelectionPageState>): void {
    this.saveFocus()
    super.setState(stateUpdates)
  }

  /**
   * @brief Set up event listeners
   */
  private setupEventListeners(container: HTMLElement): void {
    // Username input
    const usernameInput = container.querySelector('[data-username-input]') as HTMLInputElement
    if (usernameInput) {
      usernameInput.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement
        this.handleUsernameChange(target.value)
      })
      
      // Submit on Enter key
      usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          this.handleSubmit()
        }
      })
      
      // Focus input on mount
      usernameInput.focus()
    }
    
    // Submit button
    const submitButton = container.querySelector('[data-submit]')
    if (submitButton) {
      submitButton.addEventListener('click', () => {
        this.handleSubmit()
      })
    }
  }

  /**
   * @brief Before unmount lifecycle - clean up timers
   */
  protected beforeUnmount(): void {
    if (this.checkTimeout !== null) {
      clearTimeout(this.checkTimeout)
      this.checkTimeout = null
    }
  }
}
