/**
 * @brief Forgot Password Page component for ft_transcendence
 * 
 * @description Simple page for users to request password reset via email.
 * Core functionality only - no complex features.
 */

import { Component } from '../../components/base/Component'
import { authService } from '../../services/auth'
import { showPopup } from '../../components/ui/Popup'
import { router } from '../../router/router'

export interface ForgotPasswordPageProps {
  /** Custom CSS classes */
  className?: string
}

export interface ForgotPasswordPageState {
  /** Loading state */
  isLoading: boolean
  /** Success state */
  emailSent: boolean
}

/**
 * @brief Forgot password page component
 * 
 * @description Simple form to request password reset email.
 */
export class ForgotPasswordPage extends Component<ForgotPasswordPageProps, ForgotPasswordPageState> {

  constructor(props: ForgotPasswordPageProps = {}) {
    super(props, {
      isLoading: false,
      emailSent: false
    })
  }

  /**
   * @brief Handle forgot password form submission
   */
  private async handleSubmit(event: Event): Promise<void> {
    event.preventDefault()
    const form = event.target as HTMLFormElement
    const formData = new FormData(form)

    const email = formData.get('email') as string

    if (!email || !this.isValidEmail(email)) {
      showPopup('Please enter a valid email address')
      return
    }

    this.setState({ isLoading: true })

    try {
      const response = await authService.requestPasswordReset(email)
      
      if (response.success) {
        this.setState({ 
          emailSent: true,
          isLoading: false
        })
        showPopup('Password reset email sent! Check your inbox.')
      } else {
        this.setState({ isLoading: false })
        showPopup(response.message || 'Failed to send reset email')
      }
    } catch (error) {
      this.setState({ isLoading: false })
      showPopup('Something went wrong. Please try again.')
    }
  }

  /**
   * @brief Simple email validation
   */
  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  /**
   * @brief Render component
   */
  public render(): string {
    const { className = '' } = this.props
    const { isLoading, emailSent } = this.state
    
    if (emailSent) {
      return this.renderSuccessView()
    }
    
    return `
      <div class="min-h-screen bg-black text-green-400 font-mono py-8 px-4 ${className}">
        <div class="flex items-center justify-center min-h-full">
          <div class="w-full max-w-md p-8 border border-green-600 rounded-lg bg-green-900/10 backdrop-blur-sm">
          <h1 class="text-3xl font-bold text-center mb-6 neon-glow text-green-400">
            🔑 Forgot Password
          </h1>
          
          <p class="text-green-500 text-center mb-6">
            Enter your email address and we'll send you a link to reset your password.
          </p>
          
          <form class="space-y-6" data-forgot-form="true">
            <div>
              <label for="email" class="block text-green-400 font-bold mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                class="w-full px-4 py-3 bg-gray-900 border border-green-600 rounded-lg text-green-400 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                placeholder="Enter your email"
                ${isLoading ? 'disabled' : ''}
              />
            </div>
            
            <button
              type="submit"
              class="w-full px-6 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-all transform hover:scale-105 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}"
              ${isLoading ? 'disabled' : ''}
            >
              ${isLoading ? '⏳ Sending...' : '📧 Send Reset Email'}
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
              data-navigate="/"
              class="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-lg transition-colors"
            >
              🏠 Back to Home
            </button>
          </div>
        </div>
      </div>
    `
  }

  /**
   * @brief Render success view after email sent
   */
  private renderSuccessView(): string {
    const { className = '' } = this.props
    
    return `
      <div class="min-h-screen bg-black text-green-400 font-mono py-8 px-4 ${className}">
        <div class="flex items-center justify-center min-h-full">
          <div class="w-full max-w-md p-8 border border-green-600 rounded-lg bg-green-900/10 backdrop-blur-sm text-center">
          <div class="text-6xl mb-6">📧</div>
          <h1 class="text-2xl font-bold mb-4 text-green-400">
            Email Sent!
          </h1>
          
          <p class="text-green-500 mb-6">
            We've sent a password reset link to your email address. 
            Please check your inbox and follow the instructions.
          </p>
          
          <div class="space-y-3">
            <button
              data-navigate="/login"
              class="w-full px-6 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-colors"
            >
              ← Back to Login
            </button>
            
            <button
              data-resend="true"
              class="w-full px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-lg transition-colors"
            >
              📧 Resend Email
            </button>
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
    this.setupEventListeners(container)
  }

  /**
   * @brief Set up event listeners
   */
  private setupEventListeners(container: HTMLElement): void {
    // Form submission
    const form = container.querySelector('[data-forgot-form]') as HTMLFormElement
    if (form) {
      form.addEventListener('submit', this.handleSubmit.bind(this))
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
    
    // Resend email
    const resendButton = container.querySelector('[data-resend]')
    if (resendButton) {
      resendButton.addEventListener('click', () => {
        this.setState({ emailSent: false })
        this.mount(container)
      })
    }
  }
}