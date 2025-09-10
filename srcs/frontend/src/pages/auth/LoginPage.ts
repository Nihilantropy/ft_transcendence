/**
 * @brief Login Page component for ft_transcendence
 * 
 * @description User authentication page with login and registration forms.
 * Integrates with AuthService for real backend authentication.
 */

import { Component } from '../../components/base/Component'
import { authService, type LoginCredentials, type RegisterCredentials } from '../../services/auth'
import { ErrorUtils } from '../../services/error'
import { PopupUtils } from '../../components/ui/Popup'
import { router } from '../../router/router'

export interface LoginPageProps {
  /** Initial mode: 'login' or 'register' */
  mode?: 'login' | 'register'
  /** Custom CSS classes */
  className?: string
}

export interface LoginPageState {
  /** Current form mode */
  mode: 'login' | 'register'
  /** Loading state */
  isLoading: boolean
  /** Success message (for inline display) */
  success: string | null
  /** Whether backend is available */
  backendAvailable: boolean
  /** Retry counter */
  retryCount: number
}

/**
 * @brief Login page component
 * 
 * @description Handles user authentication with login/register forms.
 * Integrates with backend API for real authentication.
 */
export class LoginPage extends Component<LoginPageProps, LoginPageState> {

  constructor(props: LoginPageProps = {}) {
    super(props, {
      mode: props.mode || 'login',
      isLoading: false,
      success: null,
      backendAvailable: true,
      retryCount: 0
    })
  }

  /**
   * @brief Handle login form submission
   */
  private async handleLogin(event: Event): Promise<void> {
    event.preventDefault()
    const form = event.target as HTMLFormElement
    const formData = new FormData(form)

    const credentials: LoginCredentials = {
      username: formData.get('username') as string,
      password: formData.get('password') as string,
      rememberMe: formData.get('rememberMe') === 'on'
    }

    await this.performLogin(credentials)
  }

  /**
   * @brief Show authentication error popup with appropriate actions
   */
  private showAuthErrorPopup(
    message: string, 
    errorCode: number | null | undefined, 
    isBackendUnavailable: boolean, 
    formType: 'login' | 'register'
  ): void {
    const actions: Array<{
      label: string
      type: 'primary' | 'secondary' | 'danger'
      action: () => void
    }> = []
    
    // Add retry action for server errors if not too many attempts
    if (isBackendUnavailable && this.state.retryCount < 3) {
      actions.push({
        label: '🔄 Retry',
        type: 'primary',
        action: () => {
          if (formType === 'login') {
            this.retryLogin()
          } else {
            this.retryRegister()
          }
        }
      })
    }
    
    // Show appropriate popup based on error severity
    if (isBackendUnavailable) {
      PopupUtils.showCriticalError(message, errorCode || undefined, actions)
    } else if (errorCode && errorCode >= 500) {
      PopupUtils.showError(message, errorCode, actions)
    } else {
      PopupUtils.showWarning(message, actions)
    }
  }

  /**
   * @brief Retry login with current form data
   */
  private async retryLogin(): Promise<void> {
    const form = document.querySelector('[data-login-form]') as HTMLFormElement
    if (form) {
      const formData = new FormData(form)
      const credentials: LoginCredentials = {
        username: formData.get('username') as string,
        password: formData.get('password') as string,
        rememberMe: formData.get('rememberMe') === 'on'
      }
      
      // Directly call the login logic without going through event handler
      await this.performLogin(credentials)
    }
  }

  /**
   * @brief Retry registration with current form data
   */
  private async retryRegister(): Promise<void> {
    const form = document.querySelector('[data-register-form]') as HTMLFormElement
    if (form) {
      const formData = new FormData(form)
      const credentials: RegisterCredentials = {
        username: formData.get('username') as string,
        email: formData.get('email') as string,
        password: formData.get('password') as string,
        confirmPassword: formData.get('confirmPassword') as string
      }
      
      // Directly call the register logic without going through event handler
      await this.performRegister(credentials)
    }
  }

  /**
   * @brief Perform login with credentials (extracted from handleLogin)
   */
  private async performLogin(credentials: LoginCredentials): Promise<void> {
    this.setState({ 
      isLoading: true, 
      success: null 
    })

    try {
      const response = await authService.login(credentials)
      
      if (response.success) {
        this.setState({ 
          success: 'Login successful! Redirecting...',
          isLoading: false,
          backendAvailable: true,
          retryCount: 0
        })
        
        // Show success popup
        PopupUtils.showSuccess('Login successful! Redirecting to home page...')
        
        // Redirect to intended page or home
        setTimeout(() => {
          router.navigate('/')
        }, 1500)
      } else {
        // Handle authentication errors from backend
        const isServerError = response.errorCode && response.errorCode >= 500
        const isBackendUnavailable = [0, 500, 502, 503, 504].includes(response.errorCode || 0)
        
        this.setState({ 
          isLoading: false,
          backendAvailable: !isBackendUnavailable,
          retryCount: this.state.retryCount + (isServerError ? 1 : 0)
        })
        
        // Show error popup with appropriate type and actions
        this.showAuthErrorPopup(
          response.message || 'Login failed',
          response.errorCode,
          isBackendUnavailable,
          'login'
        )
      }
    } catch (error) {
      // Handle unexpected errors
      const errorResponse = ErrorUtils.handleAuthError(error)
      const isBackendUnavailable = ErrorUtils.isBackendUnavailable(errorResponse)
      
      this.setState({ 
        isLoading: false,
        backendAvailable: !isBackendUnavailable,
        retryCount: this.state.retryCount + 1
      })
      
      // Show error popup
      this.showAuthErrorPopup(
        errorResponse.userMessage,
        errorResponse.code,
        isBackendUnavailable,
        'login'
      )
    }
  }

