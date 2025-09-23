/**
 * @brief Friends API service for ft_transcendence
 * 
 * @description Service layer for friends management API calls.
 * Handles friend requests, management, search, and real-time integration.
 */

import { apiService } from './BaseApiService'
import type {
  SendFriendRequestRequest,
  SendFriendRequestResponse,
  RespondToFriendRequestRequest,
  RespondToFriendRequestResponse,
  GetFriendsResponse,
  GetFriendRequestsResponse,
  RemoveFriendResponse,
  BlockUserRequest,
  BlockUserResponse,
  GetOnlineFriendsResponse,
  SearchUsersRequest,
  SearchUsersResponse,
  GetFriendsActivityResponse,
  FriendsFilter,
  FriendRequest
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
  async sendFriendRequest(request: SendFriendRequestRequest): Promise<SendFriendRequestResponse> {
    try {
      const response = await apiService.post<SendFriendRequestResponse>('/friends/requests', request)
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
   * @brief Respond to a friend request (accept/decline)
   */
  async respondToFriendRequest(request: RespondToFriendRequestRequest): Promise<RespondToFriendRequestResponse> {
    try {
      const response = await apiService.put<RespondToFriendRequestResponse>(
        `/friends/requests/${request.requestId}`,
        { action: request.action }
      )
      console.log(`✅ Friend request ${request.action}ed successfully`)
      return response.data
    } catch (error) {
      if (error instanceof ApiError) {
        console.error(`Failed to respond to friend request: ${error.message}`)
        throw error
      }
      throw new ApiError('FRIEND_RESPONSE_ERROR', 'Failed to respond to friend request', 500)
    }
  }

  /**
   * @brief Get user's friends list
   */
  async getFriends(page: number = 1, limit: number = 20, filter: FriendsFilter = 'all'): Promise<GetFriendsResponse> {
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        filter
      })
      
      const response = await apiService.get<GetFriendsResponse>(`/friends?${queryParams}`)
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
   * @brief Get pending friend requests (incoming and outgoing)
   */
  async getFriendRequests(): Promise<GetFriendRequestsResponse> {
    try {
      const response = await apiService.get<GetFriendRequestsResponse>('/friends/requests')
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
   * @brief Remove a friend from friends list
   */
  async removeFriend(friendId: string): Promise<RemoveFriendResponse> {
    try {
      const response = await apiService.delete<RemoveFriendResponse>(`/friends/${friendId}`)
      console.log('✅ Friend removed successfully')
      return response.data
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
  async blockUser(request: BlockUserRequest): Promise<BlockUserResponse> {
    try {
      const response = await apiService.post<BlockUserResponse>('/friends/block', request)
      console.log('✅ User blocked successfully')
      return response.data
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
  async unblockUser(userId: string): Promise<BlockUserResponse> {
    try {
      const response = await apiService.delete<BlockUserResponse>(`/friends/block/${userId}`)
      console.log('✅ User unblocked successfully')
      return response.data
    } catch (error) {
      if (error instanceof ApiError) {
        console.error(`Failed to unblock user: ${error.message}`)
        throw error
      }
      throw new ApiError('UNBLOCK_USER_ERROR', 'Failed to unblock user', 500)
    }
  }

  /**
   * @brief Get list of online friends
   */
  async getOnlineFriends(): Promise<GetOnlineFriendsResponse> {
    try {
      const response = await apiService.get<GetOnlineFriendsResponse>('/friends/online')
      return response.data
    } catch (error) {
      if (error instanceof ApiError) {
        console.error(`Failed to get online friends: ${error.message}`)
        throw error
      }
      throw new ApiError('ONLINE_FRIENDS_ERROR', 'Failed to retrieve online friends', 500)
    }
  }

  /**
   * @brief Search for users to add as friends
   */
  async searchUsers(request: SearchUsersRequest): Promise<SearchUsersResponse> {
    try {
      const queryParams = new URLSearchParams({
        query: request.query,
        page: (request.page || 1).toString(),
        limit: (request.limit || 10).toString(),
        excludeFriends: (request.excludeFriends || true).toString()
      })
      
      const response = await apiService.get<SearchUsersResponse>(`/users/search?${queryParams}`)
      return response.data
    } catch (error) {
      if (error instanceof ApiError) {
        console.error(`Failed to search users: ${error.message}`)
        throw error
      }
      throw new ApiError('USER_SEARCH_ERROR', 'Failed to search users', 500)
    }
  }

  /**
   * @brief Get friends activity feed
   */
  async getFriendsActivity(page: number = 1, limit: number = 20): Promise<GetFriendsActivityResponse> {
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      })
      
      const response = await apiService.get<GetFriendsActivityResponse>(`/friends/activity?${queryParams}`)
      return response.data
    } catch (error) {
      if (error instanceof ApiError) {
        console.error(`Failed to get friends activity: ${error.message}`)
        throw error
      }
      throw new ApiError('FRIENDS_ACTIVITY_ERROR', 'Failed to retrieve friends activity', 500)
    }
  }

  /**
   * @brief Get friendship status with a specific user
   */
  async getFriendshipStatus(userId: string): Promise<{ status: 'friends' | 'pending' | 'blocked' | 'none', request?: FriendRequest }> {
    try {
      const response = await apiService.get<{ status: string, request?: FriendRequest }>(`/friends/status/${userId}`)
      return response.data as { status: 'friends' | 'pending' | 'blocked' | 'none', request?: FriendRequest }
    } catch (error) {
      if (error instanceof ApiError) {
        console.error(`Failed to get friendship status: ${error.message}`)
        throw error
      }
      throw new ApiError('FRIENDSHIP_STATUS_ERROR', 'Failed to get friendship status', 500)
    }
  }

  /**
   * @brief Cancel friend request
   */
  async cancelFriendRequest(requestId: string): Promise<RemoveFriendResponse> {
    try {
      const response = await apiService.delete<RemoveFriendResponse>(`/friends/requests/${requestId}`)
      return response.data
    } catch (error: any) {
      if (error instanceof ApiError) {
        console.error(`Failed to cancel friend request: ${error.message}`)
        throw error
      }
      throw new ApiError('CANCEL_REQUEST_ERROR', 'Failed to cancel friend request', 500)
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
      const { webSocketService } = await import('../websocket')
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