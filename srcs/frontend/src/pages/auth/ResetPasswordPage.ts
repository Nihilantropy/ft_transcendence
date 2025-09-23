/**
 * @brief Reset Password Page component for ft_transcendence
 * 
 * @description Simple page for users to reset their password with a token.
 * Core functionality only - no complex features.
 */

import { Component } from '../../components/base/Component'
import { authService, PasswordUtils, type PasswordValidation } from '../../services/auth'
import { showPopup } from '../../components/ui/Popup'
import { router } from '../../router/router'

export interface ResetPasswordPageProps {
  /** Reset token from URL parameters */
  token?: string
  /** Custom CSS classes */
  className?: string
}

export interface ResetPasswordPageState {
  /** Loading state */
  isLoading: boolean
  /** Password validation */
  passwordValidation: PasswordValidation | null
  /** Current password being typed */
  currentPassword: string
  /** Reset complete state */
  resetComplete: boolean
}

/**
 * @brief Reset password page component
 * 
 * @description Simple form to reset password with token validation.
 */
export class ResetPasswordPage extends Component<ResetPasswordPageProps, ResetPasswordPageState> {

  constructor(props: ResetPasswordPageProps = {}) {
    super(props, {
      isLoading: false,
      passwordValidation: null,
      currentPassword: '',
      resetComplete: false
    })
  }

  /**
   * @brief Handle password reset form submission
   */
  private async handleSubmit(event: Event): Promise<void> {
    event.preventDefault()
    const form = event.target as HTMLFormElement
    const formData = new FormData(form)

    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string
    const token = this.props.token || new URLSearchParams(window.location.search).get('token')

    if (!token) {
      showPopup('Invalid or missing reset token')
      router.navigate('/forgot-password')
      return
    }

    if (password !== confirmPassword) {
      showPopup('Passwords do not match')
      return
    }

    // Validate password strength
    const passwordValidation = PasswordUtils.validatePassword(password)
    if (!passwordValidation.isValid) {
      showPopup(`Password validation failed: ${passwordValidation.feedback.join(', ')}`)
      return
    }

    this.setState({ isLoading: true })

    try {
      const response = await authService.resetPassword(token, password)
      
      if (response.success) {
        this.setState({ 
          resetComplete: true,
          isLoading: false
        })
        showPopup('Password reset successful! You can now log in.')
      } else {
        this.setState({ isLoading: false })
        showPopup(response.message || 'Failed to reset password')
      }
    } catch (error) {
      this.setState({ isLoading: false })
      showPopup('Something went wrong. Please try again.')
    }
  }

  /**
   * @brief Handle password input for real-time validation
   */
  private handlePasswordInput(password: string): void {
    this.setState({ 
      currentPassword: password,
      passwordValidation: PasswordUtils.validatePassword(password)
    })
  }

