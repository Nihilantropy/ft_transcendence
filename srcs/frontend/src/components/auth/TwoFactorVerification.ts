/**
 * @brief Two-Factor Authentication Verification Component
 * 
 * @description Minimal 2FA verification component for login process.
 * Handles TOTP tokens and backup codes.
 */

import { authService } from '../../services/auth/AuthService'

interface TwoFactorVerificationProps {
  onSuccess: (authResponse: any) => void
  onError: (error: string) => void
  onCancel?: () => void
  username?: string
}

interface VerificationState {
  token: string
  useBackupCode: boolean
  isSubmitting: boolean
  error?: string
  attemptsRemaining: number
}

export class TwoFactorVerification {
  private props: TwoFactorVerificationProps
  private state: VerificationState = {
    token: '',
    useBackupCode: false,
    isSubmitting: false,
    attemptsRemaining: 3
  }

  constructor(props: TwoFactorVerificationProps) {
    this.props = props
  }

  /**
   * @brief Mount component to DOM
   */
  mount(container: HTMLElement): void {
    container.innerHTML = this.render()
    this.addEventListeners(container)
    
    // Focus on input
    const tokenInput = container.querySelector('#twofa-token') as HTMLInputElement
    if (tokenInput) {
      tokenInput.focus()
    }
  }

  /**
   * @brief Handle token verification
   */
  private async handleVerifyToken(): Promise<void> {
    if (!this.state.token || this.state.isSubmitting) return
    
    this.state.isSubmitting = true
    this.updateSubmitButton()
    
    try {
      const response = this.state.useBackupCode ? 
        await authService.verify2FA(undefined, this.state.token) :
        await authService.verify2FA(this.state.token)
      
      if (response.success) {
        this.props.onSuccess(response)
      } else {
        this.state.attemptsRemaining--
        
        if (this.state.attemptsRemaining <= 0) {
          this.props.onError('Too many failed attempts. Please try logging in again.')
          return
        }
        
        this.showError(response.message || 'Invalid verification code')
      }
    } catch (error) {
      console.error('2FA verification failed:', error)
      this.showError('Verification failed. Please try again.')
    } finally {
      this.state.isSubmitting = false
      this.updateSubmitButton()
    }
  }

  /**
   * @brief Toggle between TOTP and backup code input
   */
  private toggleBackupCode(): void {
    this.state.useBackupCode = !this.state.useBackupCode
    this.state.token = ''
    this.updateView()
  }

  /**
   * @brief Update view
   */
  private updateView(): void {
    const container = document.querySelector('#twofa-container')
    if (container) {
      container.innerHTML = this.renderVerificationForm()
      this.addEventListeners(container as HTMLElement)
      
      // Focus on input after update
      const tokenInput = container.querySelector('#twofa-token') as HTMLInputElement
      if (tokenInput) {
        tokenInput.focus()
      }
    }
  }

