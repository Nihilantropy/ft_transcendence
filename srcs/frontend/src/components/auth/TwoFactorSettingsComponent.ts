/**
 * @brief Two-Factor Authentication Settings Component
 * 
 * @description A reusable component for displaying 2FA status and providing
 * quick access to 2FA management functions from profile/settings pages.
 */

import { authService } from '../../services/auth/AuthService'
import { router } from '../../router/router'

interface TwoFactorSettingsProps {
  onNavigate?: (path: string) => void
}

export class TwoFactorSettingsComponent {
  private props: TwoFactorSettingsProps
  private is2FAEnabled: boolean = false

  constructor(props: TwoFactorSettingsProps = {}) {
    this.props = props
    this.is2FAEnabled = authService.is2FAEnabled()
  }

  /**
   * @brief Mount the component to a container
   */
  mount(container: HTMLElement): void {
    container.innerHTML = this.render()
    this.addEventListeners(container)
  }

  /**
   * @brief Navigate to specific 2FA page
   */
  private navigateTo(path: string): void {
    if (this.props.onNavigate) {
      this.props.onNavigate(path)
    } else {
      router.navigate(path)
    }
  }

  /**
   * @brief Add event listeners
   */
  private addEventListeners(container: HTMLElement): void {
    // Setup 2FA button
    const setupBtn = container.querySelector('#setup-2fa')
    if (setupBtn) {
      setupBtn.addEventListener('click', () => this.navigateTo('/setup-2fa'))
    }

    // Manage 2FA button
    const manageBtn = container.querySelector('#manage-2fa')
    if (manageBtn) {
      manageBtn.addEventListener('click', () => this.navigateTo('/manage-2fa'))
    }
  }

  /**
   * @brief Render the component
   */
  render(): string {
    return `
      <div class="bg-gray-800 rounded-lg p-4 border border-gray-600">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center space-x-3">
            <div class="text-2xl">${this.is2FAEnabled ? '🔐' : '🔓'}</div>
            <div>
              <h3 class="font-bold text-green-400">Two-Factor Authentication</h3>
              <p class="text-sm text-gray-300">
                Extra security for your account
              </p>
            </div>
          </div>
          <div class="flex items-center space-x-2">
            <span class="text-xs px-2 py-1 rounded-full ${
              this.is2FAEnabled 
                ? 'bg-green-900/50 text-green-400 border border-green-500' 
                : 'bg-yellow-900/50 text-yellow-400 border border-yellow-500'
            }">
              ${this.is2FAEnabled ? '✅ ENABLED' : '⚠️ DISABLED'}
            </span>
          </div>
        </div>

        <div class="flex items-center justify-between">
          <p class="text-sm text-gray-400">
            ${this.is2FAEnabled 
              ? 'Your account is protected with 2FA'
              : 'Add an extra layer of security to your account'
            }
          </p>
          
          <div class="flex space-x-2">
            ${this.is2FAEnabled ? `
              <button 
                id="manage-2fa"
                class="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-all"
              >
                🛠️ Manage
              </button>
            ` : `
              <button 
                id="setup-2fa"
                class="px-3 py-1 text-sm bg-green-600 hover:bg-green-500 text-black font-medium rounded transition-all"
              >
                🔐 Setup 2FA
              </button>
            `}
          </div>
        </div>
      </div>
    `
  }

  /**
   * @brief Update component state (useful for reactivity)
   */
  update(): void {
    this.is2FAEnabled = authService.is2FAEnabled()
    const container = document.querySelector('[data-component="two-factor-settings"]')
    if (container) {
      this.mount(container as HTMLElement)
    }
  }
}