  /**
   * @brief Render password strength indicator
   */
  private renderPasswordStrengthIndicator(): string {
    const { passwordValidation } = this.state
    
    if (!passwordValidation) return ''

    const strengthColor = PasswordUtils.getStrengthColor(passwordValidation.strength)
    const strengthText = PasswordUtils.getStrengthText(passwordValidation.strength)
    
    return `
      <div class="mt-2 space-y-2">
        <div class="flex items-center space-x-2">
          <div class="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
            <div 
              class="h-full transition-all duration-300 ease-out" 
              style="width: ${passwordValidation.score}%; background-color: ${strengthColor};"
            ></div>
          </div>
          <span class="text-sm font-semibold" style="color: ${strengthColor};">
            ${strengthText}
          </span>
        </div>
        
        ${passwordValidation.feedback.length > 0 ? `
          <div class="space-y-1">
            ${passwordValidation.feedback.map(feedback => `
              <p class="text-xs ${passwordValidation.isValid ? 'text-green-400' : 'text-orange-400'}">
                ${feedback}
              </p>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `
  }

  /**
   * @brief Render component
   */
  public render(): string {
    const { className = '' } = this.props
    const { isLoading, resetComplete } = this.state
    
    if (resetComplete) {
      return this.renderSuccessView()
    }
    
    return `
      <div class="min-h-screen bg-black text-green-400 font-mono py-8 px-4 ${className}">
        <div class="flex items-center justify-center min-h-full">
          <div class="w-full max-w-md p-8 border border-green-600 rounded-lg bg-green-900/10 backdrop-blur-sm">
          <h1 class="text-3xl font-bold text-center mb-6 neon-glow text-green-400">
            🔐 Reset Password
          </h1>
          
          <p class="text-green-500 text-center mb-6">
            Enter your new password below.
          </p>
          
          <form class="space-y-6" data-reset-form="true">
            <div>
              <label for="password" class="block text-green-400 font-bold mb-2">
                New Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                required
                data-password-input="true"
                class="w-full px-4 py-3 bg-gray-900 border border-green-600 rounded-lg text-green-400 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                placeholder="Enter new password"
                ${isLoading ? 'disabled' : ''}
              />
              
              <!-- Password Strength Indicator -->
              <div id="password-strength-indicator">
                ${this.renderPasswordStrengthIndicator()}
              </div>
            </div>
            
            <div>
              <label for="confirmPassword" class="block text-green-400 font-bold mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                required
                class="w-full px-4 py-3 bg-gray-900 border border-green-600 rounded-lg text-green-400 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                placeholder="Confirm new password"
                ${isLoading ? 'disabled' : ''}
              />
            </div>
            
            <button
              type="submit"
              class="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all transform hover:scale-105 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}"
              ${isLoading ? 'disabled' : ''}
            >
              ${isLoading ? '⏳ Resetting...' : '🔐 Reset Password'}
            </button>
          </form>
          
          <div class="mt-6 text-center space-y-2">
            <button
              data-navigate="/login"
              class="text-green-500 hover:text-green-400 underline block"
            >
              ← Back to Login
            </button>
            
            <button
              data-navigate="/forgot-password"
              class="text-green-500 hover:text-green-400 underline block"
            >
              Request New Reset Link
            </button>
          </div>
        </div>
      </div>
    `
  }

  /**
   * @brief Render success view after password reset
   */
  private renderSuccessView(): string {
    const { className = '' } = this.props
    
    return `
      <div class="min-h-screen bg-black text-green-400 font-mono py-8 px-4 ${className}">
        <div class="flex items-center justify-center min-h-full">
          <div class="w-full max-w-md p-8 border border-green-600 rounded-lg bg-green-900/10 backdrop-blur-sm text-center">
          <div class="text-6xl mb-6">✅</div>
          <h1 class="text-2xl font-bold mb-4 text-green-400">
            Password Reset Complete!
          </h1>
          
          <p class="text-green-500 mb-6">
            Your password has been successfully reset. 
            You can now log in with your new password.
          </p>
          
          <button
            data-navigate="/login"
            class="w-full px-6 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-colors"
          >
            🔐 Go to Login
          </button>
        </div>
      </div>
    `
  }

  /**
   * @brief Mount component and set up event listeners
   */
  public mount(container: HTMLElement): void {
    container.innerHTML = this.render()
    this.setupEventListeners(container)
  }

  /**
   * @brief Set up event listeners
   */
  private setupEventListeners(container: HTMLElement): void {
    // Form submission
    const form = container.querySelector('[data-reset-form]') as HTMLFormElement
    if (form) {
      form.addEventListener('submit', this.handleSubmit.bind(this))
    }

    // Password input for real-time validation
    const passwordInput = container.querySelector('[data-password-input]') as HTMLInputElement
    if (passwordInput) {
      passwordInput.addEventListener('input', (event) => {
        const target = event.target as HTMLInputElement
        this.handlePasswordInput(target.value)
        
        // Update the password strength indicator
        const indicator = container.querySelector('#password-strength-indicator')
        if (indicator) {
          indicator.innerHTML = this.renderPasswordStrengthIndicator()
        }
      })
    }
    
    // Navigation
    const navButtons = container.querySelectorAll('[data-navigate]')
    navButtons.forEach(button => {
      button.addEventListener('click', () => {
        const path = button.getAttribute('data-navigate')
        if (path) {
          router.navigate(path)
        }
      })
    })
  }
}