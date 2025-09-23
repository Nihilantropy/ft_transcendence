/**
 * @brief Authentication Service for ft_transcendence
 * 
 * @description Comprehensive authentication service that handles us    } catch (error) {
      console.error('❌ Registration error:', error)
      
      // Simple error acknowledgment: return error code and message
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Registration failed',
        errorCode: (error && typeof error === 'object' && 'status' in error) ? (error as any).status : -1
      }
    }ion, login, 
 * logout, and session management. Features include:
 * 
 * - **Registration**: Email/password registration with email verification
 * - **Login**: Support for both email and username as login identifier
 * - **Username Management**: Post-registration username selection and availability checking
 * - **Email Verification**: Secure email verification flow for new accounts
 * - **Password Management**: Password reset and strength validation
 * - **Token Management**: JWT token storage, refresh, and secure session handling
 * - **Two-Factor Authentication**: TOTP-based 2FA setup, verification, and management
 * - **OAuth Integration**: Google OAuth 2.0 support for social authentication
 * - **Error Handling**: Centralized error handling with user-friendly messages
 * 
 * @version 2.0
 * @author ft_transcendence team
 */

import { ApiService } from '../api/BaseApiService'
import { PasswordUtils } from './PasswordUtils'
import { catchErrorTyped } from '../error'
import type { 
  AuthResponse, 
  LoginRequest, 
  RegisterRequest
} from '../../types/api.types'
import type { User } from '../../types/global.types'

// Type aliases for backwards compatibility
export type LoginCredentials = LoginRequest
export type RegisterCredentials = RegisterRequest

/**
 * @brief Authentication service class
 * 
 * @description Manages user authentication state, API calls, and token storage.
 */
export class AuthService extends ApiService {
  private static instance: AuthService
  private currentUser: User | null = null
  private authToken: string | null = null

  constructor() {
    super()
    this.loadStoredAuth()
  }

