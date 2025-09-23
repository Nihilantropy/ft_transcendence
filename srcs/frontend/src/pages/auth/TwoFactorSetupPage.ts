/**
 * @brief Two-Factor Authentication Setup Page
 * 
 * @description Essential 2FA setup page with QR code generation and backup codes.
 * Minimal implementation focusing on core security features.
 */

import { authService } from '../../services/auth/AuthService'
import { router } from '../../router/router'

interface TwoFactorSetupPageProps {
  onComplete?: () => void
}

interface SetupState {
  step: 'loading' | 'setup' | 'verify' | 'backup-codes' | 'complete' | 'error'
  qrCodeUrl?: string
  secret?: string
  manualEntryKey?: string
  backupCodes?: string[]
  verificationToken: string
  error?: string
  isSubmitting: boolean
}

export class TwoFactorSetupPage {
  private props: TwoFactorSetupPageProps
  private state: SetupState = {
    step: 'loading',
    verificationToken: '',
    isSubmitting: false
  }

  constructor(props: TwoFactorSetupPageProps = {}) {
    this.props = props
  }

  /**
   * @brief Initialize 2FA setup
   */
  async mount(container: HTMLElement): Promise<void> {
    container.innerHTML = this.render()
    this.addEventListeners(container)
    
    // Start 2FA setup process
    await this.initiate2FASetup()
  }

  /**
   * @brief Initiate 2FA setup with backend
   */
  private async initiate2FASetup(): Promise<void> {
    try {
      console.log('🔐 Initiating 2FA setup...')
      
      const response = await authService.setup2FA()
      
      if (response.success && response.setupData) {
        this.state = {
          ...this.state,
          step: 'setup',
          qrCodeUrl: response.setupData.qrCodeUrl,
          secret: response.setupData.secret,
          manualEntryKey: response.setupData.manualEntryKey,
          backupCodes: response.setupData.backupCodes
        }
        this.updateView()
      } else {
        this.state = {
          ...this.state,
          step: 'error',
          error: response.message || 'Failed to setup 2FA'
        }
        this.updateView()
      }
    } catch (error) {
      console.error('Failed to initiate 2FA setup:', error)
      this.state = {
        ...this.state,
        step: 'error',
        error: 'Network error. Please try again.'
      }
      this.updateView()
    }
  }

