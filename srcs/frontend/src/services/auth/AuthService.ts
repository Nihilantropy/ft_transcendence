/**
 * @brief Authentication service class with Zod schema validation
 * 
 * @description Handles JWT authentication with cookie-based access tokens
 * and memory/localStorage refresh tokens based on rememberMe preference.
 * Aligned with backend auth.js schemas for consistent validation.
 */

import { ApiService, type ApiResponse } from '../api/BaseApiService'
import { catchErrorTyped } from '../error'
import { 
  type User,
  type LoginRequest,
  type LoginResponse,
  type RegisterRequest,
  type RegisterForm,
  type RefreshTokenRequestSchema,
  type VerifyEmailQuery,
  type SuccessResponse,
  type ErrorResponse
} from './schemas/auth.schemas'
import { executeLogin } from './loginService'

/**
 * @brief Authentication service singleton
 */
export class AuthService extends ApiService {
  private static instance: AuthService
  private currentUser: User | null = null
  private refreshToken: string | null = null

  constructor() {
    super()
    this.loadStoredAuth()
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService()
    }
    return AuthService.instance
  }

  // ==========================================================================
  // AUTHENTICATION METHODS
  // ==========================================================================

  /**
   * @brief Login using extracted business logic
   * 
   * @param credentials - Login credentials
   * 
   * @return Promise<{ success: boolean; user?: User }>
   */
  public async login(credentials: LoginRequest): Promise<{ success: boolean; user?: User }> {
    console.log('🔐 Attempting login for:', credentials.identifier)
    
    // Use extracted login logic
    const [error, response] = await catchErrorTyped(
      executeLogin(credentials, (endpoint, data) => this.post(endpoint, data))
    )

    if (error) {
      throw new Error(error.message || 'Login failed')
    }

    if (!response.success || !response.user) {
      throw new Error(response.message || 'Authentication failed')
    }

    // Handle refresh token storage
    if (response.refreshToken) {
      if (credentials.rememberMe) {
        localStorage.setItem('ft_refresh_token', response.refreshToken)
      } else {
        this.refreshToken = response.refreshToken
      }
    }

    // Store user data
    this.storeUser(response.user)
    console.log('✅ Login successful for:', response.user.username)
    
    return { success: true, user: response.user }
  }

  /**
   * @brief Register new user account
   * @param credentials - Registration form data (with confirmation)
   * @return Success status and message
   */
  public async register(credentials: RegisterForm): Promise<{ success: boolean; message: string }> {
    const validation = validateData(RegisterFormSchema, credentials)
    if (!validation.success) {
      throw new Error(validation.errors.join(', '))
    }

    // Convert to backend request format (no confirmPassword)
    const registerRequest: RegisterRequest = {
      email: validation.data.email,
      password: validation.data.password
    }

    console.log('📝 Attempting registration for:', registerRequest.email)
    
    const [error, apiResponse] = await catchErrorTyped(
      this.post('/auth/register', registerRequest)
    )

    if (error) {
      throw new Error(error.message || 'Registration failed')
    }

    // Validate register response (has nested data structure)
    const response = safeParseApiResponse(RegisterResponseSchema, apiResponse)
    if (!response) {
      if (isErrorResponse(apiResponse)) {
        throw new Error(apiResponse.message || 'Registration failed')
      }
      throw new Error('Invalid server response')
    }

    if (!response.success) {
      throw new Error(response.message || 'Registration failed')
    }

    console.log('✅ Registration successful for:', registerRequest.email)
    
    return { 
      success: true, 
      message: response.message || 'Registration successful! Please check your email for verification.' 
    }
  }

  /**
   * @brief Verify email with token from query parameter
   * @param token - Email verification token
   * @return Success status and user data
   */
  public async verifyEmail(token: string): Promise<{ success: boolean; user?: User }> {
    const validation = validateData(VerifyEmailQuerySchema, { token })
    if (!validation.success) {
      throw new Error(validation.errors.join(', '))
    }

    console.log('📧 Verifying email with token')
    
    const [error, apiResponse] = await catchErrorTyped(
      this.get(`/auth/verify-email?token=${encodeURIComponent(token)}`)
    )

    if (error) {
      throw new Error(error.message || 'Email verification failed')
    }

    const response = safeParseApiResponse(VerifyEmailResponseSchema, apiResponse)
    if (!response) {
      if (isErrorResponse(apiResponse)) {
        throw new Error(apiResponse.message || 'Email verification failed')
      }
      throw new Error('Invalid server response')
    }

    if (!response.success) {
      throw new Error(response.message || 'Email verification failed')
    }

    // Store refresh token in memory (email verification doesn't use rememberMe)
    if (response.refreshToken) {
      this.refreshToken = response.refreshToken
    }

    this.storeUser(response.user)
    console.log('✅ Email verified and user logged in:', response.user.username)
    
    return { success: true, user: response.user }
  }

  /**
   * @brief Logout user and clear stored data
   */
  public async logout(): Promise<void> {
    const [error] = await catchErrorTyped(
      this.post('/auth/logout', {})
    )
    
    if (error) {
      console.warn('Logout API call failed:', error)
    }
    
    this.clearStoredAuth()
    console.log('👋 User logged out')
  }

  /**
   * @brief Refresh access token using stored refresh token
   * @return Success status
   */
  public async refreshAuthToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken()
    if (!refreshToken) {
      console.warn('No refresh token available')
      return false
    }

    const requestData: RefreshTokenRequestSchema = { refreshToken }
    
    const [error, apiResponse] = await catchErrorTyped(
      this.post('/auth/refresh', requestData)
    )

    if (error) {
      console.warn('Token refresh failed:', error.message)
      this.clearStoredAuth()
      return false
    }

    const response = safeParseApiResponse(RefreshResponseSchema, apiResponse)
    if (!response || !response.success) {
      console.warn('Invalid refresh response')
      this.clearStoredAuth()
      return false
    }

    // Update refresh token if rotated
    if (response.refreshToken) {
      this.updateRefreshToken(response.refreshToken)
    }

    console.log('✅ Access token refreshed')
    return true
  }

  /**
   * @brief Request password reset email
   * @param email - User email address
   * @return Success status and message
   */
  public async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    const emailSchema = z.string().email('Valid email required')
    const validation = validateData(emailSchema, email)
    
    if (!validation.success) {
      throw new Error(validation.errors.join(', '))
    }

    console.log('🔑 Requesting password reset for:', email)
    
    const [error, apiResponse] = await catchErrorTyped(
      this.post('/auth/forgot-password', { email })
    )

    if (error) {
      throw new Error(error.message || 'Failed to request password reset')
    }

    const response = safeParseApiResponse(SuccessResponseSchema, apiResponse)
    if (!response || !response.success) {
      if (isErrorResponse(apiResponse)) {
        throw new Error(apiResponse.message || 'Failed to request password reset')
      }
      throw new Error('Invalid server response')
    }

    console.log('✅ Password reset email sent')
    return { 
      success: true, 
      message: response.message || 'Password reset email sent successfully'
    }
  }

  /**
   * @brief Resend email verification
   * @param email - User email address
   * @return Success status and message
   */
  public async resendVerificationEmail(email: string): Promise<{ success: boolean; message: string }> {
    const emailSchema = z.string().email('Valid email required')
    const validation = validateData(emailSchema, email)
    
    if (!validation.success) {
      throw new Error(validation.errors.join(', '))
    }

    console.log('📧 Resending verification email for:', email)
    
    const [error, apiResponse] = await catchErrorTyped(
      this.post('/auth/resend-verification', { email })
    )

    if (error) {
      throw new Error(error.message || 'Failed to resend verification email')
    }

    const response = safeParseApiResponse(SuccessResponseSchema, apiResponse)
    if (!response || !response.success) {
      if (isErrorResponse(apiResponse)) {
        throw new Error(apiResponse.message || 'Failed to resend verification email')
      }
      throw new Error('Invalid server response')
    }

    console.log('✅ Verification email resent')
    return { 
      success: true, 
      message: response.message || 'Verification email sent successfully'
    }
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * @brief Get current authenticated user
   * @return User object or null
   */
  public getCurrentUser(): User | null {
    if (this.currentUser) return this.currentUser
    
    try {
      const userJson = localStorage.getItem('ft_user')
      if (!userJson) return null
      
      const userData = JSON.parse(userJson)
      const user = safeParseApiResponse(UserSchema, userData)
      
      if (user) {
        this.currentUser = user
        return this.currentUser
      } else {
        console.warn('Invalid stored user data, clearing...')
        localStorage.removeItem('ft_user')
        return null
      }
    } catch {
      localStorage.removeItem('ft_user')
      return null
    }
  }

  /**
   * @brief Check if user is authenticated
   * @return Authentication status
   */
  public isAuthenticated(): boolean {
    return !!this.getCurrentUser() && !!this.getRefreshToken()
  }

  /**
   * @brief Check if 2FA is enabled for current user
   * @return 2FA status
   */
  public is2FAEnabled(): boolean {
    // Note: 2FA info should come from separate endpoint when needed
    return false // Placeholder - implement when 2FA schema is defined
  }

  /**
   * @brief Check if OAuth is available
   * @return OAuth availability
   */
  public isOAuthAvailable(): boolean {
    return import.meta.env.VITE_OAUTH_ENABLED === 'true'
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  /**
   * @brief Store user data in localStorage
   * @param user - User object to store
   */
  private storeUser(user: User): void {
    try {
      localStorage.setItem('ft_user', JSON.stringify(user))
      this.currentUser = user
    } catch (error) {
      console.error('Failed to store user:', error)
    }
  }

  /**
   * @brief Clear all stored authentication data
   */
  private clearStoredAuth(): void {
    localStorage.removeItem('ft_user')
    localStorage.removeItem('ft_refresh_token')
    this.currentUser = null
    this.refreshToken = null
  }

  /**
   * @brief Get refresh token from memory or localStorage
   * @return Refresh token or null
   */
  private getRefreshToken(): string | null {
    return this.refreshToken || localStorage.getItem('ft_refresh_token')
  }

  /**
   * @brief Update refresh token in current storage location
   * @param newToken - New refresh token
   */
  private updateRefreshToken(newToken: string): void {
    if (this.refreshToken) {
      // Token was in memory, keep it in memory
      this.refreshToken = newToken
    } else {
      // Token was in localStorage, update localStorage
      localStorage.setItem('ft_refresh_token', newToken)
    }
  }

  /**
   * @brief Load stored authentication on service initialization
   */
  private loadStoredAuth(): void {
    const user = this.getCurrentUser()
    if (user) {
      console.log('🔐 Loaded stored authentication for:', user.username)
    }
  }
}

// Export singleton instance
export const authService = AuthService.getInstance()

function executeLogin(credentials: { identifier: string; password: string; rememberMe?: boolean | undefined; twoFactorToken?: string | undefined }, arg1: (endpoint: any, data: any) => Promise<ApiResponse<unknown>>): Promise<unknown> {
  throw new Error('Function not implemented.')
}
