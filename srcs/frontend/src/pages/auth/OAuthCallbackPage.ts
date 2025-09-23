/**
 * @brief OAuth Callback Page component for ft_transcendence
 * 
 * @description Handles OAuth callback from Google authentication.
 * Processes authorization code and completes OAuth flow.
 */

import { Component } from '../../components/base/Component'
import { authService } from '../../services/auth'
import { catchErrorTyped } from '../../services/error'
import { showPopup } from '../../components/ui/Popup'
import { router } from '../../router/router'

export interface OAuthCallbackPageProps {
  /** Custom CSS classes */
  className?: string
}

export interface OAuthCallbackPageState {
  /** Processing state */
  isProcessing: boolean
  /** Success state */
  success: boolean
  /** Error message */
  error: string | null
  /** User info after successful OAuth */
  userInfo: any | null
}

/**
 * @brief OAuth callback page component
 * 
 * @description Automatically processes OAuth callback from Google.
 * Shows loading state while processing, then success or error results.
 */
export class OAuthCallbackPage extends Component<OAuthCallbackPageProps, OAuthCallbackPageState> {

  constructor(props: OAuthCallbackPageProps = {}) {
    super(props, {
      isProcessing: true,
      success: false,
      error: null,
      userInfo: null
    })
  }

  /**
   * @brief Process OAuth callback automatically on mount
   */
  public async mount(container: HTMLElement): Promise<void> {
    container.innerHTML = this.render()
    
    // Process OAuth callback automatically
    await this.processOAuthCallback()
  }

  /**
   * @brief Process OAuth callback from URL parameters
   */
  private async processOAuthCallback(): Promise<void> {
    // Get URL search parameters
    const urlParams = new URLSearchParams(window.location.search)
    
    console.log('🔍 OAuth Callback Debug Information:')
    console.log('Full URL:', window.location.href)
    console.log('Search string:', window.location.search)
    console.log('URL params entries:', Array.from(urlParams.entries()))
    console.log('Code parameter:', urlParams.get('code'))
    console.log('State parameter:', urlParams.get('state'))
    console.log('Error parameter:', urlParams.get('error'))
    
    // Check if OAuth is available
    if (!authService.isOAuthAvailable()) {
      const errorMessage = 'OAuth is not available - missing configuration'
      this.setState({
        isProcessing: false,
        success: false,
        error: errorMessage,
        userInfo: null
      })
      showPopup(`OAuth authentication failed: ${errorMessage}`)
      return
    }
    
    const [error, result] = await catchErrorTyped(
      authService.handleOAuthCallback(urlParams)
    )

    if (error) {
      console.error('❌ OAuth callback processing failed:', error)
      
      const errorMessage = error.message || 'OAuth authentication failed'
      
      this.setState({
        isProcessing: false,
        success: false,
        error: errorMessage,
        userInfo: null
      })
      
      // Show error popup
      showPopup(`OAuth authentication failed: ${errorMessage}`)
      return
    }

    if (!result) {
      const errorMessage = 'No response received from OAuth service'
      this.setState({
        isProcessing: false,
        success: false,
        error: errorMessage,
        userInfo: null
      })
      showPopup(`OAuth authentication failed: ${errorMessage}`)
      return
    }
    
    if (result.success && result.user) {
      // Success!
      this.setState({
        isProcessing: false,
        success: true,
        userInfo: result.user,
        error: null
      })
      
      console.log('✅ OAuth authentication successful:', result.user)
      
      // Show success popup
      showPopup(`Welcome, ${result.user.username}! OAuth authentication successful.`)
      
      // Redirect to home after a short delay
      setTimeout(() => {
        router.navigate('/')
      }, 2000)
      
    } else {
      // Handle authentication failure
      const errorMessage = result.message || 'OAuth authentication failed'
      this.setState({
        isProcessing: false,
        success: false,
        error: errorMessage,
        userInfo: null
      })
      showPopup(`OAuth authentication failed: ${errorMessage}`)
    }
    
    // Re-render with new state
    const container = document.getElementById('app')
    if (container) {
      container.innerHTML = this.render()
      this.setupEventListeners(container)
    }
  }

