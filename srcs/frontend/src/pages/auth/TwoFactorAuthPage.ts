/**
 * @brief Two-Factor Authentication Verification Page
 * 
 * @description Essential 2FA verification page for login process.
 * Allows users to enter TOTP token or backup code to complete authentication.
 */

import { authService } from '../../services/auth/AuthService'
import { router } from '../../router/router'
import { showPopup } from '../../components/ui/Popup'

export interface TwoFactorAuthPageProps {
  /** Temporary token from initial login */
  tempToken?: string
  /** Custom CSS classes */
  className?: string
}

interface TwoFactorAuthState {
  /** Input mode: 'totp' or 'backup' */
  inputMode: 'totp' | 'backup'
  /** TOTP token value */
  totpToken: string
  /** Backup code value */
  backupCode: string
  /** Submitting state */
  isSubmitting: boolean
}

/**
 * @brief Two-Factor Authentication verification page
 * 
 * @description Handles TOTP token and backup code verification during login.
 * Redirects to profile on success or shows error popup on failure.
 */
export class TwoFactorAuthPage {
  private props: TwoFactorAuthPageProps
  private state: TwoFactorAuthState = {
    inputMode: 'totp',
    totpToken: '',
    backupCode: '',
    isSubmitting: false
  }

  constructor(props: TwoFactorAuthPageProps = {}) {
    this.props = props
  }

  /**
   * @brief Mount component and set up event listeners
   */
  public mount(container: HTMLElement): void {
    container.innerHTML = this.render()
    this.setupEventListeners(container)
    
    // Check if user has 2FA enabled
    const user = authService.getCurrentUser()
    if (user && !user.twoFactorEnabled) {
      console.warn('⚠️ User does not have 2FA enabled')
    }
  }

