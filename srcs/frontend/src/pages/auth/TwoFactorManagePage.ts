/**
 * @brief Two-Factor Authentication Management Page
 * 
 * @description Allows users to manage their 2FA settings:
 * - View current 2FA status
 * - Disable 2FA (with password confirmation)
 * - Regenerate backup codes
 * - Setup 2FA if not enabled
 */

import { authService } from '../../services/auth/AuthService'
import { router } from '../../router/router'

interface TwoFactorManagePageProps {
  onNavigate?: (path: string) => void
}

interface ManageState {
  step: 'loading' | 'overview' | 'disable' | 'success' | 'error'
  is2FAEnabled: boolean
  password: string
  token: string
  error?: string
  isSubmitting: boolean
  showBackupCodes: boolean
}

export class TwoFactorManagePage {
  private props: TwoFactorManagePageProps
  private state: ManageState = {
    step: 'loading',
    is2FAEnabled: false,
    password: '',
    token: '',
    isSubmitting: false,
    showBackupCodes: false
  }

  constructor(props: TwoFactorManagePageProps = {}) {
    this.props = props
  }

  /**
   * @brief Mount the 2FA management page
   */
  async mount(container: HTMLElement): Promise<void> {
    container.innerHTML = this.render()
    this.addEventListeners(container)
    
    // Check current 2FA status
    await this.checkCurrentStatus()
  }

  /**
   * @brief Check current 2FA status
   */
  private async checkCurrentStatus(): Promise<void> {
    try {
      const user = authService.getCurrentUser()
      if (user) {
        this.state.is2FAEnabled = authService.is2FAEnabled()
        this.state.step = 'overview'
        this.updateView()
      } else {
        this.state.step = 'error'
        this.state.error = 'Please log in to manage 2FA settings'
        this.updateView()
      }
    } catch (error) {
      console.error('Failed to check 2FA status:', error)
      this.state.step = 'error'
      this.state.error = 'Failed to load 2FA settings'
      this.updateView()
    }
  }

  /**
   * @brief Handle 2FA disable
   */
  private async handleDisable2FA(): Promise<void> {
    if (!this.state.password || this.state.isSubmitting) return
    
    this.state.isSubmitting = true
    this.updateSubmitButton()
    
    try {
      const response = await authService.disable2FA(
        this.state.password,
        this.state.token || undefined
      )
      
      if (response.success) {
        this.state.step = 'success'
        this.state.is2FAEnabled = false
        this.updateView()
        
        // Auto-redirect after showing success
        setTimeout(() => {
          this.state.step = 'overview'
          this.updateView()
        }, 3000)
      } else {
        this.showError(response.message || '2FA disable failed')
      }
    } catch (error) {
      console.error('2FA disable failed:', error)
      this.showError(
        error instanceof Error ? error.message : 'Failed to disable 2FA. Please try again.'
      )
    } finally {
      this.state.isSubmitting = false
      this.updateSubmitButton()
    }
  }

  /**
   * @brief Navigate to 2FA setup
   */
  private navigateToSetup(): void {
    if (this.props.onNavigate) {
      this.props.onNavigate('/setup-2fa')
    } else {
      router.navigate('/setup-2fa')
    }
  }

  /**
   * @brief Show error message
   */
  private showError(message: string): void {
    this.state.error = message
    const errorEl = document.querySelector('#manage-error')
    if (errorEl) {
      errorEl.textContent = message
      errorEl.classList.remove('hidden')
      
      // Hide error after 5 seconds
      setTimeout(() => {
        errorEl.classList.add('hidden')
      }, 5000)
    }
  }

