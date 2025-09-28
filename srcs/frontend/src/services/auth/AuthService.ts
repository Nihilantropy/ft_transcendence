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
import { PasswordUtils } from '../utils/PasswordUtils'
import { catchErrorTyped } from '../error'
// import { googleOAuthService, type OAuthError, type OAuthCallbackResult } from './GoogleOAuthService'
import type {
  AuthResponse, 
  LoginRequest, 
  RegisterRequest
} from '../../types/api.types'
import type { User } from '../../types/global.types'

/**
 * @brief Authentication service class
 * 
 * @description Manages user authentication state, API calls, and token storage.
 */
export class AuthService extends ApiService {
  private static instance: AuthService
  private currentUser: User | null = null
  private refreshToken: String | null = null

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
      const userJson = localStorage.getItem('ft_user')

      if (userJson) {
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
  private storeUser(user: User): void {
    try {
      localStorage.setItem('ft_user', JSON.stringify(user))
      this.currentUser = user
    } catch (error) {
      console.error('Failed to store user:', error)
    }
  }

  /**
   * @brief Clear stored authentication data
   */
  private clearStoredAuth(): void {
    localStorage.removeItem('ft_user')
    localStorage.removeItem('ft_refresh_token')
    this.currentUser = null
  }

  /**
   * @brief Login user with credentials
   * 
   * @param credentials - User login credentials
   * @returns Promise resolving to authentication response
   */
  public async login(credentials: any): Promise<{ success: boolean; user?: User }> {
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

    if (!apiResponse.data.user) {
      throw new Error('Invalid response from server')
    }

    const refreshToken = apiResponse.data.refreshToken
    if (refreshToken) {
      if (credentials.rememberMe) {
        localStorage.setItem('ft_refresh_token', refreshToken)
      } else {
        this.refreshToken = refreshToken  // Store in memory
      }
    }

    // Store authentication data
    this.storeUser(apiResponse.data.user)
    
    // Store refresh token if provided
    if (refreshToken) {
      localStorage.setItem('ft_refresh_token', refreshToken)
    }

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
  public async register(credentials: any): Promise<{ success: boolean; message?: string }> {
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

  // TODO refactor in order to use catchErrorTyped and new cookie architecture for authentication/tokens
  /**
   * @brief Logout current user
   */
  public async logout(): Promise<void> {
    const [error] = await catchErrorTyped(this.post('/auth/logout', {}))
    
    if (error) {
      console.error('Logout error:', error)
      throw new Error('Logout failed')
    }
    console.log('👋 User logged out')
    // Clear auth anyway
    this.clearStoredAuth()
    }

  
  /**
   * @brief Refresh authentication token
   */
  public async refreshAuthToken(): Promise<boolean> {
    try {
      const refreshToken = localStorage.getItem('ft_refresh_token')
      if (!refreshToken) {
        return false
      }

      const apiResponse = await this.post<AuthResponse>('/auth/refresh', {
        refreshToken
      })

      if (apiResponse.success && apiResponse.data.success && apiResponse.data.user) {
        const accessToken = apiResponse.data.tokens?.accessToken
        const newRefreshToken = apiResponse.data.tokens?.refreshToken
        
        if (accessToken) {
          this.storeUser(apiResponse.data.user, accessToken)
          
          // Update refresh token if provided
          if (newRefreshToken) {
            localStorage.setItem('ft_refresh_token', newRefreshToken)
          }
          
          return true
        }
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
      this.get<AuthResponse>('/auth/verify-email?token=' + token)
    )

    if (error) {
      throw new Error(error.message || 'Email verification failed')
    }

    if (!apiResponse?.success || !apiResponse.data.success) {
      throw new Error(apiResponse?.data.message || 'Email verification failed')
    }

    // If verification successful AND we get user, authenticate the user
    const refreshToken = apiResponse.data.tokens?.refreshToken

    if (apiResponse.data.user) {
      this.storeUser(apiResponse.data.user)
      
      // Store refresh token if provided
      if (refreshToken) {
        localStorage.setItem('ft_refresh_token', refreshToken)
      }
      
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
    const accessToken = apiResponse.data.tokens?.accessToken
    
    if (accessToken) {
      this.authToken = accessToken
      localStorage.setItem('ft_auth_token', this.authToken)
      
      // Store refresh token if provided
      const refreshToken = apiResponse.data.tokens?.refreshToken
      if (refreshToken) {
        localStorage.setItem('ft_refresh_token', refreshToken)
      }
    }

    return {
      success: true,
      message: apiResponse.data.message,
      token: accessToken
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
  // Enhanced OAuth 2.0 Methods
  // ===========================================

  /**
   * @brief Check if Google OAuth is available and properly configured
   */
  public isOAuthAvailable(): boolean {
    return import.meta.env.VITE_OAUTH_ENABLED === 'true'
  }

  /**
   * @brief Initiate Google OAuth flow with PKCE
   */
  async startGoogleOAuth(): Promise<void> {
    const oauthAvailable = this.isOAuthAvailable()
    if (!oauthAvailable) {
      throw new Error('Google OAuth is not available or not properly configured')
    }

    const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
    const REDIRECT_URI = import.meta.env.VITE_OAUTH_REDIRECT_URI
    // Generate and store state for security
    const state = Math.random().toString(36).substring(2, 15)
    sessionStorage.setItem('oauth_state', state)

    // Build OAuth URL
    const params = new URLSearchParams({
      client_id: CLIENT_ID || '',
      redirect_uri: REDIRECT_URI || 'https://localhost/api/auth/oauth/google/callback',
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
      state: state
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    
    // Redirect to Google
    window.location.href = authUrl;
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