  /**
   * @brief Handle TOTP verification
   */
  private async handleTOTPVerification(event: Event): Promise<void> {
    event.preventDefault()
    
    if (this.state.isSubmitting) return
    
    const token = this.state.totpToken.replace(/\s/g, '')
    
    if (!token || token.length !== 6) {
      showPopup('Please enter a valid 6-digit code')
      return
    }

    const tempToken = this.props.tempToken || sessionStorage.getItem('ft_2fa_temp_token')
    
    if (!tempToken) {
      showPopup('Session expired. Please log in again.')
      router.navigate('/login')
      return
    }

    this.state.isSubmitting = true
    this.updateSubmitButtonText()

    try {
      const response = await authService.verify2FA(tempToken, token, undefined)
      
      if (response.success) {
        // Clear temp token
        sessionStorage.removeItem('ft_2fa_temp_token')
        
        showPopup('✅ Login successful! Welcome back!')
        
        // Redirect to profile
        setTimeout(() => {
          router.navigate('/profile')
        }, 1000)
      } else {
        showPopup(response.message || '2FA verification failed')
        this.state.isSubmitting = false
        this.updateSubmitButtonText()
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed'
      showPopup(errorMessage)
      this.state.isSubmitting = false
      this.updateSubmitButtonText()
    }
  }

  /**
   * @brief Handle backup code verification
   */
  private async handleBackupCodeVerification(event: Event): Promise<void> {
    event.preventDefault()
    
    if (this.state.isSubmitting) return
    
    const backupCode = this.state.backupCode.trim().toUpperCase()
    
    if (!backupCode || backupCode.length < 8) {
      showPopup('Please enter a valid backup code')
      return
    }

    const tempToken = this.props.tempToken || sessionStorage.getItem('ft_2fa_temp_token')
    
    if (!tempToken) {
      showPopup('Session expired. Please log in again.')
      router.navigate('/login')
      return
    }

    this.state.isSubmitting = true
    this.updateSubmitButtonText()

    try {
      const response = await authService.verify2FA(tempToken, undefined, backupCode)
      
      if (response.success) {
        // Clear temp token
        sessionStorage.removeItem('ft_2fa_temp_token')
        
        showPopup('✅ Login successful! Welcome back!')
        
        // Redirect to profile
        setTimeout(() => {
          router.navigate('/profile')
        }, 1000)
      } else {
        showPopup(response.message || '2FA verification failed')
        this.state.isSubmitting = false
        this.updateSubmitButtonText()
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed'
      showPopup(errorMessage)
      this.state.isSubmitting = false
      this.updateSubmitButtonText()
    }
  }

  /**
   * @brief Switch between TOTP and backup code input
   */
  private switchInputMode(mode: 'totp' | 'backup'): void {
    this.state.inputMode = mode
    this.state.totpToken = ''
    this.state.backupCode = ''
    this.updateView()
  }

  /**
   * @brief Handle navigation to home
   */
  private handleGoHome(): void {
    // Clear temp token
    sessionStorage.removeItem('ft_2fa_temp_token')
    router.navigate('/')
  }

  /**
   * @brief Handle navigation to 2FA setup
   */
  private handleGoToSetup(): void {
    const user = authService.getCurrentUser()
    
    if (user && !user.twoFactorEnabled) {
      // Clear temp token
      sessionStorage.removeItem('ft_2fa_temp_token')
      router.navigate('/setup-2fa')
    } else {
      showPopup('2FA is already enabled for your account')
    }
  }

  /**
   * @brief Update submit button text based on submitting state
   */
  private updateSubmitButtonText(): void {
    const submitBtn = document.querySelector('#verify-btn') as HTMLButtonElement
    if (submitBtn) {
      if (this.state.isSubmitting) {
        submitBtn.textContent = '🔄 Verifying...'
      } else {
        submitBtn.textContent = '✅ Verify'
      }
    }
  }

  /**
   * @brief Update view dynamically
   */
  private updateView(): void {
    const container = document.querySelector('#auth-content')
    if (container) {
      container.innerHTML = this.renderAuthContent()
      
      // Re-attach event listeners for the new content
      const formContainer = container.parentElement
      if (formContainer) {
        this.setupEventListeners(formContainer as HTMLElement)
      }
    }
  }

  /**
   * @brief Set up event listeners
   */
  private setupEventListeners(container: HTMLElement): void {
    // TOTP form handler
    const totpForm = container.querySelector('#totp-form')
    if (totpForm) {
      totpForm.addEventListener('submit', (e) => this.handleTOTPVerification(e))
    }

    // Backup code form handler
    const backupForm = container.querySelector('#backup-form')
    if (backupForm) {
      backupForm.addEventListener('submit', (e) => this.handleBackupCodeVerification(e))
    }

    // TOTP input handler
    const totpInput = container.querySelector('#totp-token') as HTMLInputElement
    if (totpInput) {
      totpInput.addEventListener('input', (e) => {
        const value = (e.target as HTMLInputElement).value.replace(/\s/g, '')
        this.state.totpToken = value
      })
    }

    // Backup code input handler
    const backupInput = container.querySelector('#backup-code') as HTMLInputElement
    if (backupInput) {
      backupInput.addEventListener('input', (e) => {
        this.state.backupCode = (e.target as HTMLInputElement).value
      })
    }

    // Switch to backup code
    const switchToBackupBtn = container.querySelector('#switch-to-backup')
    if (switchToBackupBtn) {
      switchToBackupBtn.addEventListener('click', () => this.switchInputMode('backup'))
    }

    // Switch to TOTP
    const switchToTotpBtn = container.querySelector('#switch-to-totp')
    if (switchToTotpBtn) {
      switchToTotpBtn.addEventListener('click', () => this.switchInputMode('totp'))
    }

    // Home button
    const homeBtn = container.querySelector('#go-home-btn')
    if (homeBtn) {
      homeBtn.addEventListener('click', () => this.handleGoHome())
    }

    // Setup button
    const setupBtn = container.querySelector('#go-setup-btn')
    if (setupBtn) {
      setupBtn.addEventListener('click', () => this.handleGoToSetup())
    }
  }

  /**
   * @brief Render authentication content based on mode
   */
  private renderAuthContent(): string {
    if (this.state.inputMode === 'totp') {
      return this.renderTOTPForm()
    } else {
      return this.renderBackupCodeForm()
    }
  }

  /**
   * @brief Render TOTP form
   */
  private renderTOTPForm(): string {
    const user = authService.getCurrentUser()
    const has2FAEnabled = user?.twoFactorEnabled || false

    return `
      <form id="totp-form" class="space-y-6">
        <div class="text-center mb-6">
          <div class="text-6xl mb-4">🔐</div>
          <h2 class="text-2xl font-bold mb-2">Two-Factor Authentication</h2>
          <p class="text-green-500">Enter the 6-digit code from your authenticator app</p>
        </div>

        <div>
          <label for="totp-token" class="block text-green-400 font-bold mb-2">
            Verification Code
          </label>
          <input
            type="text"
            id="totp-token"
            placeholder="000 000"
            maxlength="7"
            class="w-full px-4 py-3 bg-gray-900 border border-green-600 rounded-lg text-center text-2xl font-mono tracking-wider text-green-400 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
            autocomplete="off"
            inputmode="numeric"
            ${this.state.isSubmitting ? 'disabled' : ''}
            required
          />
          <p class="text-xs text-gray-400 mt-2 text-center">Enter the code without spaces</p>
        </div>

        <button
          type="submit"
          id="verify-btn"
          class="w-full px-6 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-all transform hover:scale-105 ${this.state.isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}"
        >
          ✅ Verify
        </button>

        <div class="text-center">
          <button
            type="button"
            id="switch-to-backup"
            class="text-green-500 hover:text-green-400 underline text-sm"
          >
            Use a backup code instead
          </button>
        </div>

        <div class="border-t border-gray-700 pt-4 space-y-2">
          <button
            type="button"
            id="go-home-btn"
            class="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all"
          >
            🏠 Go to Home
          </button>
          ${!has2FAEnabled ? `
            <button
              type="button"
              id="go-setup-btn"
              class="w-full px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg transition-all"
            >
              🔐 Setup 2FA
            </button>
          ` : ''}
        </div>
      </form>
    `
  }

  /**
   * @brief Render backup code form
   */
  private renderBackupCodeForm(): string {
    const user = authService.getCurrentUser()
    const has2FAEnabled = user?.twoFactorEnabled || false

    return `
      <form id="backup-form" class="space-y-6">
        <div class="text-center mb-6">
          <div class="text-6xl mb-4">🔑</div>
          <h2 class="text-2xl font-bold mb-2">Use Backup Code</h2>
          <p class="text-green-500">Enter one of your backup recovery codes</p>
        </div>

        <div>
          <label for="backup-code" class="block text-green-400 font-bold mb-2">
            Backup Code
          </label>
          <input
            type="text"
            id="backup-code"
            placeholder="XXXXXXXX"
            class="w-full px-4 py-3 bg-gray-900 border border-green-600 rounded-lg text-center text-xl font-mono tracking-wider text-green-400 uppercase focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
            autocomplete="off"
            ${this.state.isSubmitting ? 'disabled' : ''}
            required
          />
          <p class="text-xs text-gray-400 mt-2 text-center">Each backup code can only be used once</p>
        </div>

        <div class="bg-yellow-900/30 border border-yellow-500 rounded-lg p-4">
          <p class="text-yellow-200 text-sm">
            <strong>⚠️ Note:</strong> Once used, this backup code will be permanently invalidated.
          </p>
        </div>

        <button
          type="submit"
          id="verify-btn"
          class="w-full px-6 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-all transform hover:scale-105 ${this.state.isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}"
        >
          ✅ Verify
        </button>

        <div class="text-center">
          <button
            type="button"
            id="switch-to-totp"
            class="text-green-500 hover:text-green-400 underline text-sm"
          >
            Use authenticator code instead
          </button>
        </div>

        <div class="border-t border-gray-700 pt-4 space-y-2">
          <button
            type="button"
            id="go-home-btn"
            class="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all"
          >
            🏠 Go to Home
          </button>
          ${!has2FAEnabled ? `
            <button
              type="button"
              id="go-setup-btn"
              class="w-full px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg transition-all"
            >
              🔐 Setup 2FA
            </button>
          ` : ''}
        </div>
      </form>
    `
  }

  /**
   * @brief Render component
   */
  public render(): string {
    return `
      <div class="min-h-screen bg-black text-green-400 font-mono py-8 px-4 scrollable-page">
        <div class="max-w-md mx-auto">
          <!-- Header -->
          <div class="text-center mb-8">
            <h1 class="text-3xl font-bold mb-2 neon-glow">🛡️ Secure Login</h1>
            <p class="text-green-500">Complete your authentication</p>
          </div>

          <!-- Auth Content -->
          <div id="auth-content" class="bg-gray-900 rounded-lg p-6 border border-green-400/30">
            ${this.renderAuthContent()}
          </div>

          <!-- Help Section -->
          <div class="mt-8 text-center">
            <details class="cursor-pointer">
              <summary class="text-sm text-green-400 hover:text-green-300">📖 Need help?</summary>
              <div class="mt-4 text-left bg-gray-800 p-4 rounded-lg border border-gray-600">
                <h3 class="font-bold mb-2">Trouble signing in?</h3>
                <ul class="text-sm text-gray-300 space-y-2">
                  <li>• Make sure your device time is synchronized</li>
                  <li>• Check that you're using the correct authenticator app</li>
                  <li>• Use a backup code if you lost access to your authenticator</li>
                  <li>• Contact support if you've lost both your authenticator and backup codes</li>
                </ul>
              </div>
            </details>
          </div>
        </div>
      </div>
    `
  }
}
