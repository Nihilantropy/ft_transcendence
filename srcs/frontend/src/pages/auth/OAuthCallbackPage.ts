/**
 * @brief OAuth Callback Handler Page
 * 
 * @description Handles OAuth callback after successful authentication with Google.
 * This page fetches user data and stores it in localStorage before redirecting.
 * 
 * Flow:
 * 1. Backend authenticates with Google and sets httpOnly cookies
 * 2. Backend redirects here with ?newUser=true/false
 * 3. Frontend fetches user data from /api/users/me
 * 4. Stores user in localStorage
 * 5. Redirects to /username-selection (new) or /profile (existing)
 */

import { Component } from '../../components/base/Component'
import { router } from '../../router/router'

export interface OAuthCallbackPageState {
  status: 'loading' | 'success' | 'error'
  errorMessage: string | null
}

export class OAuthCallbackPage extends Component<{}, OAuthCallbackPageState> {

  constructor() {
    super({}, {
      status: 'loading',
      errorMessage: null
    })
    
    // Auto-handle OAuth callback when component is created
    this.handleOAuthCallback()
  }

  render(): string {
    const { status, errorMessage } = this.state

    if (status === 'error') {
      return this.renderError(errorMessage || 'Authentication failed')
    }

    return this.renderLoading()
  }

  private renderLoading(): string {
    return `
      <div class="oauth-callback-container">
        <div class="oauth-callback-content">
          <div class="spinner"></div>
          <h2>Completing Sign In...</h2>
          <p>Please wait while we finish setting up your account.</p>
        </div>
      </div>
      ${this.getStyles()}
    `
  }

  private renderError(message: string): string {
    return `
      <div class="oauth-callback-container">
        <div class="oauth-callback-content">
          <div style="font-size: 3rem; margin-bottom: 1rem;">❌</div>
          <h2 style="color: #ff4444;">Authentication Failed</h2>
          <div class="error-message">
            ${message}
          </div>
          <p style="margin-top: 1rem; color: #888;">
            Redirecting to login page...
          </p>
          <button class="retry-button" onclick="window.location.href='/login'">
            Return to Login
          </button>
        </div>
      </div>
      ${this.getStyles()}
    `
  }

  private getStyles(): string {
    return `
      <style>
        .oauth-callback-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #000000 0%, #001100 50%, #000000 100%);
          font-family: 'Courier New', monospace;
        }

        .oauth-callback-content {
          text-align: center;
          padding: 3rem;
          border: 2px solid var(--primary-color, #00ff41);
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(10px);
          box-shadow: 0 0 20px rgba(0, 255, 65, 0.3);
        }

        .oauth-callback-content h2 {
          color: var(--primary-color, #00ff41);
          font-size: 1.8rem;
          margin-bottom: 1rem;
          text-shadow: 0 0 10px currentColor;
        }

        .oauth-callback-content p {
          color: #888;
          font-size: 1rem;
          margin-top: 0.5rem;
        }

        .spinner {
          width: 50px;
          height: 50px;
          margin: 0 auto 2rem;
          border: 4px solid rgba(0, 255, 65, 0.2);
          border-top: 4px solid var(--primary-color, #00ff41);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .error-message {
          color: #ff4444;
          background: rgba(255, 68, 68, 0.1);
          padding: 1rem;
          border-radius: 8px;
          margin-top: 1rem;
          border: 1px solid #ff4444;
        }

        .retry-button {
          margin-top: 1rem;
          padding: 0.75rem 1.5rem;
          background: var(--primary-color, #00ff41);
          color: black;
          border: none;
          border-radius: 8px;
          font-weight: bold;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.3s ease;
        }

        .retry-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 255, 65, 0.4);
        }
      </style>
    `
  }

  /**
   * @brief Handle OAuth callback by fetching user data and redirecting
   */
  private async handleOAuthCallback(): Promise<void> {
    try {
      console.log('🔐 OAuth callback: Processing authentication...')

      // Check for error parameter
      const urlParams = new URLSearchParams(window.location.search)
      const error = urlParams.get('error')
      const isNewUser = urlParams.get('newUser') === 'true'

      if (error) {
        console.error('❌ OAuth error:', error)
        this.setState({ 
          status: 'error',
          errorMessage: `Authentication failed: ${error}`
        })
        setTimeout(() => {
          router.navigate('/login')
        }, 3000)
        return
      }

      // Fetch user data from backend (cookies are automatically sent)
      console.log('📡 Fetching user data...')
      const user = await this.fetchUserData()

      if (!user) {
        throw new Error('Failed to fetch user data after OAuth')
      }

      // Store user in localStorage for frontend router
      console.log('💾 Storing user data:', user.username)
      localStorage.setItem('ft_user', JSON.stringify(user))

      // Update state to success
      this.setState({ status: 'success' })

      // Redirect based on user status
      console.log('✅ OAuth authentication complete')
      
      // Small delay to show success
      await new Promise(resolve => setTimeout(resolve, 500))

      if (isNewUser) {
        console.log('🆕 New user, redirecting to username selection')
        router.navigate('/username-selection')
      } else {
        console.log('👤 Existing user, redirecting to profile')
        router.navigate('/profile')
      }

    } catch (error) {
      console.error('❌ OAuth callback handling failed:', error)
      this.setState({
        status: 'error',
        errorMessage: error instanceof Error 
          ? error.message 
          : 'Failed to complete authentication'
      })
      
      // Redirect to login after delay
      setTimeout(() => {
        router.navigate('/login')
      }, 3000)
    }
  }

  /**
   * @brief Fetch user data from backend
   */
  private async fetchUserData(): Promise<any> {
    try {
      const response = await fetch('/api/users/me', {
        method: 'GET',
        credentials: 'include', // Send cookies
        headers: {
          'Accept': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch user data: ${response.status}`)
      }

      const data = await response.json()
      
      // Extract user from response (handle both formats)
      const user = data.user || data
      
      if (!user || !user.id || !user.username) {
        throw new Error('Invalid user data received')
      }

      return user

    } catch (error) {
      console.error('Failed to fetch user data:', error)
      throw error
    }
  }
}