  /**
   * @brief Add event listeners
   */
  private addEventListeners(container: HTMLElement): void {
    // Token input handler
    const tokenInput = container.querySelector('#twofa-token') as HTMLInputElement
    if (tokenInput) {
      tokenInput.addEventListener('input', (e) => {
        const value = (e.target as HTMLInputElement).value
        this.state.token = this.state.useBackupCode ? value : value.replace(/\s/g, '')
        this.updateSubmitButton()
      })
      
      tokenInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.handleVerifyToken()
        }
      })
    }

    // Verify button
    const verifyBtn = container.querySelector('#verify-twofa-btn')
    if (verifyBtn) {
      verifyBtn.addEventListener('click', () => this.handleVerifyToken())
    }

    // Toggle backup code
    const toggleBtn = container.querySelector('#toggle-backup-code')
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleBackupCode())
    }

    // Cancel button
    const cancelBtn = container.querySelector('#cancel-twofa')
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        if (this.props.onCancel) {
          this.props.onCancel()
        }
      })
    }
  }

  /**
   * @brief Update submit button state
   */
  private updateSubmitButton(): void {
    const submitBtn = document.querySelector('#verify-twofa-btn') as HTMLButtonElement
    if (submitBtn) {
      const minLength = this.state.useBackupCode ? 8 : 6
      const isValid = this.state.token.length >= minLength
      
      submitBtn.disabled = !isValid || this.state.isSubmitting
      submitBtn.textContent = this.state.isSubmitting ? '🔄 Verifying...' : '✅ Verify'
    }
  }

  /**
   * @brief Show error message
   */
  private showError(message: string): void {
    this.state.error = message
    const errorEl = document.querySelector('#twofa-error')
    if (errorEl) {
      errorEl.textContent = message
      errorEl.classList.remove('hidden')
      
      // Clear token on error
      this.state.token = ''
      const tokenInput = document.querySelector('#twofa-token') as HTMLInputElement
      if (tokenInput) {
        tokenInput.value = ''
        tokenInput.focus()
      }
      
      // Hide error after 5 seconds
      setTimeout(() => {
        errorEl.classList.add('hidden')
      }, 5000)
    }
  }

  /**
   * @brief Render verification form
   */
  private renderVerificationForm(): string {
    const inputType = this.state.useBackupCode ? 'text' : 'text'
    const placeholder = this.state.useBackupCode ? 'Enter backup code' : '000 000'
    const maxLength = this.state.useBackupCode ? 12 : 7
    const helpText = this.state.useBackupCode ? 
      'Enter one of your saved backup codes' : 
      'Enter the 6-digit code from your authenticator app'

    return `
      <div class="space-y-6">
        <!-- Token Input -->
        <div>
          <label for="twofa-token" class="block text-sm font-medium text-green-400 mb-2">
            ${this.state.useBackupCode ? '🔑 Backup Code' : '📱 Authenticator Code'}
          </label>
          <input 
            type="${inputType}" 
            id="twofa-token"
            placeholder="${placeholder}"
            maxlength="${maxLength}"
            class="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-center ${this.state.useBackupCode ? 'text-base font-mono' : 'text-2xl font-mono tracking-wider'} focus:border-green-400 focus:outline-none"
            autocomplete="off"
            ${this.state.useBackupCode ? '' : 'inputmode="numeric"'}
          />
          <p class="text-xs text-gray-400 mt-2 text-center">${helpText}</p>
        </div>

        <!-- Error Display -->
        <div id="twofa-error" class="hidden bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg text-sm"></div>

        <!-- Attempts Remaining -->
        ${this.state.attemptsRemaining < 3 ? `
          <div class="bg-yellow-900/50 border border-yellow-500 text-yellow-200 px-4 py-3 rounded-lg text-sm text-center">
            ⚠️ ${this.state.attemptsRemaining} attempt${this.state.attemptsRemaining !== 1 ? 's' : ''} remaining
          </div>
        ` : ''}

        <!-- Action Buttons -->
        <div class="space-y-3">
          <button 
            id="verify-twofa-btn"
            disabled
            class="w-full px-4 py-3 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-bold rounded-lg transition-all"
          >
            ✅ Verify
          </button>

          <button 
            id="toggle-backup-code"
            class="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-green-400 font-medium rounded-lg transition-all text-sm"
          >
            ${this.state.useBackupCode ? '📱 Use Authenticator Code' : '🔑 Use Backup Code'}
          </button>

          ${this.props.onCancel ? `
            <button 
              id="cancel-twofa"
              class="w-full px-4 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-all"
            >
              ❌ Cancel Login
            </button>
          ` : ''}
        </div>
      </div>
    `
  }

  /**
   * @brief Main render method
   */
  render(): string {
    return `
      <div class="bg-gray-900 rounded-lg p-6 border border-green-400/30 max-w-md mx-auto">
        <!-- Header -->
        <div class="text-center mb-6">
          <div class="text-6xl mb-4">🔐</div>
          <h2 class="text-2xl font-bold mb-2">Two-Factor Authentication</h2>
          <p class="text-green-500 text-sm">
            ${this.props.username ? `Welcome back, ${this.props.username}!` : 'Welcome back!'}<br>
            Please verify your identity to continue.
          </p>
        </div>

        <!-- Verification Form Container -->
        <div id="twofa-container">
          ${this.renderVerificationForm()}
        </div>

        <!-- Help Section -->
        <div class="mt-6 text-center">
          <details class="cursor-pointer">
            <summary class="text-xs text-green-400 hover:text-green-300">Need help?</summary>
            <div class="mt-2 text-left bg-gray-800 p-3 rounded border border-gray-600">
              <p class="text-xs text-gray-300 mb-2">
                <strong>Lost your phone?</strong> Use a backup code instead.
              </p>
              <p class="text-xs text-gray-300">
                <strong>Can't access codes?</strong> Contact support to recover your account.
              </p>
            </div>
          </details>
        </div>
      </div>
    `
  }
}