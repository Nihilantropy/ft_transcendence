/**
 * @brief Friends API service for ft_transcendence
 * 
 * @description Service layer for friends management API calls.
 * Handles friend requests, management, search, and real-time integration.
 */

import { apiService } from './BaseApiService'
import type {
  FriendProfile,
  FriendRequest,
  SendFriendRequestResponse
} from '../../types/friends.types'

/**
 * @brief Simple API Error class
 */
class ApiError extends Error {
  public code: string
  public status: number
  
  constructor(code: string, message: string, status: number = 500) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

export class FriendsService {
  /**
   * @brief Send a friend request to another user
   */
  async sendFriendRequest(userId: number, message?: string): Promise<SendFriendRequestResponse> {
    try {
      const response = await apiService.post<SendFriendRequestResponse>('/friends/request', {
        to_user_id: userId,
        message: message || ''
      })
      console.log('✅ Friend request sent successfully')
      return response.data
    } catch (error) {
      if (error instanceof ApiError) {
        console.error(`Failed to send friend request: ${error.message}`)
        throw error
      }
      throw new ApiError('FRIEND_REQUEST_ERROR', 'Failed to send friend request', 500)
    }
  }

  /**
   * @brief Accept a friend request
   */
  async acceptFriendRequest(requestId: number): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiService.post<{ message: string }>(`/friends/accept/${requestId}`, {})
      console.log('✅ Friend request accepted successfully')
      return { success: true, message: response.data.message }
    } catch (error) {
      if (error instanceof ApiError) {
        console.error(`Failed to accept friend request: ${error.message}`)
        throw error
      }
      throw new ApiError('ACCEPT_REQUEST_ERROR', 'Failed to accept friend request', 500)
    }
  }

  /**
   * @brief Decline a friend request
   */
  async declineFriendRequest(requestId: number): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiService.post<{ message: string }>(`/friends/decline/${requestId}`, {})
      console.log('✅ Friend request declined successfully')
      return { success: true, message: response.data.message }
    } catch (error) {
      if (error instanceof ApiError) {
        console.error(`Failed to decline friend request: ${error.message}`)
        throw error
      }
      throw new ApiError('DECLINE_REQUEST_ERROR', 'Failed to decline friend request', 500)
    }
  }

  /**
   * @brief Get user's friends list
   */
  async getFriends(): Promise<FriendProfile[]> {
    try {
      const response = await apiService.get<FriendProfile[]>('/friends')
      return response.data
    } catch (error) {
      if (error instanceof ApiError) {
        console.error(`Failed to get friends: ${error.message}`)
        throw error
      }
      throw new ApiError('FRIENDS_LIST_ERROR', 'Failed to retrieve friends list', 500)
    }
  }

  /**
   * @brief Get received friend requests
   */
  async getFriendRequests(status?: 'pending' | 'accepted' | 'declined'): Promise<FriendRequest[]> {
    try {
      const queryParams = status ? `?status=${status}` : ''
      const response = await apiService.get<FriendRequest[]>(`/friends/requests${queryParams}`)
      return response.data
    } catch (error) {
      if (error instanceof ApiError) {
        console.error(`Failed to get friend requests: ${error.message}`)
        throw error
      }
      throw new ApiError('FRIEND_REQUESTS_ERROR', 'Failed to retrieve friend requests', 500)
    }
  }

  /**
   * @brief Get sent friend requests
   */
  async getSentFriendRequests(): Promise<FriendRequest[]> {
    try {
      const response = await apiService.get<FriendRequest[]>('/friends/requests/sent')
      return response.data
    } catch (error) {
      if (error instanceof ApiError) {
        console.error(`Failed to get sent requests: ${error.message}`)
        throw error
      }
      throw new ApiError('SENT_REQUESTS_ERROR', 'Failed to retrieve sent requests', 500)
    }
  }

  /**
   * @brief Remove a friend from friends list
   */
  async removeFriend(friendId: number): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiService.delete<{ message: string }>(`/friends/${friendId}`)
      console.log('✅ Friend removed successfully')
      return { success: true, message: response.data.message }
    } catch (error) {
      if (error instanceof ApiError) {
        console.error(`Failed to remove friend: ${error.message}`)
        throw error
      }
      throw new ApiError('REMOVE_FRIEND_ERROR', 'Failed to remove friend', 500)
    }
  }

  /**
   * @brief Block a user
   */
  async blockUser(userId: number): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiService.post<{ message: string }>(`/friends/block/${userId}`, {})
      console.log('✅ User blocked successfully')
      return { success: true, message: response.data.message }
    } catch (error) {
      if (error instanceof ApiError) {
        console.error(`Failed to block user: ${error.message}`)
        throw error
      }
      throw new ApiError('BLOCK_USER_ERROR', 'Failed to block user', 500)
    }
  }

  /**
   * @brief Unblock a user
   */
  async unblockUser(userId: number): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiService.post<{ message: string }>(`/friends/unblock/${userId}`, {})
      console.log('✅ User unblocked successfully')
      return { success: true, message: response.data.message }
    } catch (error) {
      if (error instanceof ApiError) {
        console.error(`Failed to unblock user: ${error.message}`)
        throw error
      }
      throw new ApiError('UNBLOCK_USER_ERROR', 'Failed to unblock user', 500)
    }
  }

  /**
   * @brief Get list of blocked users
   */
  async getBlockedUsers(): Promise<FriendProfile[]> {
    try {
      const response = await apiService.get<FriendProfile[]>('/friends/blocked')
      return response.data
    } catch (error) {
      if (error instanceof ApiError) {
        console.error(`Failed to get blocked users: ${error.message}`)
        throw error
      }
      throw new ApiError('BLOCKED_USERS_ERROR', 'Failed to retrieve blocked users', 500)
    }
  }

  /**
   * @brief Get list of online friends (client-side filtering)
   */
  async getOnlineFriends(): Promise<FriendProfile[]> {
    try {
      const friends = await this.getFriends()
      // Filter for online friends on client side
      return friends.filter(friend => friend.isOnline)
    } catch (error) {
      if (error instanceof ApiError) {
        console.error(`Failed to get online friends: ${error.message}`)
        throw error
      }
      throw new ApiError('ONLINE_FRIENDS_ERROR', 'Failed to retrieve online friends', 500)
    }
  }

  /**
   * @brief Initialize real-time connection for friends
   * 
   * @description Starts WebSocket connection and subscribes to friend presence updates.
   * Should be called after loading friends list.
   */
  public async initializeRealTimeUpdates(authToken?: string): Promise<void> {
    try {
      const { friendsStore } = await import('../../stores/friends.store')

      // Start real-time updates
      await friendsStore.startRealTimeUpdates(authToken)
      
      console.log('🔌 Real-time friends updates initialized')
    } catch (error: any) {
      console.error('Failed to initialize real-time updates:', error)
      // Don't throw - real-time is optional enhancement
    }
  }

  /**
   * @brief Stop real-time connection
   */
  public stopRealTimeUpdates(): void {
    import('../../stores/friends.store').then(({ friendsStore }) => {
      friendsStore.stopRealTimeUpdates()
      console.log('🔌 Real-time friends updates stopped')
    }).catch(error => {
      console.error('Failed to stop real-time updates:', error)
    })
  }
}

// Singleton instance
export const friendsService = new FriendsService()