  /**
   * @brief Get singleton instance
   */
  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService()
    }
    return AuthService.instance
  }

  /**
   * @brief Load stored authentication from localStorage
   */
  private loadStoredAuth(): void {
    try {
      const token = localStorage.getItem('ft_auth_token')
      const userJson = localStorage.getItem('ft_user')
      
      if (token && userJson) {
        this.authToken = token
        this.currentUser = JSON.parse(userJson)
        console.log('🔐 Loaded stored authentication for:', this.currentUser?.username)
      }
    } catch (error) {
      console.warn('Failed to load stored auth:', error)
      this.clearStoredAuth()
    }
  }

  /**
   * @brief Store authentication data in localStorage
   */
  private storeAuth(user: User, token: string): void {
    try {
      localStorage.setItem('ft_auth_token', token)
      localStorage.setItem('ft_user', JSON.stringify(user))
      this.authToken = token
      this.currentUser = user
    } catch (error) {
      console.error('Failed to store auth:', error)
    }
  }

  /**
   * @brief Clear stored authentication data
   */
  private clearStoredAuth(): void {
    localStorage.removeItem('ft_user')
    localStorage.removeItem('ft_auth_token')
    localStorage.removeItem('ft_refresh_token')
    this.authToken = null
    this.currentUser = null
  }

  /**
   * @brief Login user with credentials
   * 
   * @param credentials - User login credentials
   * @returns Promise resolving to authentication response
   */
  public async login(credentials: LoginCredentials): Promise<{ success: boolean; user?: User }> {
    console.log('🔐 Attempting login for:', credentials.identifier)
    
    const [error, apiResponse] = await catchErrorTyped(
      this.post<AuthResponse>('/auth/login', {
        identifier: credentials.identifier,  // Can be email or username
        password: credentials.password,
        rememberMe: credentials.rememberMe || false
      })
    )

    if (error) {
      throw new Error(error.message || 'Login failed')
    }

    if (!apiResponse?.success || !apiResponse.data.success) {
      throw new Error(apiResponse?.data.message || 'Login failed')
    }

    if (!apiResponse.data.user || !apiResponse.data.token) {
      throw new Error('Invalid response from server')
    }

    this.storeAuth(apiResponse.data.user, apiResponse.data.token)
    console.log('✅ Login successful for:', apiResponse.data.user.username)
    
    return { 
      success: true, 
      user: apiResponse.data.user 
    }
  }

  /**
   * @brief Register new user
   * 
   * @param credentials - User registration credentials
   * @returns Promise resolving to authentication response
   */
  public async register(credentials: RegisterRequest): Promise<{ success: boolean; message?: string }> {
    console.log('📝 Attempting registration for:', credentials.email)
    
    // Validate passwords match (client-side check)
    if (credentials.password !== credentials.confirmPassword) {
      throw new Error('Passwords do not match')
    }

    // Validate password strength (client-side check only for UX)
    const passwordValidation = PasswordUtils.validatePassword(credentials.password)
    if (!passwordValidation.isValid) {
      throw new Error(`Password validation failed: ${passwordValidation.feedback.join(', ')}`)
    }

    // Send plain text password to backend - backend will handle secure hashing
    console.log('📤 Sending registration data to backend (backend will hash password securely)...')
    
    const [error, apiResponse] = await catchErrorTyped(
      this.post<AuthResponse>('/auth/register', {
        email: credentials.email,
        password: credentials.password // Backend will hash this securely with bcrypt
      })
    )
    if (error) {
      throw new Error(error.message || 'Registration failed')
    }

    if (!apiResponse?.success || !apiResponse.data.success) {
      throw new Error(apiResponse?.data.message || 'Registration failed')
    }

    console.log('✅ Registration successful for:', credentials.email, '- Verification email sent')
    console.log('📧 User must verify email before authentication')
    
    return { 
      success: true, 
      message: apiResponse.data.message || 'Registration successful! Please check your email to verify your account.' 
    }
  }

  /**
   * @brief Logout current user
   */
  public async logout(): Promise<void> {
    try {
      if (this.authToken) {
        // Notify backend of logout (optional, fire-and-forget)
        this.post('/auth/logout', {}).catch((error: any) => {
          console.warn('Backend logout notification failed:', error)
        })
      }
      
      this.clearStoredAuth()
      console.log('👋 User logged out')
    } catch (error) {
      console.error('Logout error:', error)
      // Clear auth anyway
      this.clearStoredAuth()
    }
  }

  /**
   * @brief Check if user is currently authenticated
   */
  public isAuthenticated(): boolean {
    return !!(this.currentUser && this.authToken)
  }

  /**
   * @brief Get current authenticated user
   */
  public getCurrentUser(): User | null {
    return this.currentUser
  }

  /**
   * @brief Get current auth token
   */
  public getAuthToken(): string | null {
    return this.authToken
  }

  /**
   * @brief Refresh authentication token
   */
  public async refreshToken(): Promise<boolean> {
    try {
      const refreshToken = localStorage.getItem('ft_refresh_token')
      if (!refreshToken) {
        return false
      }

      const apiResponse = await this.post<AuthResponse>('/auth/refresh', {
        refreshToken
      })

      if (apiResponse.success && apiResponse.data.success && apiResponse.data.user && apiResponse.data.token) {
        this.storeAuth(apiResponse.data.user, apiResponse.data.token)
        return true
      }
      
      return false
    } catch (error) {
      console.error('Token refresh failed:', error)
      return false
    }
  }

  /**
   * @brief Request password reset email
   * 
   * @param email - User email address
   * @returns Promise resolving to success/failure response
   */
  public async requestPasswordReset(email: string): Promise<{ success: boolean; message?: string }> {
    console.log('📧 Requesting password reset for:', email)
    
    const [error, apiResponse] = await catchErrorTyped(
      this.post<AuthResponse>('/auth/forgot-password', { email })
    )

    if (error) {
      throw new Error(error.message || 'Password reset request failed')
    }

    if (!apiResponse?.success || !apiResponse.data.success) {
      throw new Error(apiResponse?.data.message || 'Password reset request failed')
    }

    console.log('✅ Password reset email sent')
    return { 
      success: true, 
      message: apiResponse.data.message || 'Password reset email sent successfully'
    }
  }

  /**
   * @brief Reset password with token
   * 
   * @param token - Reset token from email
   * @param newPassword - New password
   * @returns Promise resolving to success/failure response
   */
  public async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
    console.log('🔐 Resetting password with token')
    
    // Validate password strength (client-side check for UX)
    const passwordValidation = PasswordUtils.validatePassword(newPassword)
    if (!passwordValidation.isValid) {
      throw new Error(`Password validation failed: ${passwordValidation.feedback.join(', ')}`)
    }

    const [error, apiResponse] = await catchErrorTyped(
      this.post<AuthResponse>('/auth/reset-password', {
        token,
        password: newPassword // Backend will hash this securely
      })
    )

    if (error) {
      throw new Error(error.message || 'Password reset failed')
    }

    if (!apiResponse?.success || !apiResponse.data.success) {
      throw new Error(apiResponse?.data.message || 'Password reset failed')
    }

    console.log('✅ Password reset successful')
    return { 
      success: true, 
      message: apiResponse.data.message || 'Password reset successful'
    }
  }

  /**
   * @brief Verify email address with token
   * 
   * @param token - Email verification token
   * @returns Promise resolving to success/failure response with authentication
   */
  public async verifyEmail(token: string): Promise<{ success: boolean; message?: string; user?: User }> {
    console.log('📧 Verifying email with token')
    
    const [error, apiResponse] = await catchErrorTyped(
      this.post<AuthResponse>('/auth/verify-email', { token })
    )

    if (error) {
      throw new Error(error.message || 'Email verification failed')
    }

    if (!apiResponse?.success || !apiResponse.data.success) {
      throw new Error(apiResponse?.data.message || 'Email verification failed')
    }

    // If verification successful AND we get user + token, authenticate the user
    if (apiResponse.data.user && apiResponse.data.token) {
      this.storeAuth(apiResponse.data.user, apiResponse.data.token)
      console.log('✅ Email verification successful - User authenticated:', apiResponse.data.user.username)
      return { 
        success: true, 
        message: apiResponse.data.message || 'Email verified successfully',
        user: apiResponse.data.user 
      }
    } else {
      console.log('✅ Email verification successful - No auto-authentication')
      return { 
        success: true, 
        message: apiResponse.data.message || 'Email verified successfully'
      }
    }
  }

  /**
   * @brief Resend email verification
   * 
   * @param email - User email address
   * @returns Promise resolving to success/failure response
   */
  public async resendEmailVerification(email: string): Promise<{ success: boolean; message?: string }> {
    console.log('📧 Resending email verification for:', email)
    
    const [error, apiResponse] = await catchErrorTyped(
      this.post<AuthResponse>('/auth/resend-verification', { email })
    )

    if (error) {
      throw new Error(error.message || 'Failed to resend verification email')
    }

    if (!apiResponse?.success || !apiResponse.data.success) {
      throw new Error(apiResponse?.data.message || 'Failed to resend verification email')
    }

    console.log('✅ Verification email resent')
    return { 
      success: true, 
      message: apiResponse.data.message || 'Verification email sent successfully'
    }
  }

  // ============================================================================
  // USERNAME MANAGEMENT METHODS
  // ============================================================================

  /**
   * @brief Check if username is available
   * 
   * @param username - Username to check
   * @returns Promise resolving to AuthResponse with availability data
   */
  public async checkUsernameAvailability(username: string): Promise<{ success: boolean; available: boolean; message?: string }> {
    console.log('🏷️ Checking username availability:', username)
    
    const [error, apiResponse] = await catchErrorTyped(
      this.post<AuthResponse & { available?: boolean }>('/auth/check-username', { username })
    )

    if (error) {
      throw new Error(error.message || 'Failed to check username availability')
    }

    if (!apiResponse?.success || !apiResponse.data.success) {
      throw new Error(apiResponse?.data.message || 'Failed to check username availability')
    }

    const available = apiResponse.data.available ?? false
    console.log(available ? '✅ Username available' : '❌ Username taken:', username)
    
    return {
      success: true,
      available,
      message: apiResponse.data.message
    }
  }

  /**
   * @brief Set username for current authenticated user
   * 
   * @param username - New username to set
   * @returns Promise resolving to AuthResponse
   */
  public async setUsername(username: string): Promise<{ success: boolean; message?: string; user?: User }> {
    console.log('🏷️ Setting username:', username)
    
    if (!this.isAuthenticated()) {
      throw new Error('User must be authenticated to set username')
    }
    
    const [error, apiResponse] = await catchErrorTyped(
      this.post<AuthResponse>('/auth/set-username', { username })
    )

    if (error) {
      throw new Error(error.message || 'Failed to set username')
    }

    if (!apiResponse?.success || !apiResponse.data.success) {
      throw new Error(apiResponse?.data.message || 'Failed to set username')
    }

    // If username set successfully and we get updated user data, update stored user
    if (apiResponse.data.user) {
      this.currentUser = apiResponse.data.user
      localStorage.setItem('ft_user', JSON.stringify(this.currentUser))
      console.log('✅ Username set successfully and user data updated')
      
      return {
        success: true,
        message: apiResponse.data.message || 'Username set successfully',
        user: apiResponse.data.user
      }
    }

    return {
      success: true,
      message: apiResponse.data.message || 'Username set successfully'
    }
  }

  // ============================================================================
  // TWO-FACTOR AUTHENTICATION METHODS
  // ============================================================================

  /**
   * @brief Setup 2FA for user account
   * 
   * @description Generates TOTP secret, QR code, and backup codes for user
   * @returns Promise resolving to 2FA setup data
   */
  public async setup2FA(): Promise<{ success: boolean; setupData?: any; message?: string }> {
    console.log('🔐 Setting up 2FA for current user')
    
    const [error, apiResponse] = await catchErrorTyped(
      this.post<AuthResponse & { setupData?: any }>('/auth/2fa/setup', {
        userId: this.currentUser?.id
      })
    )

    if (error) {
      throw new Error(error.message || '2FA setup failed')
    }

    if (!apiResponse?.success || !apiResponse.data.success) {
      throw new Error(apiResponse?.data.message || '2FA setup failed')
    }

    if (apiResponse.data.setupData) {
      console.log('✅ 2FA setup data generated successfully')
      return {
        success: true,
        setupData: apiResponse.data.setupData,
        message: apiResponse.data.message
      }
    } else {
      throw new Error('Failed to generate 2FA setup data')
    }
  }

  /**
   * @brief Verify and enable 2FA setup
   * 
   * @param token - TOTP token from authenticator app
   * @param secret - Secret key generated during setup
   * @returns Promise resolving to verification response
   */
  public async verify2FASetup(token: string, secret: string): Promise<{ success: boolean; message?: string }> {
    console.log('🔐 Verifying 2FA setup token')
    
    const [error, apiResponse] = await catchErrorTyped(
      this.post<AuthResponse>('/auth/2fa/verify-setup', {
        userId: this.currentUser?.id,
        token,
        secret
      })
    )

    if (error) {
      throw new Error(error.message || '2FA setup verification failed')
    }

    if (!apiResponse?.success || !apiResponse.data.success) {
      throw new Error(apiResponse?.data.message || '2FA setup verification failed')
    }

    console.log('✅ 2FA setup verified and enabled')
    // Update current user's 2FA status
    if (this.currentUser) {
      this.currentUser.twoFactorAuth = {
        enabled: true,
        setupComplete: true,
        backupCodesGenerated: true
      }
      this.updateStoredUser()
    }

    return {
      success: true,
      message: apiResponse.data.message
    }
  }

  /**
   * @brief Verify 2FA token during login
   * 
   * @param token - TOTP token from authenticator app
   * @param backupCode - Optional backup code
   * @returns Promise resolving to verification response
   */
  public async verify2FA(token?: string, backupCode?: string): Promise<{ success: boolean; message?: string; token?: string }> {
    console.log('🔐 Verifying 2FA token for login')
    
    const [error, apiResponse] = await catchErrorTyped(
      this.post<AuthResponse>('/auth/2fa/verify', {
        userId: this.currentUser?.id,
        token,
        backupCode
      })
    )

    if (error) {
      throw new Error(error.message || '2FA verification failed')
    }

    if (!apiResponse?.success || !apiResponse.data.success) {
      throw new Error(apiResponse?.data.message || '2FA verification failed')
    }

    console.log('✅ 2FA verification successful')
    // Update authentication state
    if (apiResponse.data.token) {
      this.authToken = apiResponse.data.token
      localStorage.setItem('ft_auth_token', this.authToken)
    }

    return {
      success: true,
      message: apiResponse.data.message,
      token: apiResponse.data.token
    }
  }

  /**
   * @brief Disable 2FA for user account
   * 
   * @param password - User's current password for confirmation
   * @param token - Optional 2FA token for additional security
   * @returns Promise resolving to disable response
   */
  public async disable2FA(password: string, token?: string): Promise<{ success: boolean; message?: string }> {
    console.log('🔐 Disabling 2FA for current user')
    
    const [error, apiResponse] = await catchErrorTyped(
      this.post<AuthResponse>('/auth/2fa/disable', {
        userId: this.currentUser?.id,
        password,
        token
      })
    )

    if (error) {
      throw new Error(error.message || '2FA disable failed')
    }

    if (!apiResponse?.success || !apiResponse.data.success) {
      throw new Error(apiResponse?.data.message || '2FA disable failed')
    }

    console.log('✅ 2FA disabled successfully')
    // Update current user's 2FA status
    if (this.currentUser) {
      this.currentUser.twoFactorAuth = {
        enabled: false,
        setupComplete: false,
        backupCodesGenerated: false
      }
      this.updateStoredUser()
    }

    return {
      success: true,
      message: apiResponse.data.message
    }
  }

  /**
   * @brief Check if current user has 2FA enabled
   * 
   * @returns boolean indicating 2FA status
   */
  public is2FAEnabled(): boolean {
    return this.currentUser?.twoFactorAuth?.enabled || false
  }

  /**
   * @brief Update stored user data in localStorage
   */
  private updateStoredUser(): void {
    if (this.currentUser) {
      localStorage.setItem('ft_user', JSON.stringify(this.currentUser))
    }
  }

  // ===========================================
  // OAuth 2.0 Methods
  // ===========================================

  /**
   * @brief Check if OAuth is enabled and configured
   */
  public isOAuthAvailable(): boolean {
    return import.meta.env.VITE_OAUTH_ENABLED === 'true'
  }

  /**
   * @brief Initiate Google OAuth flow
   */
  public startGoogleOAuth(returnTo?: string): void {
    console.log('🔐 Starting Google OAuth flow')
    // Redirect to backend OAuth endpoint
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
    const oauthUrl = `${baseUrl}/auth/oauth/google`
    const params = new URLSearchParams()
    if (returnTo) {
      params.append('returnTo', returnTo)
    }
    window.location.href = `${oauthUrl}?${params.toString()}`
  }

  /**
   * @brief Handle OAuth callback and complete authentication
   */
  public async handleOAuthCallback(searchParams: URLSearchParams): Promise<{ success: boolean; user?: any; token?: string; message?: string; returnTo?: string }> {
    console.log('🔐 Processing OAuth callback')
    
    // Extract OAuth parameters from URL
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const returnTo = searchParams.get('returnTo')
    
    if (!code) {
      throw new Error('OAuth authorization code not found')
    }

    const [error, apiResponse] = await catchErrorTyped(
      this.post<AuthResponse>('/auth/oauth/google/callback', {
        code,
        state,
        returnTo
      })
    )

    if (error) {
      throw new Error(error.message || 'OAuth authentication failed')
    }

    if (!apiResponse?.success || !apiResponse.data.success) {
      throw new Error(apiResponse?.data.message || 'OAuth authentication failed')
    }

    if (apiResponse.data.user && apiResponse.data.token) {
      // Store authentication data
      this.storeAuth(apiResponse.data.user, apiResponse.data.token)
      
      console.log('🔐 OAuth authentication successful:', apiResponse.data.user.username)
      
      return {
        success: true,
        user: apiResponse.data.user,
        token: apiResponse.data.token,
        message: `OAuth authentication successful. ${returnTo ? `Redirecting to ${returnTo}` : 'Welcome!'}`,
        returnTo: returnTo || undefined
      }
    } else {
      throw new Error('Invalid OAuth response data')
    }
  }

  /**
   * @brief Link Google account to existing user
   */
  public async linkGoogleAccount(): Promise<{ success: boolean; message?: string }> {
    if (!this.isAuthenticated()) {
      throw new Error('User must be authenticated to link accounts')
    }

    console.log('🔐 Starting Google account linking')
    // Redirect to OAuth linking endpoint
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
    const linkUrl = `${baseUrl}/auth/oauth/google/link`
    window.location.href = linkUrl
    
    return {
      success: true,
      message: 'Redirecting to Google for account linking...'
    }
  }

  /**
   * @brief Unlink OAuth provider from account
   */
  public async unlinkOAuthProvider(provider: string): Promise<{ success: boolean; message?: string; user?: any }> {
    const [error, apiResponse] = await catchErrorTyped(
      this.delete<AuthResponse>(`/auth/oauth/${provider}`)
    )

    if (error) {
      throw new Error(error.message || `Failed to unlink ${provider} account`)
    }

    if (!apiResponse?.success || !apiResponse.data.success) {
      throw new Error(apiResponse?.data.message || `Failed to unlink ${provider} account`)
    }

    if (apiResponse.data.user) {
      // Update stored user data
      this.currentUser = apiResponse.data.user
      this.updateStoredUser()
      
      console.log('🔐 OAuth provider unlinked successfully')
    }
    
    return {
      success: true,
      message: apiResponse.data.message,
      user: apiResponse.data.user
    }
  }
}

// Export singleton instance
export const authService = AuthService.getInstance()