  /**
   * @brief Render processing state
   */
  private renderProcessingState(): string {
    return `
      <div class="text-center">
        <div class="text-6xl mb-6 animate-spin">🔄</div>
        <h1 class="text-4xl font-bold mb-4 text-green-400 neon-glow">
          Processing OAuth Authentication
        </h1>
        <p class="text-green-300 text-lg mb-6">
          Please wait while we complete your Google authentication...
        </p>
        <div class="flex justify-center space-x-1">
          <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse delay-100"></div>
          <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse delay-200"></div>
        </div>
      </div>
    `
  }

  /**
   * @brief Render success state
   */
  private renderSuccessState(): string {
    const { userInfo } = this.state
    
    return `
      <div class="text-center">
        <div class="text-6xl mb-6">✅</div>
        <h1 class="text-4xl font-bold mb-4 text-green-400 neon-glow">
          Authentication Successful!
        </h1>
        <p class="text-green-300 text-lg mb-6">
          Welcome to ft_transcendence, ${userInfo?.username || 'User'}!
        </p>
        
        ${userInfo ? `
          <div class="bg-gray-900 border border-green-600 rounded-lg p-4 mb-6 text-left max-w-md mx-auto">
            <h3 class="text-lg font-bold text-green-400 mb-2">Account Information:</h3>
            <div class="space-y-2 text-sm">
              <p><span class="text-green-500">Username:</span> ${userInfo.username}</p>
              <p><span class="text-green-500">Email:</span> ${userInfo.email}</p>
              ${userInfo.googleProfile ? `
                <p><span class="text-green-500">Google Name:</span> ${userInfo.googleProfile.name}</p>
              ` : ''}
            </div>
          </div>
        ` : ''}
        
        <p class="text-green-500 mb-4">
          🚀 Redirecting to home page...
        </p>
        
        <button
          data-navigate="/"
          class="px-6 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-all transform hover:scale-105"
        >
          🏠 Go to Home Now
        </button>
      </div>
    `
  }

  /**
   * @brief Render error state
   */
  private renderErrorState(): string {
    const { error } = this.state
    
    return `
      <div class="text-center">
        <div class="text-6xl mb-6">❌</div>
        <h1 class="text-4xl font-bold mb-4 text-red-400">
          Authentication Failed
        </h1>
        <p class="text-red-300 text-lg mb-6">
          There was a problem with your Google authentication.
        </p>
        
        <div class="bg-red-900/20 border border-red-600 rounded-lg p-4 mb-6 text-left max-w-md mx-auto">
          <h3 class="text-lg font-bold text-red-400 mb-2">Error Details:</h3>
          <p class="text-red-300 text-sm">${error}</p>
        </div>
        
        <div class="space-y-4">
          <button
            data-navigate="/login"
            class="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all transform hover:scale-105 mr-4"
          >
            🔄 Try Again
          </button>
          
          <button
            data-navigate="/"
            class="px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-lg transition-all transform hover:scale-105"
          >
            🏠 Go Home
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
    const { isProcessing, success } = this.state
    
    let content = ''
    
    if (isProcessing) {
      content = this.renderProcessingState()
    } else if (success) {
      content = this.renderSuccessState()
    } else {
      content = this.renderErrorState()
    }
    
    return `
      <div class="min-h-screen bg-black text-green-400 font-mono py-8 px-4 ${className}">
        <div class="flex items-center justify-center min-h-full">
          <div class="w-full max-w-2xl p-8 border border-green-600 rounded-lg bg-green-900/10 backdrop-blur-sm">
            ${content}
          </div>
        </div>
      </div>
    `
  }

  /**
   * @brief Set up event listeners
   */
  private setupEventListeners(container: HTMLElement): void {
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