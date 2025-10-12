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
  type RegisterRequest,
  safeParseApiResponse
} from './schemas/auth.schemas'
import { executeLogin } from './executeLogin'
import { executeRegister } from './executeRegister'
import { executeVerifyEmail } from './executeVerifyEmail'
import { executeLogout } from './executeLogout'
import { executeRefreshToken } from './executeRefreshToken'
import { executeForgotPassword } from './executeForgotPassword'
import { executeResetPassword } from './executeResetPassword'
import { executeResendVerificationEmail } from './executeResendVerificationEmail'
import { executeSetup2FA } from './execute2FASetup'
import { executeVerify2FASetup } from './execute2FAVerifySetup'
import { executeVerify2FA } from './execute2FAVerify'
import { executeDisable2FA } from './execute2FADisable'

/**
 * @brief Authentication service singleton
 */
export class AuthService extends ApiService {
  private static instance: AuthService
  private currentUser: User | null = null
  // Note: refreshToken is now stored in httpOnly cookie, not accessible from JavaScript

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
   * @return Promise<{ success: boolean; user?: User; requiresTwoFactor?: boolean; tempToken?: string }>
   * @throws Error on failure with descriptive message
   */
  public async login(credentials: LoginRequest): Promise<{ success: boolean; user?: User; requiresTwoFactor?: boolean; tempToken?: string }> {
    console.log('🔐 Attempting login for:', credentials.identifier)
    try {
      const loginData: LoginResponse = await executeLogin(credentials, '/auth/login')

      // Check if 2FA is required
      if (loginData.requiresTwoFactor && loginData.tempToken) {
        console.log('🔐 2FA required for login')
        return {
          success: true,
          requiresTwoFactor: true,
          tempToken: loginData.tempToken
        }
      }

      // Store user data (refresh token is now in httpOnly cookie, not in response)
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
  public async register(credentials: RegisterRequest): Promise<{ success: boolean; message: string }> {
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
   * @brief Refresh access token using httpOnly cookie
   * @return Promise<boolean> - Success status
   * 
   * @description Refresh token is now in httpOnly cookie and automatically sent by browser.
   * We just need to call the refresh endpoint, backend will read token from cookie.
   */
  public async refreshAuthToken(): Promise<boolean> {
    console.log('🔄 Attempting token refresh')
    try {
      // Refresh token is in httpOnly cookie, automatically sent by browser
      // Pass empty string as refreshToken parameter (backend reads from cookie)
      await executeRefreshToken('', '/auth/refresh')

      console.log('✅ Token refresh successful')
      return true
    } catch (error) {
      if (error instanceof Error) {
        console.warn('❌ Token refresh failed:', error.message)
      } else {
        console.error('❌ Token refresh failed:', error)
      }
      
      // Clear auth data on refresh failure
      this.clearStoredAuth()
      return false
    }
  }

  /**
   * @brief Request password reset (forgot password) using extracted business logic
   * @param email - User email address
   * @return Promise<{ success: boolean; message: string }>
   * @throws Error on failure with descriptive message
   */
  public async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    console.log('🔑 Requesting password reset for:', email)
    try {
      const resetData = await executeForgotPassword(email, '/auth/forgot-password')

      console.log('✅ Password reset email sent')
      return { 
        success: true, 
        message: resetData.message || 'If an account with that email exists, a password reset link has been sent.'
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
   * @brief Reset password with token using extracted business logic
   * @param token - Password reset token from email
   * @param newPassword - New password
   * @param confirmPassword - Password confirmation
   * @return Promise<{ success: boolean; message: string }>
   * @throws Error on failure with descriptive message
   */
  public async resetPassword(
    token: string, 
    newPassword: string, 
    confirmPassword: string
  ): Promise<{ success: boolean; message: string }> {
    console.log('🔄 Resetting password with token')
    try {
      const resetData = await executeResetPassword(
        token, 
        newPassword, 
        confirmPassword, 
        '/auth/reset-password'
      )

      console.log('✅ Password reset successful')
      return { 
        success: true, 
        message: resetData.message || 'Password reset successful. You can now login with your new password.'
      }
    } catch (error) {
      if (error instanceof Error) {
        console.warn('❌ Password reset failed:', error.message)
        throw new Error(error.message || 'Failed to reset password')
      } else {
        console.error('❌ Password reset failed:', error)
        throw new Error('Failed to reset password')
      }
    }
  }

  /**
   * @brief Backward compatibility alias for forgotPassword
   * @deprecated Use forgotPassword() instead
   */
  public async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    return this.forgotPassword(email)
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
      const setup2FAData = await executeSetup2FA('/auth/2fa/setup')

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
   * @return Promise<{ success: boolean; message?: string; user?: User }>
   * @throws Error on failure with descriptive message
   */
  public async verify2FASetup(token: string, secret: string): Promise<{ success: boolean; message?: string; user?: User }> {
    if (!this.currentUser?.id) {
      throw new Error('User must be logged in to verify 2FA setup')
    }

    console.log('🔐 Verifying 2FA setup token')
    try {
      const verificationData = await executeVerify2FASetup(
        token,
        secret,
        '/auth/2fa/verify-setup'
      )

      console.log('✅ 2FA setup verified and enabled')
      
      // Update current user with data from backend (source of truth)
      if (verificationData.user) {
        this.storeUser(verificationData.user)
        console.log('🔐 User 2FA status updated from backend')
      }

      return {
        success: true,
        message: verificationData.message,
        user: verificationData.user
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
   * @param tempToken - Temporary token from initial login
   * @param token - TOTP token from authenticator app (optional)
   * @param backupCode - Backup code (optional)
   * @return Promise<{ success: boolean; message?: string; user?: User }>
   * @throws Error on failure with descriptive message
   */
  public async verify2FA(tempToken: string, token?: string, backupCode?: string): Promise<{ success: boolean; message?: string; user?: User }> {
    console.log('🔐 Verifying 2FA token for login')
    try {
      const verificationData = await executeVerify2FA(
        tempToken,
        token,
        backupCode,
        '/auth/2fa/verify'
      )

      console.log('✅ 2FA verification successful')

      // Store user data (refresh token is now in httpOnly cookie, not in response)
      if (verificationData.user) {
        this.storeUser(verificationData.user)
      }

      return {
        success: true,
        message: verificationData.message,
        user: verificationData.user
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
   * @brief Disable 2FA for user account using extracted business logic
   * @param password - User's current password for confirmation
   * @param token - Optional 2FA token for additional security
   * @return Promise<{ success: boolean; message?: string }>
   * @throws Error on failure with descriptive message
   */
  public async disable2FA(password: string, token?: string): Promise<{ success: boolean; message?: string }> {
    if (!this.currentUser?.id) {
      throw new Error('User must be logged in to disable 2FA')
    }

    console.log('🔐 Disabling 2FA for current user')
    try {
      const disableData = await executeDisable2FA(password, token, '/auth/2fa/disable')

      console.log('✅ 2FA disabled successfully')
      
      // Update current user with data from backend (source of truth)
      if (disableData.user) {
        this.storeUser(disableData.user)
        console.log('🔐 User 2FA status updated from backend')
      }

      return {
        success: true,
        message: disableData.message
      }
    } catch (error) {
      if (error instanceof Error) {
        console.warn('❌ 2FA disable failed:', error.message)
        throw new Error(error.message || '2FA disable failed')
      } else {
        console.error('❌ 2FA disable failed:', error)
        throw new Error('2FA disable failed')
      }
    }
  }

  /**
   * @brief Check if current user has 2FA enabled
   * 
   * @returns boolean indicating 2FA status
   */
  public is2FAEnabled(): boolean {
    return this.currentUser?.twoFactorEnabled || false
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
   * @brief Initiate Google OAuth flow through backend
   * @description Redirects to backend OAuth initiation endpoint which:
   * 1. Generates and stores a secure state token (CSRF protection)
   * 2. Redirects to Google OAuth with the state
   * 3. Google redirects back to /oauth/google/callback with code & state
   * 4. Backend automatically links accounts with matching email addresses
   */
  async startGoogleOAuth(): Promise<void> {
    const oauthAvailable = this.isOAuthAvailable()
    if (!oauthAvailable) {
      throw new Error('OAuth is not configured')
    }

    // Redirect to backend OAuth initiation endpoint
    // Backend will generate state token and redirect to Google
    window.location.href = '/api/auth/oauth/google/login';
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
    // Since refresh token is now in httpOnly cookie, we can't check it from JS
    // Just check if we have a user object
    return !!this.getCurrentUser()
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
    // Clean up old refresh tokens from localStorage (for backwards compatibility)
    localStorage.removeItem('ft_refresh_token')
    this.currentUser = null
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
