/**
 * @brief Authentication Service for ft_transcendence
 * 
 * @description Handles user authentication, login, logout, and session management.
 * Integrates with backend authentication API and manages JWT tokens.
 */

import { ApiService } from '../api/BaseApiService'
import { ErrorUtils } from '../error/ErrorHandler'
import type { 
  LoginRequest, 
  RegisterRequest, 
  AuthResponse,
  User
} from '../../types'

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
    localStorage.removeItem('ft_token')
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
  public async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      console.log('🔐 Attempting login for:', credentials.username)
      
      const apiResponse = await this.post<AuthResponse>('/auth/login', {
        username: credentials.username,
        password: credentials.password,
        rememberMe: credentials.rememberMe || false
      })

      if (apiResponse.success && apiResponse.data.success && apiResponse.data.user && apiResponse.data.token) {
        this.storeAuth(apiResponse.data.user, apiResponse.data.token)
        console.log('✅ Login successful for:', apiResponse.data.user.username)
        
        return apiResponse.data
      } else {
        console.warn('❌ Login failed:', apiResponse.data.message)
        return apiResponse.data
      }
    } catch (error) {
      console.error('❌ Login error:', error)
      
      // Use centralized error handler
      const errorResponse = ErrorUtils.handleAuthError(error)
      
      return {
        success: false,
        message: errorResponse.userMessage,
        errorCode: errorResponse.code
      }
    }
  }

  /**
   * @brief Register new user
   * 
   * @param credentials - User registration credentials
   * @returns Promise resolving to authentication response
   */
  public async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    try {
      console.log('📝 Attempting registration for:', credentials.username)
      
      // Validate passwords match
      if (credentials.password !== credentials.confirmPassword) {
        return {
          success: false,
          message: 'Passwords do not match'
        }
      }

      const apiResponse = await this.post<AuthResponse>('/auth/register', {
        username: credentials.username,
        email: credentials.email,
        password: credentials.password
      })

      if (apiResponse.success && apiResponse.data.success && apiResponse.data.user && apiResponse.data.token) {
        this.storeAuth(apiResponse.data.user, apiResponse.data.token)
        console.log('✅ Registration successful for:', apiResponse.data.user.username)
      }

      return apiResponse.data
    } catch (error) {
      console.error('❌ Registration error:', error)
      
      // Use centralized error handler
      const errorResponse = ErrorUtils.handleAuthError(error)
      
      return {
        success: false,
        message: errorResponse.userMessage,
        errorCode: errorResponse.code
      }
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


}

// Export singleton instance
export const authService = AuthService.getInstance()
