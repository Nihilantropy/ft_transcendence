/**
 * @brief Username Selection Page for ft_transcendence
 * 
 * @description Simple page for users to choose a unique username after registration.
 * Users can input a custom username or skip to get a random 16-digit number.
 */

import { Component } from '../../components/base/Component'
import { authService } from '../../services/auth/AuthService'
import { showPopup } from '../../components/ui/Popup'
import { router } from '../../router/router'
import { catchErrorTyped } from '../../services/error'

interface UsernameSelectionState {
  isLoading: boolean
  isCheckingAvailability: boolean
  username: string
  isUsernameAvailable: boolean | null
  errorMessage: string | null
  successMessage: string | null
}

/**
 * @brief Username selection component
 * 
 * @description Simple component for users to choose their username after registration.
 */
export class UsernameSelectionPage extends Component<{}, UsernameSelectionState> {
  constructor() {
    super({}, {
      isLoading: false,
      isCheckingAvailability: false,
      username: '',
      isUsernameAvailable: null,
      errorMessage: null,
      successMessage: null
    })
    
    // Check if user is authenticated, redirect to login if not
    this.checkAuthenticationStatus()
  }

  /**
   * @brief Check if user is authenticated
   */
  private checkAuthenticationStatus(): void {
    if (!authService.isAuthenticated()) {
      showPopup('You must be logged in to set your username')
      router.navigate('/login')
      return
    }
  }

  /**
   * @brief Handle username form submission
   */
  private async handleUsernameSubmit(event: Event): Promise<void> {
    event.preventDefault()
    
    const form = event.target as HTMLFormElement
    const formData = new FormData(form)
    const username = (formData.get('username') as string)?.trim()

    if (!username) {
      showPopup('Please enter a username')
      return
    }

    if (username.length < 3) {
      showPopup('Username must be at least 3 characters long')
      return
    }

    if (username.length > 20) {
      showPopup('Username must be less than 20 characters long')
      return
    }

    // Check if username contains only valid characters
    const usernameRegex = /^[a-zA-Z0-9_-]+$/
    if (!usernameRegex.test(username)) {
      showPopup('Username can only contain letters, numbers, underscores, and hyphens')
      return
    }

    await this.setUsername(username)
  }

  /**
   * @brief Handle skip username (use random username)
   */
  private async handleSkipUsername(): Promise<void> {
    // Generate a random 16-digit number for username
    const randomUsername = Math.floor(Math.random() * 10000000000000000).toString().padStart(16, '0')
    await this.setUsername(randomUsername)
  }

  /**
   * @brief Set the username for the current user
   */
  private async setUsername(username: string): Promise<void> {
    this.setState({ 
      isLoading: true, 
      errorMessage: null 
    })

    const [error, response] = await catchErrorTyped(
      authService.setUsername(username)
    )

    if (error) {
      console.error('❌ Username setting error:', error)
      
      const errorMessage = error.message || 'Failed to set username. Please try again.'
      
      this.setState({ 
        errorMessage,
        isLoading: false
      })
      
      showPopup(errorMessage)
      return
    }

    if (!response) {
      const errorMessage = 'No response received from server'
      this.setState({ 
        errorMessage,
        isLoading: false
      })
      showPopup(errorMessage)
      return
    }

    console.log('🏷️ Username set successfully:', username)

    if (response.success) {
      this.setState({ 
        successMessage: 'Username set successfully!',
        isLoading: false
      })
      
      showPopup(`Username "${username}" set successfully! Welcome to ft_transcendence!`)
      
      // Redirect to home/dashboard after successful username setup
      setTimeout(() => {
        router.navigate('/')
      }, 2000)
    } else {
      const errorMessage = response.message || 'Failed to set username. Please try again.'
      this.setState({ 
        errorMessage,
        isLoading: false
      })
      showPopup(errorMessage)
    }
  }

  /**
   * @brief Check username availability as user types
   */
  private async checkUsernameAvailability(username: string): Promise<void> {
    if (!username || username.length < 3) {
      this.setState({ isUsernameAvailable: null })
      return
    }

    this.setState({ isCheckingAvailability: true })

    const [error, result] = await catchErrorTyped(
      authService.checkUsernameAvailability(username)
    )

    if (error) {
      console.error('❌ Username availability check error:', error)
      this.setState({ 
        isUsernameAvailable: null,
        isCheckingAvailability: false
      })
      return
    }

    // Handle the new AuthResponse format
    if (result && result.success && result.available !== undefined) {
      this.setState({ 
        isUsernameAvailable: result.available,
        isCheckingAvailability: false
      })
    } else {
      // If the API call failed, treat as unavailable
      this.setState({ 
        isUsernameAvailable: false,
        isCheckingAvailability: false
      })
    }
  }

