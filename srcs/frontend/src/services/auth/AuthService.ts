import { z } from 'zod'
import { ApiService } from '../api/BaseApiService'
import { catchErrorTyped } from '../error'
import { validateData } from '../utils/validation'
import { 
  LoginCredentialsSchema, 
  RegisterCredentialsSchema,
  AuthResponseSchema,
  UserSchema,
  type User,
  type LoginCredentials,
  type RegisterCredentials,
  type AuthResponse
} from '../schemas/auth.schemas'

/**
 * @brief Authentication service class - Zod-powered
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

  private loadStoredAuth(): void {
    const user = this.getCurrentUser()
    if (user) {
      console.log('🔐 Loaded stored authentication for:', user.username)
    }
  }

  /**
   * @brief Login with cookie architecture and Zod validation
   */
  public async login(credentials: LoginCredentialsSchema): Promise<{ success: boolean; user?: User }> {
    const validation = validateData(LoginCredentialsSchema, credentials)
    if (!validation.success) {
      throw new Error(validation.errors.join(', '))
    }

    const validCredentials: LoginCredentialsSchema = validation.data
    console.log('🔐 Attempting login for:', validCredentials.identifier)
    
    const [error, apiResponse] = await catchErrorTyped(
      this.post('/auth/login', {
        identifier: validCredentials.identifier,
        password: validCredentials.password,
        rememberMe: validCredentials.rememberMe
      })
    )

    if (error) {
      throw new Error(error.message || 'Login failed')
    }

    const responseValidation = validateData(AuthResponseSchema, apiResponse)
    if (!responseValidation.success) {
      throw new Error('Invalid server response')
    }

    const response = responseValidation.data
    if (!response.success || !response.data.success || !response.data.user) {
      throw new Error(response.data.message || 'Login failed')
    }

    const user = response.data.user

    // Handle refresh token based on rememberMe
    if (response.data.refreshToken) {
      if (validCredentials.rememberMe) {
        localStorage.setItem('ft_refresh_token', response.data.refreshToken)
      } else {
        this.refreshToken = response.data.refreshToken
      }
    }

    this.storeUser(user)
    console.log('✅ Login successful for:', user.username)
    
    return { success: true, user }
  }

  /**
   * @brief Register with Zod validation
   */
  public async register(credentials: unknown): Promise<{ success: boolean; message?: string }> {
    const validation = validateData(RegisterCredentialsSchema, credentials)
    if (!validation.success) {
      throw new Error(validation.errors.join(', '))
    }

    const validCredentials = validation.data
    console.log('📝 Attempting registration for:', validCredentials.email)
    
    const [error, apiResponse] = await catchErrorTyped(
      this.post('/auth/register', {
        email: validCredentials.email,
        password: validCredentials.password
      })
    )

    if (error) {
      throw new Error(error.message || 'Registration failed')
    }

    const responseValidation = validateData(AuthResponseSchema, apiResponse)
    if (!responseValidation.success) {
      throw new Error('Invalid server response')
    }

    const response = responseValidation.data
    if (!response.success || !response.data.success) {
      throw new Error(response.data.message || 'Registration failed')
    }

    console.log('✅ Registration successful for:', validCredentials.email)
    
    return { 
      success: true, 
      message: response.data.message || 'Registration successful!' 
    }
  }

  /**
   * @brief Logout with cookie architecture
   */
  public async logout(): Promise<void> {
    const [error] = await catchErrorTyped(this.post('/auth/logout', {}))
    
    if (error) {
      console.warn('Logout API call failed:', error)
    }
    
    this.clearStoredAuth()
    console.log('👋 User logged out')
  }

  /**
   * @brief Refresh token with cookie architecture
   */
  public async refreshAuthToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken()
    if (!refreshToken) return false

    const [error, apiResponse] = await catchErrorTyped(
      this.post('/auth/refresh', { refreshToken })
    )

    if (error) {
      console.warn('Token refresh failed')
      this.clearStoredAuth()
      return false
    }

    const responseValidation = validateData(AuthResponseSchema, apiResponse)
    if (!responseValidation.success || !responseValidation.data.success) {
      this.clearStoredAuth()
      return false
    }

    // Update refresh token if rotated
    if (responseValidation.data.data.refreshToken) {
      this.updateRefreshToken(responseValidation.data.data.refreshToken)
    }

    console.log('✅ Access token refreshed')
    return true
  }

  /**
   * @brief Request password reset with validation
   */
  public async requestPasswordReset(email: unknown): Promise<{ success: boolean; message?: string }> {
    const emailSchema = z.string().email('Valid email required')
    const validation = validateData(emailSchema, email)
    
    if (!validation.success) {
      throw new Error(validation.errors.join(', '))
    }

    console.log('📧 Requesting password reset for:', validation.data)
    
    const [error, apiResponse] = await catchErrorTyped(
      this.post('/auth/forgot-password', { email: validation.data })
    )

    if (error) {
      throw new Error(error.message || 'Password reset request failed')
    }

    const responseValidation = validateData(AuthResponseSchema, apiResponse)
    if (!responseValidation.success || !responseValidation.data.success) {
      throw new Error(responseValidation.data?.data.message || 'Password reset request failed')
    }

    console.log('✅ Password reset email sent')
    return { 
      success: true, 
      message: responseValidation.data.data.message || 'Password reset email sent successfully'
    }
  }

  /**
   * @brief Reset password with validation
   */
  public async resetPassword(token: unknown, newPassword: unknown): Promise<{ success: boolean; message?: string }> {
    const resetSchema = z.object({
      token: z.string().min(1, 'Reset token required'),
      password: z.string().min(8, 'Password must be at least 8 characters')
    })

    const validation = validateData(resetSchema, { token, password: newPassword })
    if (!validation.success) {
      throw new Error(validation.errors.join(', '))
    }

    console.log('🔐 Resetting password with token')
    
    const [error, apiResponse] = await catchErrorTyped(
      this.post('/auth/reset-password', {
        token: validation.data.token,
        password: validation.data.password
      })
    )

    if (error) {
      throw new Error(error.message || 'Password reset failed')
    }

    const responseValidation = validateData(AuthResponseSchema, apiResponse)
    if (!responseValidation.success || !responseValidation.data.success) {
      throw new Error(responseValidation.data?.data.message || 'Password reset failed')
    }

    console.log('✅ Password reset successful')
    return { 
      success: true, 
      message: responseValidation.data.data.message || 'Password reset successful'
    }
  }

  /**
   * @brief Verify email with validation
   */
  public async verifyEmail(token: unknown): Promise<{ success: boolean; message?: string; user?: User }> {
    const tokenSchema = z.string().min(1, 'Verification token required')
    const validation = validateData(tokenSchema, token)
    
    if (!validation.success) {
      throw new Error(validation.errors.join(', '))
    }

    console.log('📧 Verifying email with token')
    
    const [error, apiResponse] = await catchErrorTyped(
      this.get(`/auth/verify-email?token=${validation.data}`)
    )

    if (error) {
      throw new Error(error.message || 'Email verification failed')
    }

    const responseValidation = validateData(AuthResponseSchema, apiResponse)
    if (!responseValidation.success || !responseValidation.data.success) {
      throw new Error(responseValidation.data?.data.message || 'Email verification failed')
    }

    const response = responseValidation.data.data

    // Auto-authenticate if user data provided
    if (response.user) {
      this.storeUser(response.user)
      
      if (response.refreshToken) {
        localStorage.setItem('ft_refresh_token', response.refreshToken)
      }
      
      console.log('✅ Email verified - User authenticated:', response.user.username)
      return { 
        success: true, 
        message: response.message || 'Email verified successfully',
        user: response.user 
      }
    }

    console.log('✅ Email verified successfully')
    return { 
      success: true, 
      message: response.message || 'Email verified successfully'
    }
  }

  /**
   * @brief Resend email verification
   */
  public async resendEmailVerification(email: unknown): Promise<{ success: boolean; message?: string }> {
    const emailSchema = z.string().email('Valid email required')
    const validation = validateData(emailSchema, email)
    
    if (!validation.success) {
      throw new Error(validation.errors.join(', '))
    }

    console.log('📧 Resending email verification for:', validation.data)
    
    const [error, apiResponse] = await catchErrorTyped(
      this.post('/auth/resend-verification', { email: validation.data })
    )

    if (error) {
      throw new Error(error.message || 'Failed to resend verification email')
    }

    const responseValidation = validateData(AuthResponseSchema, apiResponse)
    if (!responseValidation.success || !responseValidation.data.success) {
      throw new Error(responseValidation.data?.data.message || 'Failed to resend verification email')
    }

    console.log('✅ Verification email resent')
    return { 
      success: true, 
      message: responseValidation.data.data.message || 'Verification email sent successfully'
    }
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  public getCurrentUser(): User | null {
    if (this.currentUser) return this.currentUser
    
    try {
      const userJson = localStorage.getItem('ft_user')
      if (!userJson) return null
      
      const userData = JSON.parse(userJson)
      const validation = validateData(UserSchema, userData)
      
      if (validation.success) {
        this.currentUser = validation.data
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

  public isAuthenticated(): boolean {
    return !!this.getRefreshToken()
  }

  public is2FAEnabled(): boolean {
    return this.currentUser?.twoFactorAuth?.enabled || false
  }

  public isOAuthAvailable(): boolean {
    return import.meta.env.VITE_OAUTH_ENABLED === 'true'
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private storeUser(user: User): void {
    try {
      localStorage.setItem('ft_user', JSON.stringify(user))
      this.currentUser = user
    } catch (error) {
      console.error('Failed to store user:', error)
    }
  }

  private clearStoredAuth(): void {
    localStorage.removeItem('ft_user')
    localStorage.removeItem('ft_refresh_token')
    this.currentUser = null
    this.refreshToken = null
  }

  private getRefreshToken(): string | null {
    return this.refreshToken || localStorage.getItem('ft_refresh_token')
  }

  private updateRefreshToken(newToken: string): void {
    if (this.refreshToken) {
      this.refreshToken = newToken
    } else {
      localStorage.setItem('ft_refresh_token', newToken)
    }
  }
}

export const authService = AuthService.getInstance()