  /**
   * @brief Perform registration with credentials (extracted from handleRegister)
   */
  private async performRegister(credentials: RegisterCredentials): Promise<void> {
    this.setState({ 
      isLoading: true, 
      success: null 
    })

    try {
      const response = await authService.register(credentials)
      
      if (response.success) {
        this.setState({ 
          success: 'Registration successful! Redirecting...',
          isLoading: false,
          backendAvailable: true,
          retryCount: 0
        })
        
        // Show success popup
        PopupUtils.showSuccess('Registration successful! Welcome to ft_transcendence!')
        
        // Redirect to home
        setTimeout(() => {
          router.navigate('/')
        }, 1500)
      } else {
        // Handle registration errors from backend
        const isServerError = response.errorCode && response.errorCode >= 500
        const isBackendUnavailable = [0, 500, 502, 503, 504].includes(response.errorCode || 0)
        
        this.setState({ 
          isLoading: false,
          backendAvailable: !isBackendUnavailable,
          retryCount: this.state.retryCount + (isServerError ? 1 : 0)
        })
        
        // Show error popup
        this.showAuthErrorPopup(
          response.message || 'Registration failed',
          response.errorCode,
          isBackendUnavailable,
          'register'
        )
      }
    } catch (error) {
      // Handle unexpected errors
      const errorResponse = ErrorUtils.handleAuthError(error)
      const isBackendUnavailable = ErrorUtils.isBackendUnavailable(errorResponse)
      
      this.setState({ 
        isLoading: false,
        backendAvailable: !isBackendUnavailable,
        retryCount: this.state.retryCount + 1
      })
      
      // Show error popup
      this.showAuthErrorPopup(
        errorResponse.userMessage,
        errorResponse.code,
        isBackendUnavailable,
        'register'
      )
    }
  }

  /**
   * @brief Handle registration form submission
   */
  private async handleRegister(event: Event): Promise<void> {
    event.preventDefault()
    const form = event.target as HTMLFormElement
    const formData = new FormData(form)

    const credentials: RegisterCredentials = {
      username: formData.get('username') as string,
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      confirmPassword: formData.get('confirmPassword') as string
    }

    // Validate password confirmation
    if (credentials.password !== credentials.confirmPassword) {
      PopupUtils.showError('Passwords do not match', 400)
      return
    }

    await this.performRegister(credentials)
  }



  /**
   * @brief Switch between login/register modes
   */
  private switchMode(newMode: 'login' | 'register'): void {
    this.setState({ 
      mode: newMode, 
      success: null,
      retryCount: 0
    })
  }



  /**
   * @brief Render login form
   */
  private renderLoginForm(): string {
    const { isLoading } = this.state
    
    return `
      <form class="space-y-6" data-login-form="true">
        <h2 class="text-3xl font-bold text-center mb-6 neon-glow text-green-400">
          🔐 Login
        </h2>
        
        <div class="space-y-4">
          <div>
            <label for="username" class="block text-green-400 font-bold mb-2">
              Username
            </label>
            <input
              type="text"
              id="username"
              name="username"
              required
              class="w-full px-4 py-3 bg-gray-900 border border-green-600 rounded-lg text-green-400 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
              placeholder="Enter your username"
              ${isLoading ? 'disabled' : ''}
            />
          </div>
          
          <div>
            <label for="password" class="block text-green-400 font-bold mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              class="w-full px-4 py-3 bg-gray-900 border border-green-600 rounded-lg text-green-400 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
              placeholder="Enter your password"
              ${isLoading ? 'disabled' : ''}
            />
          </div>
          
          <div class="flex items-center">
            <input
              type="checkbox"
              id="rememberMe"
              name="rememberMe"
              class="mr-2 rounded border-green-600 bg-gray-900 text-green-400 focus:ring-green-400"
              ${isLoading ? 'disabled' : ''}
            />
            <label for="rememberMe" class="text-green-500">
              Remember me
            </label>
          </div>
        </div>
        
        <button
          type="submit"
          class="w-full px-6 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-all transform hover:scale-105 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}"
          ${isLoading ? 'disabled' : ''}
        >
          ${isLoading ? '⏳ Logging in...' : '✅ Login'}
        </button>
        
        <div class="text-center">
          <button
            type="button"
            class="text-green-500 hover:text-green-400 underline"
            data-switch-mode="register"
          >
            Don't have an account? Register here
          </button>
        </div>
      </form>
    `
  }

