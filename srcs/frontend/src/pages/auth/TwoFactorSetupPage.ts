/**
 * @brief Two-Factor Authentication Setup Page
 * 
 * @description Essential 2FA setup page with QR code generation and backup codes.
 * Shows QR code and secret, then redirects to /verify-2fa for token verification.
 * Separation of concerns: Setup shows codes, verification happens in TwoFactorAuthPage.
 */

import { authService } from '../../services/auth/AuthService'
import { router } from '../../router/router'

interface TwoFactorSetupPageProps {
  onComplete?: () => void
}

interface SetupState {
  step: 'loading' | 'show-qr' | 'show-backup-codes' | 'error'
  qrCode?: string
  secret?: string
  backupCodes?: string[]
  error?: string
}

export class TwoFactorSetupPage {
  private props: TwoFactorSetupPageProps
  private state: SetupState = {
    step: 'loading'
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
          step: 'show-qr',
          qrCode: response.setupData.qrCode,
          secret: response.setupData.secret,
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
   * @brief Show backup codes after QR code is scanned
   */
  private showBackupCodes(): void {
    this.state.step = 'show-backup-codes'
    this.updateView()
  }

  /**
   * @brief Redirect to verification page
   */
  private proceedToVerification(): void {
    // Store secret in sessionStorage for verification
    if (this.state.secret) {
      sessionStorage.setItem('ft_2fa_setup_secret', this.state.secret)
    }
    
    // Redirect to /verify-2fa route
    router.navigate('/verify-2fa')
  }

  /**
   * @brief Add event listeners
   */
  private addEventListeners(container: HTMLElement): void {
    // Show backup codes button
    const showBackupBtn = container.querySelector('#show-backup-codes-btn')
    if (showBackupBtn) {
      showBackupBtn.addEventListener('click', () => this.showBackupCodes())
    }

    // Proceed to verification button
    const proceedBtn = container.querySelector('#proceed-to-verify-btn')
    if (proceedBtn) {
      proceedBtn.addEventListener('click', () => this.proceedToVerification())
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
      case 'show-qr':
        return this.renderQRCodeStep()
      case 'show-backup-codes':
        return this.renderBackupCodesStep()
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
   * @brief Render QR code step
   */
  private renderQRCodeStep(): string {
    return `
      <div class="max-w-md mx-auto">
        <div class="text-center mb-6">
          <div class="text-6xl mb-4">📱</div>
          <h2 class="text-2xl font-bold mb-2">Scan QR Code</h2>
          <p class="text-green-500">Use your authenticator app to scan this code</p>
        </div>

        <!-- QR Code Display -->
        <div class="bg-white p-4 rounded-lg mb-6 text-center">
          ${this.state.qrCode ? 
            `<img src="data:image/png;base64,${this.state.qrCode}" alt="2FA QR Code" class="mx-auto max-w-full h-auto" />` :
            `<div class="h-48 flex items-center justify-center text-gray-500">QR Code will appear here</div>`
          }
        </div>

        <!-- Manual Entry -->
        <div class="mb-6">
          <details class="cursor-pointer">
            <summary class="text-sm text-green-400 hover:text-green-300">Can't scan? Enter manually</summary>
            <div class="mt-2 p-3 bg-gray-800 rounded border-l-4 border-green-400">
              <p class="text-xs text-gray-300 mb-2">Enter this key in your authenticator app:</p>
              <code class="text-green-400 text-sm break-all">${this.state.secret || ''}</code>
            </div>
          </details>
        </div>

        <!-- Info about next step -->
        <div class="bg-blue-900/30 border border-blue-500 rounded-lg p-4 mb-6">
          <p class="text-blue-200 text-sm">
            <strong>ℹ️ Next:</strong> After scanning, you'll be prompted to verify your setup by entering a code from your authenticator app.
          </p>
        </div>

        <div class="space-y-4">
          <button 
            id="show-backup-codes-btn"
            class="w-full px-4 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-all"
          >
            📱 I've Scanned the Code - Show Backup Codes
          </button>
          
          <button 
            id="cancel-setup"
            class="w-full px-4 py-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-lg transition-all"
          >
            ❌ Cancel Setup
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
            id="proceed-to-verify-btn"
            class="w-full px-4 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-all"
          >
            ✅ Continue to Verification
          </button>
        </div>

        <div class="mt-4 text-center text-sm text-gray-400">
          <p>Next: You'll verify your setup by entering a code from your authenticator app</p>
        </div>
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