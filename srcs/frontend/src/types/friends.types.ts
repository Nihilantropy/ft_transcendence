/**
 * @file Friends type definitions for ft_transcendence
 * @description Type definitions for friends system, requests, and social features
 */

/**
 * @brief Online status for users
 */
export type OnlineStatus = 'online' | 'offline' | 'away' | 'busy' | 'in-game'

/**
 * @brief Friend filter options
 */
export type FriendsFilter = 'all' | 'online' | 'offline' | 'recent'

/**
 * @brief Basic user profile for friends
 */
export interface FriendProfile {
  id: number
  username: string
  avatar?: string
  isOnline?: boolean
  onlineStatus?: OnlineStatus
  lastSeen?: Date | string
}

/**
 * @brief Friend relationship data
 */
export interface Friend {
  id: number
  userId: number
  friendId: string
  friend: FriendProfile
  createdAt: Date | string
}

/**
 * @brief Friend request status
 */
export type FriendRequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled'

/**
 * @brief Friend request data
 */
export interface FriendRequest {
  id: string | number
  fromUserId: string | number
  toUserId: string | number
  status: FriendRequestStatus
  message?: string
  createdAt: Date | string
  fromUser?: FriendProfile
  toUser?: FriendProfile
}

/**
 * @brief Request: Send friend request
 */
export interface SendFriendRequestRequest {
  userId: string | number
}

/**
 * @brief Response: Send friend request
 */
export interface SendFriendRequestResponse {
  success: boolean
  message: string
  request: FriendRequest
}

/**
 * @brief Request: Respond to friend request
 */
export interface RespondToFriendRequestRequest {
  requestId: string
  action: 'accept' | 'decline'
}

/**
 * @brief Response: Respond to friend request
 */
export interface RespondToFriendRequestResponse {
  success: boolean
  message: string
  friend?: Friend
}

/**
 * @brief Response: Get friends list
 */
export interface GetFriendsResponse {
  success: boolean
  friends: Friend[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

/**
 * @brief Response: Get friend requests
 */
export interface GetFriendRequestsResponse {
  success: boolean
  incoming: FriendRequest[]
  outgoing: FriendRequest[]
}

/**
 * @brief Response: Remove friend
 */
export interface RemoveFriendResponse {
  success: boolean
  message: string
}

/**
 * @brief Request: Block user
 */
export interface BlockUserRequest {
  userId: string | number
}

/**
 * @brief Response: Block/Unblock user
 */
export interface BlockUserResponse {
  success: boolean
  message: string
}

/**
 * @brief Response: Get online friends
 */
export interface GetOnlineFriendsResponse {
  success: boolean
  friends: Friend[]
  count: number
}

/**
 * @brief Request: Search users
 */
export interface SearchUsersRequest {
  query: string
  page?: number
  limit?: number
  excludeFriends?: boolean
}

/**
 * @brief Response: Search users
 */
export interface SearchUsersResponse {
  success: boolean
  users: FriendProfile[]
  total: number
  page: number
  limit: number
}

/**
 * @brief Friend activity types
 */
export type FriendActivityType = 'game_won' | 'game_lost' | 'achievement' | 'level_up' | 'status_change'

/**
 * @brief Friend activity item
 */
export interface FriendActivity {
  id: string
  userId: string
  user: FriendProfile
  activityType: FriendActivityType
  message: string
  data?: Record<string, any>
  createdAt: Date | string
}

/**
 * @brief Response: Get friends activity
 */
export interface GetFriendsActivityResponse {
  success: boolean
  activity: FriendActivity[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}
