/**
 * @brief User API Service for ft_transcendence
 * 
 * @description Handles user profile management, stats, and game history.
 * Integrates with backend user service.
 */

import { apiService } from './BaseApiService'
import { catchErrorTyped } from '../error'
import type { UserProfile, GameHistory, UserStats } from '../../types/user.types'

export class UserApiService {
  /**
   * @brief Get user profile by ID
   */
  async getUserProfile(userId: string): Promise<UserProfile> {
    const [error, response] = await catchErrorTyped(
      apiService.get<UserProfile>(`/users/${userId}`)
    )

    if (error) {
      throw new Error(error.message || 'Failed to retrieve user profile')
    }

    if (!response?.data) {
      throw new Error('Invalid response from server')
    }

    return response.data
  }

  /**
   * @brief Update user profile
   */
  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    const [error, response] = await catchErrorTyped(
      apiService.put<UserProfile>(`/users/${userId}`, updates)
    )

    if (error) {
      throw new Error(error.message || 'Failed to update user profile')
    }

    if (!response?.data) {
      throw new Error('Invalid response from server')
    }

    return response.data
  }

  /**
   * @brief Get user game history
   */
  async getUserGameHistory(userId: string, page: number = 1, limit: number = 10): Promise<GameHistory[]> {
    const [error, response] = await catchErrorTyped(
      apiService.get<GameHistory[]>(`/users/${userId}/games?page=${page}&limit=${limit}`)
    )

    if (error) {
      throw new Error(error.message || 'Failed to retrieve game history')
    }

    if (!response?.data) {
      throw new Error('Invalid response from server')
    }

    return response.data
  }

  /**
   * @brief Get user statistics
   */
  async getUserStats(userId: string): Promise<UserStats> {
    const [error, response] = await catchErrorTyped(
      apiService.get<UserStats>(`/users/${userId}/stats`)
    )

    if (error) {
      throw new Error(error.message || 'Failed to retrieve user statistics')
    }

    if (!response?.data) {
      throw new Error('Invalid response from server')
    }

    return response.data
  }

  /**
   * @brief Upload user avatar
   */
  async uploadAvatar(userId: string, avatarFile: File): Promise<string> {
    const formData = new FormData()
    formData.append('avatar', avatarFile)

    const [error, response] = await catchErrorTyped(
      fetch(`${apiService['baseUrl']}/users/${userId}/avatar`, {
        method: 'POST',
        body: formData,
      })
    )

    if (error) {
      throw new Error(error.message || 'Failed to upload avatar')
    }

    if (!response?.ok) {
      throw new Error('Failed to upload avatar')
    }

    const [jsonError, result] = await catchErrorTyped(response.json())
    
    if (jsonError) {
      throw new Error('Failed to parse avatar upload response')
    }

    if (!result?.avatarUrl) {
      throw new Error('Invalid avatar upload response')
    }

    return result.avatarUrl
  }

  /**
   * @brief Get current authenticated user
   */
  async getCurrentUser(): Promise<UserProfile> {
    const [error, response] = await catchErrorTyped(
      apiService.get<UserProfile>('/users/me')
    )

    if (error) {
      throw new Error(error.message || 'Failed to get current user')
    }

    if (!response?.data) {
      throw new Error('Invalid response from server')
    }

    return response.data
  }
}

// Singleton instance
export const userApiService = new UserApiService()
