/**
 * @brief Email Verification Page component for ft_transcendence
 * 
 * @description Clean page for email verification with seamless backend integration.
 * Features automatic verification, resend functionality, and proper error handling.
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
  status: 'loading' | 'success' | 'error' | 'invalid' | 'resending'
  /** Loading state */
  isLoading: boolean
  /** Error message */
  errorMessage: string | null
  /** User email for resend (stored after failed verification if available) */
  userEmail: string | null
}

/**
 * @brief Email verification page component
 * 
 * @description Clean component to verify email address with automatic verification,
 * proper error handling, and seamless backend integration.
 */
export class EmailVerificationPage extends Component<EmailVerificationPageProps, EmailVerificationPageState> {

  constructor(props: EmailVerificationPageProps = {}) {
    super(props, {
      status: 'loading',
      isLoading: true,
      errorMessage: null,
      userEmail: null
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
      console.log('📧 Starting email verification...')
      const response = await authService.verifyEmail(token)
      
      if (response.success && response.user) {
        // Success - email verified and user auto-logged in
        this.setState({
          status: 'success',
          isLoading: false,
          errorMessage: null,
          userEmail: response.user.email
        })
        
        console.log('✅ Email verified successfully for:', response.user.email)
        showPopup('Email verified successfully! You can now choose your username.')
        
        // Backend automatically logs user in with httpOnly cookies
        // Redirect to username selection page
        setTimeout(() => {
          router.navigate('/username-selection')
        }, 2000)
      } else {
        // This shouldn't happen if backend is working correctly
        this.setState({
          status: 'error',
          isLoading: false,
          errorMessage: 'Email verification failed - please try again'
        })
        console.warn('⚠️ Unexpected response from verify email:', response)
      }
    } catch (error: any) {
      console.error('❌ Email verification error:', error)
      
      // Parse error message for better UX
      const errorMessage = error.message || 'Something went wrong. Please try again.'
      const isExpired = errorMessage.toLowerCase().includes('expired') || 
                        errorMessage.toLowerCase().includes('invalid')
      
      this.setState({
        status: isExpired ? 'invalid' : 'error',
        isLoading: false,
        errorMessage
      })
      
      showPopup(`Verification failed: ${errorMessage}`)
    }
  }

  /**
   * @brief Resend verification email with proper validation
   */
  private async handleResendVerification(): Promise<void> {
    // Prevent multiple simultaneous requests
    if (this.state.isLoading) {
      return
    }
    
    this.setState({ 
      status: 'resending',
      isLoading: true 
    })
    
    try {
      // Use stored email if available, otherwise prompt user
      let email = this.state.userEmail
      
      if (!email) {
        email = prompt('Please enter your email address:')
        if (!email) {
          // User cancelled prompt
          this.setState({ 
            isLoading: false,
            status: this.state.errorMessage ? 'error' : 'invalid'
          })
          return
        }
      }
      
      console.log('📤 Resending verification email to:', email)
      const response = await authService.resendVerificationEmail(email)
      
      if (response.success) {
        console.log('✅ Verification email resent successfully')
        showPopup('Verification email sent! Please check your inbox.')
        
        // Store email for future resend attempts
        this.setState({ 
          isLoading: false,
          userEmail: email,
          status: 'error' // Keep showing resend option
        })
      } else {
        console.warn('⚠️ Resend failed:', response.message)
        showPopup(`Failed to send email: ${response.message}`)
        this.setState({ isLoading: false })
      }
    } catch (error: any) {
      console.error('❌ Resend verification error:', error)
      const errorMessage = error.message || 'Failed to resend verification email'
      showPopup(errorMessage)
      
      this.setState({ 
        isLoading: false,
        status: this.state.errorMessage ? 'error' : 'invalid'
      })
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
    const { userEmail } = this.state
    
    return `
      <div class="text-center">
        <div class="text-6xl mb-6">✅</div>
        <h1 class="text-3xl font-bold mb-4 text-green-400">
          Email Verified!
        </h1>
        <p class="text-green-500 mb-2">
          Your email address has been successfully verified.
        </p>
        ${userEmail ? `
          <p class="text-sm text-green-300 mb-6">
            📧 ${userEmail}
          </p>
        ` : ''}
        <p class="text-green-400 mb-6">
          You are now logged in and can choose your username!
        </p>
        <div class="space-y-3">
          <button
            data-navigate="/username-selection"
            class="w-full px-6 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-colors"
          >
            🏷️ Choose Username
          </button>
          <p class="text-sm text-green-300 animate-pulse">
            Redirecting automatically in 2 seconds...
          </p>
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
    const { errorMessage, userEmail, isLoading } = this.state
    
    return `
      <div class="text-center">
        <div class="text-6xl mb-6">❌</div>
        <h1 class="text-3xl font-bold mb-4 text-red-400">
          Verification Failed
        </h1>
        <p class="text-red-300 mb-2">
          ${errorMessage || 'We could not verify your email address.'}
        </p>
        ${userEmail ? `
          <p class="text-sm text-gray-400 mb-6">
            📧 ${userEmail}
          </p>
        ` : `
          <p class="text-sm text-gray-400 mb-6">
            Don't worry - you can request a new verification email.
          </p>
        `}
        <div class="space-y-3">
          <button
            data-resend="true"
            class="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            ${isLoading ? 'disabled' : ''}
          >
            ${isLoading ? '⏳ Sending...' : '📧 Resend Verification Email'}
          </button>
          <p class="text-xs text-gray-500">
            ${userEmail ? 'Click to resend to your registered email' : 'You will be asked to enter your email address'}
          </p>
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
    const { errorMessage, userEmail, isLoading } = this.state
    
    return `
      <div class="text-center">
        <div class="text-6xl mb-6">🚫</div>
        <h1 class="text-3xl font-bold mb-4 text-yellow-400">
          Invalid Verification Link
        </h1>
        <p class="text-yellow-300 mb-2">
          ${errorMessage || 'This verification link is invalid or has expired.'}
        </p>
        <p class="text-sm text-gray-400 mb-6">
          Please request a new verification email to complete your registration.
        </p>
        ${userEmail ? `
          <p class="text-sm text-gray-400 mb-4">
            📧 Registered email: ${userEmail}
          </p>
        ` : ''}
        <div class="space-y-3">
          <button
            data-resend="true"
            class="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            ${isLoading ? 'disabled' : ''}
          >
            ${isLoading ? '⏳ Sending...' : '📧 Request New Verification Email'}
          </button>
          <p class="text-xs text-gray-500">
            ${userEmail ? 'Click to resend to your registered email' : 'You will be asked to enter your email address'}
          </p>
          <button
            data-navigate="/login"
            class="w-full px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-lg transition-colors"
          >
            📝 Register New Account
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
      case 'resending':
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
   * @brief Set up event listeners for buttons
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