  /**
   * @brief Render registration form
   */
  private renderRegisterForm(): string {
    const { isLoading } = this.state
    
    return `
      <form class="space-y-6" data-register-form="true">
        <h2 class="text-3xl font-bold text-center mb-6 neon-glow text-green-400">
          📝 Register
        </h2>
        
        <div class="space-y-4">
          <div>
            <label for="username" class="block text-green-400 font-bold mb-2">
              Username
            </label>
            <input
              type="text"
              id="username"
              name="username"
              required
              class="w-full px-4 py-3 bg-gray-900 border border-green-600 rounded-lg text-green-400 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
              placeholder="Choose a username"
              ${isLoading ? 'disabled' : ''}
            />
          </div>
          
          <div>
            <label for="email" class="block text-green-400 font-bold mb-2">
              Email
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
          
          <div>
            <label for="password" class="block text-green-400 font-bold mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              class="w-full px-4 py-3 bg-gray-900 border border-green-600 rounded-lg text-green-400 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
              placeholder="Create a password"
              ${isLoading ? 'disabled' : ''}
            />
          </div>
          
          <div>
            <label for="confirmPassword" class="block text-green-400 font-bold mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              required
              class="w-full px-4 py-3 bg-gray-900 border border-green-600 rounded-lg text-green-400 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
              placeholder="Confirm your password"
              ${isLoading ? 'disabled' : ''}
            />
          </div>
        </div>
        
        <button
          type="submit"
          class="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all transform hover:scale-105 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}"
          ${isLoading ? 'disabled' : ''}
        >
          ${isLoading ? '⏳ Registering...' : '📝 Register'}
        </button>
        
        <div class="text-center">
          <button
            type="button"
            class="text-green-500 hover:text-green-400 underline"
            data-switch-mode="login"
          >
            Already have an account? Login here
          </button>
        </div>
      </form>
    `
  }

  /**
   * @brief Render error message (now handled by popups)
   */
  private renderErrorMessage(): string {
    // Errors are now shown as popups, so return empty
    return ''
  }

  /**
   * @brief Render success message
   */
  private renderSuccessMessage(): string {
    const { success } = this.state
    
    if (!success) return ''
    
    return `
      <div class="mb-6 p-3 bg-green-900/20 border border-green-600 rounded-lg">
        <p class="text-green-400 text-sm text-center">✅ ${success}</p>
      </div>
    `
  }



  /**
   * @brief Render component
   */
  public render(): string {
    const { className = '' } = this.props
    const { mode } = this.state
    
    let formContent = ''
    
    switch (mode) {
      case 'login':
        formContent = this.renderLoginForm()
        break
      case 'register':
        formContent = this.renderRegisterForm()
        break
    }
    
    return `
      <div class="min-h-screen bg-black text-green-400 font-mono flex items-center justify-center ${className}">
        <div class="w-full max-w-md p-8 border border-green-600 rounded-lg bg-green-900/10 backdrop-blur-sm">
          <!-- Tab Navigation -->
          <div class="flex space-x-2 mb-6 bg-gray-900 p-1 rounded-lg">
            <button
              class="flex-1 px-3 py-2 text-sm font-bold rounded transition-colors ${mode === 'login' ? 'bg-green-600 text-black' : 'text-green-400 hover:text-green-300'}"
              data-switch-mode="login"
            >
              Login
            </button>
            <button
              class="flex-1 px-3 py-2 text-sm font-bold rounded transition-colors ${mode === 'register' ? 'bg-blue-600 text-white' : 'text-green-400 hover:text-green-300'}"
              data-switch-mode="register"
            >
              Register
            </button>
          </div>
          
          <!-- Messages -->
          ${this.renderErrorMessage()}
          ${this.renderSuccessMessage()}
          
          <!-- Form Content -->
          ${formContent}
          
          <!-- Back to Home -->
          <div class="mt-8 text-center">
            <button
              data-navigate="/"
              class="px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-lg transition-colors"
            >
              🏠 Back to Home
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
    // Login form submission
    const loginForm = container.querySelector('[data-login-form]') as HTMLFormElement
    if (loginForm) {
      loginForm.addEventListener('submit', this.handleLogin.bind(this))
    }
    
    // Register form submission
    const registerForm = container.querySelector('[data-register-form]') as HTMLFormElement
    if (registerForm) {
      registerForm.addEventListener('submit', this.handleRegister.bind(this))
    }
    
    // Mode switching
    const modeButtons = container.querySelectorAll('[data-switch-mode]')
    modeButtons.forEach(button => {
      button.addEventListener('click', () => {
        const newMode = button.getAttribute('data-switch-mode') as 'login' | 'register'
        if (newMode === 'login' || newMode === 'register') {
          this.switchMode(newMode)
          this.mount(container) // Re-mount with new state
        }
      })
    })
    
    // Note: Error handling is now done via popups, no inline error UI needed
    
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
