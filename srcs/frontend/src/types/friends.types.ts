/**
 * @brief Friends system type definitions
 * 
 * @description Types for friend relationships, requests, and social features.
 * Supports the Standard User Management module requirements.
 */

// Friend Status Types
export type FriendStatus = 'pending' | 'accepted' | 'blocked'
export type OnlineStatus = 'online' | 'away' | 'busy' | 'offline'

// Core Friend Interfaces
export interface Friend {
  id: string
  userId: string
  friendId: string
  status: FriendStatus
  createdAt: Date
  acceptedAt?: Date
  friend: FriendProfile
}

export interface FriendProfile {
  id: string
  username: string
  displayName?: string
  avatar?: string
  isOnline: boolean
  onlineStatus: OnlineStatus
  lastSeen?: Date
}

export interface FriendRequest {
  id: string
  fromUserId: string
  toUserId: string
  status: 'pending' | 'accepted' | 'declined'
  message?: string
  createdAt: Date
  respondedAt?: Date
  fromUser: FriendProfile
  toUser: FriendProfile
}

// API Request/Response Types
export interface SendFriendRequestRequest {
  userId: string
  message?: string
}

export interface SendFriendRequestResponse {
  success: boolean
  request: FriendRequest
  message: string
}

export interface RespondToFriendRequestRequest {
  requestId: string
  action: 'accept' | 'decline'
}

export interface RespondToFriendRequestResponse {
  success: boolean
  request: FriendRequest
  message: string
}

export interface GetFriendsResponse {
  friends: Friend[]
  total: number
  page: number
  limit: number
}

export interface GetFriendRequestsResponse {
  incoming: FriendRequest[]
  outgoing: FriendRequest[]
  total: number
}

export interface RemoveFriendRequest {
  friendId: string
}

export interface RemoveFriendResponse {
  success: boolean
  message: string
}

export interface BlockUserRequest {
  userId: string
  reason?: string
}

export interface BlockUserResponse {
  success: boolean
  message: string
}

export interface GetOnlineFriendsResponse {
  friends: Friend[]
  count: number
}

// Search and Discovery Types
export interface SearchUsersRequest {
  query: string
  page?: number
  limit?: number
  excludeFriends?: boolean
}

export interface SearchUsersResponse {
  users: FriendProfile[]
  total: number
  page: number
  limit: number
}

// Friends List Filters
export type FriendsFilter = 'all' | 'online' | 'offline' | 'recent'

// Friend Activity Types
export interface FriendActivity {
  id: string
  userId: string
  type: 'game_start' | 'game_end' | 'achievement' | 'online' | 'offline'
  data?: any
  timestamp: Date
}

export interface GetFriendsActivityResponse {
  activities: FriendActivity[]
  hasMore: boolean
}

// Placeholder for development
export const FRIENDS_TYPES_PLACEHOLDER = 'Friends types implemented for social features'