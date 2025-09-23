/**
 * @brief Email Verification Page component for ft_transcendence
 * 
 * @description Simple page for users to verify their email address with a token.
 * Essential functionality only - no complex features.
 */

import { Component } from '../../components/base/Component'
import { authService } from '../../services/auth'
import { showPopup } from '../../components/ui/Popup'
import { router } from '../../router/router'

export interface EmailVerificationPageProps {
  /** Verification token from URL parameters */
  token?: string
  /** Custom CSS classes */
  className?: string
}

export interface EmailVerificationPageState {
  /** Current verification status */
  status: 'loading' | 'success' | 'error' | 'invalid'
  /** Loading state */
  isLoading: boolean
  /** Error message */
  errorMessage: string | null
}

/**
 * @brief Email verification page component
 * 
 * @description Simple component to verify email address with token validation.
 */
export class EmailVerificationPage extends Component<EmailVerificationPageProps, EmailVerificationPageState> {

  constructor(props: EmailVerificationPageProps = {}) {
    super(props, {
      status: 'loading',
      isLoading: true,
      errorMessage: null
    })
    
    // Auto-verify when component is created
    this.verifyEmailToken()
  }

  /**
   * @brief Verify email token automatically on page load
   */
  private async verifyEmailToken(): Promise<void> {
    const token = this.props.token || new URLSearchParams(window.location.search).get('token')
    
    if (!token) {
      this.setState({
        status: 'invalid',
        isLoading: false,
        errorMessage: 'No verification token provided'
      })
      return
    }

    try {
      const response = await authService.verifyEmail(token)
      
      if (response.success) {
        this.setState({
          status: 'success',
          isLoading: false,
          errorMessage: null
        })
        
        // Check if user is now authenticated (means verification gave them a token)
        if (authService.isAuthenticated()) {
          showPopup('Email verified successfully! Welcome!')
          // Redirect to dashboard/home after successful verification and authentication
          setTimeout(() => {
            window.location.href = '/dashboard'
          }, 2000)
        } else {
          showPopup('Email verified successfully! You can now log in.')
          // Redirect to login page if not automatically authenticated
          setTimeout(() => {
            window.location.href = '/login'
          }, 2000)
        }
      } else {
        this.setState({
          status: 'error',
          isLoading: false,
          errorMessage: response.message || 'Email verification failed'
        })
        showPopup(`Verification failed: ${response.message}`)
      }
    } catch (error) {
      this.setState({
        status: 'error',
        isLoading: false,
        errorMessage: 'Something went wrong. Please try again.'
      })
      showPopup('Something went wrong during verification.')
    }
  }

  /**
   * @brief Resend verification email
   */
  private async handleResendVerification(): Promise<void> {
    this.setState({ isLoading: true })
    
    try {
      // For now, show a helpful message since backend is not yet implemented
      // In the future, this would call authService.resendEmailVerification()
      showPopup('Backend not yet implemented. Email verification will be available when backend is ready.')
      this.setState({ isLoading: false })
      
      // Future implementation:
      // const email = prompt('Please enter your email address:')
      // if (email) {
      //   const response = await authService.resendEmailVerification(email)
      //   if (response.success) {
      //     showPopup('Verification email sent! Please check your inbox.')
      //   } else {
      //     showPopup(`Failed to send email: ${response.message}`)
      //   }
      // }
      
    } catch (error) {
      this.setState({ isLoading: false })
      showPopup('Failed to resend verification email.')
    }
  }

  /**
   * @brief Render loading state
   */
  private renderLoadingState(): string {
    return `
      <div class="text-center">
        <div class="text-6xl mb-6 animate-pulse">📧</div>
        <h1 class="text-3xl font-bold mb-4 text-green-400">
          Verifying Email...
        </h1>
        <p class="text-green-500 mb-6">
          Please wait while we verify your email address.
        </p>
        <div class="text-green-400 animate-pulse">
          ⏳ Processing verification...
        </div>
      </div>
    `
  }

  /**
   * @brief Render success state
   */
  private renderSuccessState(): string {
    return `
      <div class="text-center">
        <div class="text-6xl mb-6">✅</div>
        <h1 class="text-3xl font-bold mb-4 text-green-400">
          Email Verified!
        </h1>
        <p class="text-green-500 mb-6">
          Your email address has been successfully verified. 
          You can now log in to your account.
        </p>
        <div class="space-y-3">
          <button
            data-navigate="/login"
            class="w-full px-6 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-colors"
          >
            🔐 Go to Login
          </button>
          <button
            data-navigate="/"
            class="w-full px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-lg transition-colors"
          >
            🏠 Go to Home
          </button>
        </div>
      </div>
    `
  }

  /**
   * @brief Render error state
   */
  private renderErrorState(): string {
    const { errorMessage } = this.state
    
    return `
      <div class="text-center">
        <div class="text-6xl mb-6">❌</div>
        <h1 class="text-3xl font-bold mb-4 text-red-400">
          Verification Failed
        </h1>
        <p class="text-red-300 mb-6">
          ${errorMessage || 'We could not verify your email address.'}
        </p>
        <div class="space-y-3">
          <button
            data-resend="true"
            class="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors"
          >
            📧 Resend Verification Email
          </button>
          <button
            data-navigate="/login"
            class="w-full px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-lg transition-colors"
          >
            🔐 Back to Login
          </button>
          <button
            data-navigate="/"
            class="w-full px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-lg transition-colors"
          >
            🏠 Go to Home
          </button>
        </div>
      </div>
    `
  }

  /**
   * @brief Render invalid token state
   */
  private renderInvalidState(): string {
    return `
      <div class="text-center">
        <div class="text-6xl mb-6">🚫</div>
        <h1 class="text-3xl font-bold mb-4 text-yellow-400">
          Invalid Verification Link
        </h1>
        <p class="text-yellow-300 mb-6">
          This verification link is invalid or has expired. 
          Please request a new verification email.
        </p>
        <div class="space-y-3">
          <button
            data-resend="true"
            class="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors"
          >
            📧 Request New Verification Email
          </button>
          <button
            data-navigate="/login"
            class="w-full px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-lg transition-colors"
          >
            🔐 Back to Login
          </button>
        </div>
      </div>
    `
  }

  /**
   * @brief Render component
   */
  public render(): string {
    const { className = '' } = this.props
    const { status } = this.state
    
    let content = ''
    
    switch (status) {
      case 'loading':
        content = this.renderLoadingState()
        break
      case 'success':
        content = this.renderSuccessState()
        break
      case 'error':
        content = this.renderErrorState()
        break
      case 'invalid':
        content = this.renderInvalidState()
        break
    }
    
    return `
      <div class="min-h-screen bg-black text-green-400 font-mono py-8 px-4 ${className}">
        <div class="flex items-center justify-center min-h-full">
          <div class="w-full max-w-md p-8 border border-green-600 rounded-lg bg-green-900/10 backdrop-blur-sm">
            ${content}
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
    // Resend verification button
    const resendButton = container.querySelector('[data-resend]')
    if (resendButton) {
      resendButton.addEventListener('click', () => {
        this.handleResendVerification()
      })
    }
    
    // Navigation buttons
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