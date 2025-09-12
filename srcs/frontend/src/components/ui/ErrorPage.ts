/**
 * @brief Error page component for ft_transcendence
 * 
 * @description Displays user-friendly error pages for different error types.
 * Handles 404, 500, and API service errors with appropriate messaging.
 */

import { Component } from '../base/Component'

interface ErrorPageProps {
  errorType: '404' | '500' | 'network' | 'api'
  errorMessage?: string
  errorDetails?: string
  showRetry?: boolean
}

interface ErrorPageState {
  // No state needed for static error pages
}

export class ErrorPage extends Component<ErrorPageProps, ErrorPageState> {
  constructor(props: ErrorPageProps) {
    super(props, {})
  }

  /**
   * @brief Render error page based on error type
   */
  render(): string {
    const { errorType, errorMessage, errorDetails, showRetry = true } = this.props

    const errorConfig = this.getErrorConfig(errorType, errorMessage)

    return `
      <div class="min-h-screen bg-black text-green-400 font-mono flex items-center justify-center">
        <div class="text-center max-w-md mx-auto p-8">
          <!-- Error Icon -->
          <div class="text-8xl mb-8 animate-pulse">
            ${errorConfig.icon}
          </div>

          <!-- Error Title -->
          <h1 class="text-4xl font-bold text-red-400 mb-4 neon-glow">
            ${errorConfig.title}
          </h1>

          <!-- Error Message -->
          <p class="text-lg text-green-300 mb-6 leading-relaxed">
            ${errorConfig.message}
          </p>

          <!-- Error Details (if available) -->
          ${errorDetails ? `
            <div class="bg-red-900 bg-opacity-20 border border-red-600 rounded-lg p-4 mb-6 text-left">
              <div class="text-sm text-red-300 font-mono">
                <div class="text-red-400 font-bold mb-2">Error Details:</div>
                <div class="break-all">${errorDetails}</div>
              </div>
            </div>
          ` : ''}

          <!-- Action Buttons -->
          <div class="space-y-4">
            ${showRetry ? `
              <button 
                id="retry-btn"
                class="w-full px-6 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-all duration-300 transform hover:scale-105 neon-border"
              >
                🔄 ${errorConfig.retryText}
              </button>
            ` : ''}
            
            <button 
              id="home-btn"
              class="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-green-400 font-bold rounded-lg transition-all duration-300 border border-green-600"
            >
              🏠 Back to Home
            </button>

            ${errorType === '500' || errorType === 'api' ? `
              <div class="text-sm text-yellow-400 mt-4 p-3 bg-yellow-900 bg-opacity-20 border border-yellow-600 rounded">
                <strong>Note:</strong> Backend services may be temporarily unavailable. 
                Please try again in a few moments.
              </div>
            ` : ''}
          </div>

          <!-- Debug Info (development only) -->
          ${this.isDevelopment() ? `
            <div class="mt-8 p-4 bg-gray-800 rounded-lg text-left">
              <div class="text-xs text-gray-400">
                <div><strong>Debug Info:</strong></div>
                <div>Error Type: ${errorType}</div>
                <div>Timestamp: ${new Date().toISOString()}</div>
                <div>User Agent: ${navigator.userAgent.substring(0, 50)}...</div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `
  }

  /**
   * @brief Get error configuration based on error type
   */
  private getErrorConfig(errorType: string, customMessage?: string) {
    switch (errorType) {
      case '404':
        return {
          icon: '🚫',
          title: 'Page Not Found',
          message: customMessage || 'The page you\'re looking for doesn\'t exist. It might have been moved or deleted.',
          retryText: 'Try Again'
        }
      
      case '500':
        return {
          icon: '⚠️',
          title: 'Server Error',
          message: customMessage || 'Something went wrong on our end. Our servers are experiencing issues.',
          retryText: 'Retry Request'
        }
      
      case 'network':
        return {
          icon: '📡',
          title: 'Connection Error',
          message: customMessage || 'Unable to connect to our servers. Please check your internet connection.',
          retryText: 'Retry Connection'
        }
      
      case 'api':
        return {
          icon: '🔌',
          title: 'Service Unavailable',
          message: customMessage || 'Backend service is currently unavailable. This might be temporary.',
          retryText: 'Retry Request'
        }
      
      default:
        return {
          icon: '❌',
          title: 'Unexpected Error',
          message: customMessage || 'An unexpected error occurred. Please try again.',
          retryText: 'Try Again'
        }
    }
  }

  /**
   * @brief Check if in development mode TODO change to get the env variable for development
   */
  private isDevelopment(): boolean {
    return window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1' ||
           window.location.hostname.includes('dev')
  }

  /**
   * @brief Setup event handlers after mount
   */
  afterMount(): void {
    this.setupEventHandlers()
  }

  /**
   * @brief Setup button event handlers
   */
  private setupEventHandlers(): void {
    const retryBtn = document.getElementById('retry-btn')
    const homeBtn = document.getElementById('home-btn')

    if (retryBtn) {
      retryBtn.addEventListener('click', () => this.handleRetry())
    }

    if (homeBtn) {
      homeBtn.addEventListener('click', () => this.handleGoHome())
    }
  }

  /**
   * @brief Handle retry action
   */
  private handleRetry(): void {
    console.log('🔄 Retrying...')
    // Reload the current page
    window.location.reload()
  }

  /**
   * @brief Handle go home action
   */
  private async handleGoHome(): Promise<void> {
    console.log('🏠 Navigating to home...')
    try {
      const { router } = await import('../../router/router')
      router.navigate('/')
    } catch (error) {
      console.error('Failed to navigate home:', error)
      // Fallback: direct navigation
      window.location.href = '/'
    }
  }
}

// Helper function to show error pages
export function showErrorPage(
  container: HTMLElement,
  errorType: '404' | '500' | 'network' | 'api',
  errorMessage?: string,
  errorDetails?: string
): void {
  const errorPage = new ErrorPage({
    errorType,
    errorMessage,
    errorDetails,
    showRetry: errorType !== '404'
  })
  
  container.innerHTML = ''
  errorPage.mount(container)
}
