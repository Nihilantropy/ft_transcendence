/**
 * @brief Authentication service class with Zod schema validation
 * 
 * @description Handles JWT authentication with cookie-based access tokens
 * and memory/localStorage refresh tokens based on rememberMe preference.
 * Aligned with backend auth.js schemas for consistent validation.
 */

import { ApiService } from '../api/BaseApiService'
import {
  UserSchema,
  type User,
  type LoginRequest,
  type LoginResponse,
  type RegisterForm,
  safeParseApiResponse
} from './schemas/auth.schemas'
import { executeLogin } from './executeLogin'
import { executeRegister } from './executeRegister'
import { executeVerifyEmail } from './executeVerifyEmail'
import { executeLogout } from './executeLogout'
import { executeRefreshToken } from './executeRefreshToken'
import { executeRequestPasswordReset } from './executeRequestPasswordReset'
import { executeResendVerificationEmail } from './executeResendVerificationEmail'
import { executeSetup2FA } from './executeSetup2FA'
import { executeVerify2FASetup } from './executeVerify2FASetup'
import { executeVerify2FA } from './executeVerify2FA'

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
   * @param credentials - Login credentials
   * @return Promise<{ success: boolean; user?: User }>
   * @throws Error on failure with descriptive message
   */
  public async login(credentials: LoginRequest): Promise<{ success: boolean; user?: User }> {
    console.log('🔐 Attempting login for:', credentials.identifier)
    try {
      const loginData: LoginResponse = await executeLogin(credentials, '/auth/login')

      // Handle refresh token storage
      if (loginData.refreshToken) {
        if (credentials.rememberMe) {
          localStorage.setItem('ft_refresh_token', loginData.refreshToken)
        } else {
          this.refreshToken = loginData.refreshToken
        }
      }

      // Store user data
      if (loginData.user) {
        this.storeUser(loginData.user)
        console.log('✅ Login successful for:', loginData.user.username)
      } else {
        throw new Error('Login response missing user data')
      }

      return { success: true, user: loginData.user }
    } catch (error) {
      if (error instanceof Error) {
        console.warn('❌ Login failed:', error.message)
        throw new Error(error.message || 'Login failed')
      } else {
        console.error('❌ Login failed:', error)
        throw new Error('Login failed')
      }
    }
  }

  /**
   * @brief Register new user account using extracted business logic
   * @param credentials - Registration request data (taken from validated form)
   * @return Promise<{ success: boolean; message: string }>
   * @throws Error on failure with descriptive message
   */
  public async register(credentials: RegisterForm): Promise<{ success: boolean; message: string }> {
    console.log('📝 Attempting registration for:', credentials.email)
    try {
      const registerData = await executeRegister(credentials, '/auth/register')

      console.log('✅ Registration successful for:', credentials.email)
      
      return { 
        success: true, 
        message: registerData.message || 'Registration successful! Please check your email for verification.' 
      }
    } catch (error) {
      if (error instanceof Error) {
        console.warn('❌ Registration failed:', error.message)
        throw new Error(error.message || 'Registration failed')
      } else {
        console.error('❌ Registration failed:', error)
        throw new Error('Registration failed')
      }
    }
  }

  /**
   * @brief Verify email using extracted business logic
   * @param token - Email verification token from query parameter
   * @return Promise<{ success: boolean; user?: User }>
   * @throws Error on failure with descriptive message
   */
  public async verifyEmail(token: string): Promise<{ success: boolean; user?: User }> {
    console.log('📧 Attempting email verification')
    try {
      const verificationData = await executeVerifyEmail(token, '/auth/verify-email')

      // Handle refresh token storage (email verification uses memory storage)
      if (verificationData.refreshToken) {
        this.refreshToken = verificationData.refreshToken
      }

      // Store user data
      if (verificationData.user) {
        this.storeUser(verificationData.user)
        console.log('✅ Email verified and user logged in:', verificationData.user.username)
      } else {
        throw new Error('Verification response missing user data')
      }

      return { success: true, user: verificationData.user }
    } catch (error) {
      if (error instanceof Error) {
        console.warn('❌ Email verification failed:', error.message)
        throw new Error(error.message || 'Email verification failed')
      } else {
        console.error('❌ Email verification failed:', error)
        throw new Error('Email verification failed')
      }
    }
  }

  /**
   * @brief Logout user using extracted business logic
   * @return Promise<void>
   * @throws Error on failure with descriptive message
   */
  public async logout(): Promise<void> {
    console.log('👋 Attempting logout')
    try {
      await executeLogout('/auth/logout')
      console.log('✅ Logout successful')
    } catch (error) {
      if (error instanceof Error) {
        console.warn('❌ Logout API call failed:', error.message)
        // Continue with cleanup even if API call fails
      } else {
        console.error('❌ Logout API call failed:', error)
      }
    }
    
    // Always clear stored authentication data
    this.clearStoredAuth()
    console.log('🧹 Authentication data cleared')
  }

  /**
   * @brief Refresh access token using extracted business logic
   * @return Promise<boolean> - Success status
   */
  public async refreshAuthToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken()
    if (!refreshToken) {
      console.warn('❌ No refresh token available')
      return false
    }

    console.log('🔄 Attempting token refresh')
    try {
      const refreshData = await executeRefreshToken(refreshToken, '/auth/refresh')

      // Handle token rotation if new refresh token provided
      if (refreshData.refreshToken) {
        this.updateRefreshToken(refreshData.refreshToken)
        console.log('🔄 Refresh token rotated')
      }

      console.log('✅ Access token refreshed successfully')
      return true
    } catch (error) {
      if (error instanceof Error) {
        console.warn('❌ Token refresh failed:', error.message)
      } else {
        console.error('❌ Token refresh failed:', error)
      }
      
      // Clear stored auth on refresh failure (tokens likely expired)
      this.clearStoredAuth()
      return false
    }
  }


  /**
   * @brief Request password reset using extracted business logic
   * @param email - User email address
   * @return Promise<{ success: boolean; message: string }>
   * @throws Error on failure with descriptive message
   */
  public async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    console.log('🔑 Requesting password reset for:', email)
    try {
      const resetData = await executeRequestPasswordReset(email, '/auth/forgot-password')

      console.log('✅ Password reset email sent')
      return { 
        success: true, 
        message: resetData.message || 'Password reset email sent successfully'
      }
    } catch (error) {
      if (error instanceof Error) {
        console.warn('❌ Password reset request failed:', error.message)
        throw new Error(error.message || 'Failed to request password reset')
      } else {
        console.error('❌ Password reset request failed:', error)
        throw new Error('Failed to request password reset')
      }
    }
  }

  /**
   * @brief Resend verification email using extracted business logic
   * @param email - User email address
   * @return Promise<{ success: boolean; message: string }>
   * @throws Error on failure with descriptive message
   */
  public async resendVerificationEmail(email: string): Promise<{ success: boolean; message: string }> {
    console.log('📧 Resending verification email for:', email)
    try {
      const verificationData = await executeResendVerificationEmail(email, '/auth/resend-verification')

      console.log('✅ Verification email resent')
      return { 
        success: true, 
        message: verificationData.message || 'Verification email sent successfully'
      }
    } catch (error) {
      if (error instanceof Error) {
        console.warn('❌ Resend verification email failed:', error.message)
        throw new Error(error.message || 'Failed to resend verification email')
      } else {
        console.error('❌ Resend verification email failed:', error)
        throw new Error('Failed to resend verification email')
      }
    }
  }

  // ============================================================================
  // TWO-FACTOR AUTHENTICATION METHODS
  // ============================================================================

  /**
   * @brief Setup 2FA using extracted business logic
   * @return Promise<{ success: boolean; setupData?: any; message?: string }>
   * @throws Error on failure with descriptive message
   */
  public async setup2FA(): Promise<{ success: boolean; setupData?: any; message?: string }> {
    if (!this.currentUser?.id) {
      throw new Error('User must be logged in to setup 2FA')
    }

    console.log('🔐 Setting up 2FA for current user')
    try {
      const setup2FAData = await executeSetup2FA(this.currentUser.id, '/auth/2fa/setup')

      if (setup2FAData.setupData) {
        console.log('✅ 2FA setup data generated successfully')
        return {
          success: true,
          setupData: setup2FAData.setupData,
          message: setup2FAData.message
        }
      } else {
        throw new Error('Failed to generate 2FA setup data')
      }
    } catch (error) {
      if (error instanceof Error) {
        console.warn('❌ 2FA setup failed:', error.message)
        throw new Error(error.message || '2FA setup failed')
      } else {
        console.error('❌ 2FA setup failed:', error)
        throw new Error('2FA setup failed')
      }
    }
  }

  /**
   * @brief Verify 2FA setup using extracted business logic
   * @param token - TOTP token from authenticator app
   * @param secret - Secret key generated during setup
   * @return Promise<{ success: boolean; message?: string }>
   * @throws Error on failure with descriptive message
   */
  public async verify2FASetup(token: string, secret: string): Promise<{ success: boolean; message?: string }> {
    if (!this.currentUser?.id) {
      throw new Error('User must be logged in to verify 2FA setup')
    }

    console.log('🔐 Verifying 2FA setup token')
    try {
      const verificationData = await executeVerify2FASetup(
        this.currentUser.id,
        token,
        secret,
        '/auth/2fa/verify-setup'
      )

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
        message: verificationData.message
      }
    } catch (error) {
      if (error instanceof Error) {
        console.warn('❌ 2FA setup verification failed:', error.message)
        throw new Error(error.message || '2FA setup verification failed')
      } else {
        console.error('❌ 2FA setup verification failed:', error)
        throw new Error('2FA setup verification failed')
      }
    }
  }

  /**
   * @brief Verify 2FA using extracted business logic
   * @param token - TOTP token from authenticator app (optional)
   * @param backupCode - Backup code (optional)
   * @return Promise<{ success: boolean; message?: string; token?: string }>
   * @throws Error on failure with descriptive message
   */
  public async verify2FA(token?: string, backupCode?: string): Promise<{ success: boolean; message?: string; token?: string }> {
    if (!this.currentUser?.id) {
      throw new Error('User must be logged in to verify 2FA')
    }

    console.log('🔐 Verifying 2FA token for login')
    try {
      const verificationData = await executeVerify2FA(
        this.currentUser.id,
        token,
        backupCode,
        '/auth/2fa/verify'
      )

      console.log('✅ 2FA verification successful')

      // TODO access token are saved in cookies by backend, refresh token could be in response body. Refactor logic accordingly
      // Update authentication state with tokens
      const accessToken = verificationData.tokens?.accessToken
      if (accessToken) {
        this.authToken = accessToken
        localStorage.setItem('ft_auth_token', this.authToken)
        
        // Store refresh token if provided
        const refreshToken = verificationData.tokens?.refreshToken
        if (refreshToken) {
          localStorage.setItem('ft_refresh_token', refreshToken)
        }
      }

      return {
        success: true,
        message: verificationData.message,
        token: accessToken
      }
    } catch (error) {
      if (error instanceof Error) {
        console.warn('❌ 2FA verification failed:', error.message)
        throw new Error(error.message || '2FA verification failed')
      } else {
        console.error('❌ 2FA verification failed:', error)
        throw new Error('2FA verification failed')
      }
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
    // Generate PKCE parameters
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);
    const state = this.generateState();

    // Store PKCE parameters for callback verification
    sessionStorage.setItem('oauth_code_verifier', codeVerifier);
    sessionStorage.setItem('oauth_state', state);

    // Build OAuth URL
    const params = new URLSearchParams({
      client_id: CLIENT_ID || '',
      redirect_uri: REDIRECT_URI || 'https://localhost/api/auth/oauth/google/callback',
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    
    // Redirect to Google
    window.location.href = authUrl;
  }

  /**
   * @brief Generate cryptographically secure code verifier
   */
  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  /**
   * @brief Generate code challenge from verifier
   */
  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  /**
   * @brief Generate random state parameter
   */
  private generateState(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array)).replace(/=/g, '');
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

export const authService = AuthService.getInstance()
