/**
 * @brief Login Page component for ft_transcendence
 * 
 * @description User authentication page with login and registration forms.
 * Integrates with AuthService for real backend authentication.
 */

import { Component } from '../../components/base/Component'
import { showPopup } from '../../components/ui/Popup'
import { router } from '../../router/router'
import { authService } from '../../services/auth/AuthService'
import { type PasswordValidation, PasswordUtils } from '../../services/utils'
import { type LoginRequest, type RegisterRequest } from '../../services/auth/schemas/auth.schema'

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
  /** Password validation for registration */
  passwordValidation: PasswordValidation | null
  /** Current password being typed (for real-time validation) */
  currentPassword: string
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
      passwordValidation: null,
      currentPassword: ''
    })
  }

  /**
   * @brief Handle login form submission
   */
  private async handleLogin(event: Event): Promise<void> {
    event.preventDefault()
    const form = event.target as HTMLFormElement
    const formData = new FormData(form)

    const credentials: LoginRequest = {
      identifier: formData.get('identifier') as string,  // Can be email or username
      password: formData.get('password') as string,
      rememberMe: formData.get('rememberMe') === 'on'
    }

    await this.performLogin(credentials)
  }

  /**
   * @brief Handle catch error
   */
  private handleError(error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    showPopup(errorMessage)
  }


  /**
   * @brief Handle Google OAuth login
   */
  private async handleGoogleLogin(): Promise<void> {
    if (this.state.isLoading) return
    
    this.setState({ 
      isLoading: true, 
      success: null 
    })

    try {
      // Check if OAuth is available
      if (!authService.isOAuthAvailable()) {
        throw new Error('Google OAuth is not available. Please check your configuration.')
      }

      // Start enhanced OAuth login flow with PKCE
      await authService.startGoogleOAuth()
      
      // Note: The method will redirect to Google, so we won't reach here
      // unless there's an error in the redirect process
    } catch (error: unknown) {
      this.setState({ 
        isLoading: false
      })
      this.handleError(error)
    }
  }

  /**
   * @brief Perform login with credentials (extracted from handleLogin)
   */
  private async performLogin(credentials: LoginRequest): Promise<void> {
    this.setState({ 
      isLoading: true, 
      success: null 
    })

    try {
      const response = await authService.login(credentials)
      
      if (response.success) {
        // Check if 2FA is required
        if (response.requiresTwoFactor && response.tempToken) {
          this.setState({ 
            isLoading: false
          })
          
          // Store tempToken temporarily for 2FA verification page
          sessionStorage.setItem('ft_2fa_temp_token', response.tempToken)
          
          // Navigate to 2FA verification page
          console.log('🔐 2FA required, navigating to verification page')
          router.navigate('/verify-2fa')
          return
        }

        // Regular login success
        this.setState({ 
          success: 'Login successful! Redirecting...',
          isLoading: false
        })
        
        // Show success popup
        showPopup('Login successful! Redirecting to home page...')
        
        // Redirect to intended page or home
        setTimeout(() => {
          router.navigate('/')
        }, 1500)
      } else {
        // Handle authentication errors from backend
        this.setState({ 
          isLoading: false
        })
      }
    } catch (error: unknown) {
      this.setState({ 
        isLoading: false
      })
      this.handleError(error)
    }
  }

  /**
   * @brief Perform registration with credentials (extracted from handleRegister)
   */
  private async performRegister(credentials: { username: string; email: string; password: string; confirmPassword: string }): Promise<void> {
    this.setState({
      isLoading: true,
      success: null
    })

    try {
      // Registration request with username
      const registerCredentials: RegisterRequest = {
        username: credentials.username,
        email: credentials.email,
        password: credentials.password,
        confirmPassword: credentials.confirmPassword
      }
      
      const response = await authService.register(registerCredentials)
      
      if (response.success) {
        this.setState({ 
          success: 'Registration successful! Check your email for verification.',
          isLoading: false
        })
        
        // Show success popup
        showPopup('Registration successful! Check your email to verify your account.')
        
        // Stay on login page - user will verify email and then login
        // No automatic redirect since user is not authenticated yet
      } else {
        // Handle registration errors from backend
        this.setState({ 
          isLoading: false
        })
      }
    } catch (error) {
      this.setState({ 
        isLoading: false
      })
      this.handleError(error)
    }
  }

  /**
   * @brief Handle registration form submission
   */
  private async handleRegister(event: Event): Promise<void> {
    event.preventDefault()
    const form = event.target as HTMLFormElement
    const formData = new FormData(form)

    // Collect username, email and password for registration
    const credentials = {
      username: formData.get('username') as string,
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      confirmPassword: formData.get('confirmPassword') as string
    }

    // Validate password confirmation
    if (credentials.password !== credentials.confirmPassword) {
      showPopup('Passwords do not match')
      return
    }

    // Validate password strength (client-side validation)
    const passwordValidation = PasswordUtils.validatePassword(credentials.password)
    if (!passwordValidation.isValid) {
      showPopup(`Password validation failed: ${passwordValidation.feedback.join(', ')}`)
      return
    }

    // Ensure password meets minimum strength requirements
    if (passwordValidation.score < 60) {
      showPopup('Password is too weak. Please choose a stronger password.')
      return
    }

    await this.performRegister(credentials)
  }



  /**
   * @brief Check if OAuth is available and render accordingly
   */
  private renderOAuthButton(type: 'login' | 'register'): string {
    const { isLoading } = this.state
    
    // Check if OAuth is available
    if (!authService.isOAuthAvailable()) {
      return `
        <!-- OAuth unavailable notice -->
        <div class="text-center py-4">
          <p class="text-gray-500 text-sm">Google OAuth is not available</p>
          <p class="text-gray-600 text-xs">Check your configuration</p>
        </div>
      `
    }

    const buttonText = type === 'login' ? 'Sign in with Google' : 'Sign up with Google'
    const dataAttribute = type === 'login' ? 'data-oauth-login="true"' : 'data-oauth-register="true"'

    return `
      <!-- OAuth Divider -->
      <div class="flex items-center space-x-4 my-4">
        <div class="flex-1 h-px bg-green-600"></div>
        <span class="text-green-400 text-sm">or</span>
        <div class="flex-1 h-px bg-green-600"></div>
      </div>
      
      <!-- Google OAuth Button -->
      <button
        type="button"
        ${dataAttribute}
        class="w-full px-6 py-3 bg-white hover:bg-gray-100 text-gray-800 font-bold rounded-lg transition-all transform hover:scale-105 flex items-center justify-center space-x-2 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}"
        ${isLoading ? 'disabled' : ''}
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        <span>${buttonText}</span>
      </button>
    `
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
   * @brief Switch between login/register modes
   */
  private switchMode(newMode: 'login' | 'register'): void {
    this.setState({ 
      mode: newMode, 
      success: null,
      passwordValidation: null,
      currentPassword: ''
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
            <label for="identifier" class="block text-green-400 font-bold mb-2">
              Email or Username
            </label>
            <input
              type="text"
              id="identifier"
              name="identifier"
              required
              class="w-full px-4 py-3 bg-gray-900 border border-green-600 rounded-lg text-green-400 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
              placeholder="Enter your email or username"
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
          
          <div class="flex items-center justify-between">
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
            <button
              type="button"
              class="text-green-500 hover:text-green-400 underline text-sm"
              data-navigate="/forgot-password"
            >
              Forgot Password?
            </button>
          </div>
        </div>
        
        <button
          type="submit"
          class="w-full px-6 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-all transform hover:scale-105 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}"
          ${isLoading ? 'disabled' : ''}
        >
          ${isLoading ? '⏳ Logging in...' : '✅ Login'}
        </button>
        
        ${this.renderOAuthButton('login')}
        
        <div class="text-center space-y-2">
          <button
            type="button"
            class="text-green-500 hover:text-green-400 underline block"
            data-switch-mode="register"
          >
            Don't have an account? Register here
          </button>
        </div>
      </form>
    `
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
        <!-- Strength Bar -->
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
        
        <!-- Feedback Messages -->
        ${passwordValidation.feedback.length > 0 ? `
          <div class="space-y-1">
            ${passwordValidation.feedback.map(feedback => `
              <p class="text-xs ${passwordValidation.isValid ? 'text-green-400' : 'text-orange-400'}">
                ${feedback}
              </p>
            `).join('')}
          </div>
        ` : ''}
        
        <!-- Requirements Checklist -->
        <div class="grid grid-cols-2 gap-1 text-xs">
          <span class="${passwordValidation.requirements.minLength ? 'text-green-400' : 'text-gray-500'}">
            ${passwordValidation.requirements.minLength ? '✅' : '❌'} 8+ characters
          </span>
          <span class="${passwordValidation.requirements.hasUppercase ? 'text-green-400' : 'text-gray-500'}">
            ${passwordValidation.requirements.hasUppercase ? '✅' : '❌'} Uppercase
          </span>
          <span class="${passwordValidation.requirements.hasLowercase ? 'text-green-400' : 'text-gray-500'}">
            ${passwordValidation.requirements.hasLowercase ? '✅' : '❌'} Lowercase
          </span>
          <span class="${passwordValidation.requirements.hasNumbers ? 'text-green-400' : 'text-gray-500'}">
            ${passwordValidation.requirements.hasNumbers ? '✅' : '❌'} Numbers
          </span>
          <span class="${passwordValidation.requirements.hasSpecialChars ? 'text-green-400' : 'text-gray-500'}">
            ${passwordValidation.requirements.hasSpecialChars ? '✅' : '❌'} Special chars
          </span>
          <span class="${passwordValidation.requirements.noCommonPatterns ? 'text-green-400' : 'text-gray-500'}">
            ${passwordValidation.requirements.noCommonPatterns ? '✅' : '❌'} Unique
          </span>
        </div>
      </div>
    `
  }
  private renderRegisterForm(): string {
    const { isLoading } = this.state
    
    return `
      <form class="space-y-6" data-register-form="true">
        <h2 class="text-3xl font-bold text-center mb-6 neon-glow text-green-400">
          📝 Register
        </h2>
        <p class="text-center text-gray-300 mb-6">
          Create your account
        </p>
        
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
              pattern="[a-zA-Z0-9_]{3,20}"
              class="w-full px-4 py-3 bg-gray-900 border border-green-600 rounded-lg text-green-400 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
              placeholder="Choose a unique username (3-20 characters)"
              ${isLoading ? 'disabled' : ''}
            />
            <p class="mt-1 text-xs text-green-600">
              3-20 characters, letters, numbers, and underscores only
            </p>
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
              data-password-input="true"
              class="w-full px-4 py-3 bg-gray-900 border border-green-600 rounded-lg text-green-400 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
              placeholder="Create a password"
              ${isLoading ? 'disabled' : ''}
            />
            
            <!-- Password Strength Indicator -->
            <div id="password-strength-indicator">
              ${this.renderPasswordStrengthIndicator()}
            </div>
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
        
        ${this.renderOAuthButton('register')}
        
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
      <div class="min-h-screen bg-black text-green-400 font-mono py-8 px-4 ${className}">
        <!-- Back to Home Button - Top Right -->
        <button
          data-navigate="/"
          class="fixed top-6 right-6 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-lg transition-colors z-10"
        >
          🏠 Home
        </button>
        
        <div class="flex items-center justify-center min-h-full">
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

    // Google OAuth buttons
    const oauthLoginButton = container.querySelector('[data-oauth-login]') as HTMLButtonElement
    if (oauthLoginButton) {
      oauthLoginButton.addEventListener('click', this.handleGoogleLogin.bind(this))
    }

    const oauthRegisterButton = container.querySelector('[data-oauth-register]') as HTMLButtonElement
    if (oauthRegisterButton) {
      oauthRegisterButton.addEventListener('click', this.handleGoogleLogin.bind(this))
    }

    // Password input for real-time validation (registration only)
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