  /**
   * @brief Handle username input change
   */
  private handleUsernameInput(event: Event): void {
    const input = event.target as HTMLInputElement
    const username = input.value.trim()
    
    this.setState({ username })
    
    // Debounce the availability check
    clearTimeout((this as any).usernameTimeout)
    ;(this as any).usernameTimeout = setTimeout(() => {
      this.checkUsernameAvailability(username)
    }, 300)
  }

  public render(): string {
    const { isLoading, isCheckingAvailability, username, isUsernameAvailable, errorMessage, successMessage } = this.state

    const availabilityIndicator = () => {
      if (!username || username.length < 3) return ''
      if (isCheckingAvailability) return '<span class="text-blue-400">⏳ Checking...</span>'
      if (isUsernameAvailable === true) return '<span class="text-green-400">✅ Available</span>'
      if (isUsernameAvailable === false) return '<span class="text-red-400">❌ Taken</span>'
      return ''
    }

    return `
      <div class="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div class="max-w-md w-full space-y-8">
          <!-- Header -->
          <div class="text-center">
            <h1 class="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500 mb-2">
              Choose Your Username
            </h1>
            <p class="text-gray-300 text-lg">
              Pick a unique username for your account
            </p>
          </div>

          <!-- Username Selection Form -->
          <div class="bg-slate-800/50 backdrop-blur-sm rounded-xl p-8 border border-slate-700/50 shadow-2xl">
            ${successMessage ? `
              <div class="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg">
                <p class="text-green-400 text-center">✅ ${successMessage}</p>
              </div>
            ` : ''}

            ${errorMessage ? `
              <div class="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
                <p class="text-red-400 text-center">❌ ${errorMessage}</p>
              </div>
            ` : ''}

            <form class="space-y-6" data-form="username-selection">
              <div>
                <label for="username" class="block text-green-400 font-bold mb-2">
                  Username
                </label>
                <div class="relative">
                  <input
                    type="text"
                    id="username"
                    name="username"
                    class="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent text-white placeholder-gray-400"
                    placeholder="Enter your username"
                    value="${username}"
                    maxlength="20"
                    data-input="username"
                    ${isLoading ? 'disabled' : ''}
                  />
                  <div class="absolute right-3 top-3 text-sm">
                    ${availabilityIndicator()}
                  </div>
                </div>
                <p class="text-gray-400 text-sm mt-2">
                  3-20 characters, letters, numbers, underscore, and hyphen only
                </p>
              </div>

              <button
                type="submit"
                class="w-full py-3 bg-gradient-to-r from-green-500 to-blue-600 text-white font-bold rounded-lg hover:from-green-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                ${isLoading || isCheckingAvailability || (isUsernameAvailable === false) ? 'disabled' : ''}
              >
                ${isLoading ? '🔄 Setting Username...' : '✅ Set Username'}
              </button>
            </form>

            <!-- Skip Option -->
            <div class="mt-6 text-center">
              <button
                type="button"
                class="text-gray-400 hover:text-gray-300 underline text-sm"
                data-action="skip-username"
                ${isLoading ? 'disabled' : ''}
              >
                Skip for now (get random username)
              </button>
            </div>
          </div>

          <!-- Footer -->
          <div class="text-center">
            <p class="text-gray-400 text-sm">
              You can change your username later in your profile settings
            </p>
          </div>
        </div>
      </div>
    `
  }

  /**
   * @brief Attach event listeners after render
   */
  public afterRender(): void {
    // Username form submission
    const form = document.querySelector('[data-form="username-selection"]') as HTMLFormElement
    if (form) {
      form.addEventListener('submit', (event) => this.handleUsernameSubmit(event))
    }

    // Username input changes
    const usernameInput = document.querySelector('[data-input="username"]') as HTMLInputElement
    if (usernameInput) {
      usernameInput.addEventListener('input', (event) => this.handleUsernameInput(event))
    }

    // Skip username button
    const skipButton = document.querySelector('[data-action="skip-username"]') as HTMLButtonElement
    if (skipButton) {
      skipButton.addEventListener('click', () => this.handleSkipUsername())
    }
  }
}