  /**
   * @brief Add event listeners
   */
  private addEventListeners(container: HTMLElement): void {
    // Password input
    const passwordInput = container.querySelector('#disable-password') as HTMLInputElement
    if (passwordInput) {
      passwordInput.addEventListener('input', (e) => {
        this.state.password = (e.target as HTMLInputElement).value
        this.updateSubmitButton()
      })
    }

    // Token input
    const tokenInput = container.querySelector('#disable-token') as HTMLInputElement
    if (tokenInput) {
      tokenInput.addEventListener('input', (e) => {
        this.state.token = (e.target as HTMLInputElement).value.replace(/\s/g, '')
        this.updateSubmitButton()
      })
    }

    // Disable 2FA button
    const disableBtn = container.querySelector('#disable-2fa-btn')
    if (disableBtn) {
      disableBtn.addEventListener('click', () => this.handleDisable2FA())
    }

    // Show disable form button
    const showDisableBtn = container.querySelector('#show-disable-form')
    if (showDisableBtn) {
      showDisableBtn.addEventListener('click', () => {
        this.state.step = 'disable'
        this.updateView()
      })
    }

    // Setup 2FA button
    const setupBtn = container.querySelector('#setup-2fa-btn')
    if (setupBtn) {
      setupBtn.addEventListener('click', () => this.navigateToSetup())
    }

    // Cancel button
    const cancelBtn = container.querySelector('#cancel-disable')
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.state.step = 'overview'
        this.state.password = ''
        this.state.token = ''
        this.updateView()
      })
    }

    // Back to profile button
    const backBtn = container.querySelector('#back-to-profile')
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (this.props.onNavigate) {
          this.props.onNavigate('/profile')
        } else {
          router.navigate('/profile')
        }
      })
    }
  }

  /**
   * @brief Update submit button state
   */
  private updateSubmitButton(): void {
    const submitBtn = document.querySelector('#disable-2fa-btn') as HTMLButtonElement
    if (submitBtn) {
      const hasPassword = this.state.password.length >= 8
      submitBtn.disabled = !hasPassword || this.state.isSubmitting
      submitBtn.textContent = this.state.isSubmitting 
        ? '🔄 Disabling...' 
        : '🔓 Disable 2FA'
    }
  }

  /**
   * @brief Update view based on current state
   */
  private updateView(): void {
    const container = document.querySelector('#manage-container')
    if (container) {
      container.innerHTML = this.renderCurrentStep()
      this.addEventListeners(container as HTMLElement)
    }
  }

  /**
   * @brief Render current step content
   */
  private renderCurrentStep(): string {
    switch (this.state.step) {
      case 'loading':
        return this.renderLoadingStep()
      case 'overview':
        return this.renderOverviewStep()
      case 'disable':
        return this.renderDisableStep()
      case 'success':
        return this.renderSuccessStep()
      case 'error':
        return this.renderErrorStep()
      default:
        return this.renderLoadingStep()
    }
  }

  /**
   * @brief Render loading step
   */
  private renderLoadingStep(): string {
    return `
      <div class="text-center">
        <div class="text-6xl mb-6 animate-pulse">🔐</div>
        <h2 class="text-2xl font-bold mb-4">Loading 2FA Settings</h2>
        <p class="text-green-500">Please wait...</p>
        <div class="mt-4">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-400"></div>
        </div>
      </div>
    `
  }

  /**
   * @brief Render overview step
   */
  private renderOverviewStep(): string {
    return `
      <div class="max-w-md mx-auto">
        <div class="text-center mb-6">
          <div class="text-6xl mb-4">${this.state.is2FAEnabled ? '🔐' : '🔓'}</div>
          <h2 class="text-2xl font-bold mb-2">Two-Factor Authentication</h2>
          <p class="text-green-500">
            2FA is currently <strong>${this.state.is2FAEnabled ? 'ENABLED' : 'DISABLED'}</strong>
          </p>
        </div>

        <!-- Current Status -->
        <div class="mb-6">
          <div class="bg-${this.state.is2FAEnabled ? 'green' : 'yellow'}-900/30 border border-${this.state.is2FAEnabled ? 'green' : 'yellow'}-500 rounded-lg p-4">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-bold text-${this.state.is2FAEnabled ? 'green' : 'yellow'}-400">
                  ${this.state.is2FAEnabled ? '✅ Protected' : '⚠️ Unprotected'}
                </h3>
                <p class="text-sm text-${this.state.is2FAEnabled ? 'green' : 'yellow'}-200 mt-1">
                  ${this.state.is2FAEnabled 
                    ? 'Your account has an extra layer of security'
                    : 'Your account could benefit from extra security'
                  }
                </p>
              </div>
              <div class="text-2xl">
                ${this.state.is2FAEnabled ? '🛡️' : '🔓'}
              </div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="space-y-4">
          ${this.state.is2FAEnabled ? `
            <button 
              id="show-disable-form"
              class="w-full px-4 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-all"
            >
              🔓 Disable Two-Factor Authentication
            </button>
          ` : `
            <button 
              id="setup-2fa-btn"
              class="w-full px-4 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-all"
            >
              🔐 Setup Two-Factor Authentication
            </button>
          `}
          
          <button 
            id="back-to-profile"
            class="w-full px-4 py-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-lg transition-all"
          >
            ← Back to Profile
          </button>
        </div>

        <!-- Information -->
        <div class="mt-8">
          <details class="cursor-pointer">
            <summary class="text-sm text-green-400 hover:text-green-300">ℹ️ About Two-Factor Authentication</summary>
            <div class="mt-4 text-left bg-gray-800 p-4 rounded-lg border border-gray-600">
              <p class="text-sm text-gray-300 mb-3">
                Two-factor authentication (2FA) adds an extra layer of security to your account by requiring:
              </p>
              <ul class="text-sm text-gray-300 space-y-1 mb-3">
                <li>• Something you know (your password)</li>
                <li>• Something you have (your phone)</li>
              </ul>
              <p class="text-xs text-gray-400">
                Even if someone gets your password, they won't be able to access your account without your phone.
              </p>
            </div>
          </details>
        </div>
      </div>
    `
  }

  /**
   * @brief Render disable step
   */
  private renderDisableStep(): string {
    return `
      <div class="max-w-md mx-auto">
        <div class="text-center mb-6">
          <div class="text-6xl mb-4">🔓</div>
          <h2 class="text-2xl font-bold mb-2 text-red-400">Disable Two-Factor Authentication</h2>
          <p class="text-red-300">Please confirm this action with your password</p>
        </div>

        <!-- Warning -->
        <div class="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6">
          <div class="flex items-start space-x-3">
            <div class="text-red-400 text-xl">⚠️</div>
            <div>
              <h3 class="font-bold text-red-400 mb-1">Security Warning</h3>
              <p class="text-red-200 text-sm">
                Disabling 2FA will make your account less secure. You'll only need your password to log in.
              </p>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <!-- Password Input -->
          <div>
            <label for="disable-password" class="block text-sm font-medium text-gray-300 mb-2">
              Current Password *
            </label>
            <input 
              type="password" 
              id="disable-password"
              placeholder="Enter your current password"
              class="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg focus:border-red-400 focus:outline-none"
              autocomplete="current-password"
              value="${this.state.password}"
            />
          </div>

          <!-- Optional 2FA Token -->
          <div>
            <label for="disable-token" class="block text-sm font-medium text-gray-300 mb-2">
              2FA Code (Optional)
            </label>
            <input 
              type="text" 
              id="disable-token"
              placeholder="000000"
              maxlength="6"
              class="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-center font-mono focus:border-red-400 focus:outline-none"
              autocomplete="off"
              inputmode="numeric"
              value="${this.state.token}"
            />
            <p class="text-xs text-gray-400 mt-1">
              Providing a 2FA code adds extra security to this action
            </p>
          </div>

          <div id="manage-error" class="hidden bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg text-sm"></div>

          <button 
            id="disable-2fa-btn"
            disabled
            class="w-full px-4 py-3 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all"
          >
            🔓 Disable 2FA
          </button>
          
          <button 
            id="cancel-disable"
            class="w-full px-4 py-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-lg transition-all"
          >
            ❌ Cancel
          </button>
        </div>
      </div>
    `
  }

  /**
   * @brief Render success step
   */
  private renderSuccessStep(): string {
    return `
      <div class="text-center">
        <div class="text-6xl mb-6">✅</div>
        <h2 class="text-2xl font-bold mb-4 text-green-400">2FA Disabled Successfully</h2>
        <p class="text-green-500 mb-6">Two-factor authentication has been disabled for your account.</p>
        
        <div class="bg-yellow-900/30 border border-yellow-500 rounded-lg p-4 mb-6">
          <p class="text-yellow-200 text-sm">
            <strong>⚠️ Security Notice:</strong> Your account is now less secure. Consider re-enabling 2FA for better protection.
          </p>
        </div>
        
        <p class="text-gray-400 text-sm">Returning to overview...</p>
      </div>
    `
  }

  /**
   * @brief Render error step
   */
  private renderErrorStep(): string {
    return `
      <div class="text-center">
        <div class="text-6xl mb-6">❌</div>
        <h2 class="text-2xl font-bold mb-4 text-red-400">Error</h2>
        <p class="text-red-300 mb-6">${this.state.error}</p>
        
        <div class="space-y-4">
          <button 
            onclick="location.reload()"
            class="px-6 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-all"
          >
            🔄 Retry
          </button>
          
          <button 
            id="back-to-profile"
            class="px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-lg transition-all"
          >
            ← Back to Profile
          </button>
        </div>
      </div>
    `
  }

  /**
   * @brief Main render method
   */
  render(): string {
    return `
      <div class="min-h-screen bg-black text-green-400 font-mono py-8 px-4">
        <div class="max-w-2xl mx-auto">
          <!-- Header -->
          <div class="text-center mb-8">
            <h1 class="text-3xl font-bold mb-2 neon-glow">🔐 Manage Two-Factor Authentication</h1>
            <p class="text-green-500">Control your account security settings</p>
          </div>

          <!-- Manage Container -->
          <div id="manage-container" class="bg-gray-900 rounded-lg p-6 border border-green-400/30">
            ${this.renderCurrentStep()}
          </div>
        </div>
      </div>
    `
  }
}