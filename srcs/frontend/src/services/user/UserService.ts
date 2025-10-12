/**
 * @file User service for ft_transcendence frontend
 * @description Handles user profile operations with Zod schema validation
 * 
 * Architecture:
 * - Core public methods for UI interaction
 * - Private execute* methods for business logic
 * - Schema validation using Zod
 * - Typed error handling with catchTypedError
 * - Follows same pattern as AuthService
 */

import { ApiService } from '../api/BaseApiService'
import { ZodError, type ZodSchema } from 'zod'
import {
  // Request schemas
  UpdateUsernameRequestSchema,
  AvatarFileSchema,
  DeleteUserRequestSchema,
  CheckUsernameQuerySchema,
  SearchUsersQuerySchema,
  // Response schemas
  CompleteProfileResponseSchema,
  PublicProfileResponseSchema,
  SearchUsersResponseSchema,
  CheckUsernameResponseSchema,
  UpdateUsernameResponseSchema,
  UpdateAvatarResponseSchema,
  DeleteUserResponseSchema,
  // Types
  type CompleteUser,
  type PublicUser,
  type UserPreview,
} from './schemas/user.schema'

/**
 * @brief User service singleton for user profile operations
 */
export class UserService extends ApiService {
  private static instance: UserService

  constructor() {
    super()
  }

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService()
    }
    return UserService.instance
  }

  // ==========================================================================
  // PROFILE RETRIEVAL METHODS
  // ==========================================================================

  /**
   * @brief Get complete profile for authenticated user
   * @return Promise<{ success: boolean; user: CompleteUser }>
   * @throws Error on failure
   */
  public async getMyProfile(): Promise<{ success: boolean; user: CompleteUser }> {
    return this.executeGetMyProfile()
  }

  /**
   * @brief Get public profile for any user by ID
   * @param userId - User ID to retrieve
   * @return Promise<{ success: boolean; user: PublicUser }>
   * @throws Error on failure
   */
  public async getPublicProfile(userId: number): Promise<{ success: boolean; user: PublicUser }> {
    if (!userId || userId <= 0) {
      throw new Error('Invalid user ID')
    }
    return this.executeGetPublicProfile(userId)
  }

  /**
   * @brief Search users by username
   * @param searchQuery - Search query string
   * @param limit - Maximum results (default 10, max 50)
   * @return Promise<{ success: boolean; users: UserPreview[]; count: number }>
   * @throws Error on failure
   */
  public async searchUsers(
    searchQuery: string,
    limit: number = 10
  ): Promise<{ success: boolean; users: UserPreview[]; count: number }> {
    const validated = this.validateData({ q: searchQuery, limit }, SearchUsersQuerySchema)
    return this.executeSearchUsers(validated.q, validated.limit || 10)
  }

  // ==========================================================================
  // USERNAME MANAGEMENT METHODS
  // ==========================================================================

  /**
   * @brief Check username availability
   * @param username - Username to check
   * @return Promise<{ available: boolean; message: string }>
   * @throws Error on failure
   */
  public async checkUsernameAvailability(
    username: string
  ): Promise<{ available: boolean; message: string }> {
    const validated = this.validateData({ username }, CheckUsernameQuerySchema)
    return this.executeCheckUsername(validated.username)
  }

  /**
   * @brief Update username for authenticated user
   * @param username - New username
   * @return Promise<{ success: boolean; message: string; user: CompleteUser }>
   * @throws Error on failure
   */
  public async updateUsername(
    username: string
  ): Promise<{ success: boolean; message: string; user: CompleteUser }> {
    const validated = this.validateData({ username }, UpdateUsernameRequestSchema)
    return this.executeUpdateUsername(validated.username)
  }

  // ==========================================================================
  // AVATAR MANAGEMENT METHODS
  // ==========================================================================

  /**
   * @brief Upload avatar image file for authenticated user
   * @param avatarFile - Image file to upload (JPEG, PNG, GIF, or WebP, max 5MB)
   * @return Promise<{ success: boolean; message: string; user: CompleteUser }>
   * @throws Error on failure
   */
  public async uploadAvatar(
    avatarFile: File
  ): Promise<{ success: boolean; message: string; user: CompleteUser }> {
    const validated = this.validateData(avatarFile, AvatarFileSchema)
    return this.executeUploadAvatar(validated)
  }

  // ==========================================================================
  // ACCOUNT MANAGEMENT METHODS
  // ==========================================================================

  /**
   * @brief Delete user account (requires confirmation, password optional for OAuth users)
   * @param password - User password for verification (optional for OAuth accounts)
   * @param confirmation - Must be "DELETE" to confirm
   * @return Promise<{ success: boolean; message: string }>
   * @throws Error on failure
   */
  public async deleteAccount(
    password: string | undefined,
    confirmation: string
  ): Promise<{ success: boolean; message: string }> {
    const validated = this.validateData({ password, confirmation }, DeleteUserRequestSchema)
    return this.executeDeleteAccount(validated.password, validated.confirmation)
  }

  // ==========================================================================
  // PRIVATE EXECUTION METHODS (Business Logic)
  // ==========================================================================

  /**
   * @brief Execute get my profile operation
   * @return Promise<{ success: boolean; user: CompleteUser }>
   * @throws Error on failure
   */
  private async executeGetMyProfile(): Promise<{ success: boolean; user: CompleteUser }> {
    try {
      const response = await this.get<{ success: boolean; user: CompleteUser }>('/users/me')
      const validated = this.validateData(response.data, CompleteProfileResponseSchema)
      return validated
    } catch (error) {
      throw this.catchTypedError(error, 'Failed to get profile')
    }
  }

  /**
   * @brief Execute get public profile operation
   * @param userId - User ID
   * @return Promise<{ success: boolean; user: PublicUser }>
   * @throws Error on failure
   */
  private async executeGetPublicProfile(
    userId: number
  ): Promise<{ success: boolean; user: PublicUser }> {
    try {
      const response = await this.get<{ success: boolean; user: PublicUser }>(`/users/${userId}`)
      const validated = this.validateData(response.data, PublicProfileResponseSchema)
      return validated
    } catch (error) {
      throw this.catchTypedError(error, 'Failed to get public profile')
    }
  }

  /**
   * @brief Execute search users operation
   * @param searchQuery - Search query
   * @param limit - Max results
   * @return Promise<{ success: boolean; users: UserPreview[]; count: number }>
   * @throws Error on failure
   */
  private async executeSearchUsers(
    searchQuery: string,
    limit: number
  ): Promise<{ success: boolean; users: UserPreview[]; count: number }> {
    try {
      const response = await this.get<{ success: boolean; users: UserPreview[]; count: number }>(
        `/users/search?q=${encodeURIComponent(searchQuery)}&limit=${limit}`
      )
      const validated = this.validateData(response.data, SearchUsersResponseSchema)
      return validated
    } catch (error) {
      throw this.catchTypedError(error, 'Failed to search users')
    }
  }

  /**
   * @brief Execute check username availability operation
   * @param username - Username to check
   * @return Promise<{ available: boolean; message: string }>
   * @throws Error on failure
   */
  private async executeCheckUsername(
    username: string
  ): Promise<{ available: boolean; message: string }> {
    try {
      const response = await this.get<{ available: boolean; message: string }>(
        `/users/check-username?username=${encodeURIComponent(username)}`
      )
      const validated = this.validateData(response.data, CheckUsernameResponseSchema)
      return {
        available: validated.available ?? false,
        message: validated.message
      }
    } catch (error) {
      throw this.catchTypedError(error, 'Failed to check username')
    }
  }

  /**
   * @brief Execute update username operation
   * @param username - New username
   * @return Promise<{ success: boolean; message: string; user: CompleteUser }>
   * @throws Error on failure
   */
  private async executeUpdateUsername(
    username: string
  ): Promise<{ success: boolean; message: string; user: CompleteUser }> {
    try {
      const response = await this.patch<{ success: boolean; message: string; user: CompleteUser }>(
        '/users/me/username',
        { username }
      )
      const validated = this.validateData(response.data, UpdateUsernameResponseSchema)
      return validated
    } catch (error) {
      throw this.catchTypedError(error, 'Failed to update username')
    }
  }

  /**
   * @brief Execute upload avatar operation
   * @param avatarFile - Image file to upload
   * @return Promise<{ success: boolean; message: string; user: CompleteUser }>
   * @throws Error on failure
   */
  private async executeUploadAvatar(
    avatarFile: File
  ): Promise<{ success: boolean; message: string; user: CompleteUser }> {
    try {
      // Create FormData for multipart/form-data upload
      const formData = new FormData()
      formData.append('avatar', avatarFile)
      
      // Use fetch directly for FormData (BaseApiService stringifies body)
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/users/me/avatar`, {
        method: 'PATCH',
        credentials: 'include', // Important for JWT cookie
        body: formData // Don't set Content-Type - browser sets it with boundary
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData?.message || 'Failed to upload avatar')
      }
      
      const data = await response.json()
      const validated = this.validateData(data, UpdateAvatarResponseSchema)
      return validated
    } catch (error) {
      throw this.catchTypedError(error, 'Failed to upload avatar')
    }
  }

  /**
   * @brief Execute delete account operation
   * @param password - User password (optional for OAuth users)
   * @param confirmation - Must be "DELETE"
   * @return Promise<{ success: boolean; message: string }>
   * @throws Error on failure
   */
  private async executeDeleteAccount(
    password: string | undefined,
    confirmation: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const body: { password?: string; confirmation: string } = { confirmation }
      if (password) {
        body.password = password
      }
      
      const response = await this.delete<{ success: boolean; message: string }>(
        '/users/me',
        body
      )
      const validated = this.validateData(response.data, DeleteUserResponseSchema)
      
      // Clear any stored user data from localStorage
      localStorage.removeItem('ft_user')
      
      return validated
    } catch (error) {
      throw this.catchTypedError(error, 'Failed to delete account')
    }
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * @brief Validate data against Zod schema
   * @param data - Data to validate
   * @param schema - Zod schema
   * @return Validated data
   * @throws Error with validation details
   */
  private validateData<T>(data: unknown, schema: ZodSchema<T>): T {
    try {
      return schema.parse(data)
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.issues.map(i => i.message).join(', ')
        throw new Error(`Validation failed: ${issues}`)
      }
      throw error
    }
  }

  /**
   * @brief Catch and format typed errors
   * @param error - Caught error
   * @param fallbackMessage - Fallback error message
   * @return Error with descriptive message
   */
  private catchTypedError(error: unknown, fallbackMessage: string): Error {
    if (error instanceof Error) {
      return error
    }
    return new Error(fallbackMessage)
  }
}

// Export singleton instance
export const userService = UserService.getInstance()
