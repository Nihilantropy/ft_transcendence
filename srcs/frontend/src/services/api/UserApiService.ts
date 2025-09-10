/**
 * @brief User API Service for ft_transcendence
 * 
 * @description Handles user profile management, stats, and game history.
 * Integrates with backend user service.
 */

import { apiService, ApiError } from './BaseApiService'
import type { UserProfile, GameHistory, UserStats } from '../../types/user.types'

export class UserApiService {
  /**
   * @brief Get user profile by ID
   */
  async getUserProfile(userId: string): Promise<UserProfile> {
    try {
      const response = await apiService.get<UserProfile>(`/users/${userId}`)
      return response.data
    } catch (error) {
      if (error instanceof ApiError) {
        console.error(`Failed to get user profile: ${error.message}`)
        throw error
      }
      throw new ApiError('USER_SERVICE_ERROR', 'Failed to retrieve user profile', 500)
    }
  }

  /**
   * @brief Update user profile
   */
  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    try {
      const response = await apiService.put<UserProfile>(`/users/${userId}`, updates)
      return response.data
    } catch (error) {
      if (error instanceof ApiError) {
        console.error(`Failed to update user profile: ${error.message}`)
        throw error
      }
      throw new ApiError('USER_UPDATE_ERROR', 'Failed to update user profile', 500)
    }
  }

  /**
   * @brief Get user game history
   */
  async getUserGameHistory(userId: string, page: number = 1, limit: number = 10): Promise<GameHistory[]> {
    try {
      const response = await apiService.get<GameHistory[]>(`/users/${userId}/games?page=${page}&limit=${limit}`)
      return response.data
    } catch (error) {
      if (error instanceof ApiError) {
        console.error(`Failed to get game history: ${error.message}`)
        throw error
      }
      throw new ApiError('GAME_HISTORY_ERROR', 'Failed to retrieve game history', 500)
    }
  }

  /**
   * @brief Get user statistics
   */
  async getUserStats(userId: string): Promise<UserStats> {
    try {
      const response = await apiService.get<UserStats>(`/users/${userId}/stats`)
      return response.data
    } catch (error) {
      if (error instanceof ApiError) {
        console.error(`Failed to get user stats: ${error.message}`)
        throw error
      }
      throw new ApiError('USER_STATS_ERROR', 'Failed to retrieve user statistics', 500)
    }
  }

  /**
   * @brief Upload user avatar
   */
  async uploadAvatar(userId: string, avatarFile: File): Promise<string> {
    try {
      const formData = new FormData()
      formData.append('avatar', avatarFile)

      const response = await fetch(`${apiService['baseUrl']}/users/${userId}/avatar`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new ApiError('AVATAR_UPLOAD_ERROR', 'Failed to upload avatar', response.status)
      }

      const result = await response.json()
      return result.avatarUrl
    } catch (error) {
      if (error instanceof ApiError) {
        console.error(`Failed to upload avatar: ${error.message}`)
        throw error
      }
      throw new ApiError('AVATAR_UPLOAD_ERROR', 'Failed to upload avatar', 500)
    }
  }

  /**
   * @brief Get current authenticated user
   */
  async getCurrentUser(): Promise<UserProfile> {
    try {
      const response = await apiService.get<UserProfile>('/users/me')
      return response.data
    } catch (error) {
      if (error instanceof ApiError) {
        console.error(`Failed to get current user: ${error.message}`)
        throw error
      }
      throw new ApiError('AUTH_ERROR', 'Failed to get current user', 401)
    }
  }
}

// Singleton instance
export const userApiService = new UserApiService()