  /**
   * @brief Handle token verification
   */
  private async handleVerifyToken(): Promise<void> {
    if (!this.state.verificationToken || this.state.isSubmitting) return
    
    this.state.isSubmitting = true
    this.updateSubmitButton()
    
    try {
      const response = await authService.verify2FASetup(
        this.state.verificationToken,
        this.state.secret!
      )
      
      if (response.success) {
        this.state.step = 'backup-codes'
        this.updateView()
      } else {
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
   * @brief Complete 2FA setup
   */
  private complete2FASetup(): void {
    this.state.step = 'complete'
    this.updateView()
    
    // Auto-redirect after 3 seconds
    setTimeout(() => {
      if (this.props.onComplete) {
        this.props.onComplete()
      } else {
        router.navigate('/profile')
      }
    }, 3000)
  }

  /**
   * @brief Add event listeners
   */
  private addEventListeners(container: HTMLElement): void {
    // Token input handler
    const tokenInput = container.querySelector('#verification-token') as HTMLInputElement
    if (tokenInput) {
      tokenInput.addEventListener('input', (e) => {
        this.state.verificationToken = (e.target as HTMLInputElement).value.replace(/\s/g, '')
        this.updateSubmitButton()
      })
      
      tokenInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.handleVerifyToken()
        }
      })
    }

    // Verify button
    const verifyBtn = container.querySelector('#verify-token-btn')
    if (verifyBtn) {
      verifyBtn.addEventListener('click', () => this.handleVerifyToken())
    }

    // Backup codes acknowledgment
    const acknowledgeBtn = container.querySelector('#acknowledge-backup-codes')
    if (acknowledgeBtn) {
      acknowledgeBtn.addEventListener('click', () => this.complete2FASetup())
    }

    // Navigation buttons
    const cancelBtn = container.querySelector('#cancel-setup')
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        router.navigate('/profile')
      })
    }
  }

  /**
   * @brief Update submit button state
   */
  private updateSubmitButton(): void {
    const submitBtn = document.querySelector('#verify-token-btn') as HTMLButtonElement
    if (submitBtn) {
      const isValid = this.state.verificationToken.length === 6
      submitBtn.disabled = !isValid || this.state.isSubmitting
      submitBtn.textContent = this.state.isSubmitting ? '🔄 Verifying...' : '✅ Verify Code'
    }
  }

  /**
   * @brief Show error message
   */
  private showError(message: string): void {
    this.state.error = message
    const errorEl = document.querySelector('#setup-error')
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
   * @brief Update view based on current state
   */
  private updateView(): void {
    const container = document.querySelector('#setup-container')
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
      case 'setup':
        return this.renderSetupStep()
      case 'verify':
        return this.renderVerifyStep()
      case 'backup-codes':
        return this.renderBackupCodesStep()
      case 'complete':
        return this.renderCompleteStep()
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
        <h2 class="text-2xl font-bold mb-4">Setting up Two-Factor Authentication</h2>
        <p class="text-green-500">Generating your security keys...</p>
        <div class="mt-4">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-400"></div>
        </div>
      </div>
    `
  }

  /**
   * @brief Render setup step with QR code
   */
  private renderSetupStep(): string {
    return `
      <div class="max-w-md mx-auto">
        <div class="text-center mb-6">
          <div class="text-6xl mb-4">📱</div>
          <h2 class="text-2xl font-bold mb-2">Scan QR Code</h2>
          <p class="text-green-500">Use your authenticator app to scan this code</p>
        </div>

        <!-- QR Code Display -->
        <div class="bg-white p-4 rounded-lg mb-6 text-center">
          ${this.state.qrCodeUrl ? 
            `<img src="${this.state.qrCodeUrl}" alt="2FA QR Code" class="mx-auto max-w-full h-auto" />` :
            `<div class="h-48 flex items-center justify-center text-gray-500">QR Code will appear here</div>`
          }
        </div>

        <!-- Manual Entry -->
        <div class="mb-6">
          <details class="cursor-pointer">
            <summary class="text-sm text-green-400 hover:text-green-300">Can't scan? Enter manually</summary>
            <div class="mt-2 p-3 bg-gray-800 rounded border-l-4 border-green-400">
              <p class="text-xs text-gray-300 mb-2">Enter this key in your authenticator app:</p>
              <code class="text-green-400 text-sm break-all">${this.state.manualEntryKey || ''}</code>
            </div>
          </details>
        </div>

        <div class="space-y-4">
          <button 
            onclick="document.querySelector('#setup-container').innerHTML = document.querySelector('#verify-step').innerHTML; document.dispatchEvent(new CustomEvent('step-verify'));"
            class="w-full px-4 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-all"
          >
            📱 I've Added the Code
          </button>
          
          <button 
            id="cancel-setup"
            class="w-full px-4 py-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-lg transition-all"
          >
            ❌ Cancel Setup
          </button>
        </div>
      </div>
      
      <!-- Hidden verify step template -->
      <div id="verify-step" style="display: none;">
        ${this.renderVerifyStep()}
      </div>

      <script>
        document.addEventListener('step-verify', () => {
          document.querySelector('#verification-token')?.focus();
        });
      </script>
    `
  }

  /**
   * @brief Render verification step
   */
  private renderVerifyStep(): string {
    return `
      <div class="max-w-md mx-auto">
        <div class="text-center mb-6">
          <div class="text-6xl mb-4">🔢</div>
          <h2 class="text-2xl font-bold mb-2">Enter Verification Code</h2>
          <p class="text-green-500">Enter the 6-digit code from your authenticator app</p>
        </div>

        <div class="space-y-4">
          <div>
            <input 
              type="text" 
              id="verification-token"
              placeholder="000 000"
              maxlength="7"
              class="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-center text-2xl font-mono tracking-wider focus:border-green-400 focus:outline-none"
              autocomplete="off"
              inputmode="numeric"
            />
            <p class="text-xs text-gray-400 mt-2 text-center">Enter the code without spaces</p>
          </div>

          <div id="setup-error" class="hidden bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg text-sm"></div>

          <button 
            id="verify-token-btn"
            disabled
            class="w-full px-4 py-3 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-bold rounded-lg transition-all"
          >
            ✅ Verify Code
          </button>
          
          <button 
            onclick="location.reload()"
            class="w-full px-4 py-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-lg transition-all"
          >
            🔄 Start Over
          </button>
        </div>
      </div>
    `
  }

  /**
   * @brief Render backup codes step
   */
  private renderBackupCodesStep(): string {
    const codes = this.state.backupCodes || []
    return `
      <div class="max-w-md mx-auto">
        <div class="text-center mb-6">
          <div class="text-6xl mb-4">🔑</div>
          <h2 class="text-2xl font-bold mb-2">Save Your Backup Codes</h2>
          <p class="text-green-500">Store these codes safely. You can use them if you lose access to your authenticator app.</p>
        </div>

        <div class="bg-gray-800 p-4 rounded-lg border border-green-400 mb-6">
          <div class="grid grid-cols-2 gap-2 text-center">
            ${codes.map(code => 
              `<code class="bg-gray-900 px-2 py-1 rounded text-green-400 font-mono text-sm">${code}</code>`
            ).join('')}
          </div>
        </div>

        <div class="bg-yellow-900/50 border border-yellow-500 rounded-lg p-4 mb-6">
          <p class="text-yellow-200 text-sm">
            <strong>⚠️ Important:</strong> Save these codes in a secure location. Each code can only be used once.
          </p>
        </div>

        <div class="space-y-4">
          <button 
            onclick="navigator.clipboard?.writeText('${codes.join('\\n')}').then(() => alert('Backup codes copied to clipboard!'))"
            class="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all"
          >
            📋 Copy Codes
          </button>
          
          <button 
            id="acknowledge-backup-codes"
            class="w-full px-4 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-all"
          >
            ✅ I've Saved These Codes
          </button>
        </div>
      </div>
    `
  }

  /**
   * @brief Render completion step
   */
  private renderCompleteStep(): string {
    return `
      <div class="text-center">
        <div class="text-6xl mb-6">🎉</div>
        <h2 class="text-2xl font-bold mb-4 text-green-400">2FA Setup Complete!</h2>
        <p class="text-green-500 mb-6">Your account is now protected with two-factor authentication.</p>
        
        <div class="bg-green-900/30 border border-green-500 rounded-lg p-4 mb-6">
          <p class="text-green-200 text-sm">
            <strong>✅ Success:</strong> You'll now need your authenticator app to log in.
          </p>
        </div>
        
        <p class="text-gray-400 text-sm">Redirecting to your profile in 3 seconds...</p>
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
        <h2 class="text-2xl font-bold mb-4 text-red-400">Setup Failed</h2>
        <p class="text-red-300 mb-6">${this.state.error}</p>
        
        <div class="space-y-4">
          <button 
            onclick="location.reload()"
            class="px-6 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-all"
          >
            🔄 Try Again
          </button>
          
          <button 
            onclick="history.back()"
            class="px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-lg transition-all"
          >
            ← Go Back
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
            <h1 class="text-3xl font-bold mb-2 neon-glow">🔐 Two-Factor Authentication</h1>
            <p class="text-green-500">Secure your account with an additional layer of protection</p>
          </div>

          <!-- Setup Container -->
          <div id="setup-container" class="bg-gray-900 rounded-lg p-6 border border-green-400/30">
            ${this.renderCurrentStep()}
          </div>

          <!-- Help Section -->
          <div class="mt-8 text-center">
            <details class="cursor-pointer">
              <summary class="text-sm text-green-400 hover:text-green-300">📖 Need help?</summary>
              <div class="mt-4 text-left bg-gray-800 p-4 rounded-lg border border-gray-600">
                <h3 class="font-bold mb-2">Recommended Authenticator Apps:</h3>
                <ul class="text-sm text-gray-300 space-y-1 mb-4">
                  <li>• Google Authenticator (iOS/Android)</li>
                  <li>• Microsoft Authenticator (iOS/Android)</li>
                  <li>• Authy (iOS/Android/Desktop)</li>
                  <li>• 1Password (Premium feature)</li>
                </ul>
                <p class="text-xs text-gray-400">
                  Two-factor authentication adds an extra layer of security by requiring a code from your phone in addition to your password.
                </p>
              </div>
            </details>
          </div>
        </div>
      </div>
    `
  }
}