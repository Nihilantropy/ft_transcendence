/**
 * @brief Friends store for ft_transcendence
 * 
 * @description Manages friends state, friend requests, and social interactions.
 * Integrates with FriendsService for API communication and WebSocket for real-time updates.
 */

import { BaseStore } from './BaseStore'
import type { Friend, FriendRequest, FriendProfile, OnlineStatus, FriendsFilter } from '../types/friends.types'
import { webSocketService } from '../services/websocket'
import type { ConnectionState } from '../services/websocket'


/**
 * @brief Friends state interface
 */
export interface FriendsState {
  // Friends list
  friends: Friend[]
  friendsCount: number
  onlineFriendsCount: number
  
  // Friend requests
  incomingRequests: FriendRequest[]
  outgoingRequests: FriendRequest[]
  
  // UI state
  isLoading: boolean
  error: string | null
  
  // Filters and pagination
  currentFilter: FriendsFilter
  currentPage: number
  hasMoreFriends: boolean
  
  // Search
  searchResults: FriendProfile[]
  searchQuery: string
  isSearching: boolean
  
  // Activity feed
  friendsActivity: any[]
  hasMoreActivity: boolean
  
  // Real-time connection
  connectionState: ConnectionState
  isRealTimeEnabled: boolean
}

/**
 * @brief Friends state management store
 * 
 * @description Concrete implementation of BaseStore for friends management.
 * Handles friends list, requests, search, and activity feed.
 */
export class FriendsStore extends BaseStore<FriendsState> {
  
  /**
   * @brief Initialize friends store
   */
  constructor() {
    const initialState: FriendsState = {
      friends: [],
      friendsCount: 0,
      onlineFriendsCount: 0,
      incomingRequests: [],
      outgoingRequests: [],
      isLoading: false,
      error: null,
      currentFilter: 'all',
      currentPage: 1,
      hasMoreFriends: false,
      searchResults: [],
      searchQuery: '',
      isSearching: false,
      friendsActivity: [],
      hasMoreActivity: false,
      connectionState: 'disconnected',
      isRealTimeEnabled: false
    }

    super(initialState, 'FriendsStore')
    
    // Setup WebSocket event handlers
    this.setupWebSocketHandlers()
  }

  /**
   * @brief Set loading state
   */
  setLoading(loading: boolean, error: string | null = null): void {
    this.setState({ isLoading: loading, error })
  }

  /**
   * @brief Set error state
   */
  setError(error: string): void {
    this.setState({ error, isLoading: false })
  }

  /**
   * @brief Clear error state
   */
  clearError(): void {
    this.setState({ error: null })
  }

  /**
   * @brief Set friends list
   */
  setFriends(friends: Friend[], friendsCount: number, hasMore: boolean = false): void {
    // Calculate online friends count
    const onlineFriendsCount = friends.filter(friend => friend.friend.isOnline).length
    
    this.setState({
      friends,
      friendsCount,
      onlineFriendsCount,
      hasMoreFriends: hasMore,
      isLoading: false,
      error: null
    })
  }

  /**
   * @brief Add friend to the list
   */
  addFriend(friend: Friend): void {
    const currentState = this.getState()
    const updatedFriends = [...currentState.friends, friend]
    
    this.setState({
      friends: updatedFriends,
      friendsCount: currentState.friendsCount + 1,
      onlineFriendsCount: friend.friend.isOnline 
        ? currentState.onlineFriendsCount + 1 
        : currentState.onlineFriendsCount
    })
  }

  /**
   * @brief Remove friend from the list
   */
  removeFriend(friendId: string): void {
    const currentState = this.getState()
    const removedFriend = currentState.friends.find(f => f.friendId === friendId)
    const updatedFriends = currentState.friends.filter(f => f.friendId !== friendId)
    
    this.setState({
      friends: updatedFriends,
      friendsCount: Math.max(0, currentState.friendsCount - 1),
      onlineFriendsCount: removedFriend?.friend.isOnline 
        ? Math.max(0, currentState.onlineFriendsCount - 1)
        : currentState.onlineFriendsCount
    })
  }

  /**
   * @brief Update friend's online status
   */
  updateFriendStatus(friendId: string, isOnline: boolean, onlineStatus: OnlineStatus): void {
    const currentState = this.getState()
    const updatedFriends = currentState.friends.map(friend => {
      if (friend.friendId === friendId) {
        const wasOnline = friend.friend.isOnline
        const updatedFriend = {
          ...friend,
          friend: {
            ...friend.friend,
            isOnline,
            onlineStatus,
            lastSeen: !isOnline ? new Date() : friend.friend.lastSeen
          }
        }
        
        // Update online count
        if (wasOnline !== isOnline) {
          this.setState({
            onlineFriendsCount: isOnline 
              ? currentState.onlineFriendsCount + 1
              : Math.max(0, currentState.onlineFriendsCount - 1)
          })
        }
        
        return updatedFriend
      }
      return friend
    })
    
    this.setState({ friends: updatedFriends })
  }

  /**
   * @brief Set friend requests
   */
  setFriendRequests(incoming: FriendRequest[], outgoing: FriendRequest[]): void {
    this.setState({
      incomingRequests: incoming,
      outgoingRequests: outgoing,
      isLoading: false,
      error: null
    })
  }

  /**
   * @brief Add incoming friend request
   */
  addIncomingRequest(request: FriendRequest): void {
    const currentState = this.getState()
    this.setState({
      incomingRequests: [...currentState.incomingRequests, request]
    })
  }

  /**
   * @brief Add outgoing friend request
   */
  addOutgoingRequest(request: FriendRequest): void {
    const currentState = this.getState()
    this.setState({
      outgoingRequests: [...currentState.outgoingRequests, request]
    })
  }

  /**
   * @brief Remove friend request
   */
  removeFriendRequest(requestId: string): void {
    const currentState = this.getState()
    this.setState({
      incomingRequests: currentState.incomingRequests.filter(r => r.id !== requestId),
      outgoingRequests: currentState.outgoingRequests.filter(r => r.id !== requestId)
    })
  }

  /**
   * @brief Set current filter
   */
  setFilter(filter: FriendsFilter): void {
    this.setState({ 
      currentFilter: filter,
      currentPage: 1 // Reset pagination when filter changes
    })
  }

  /**
   * @brief Set current page
   */
  setPage(page: number): void {
    this.setState({ currentPage: page })
  }

  /**
   * @brief Set search results
   */
  setSearchResults(results: FriendProfile[], query: string): void {
    this.setState({
      searchResults: results,
      searchQuery: query,
      isSearching: false,
      error: null
    })
  }

  /**
   * @brief Set searching state
   */
  setSearching(isSearching: boolean): void {
    this.setState({ isSearching })
  }

  /**
   * @brief Clear search results
   */
  clearSearch(): void {
    this.setState({
      searchResults: [],
      searchQuery: '',
      isSearching: false
    })
  }

  /**
   * @brief Set friends activity
   */
  setFriendsActivity(activity: any[], hasMore: boolean = false): void {
    this.setState({
      friendsActivity: activity,
      hasMoreActivity: hasMore,
      isLoading: false,
      error: null
    })
  }

  /**
   * @brief Add activity to feed
   */
  addActivity(activity: any): void {
    const currentState = this.getState()
    this.setState({
      friendsActivity: [activity, ...currentState.friendsActivity]
    })
  }

  /**
   * @brief Get filtered friends list
   */
  getFilteredFriends(): Friend[] {
    const state = this.getState()
    
    switch (state.currentFilter) {
      case 'online':
        return state.friends.filter(friend => friend.friend.isOnline)
      case 'offline':
        return state.friends.filter(friend => !friend.friend.isOnline)
      case 'recent':
        return state.friends
          .filter(friend => friend.friend.lastSeen)
          .sort((a, b) => {
            const dateA = new Date(a.friend.lastSeen!).getTime()
            const dateB = new Date(b.friend.lastSeen!).getTime()
            return dateB - dateA
          })
          .slice(0, 10)
      case 'all':
      default:
        return state.friends
    }
  }

  /**
   * @brief Get pending requests count
   */
  getPendingRequestsCount(): number {
    const state = this.getState()
    return state.incomingRequests.length
  }

  /**
   * @brief Check if user is already a friend
   */
  isFriend(userId: string): boolean {
    const state = this.getState()
    return state.friends.some(friend => friend.friendId === userId)
  }

  /**
   * @brief Check if there's a pending request with user
   */
  hasPendingRequest(userId: string): 'incoming' | 'outgoing' | null {
    const state = this.getState()
    
    if (state.incomingRequests.some(req => req.fromUserId === userId)) {
      return 'incoming'
    }
    
    if (state.outgoingRequests.some(req => req.toUserId === userId)) {
      return 'outgoing'
    }
    
    return null
  }

  /**
   * @brief Setup WebSocket event handlers for real-time updates
   */
  private setupWebSocketHandlers(): void {
    // Handle user online status changes
    webSocketService.on('user:online', (data) => {
      this.updateFriendStatus(data.userId, true, data.onlineStatus)
    })

    webSocketService.on('user:offline', (data) => {
      this.updateFriendStatus(data.userId, false, 'offline')
    })

    webSocketService.on('user:status_change', (data) => {
      const currentState = this.getState()
      const friend = currentState.friends.find(f => f.friendId === data.userId)
      if (friend) {
        this.updateFriendStatus(data.userId, friend.friend.isOnline, data.onlineStatus)
      }
    })

    // Handle friend requests
    webSocketService.on('friend:request_received', (data) => {
      // In a real app, you'd fetch the full request details
      console.log('📨 Friend request received:', data)
      // this.loadFriendRequests() - Could trigger a refresh
    })

    webSocketService.on('friend:request_accepted', (data) => {
      console.log('✅ Friend request accepted:', data)
      // this.loadFriends() - Could trigger a refresh
    })

    // Handle connection state changes
    webSocketService.on('connection:state_change', (data) => {
      this.setState({ 
        connectionState: data.state,
        isRealTimeEnabled: data.state === 'connected'
      })
    })

    webSocketService.on('connection:error', (data) => {
      console.error('🔌 WebSocket connection error:', data.error)
      this.setState({ 
        connectionState: 'error',
        isRealTimeEnabled: false 
      })
    })
  }

  /**
   * @brief Start real-time connection
   */
  public startRealTimeUpdates(token?: string): void {
    webSocketService.connect(token).then(() => {
      // Subscribe to friends' presence updates
      const friendIds = this.getState().friends.map(f => f.friendId)
      if (friendIds.length > 0) {
        webSocketService.subscribeToPresence(friendIds)
      }
    }).catch(error => {
      console.error('Failed to start real-time updates:', error)
    })
  }

  /**
   * @brief Stop real-time connection
   */
  public stopRealTimeUpdates(): void {
    webSocketService.disconnect()
    this.setState({ 
      connectionState: 'disconnected',
      isRealTimeEnabled: false 
    })
  }

  /**
   * @brief Get connection status indicator
   */
  public getConnectionStatus(): { 
    state: ConnectionState, 
    isConnected: boolean, 
    statusText: string,
    statusColor: string
  } {
    const state = this.getState().connectionState
    
    const statusMap = {
      connecting: { text: 'Connecting...', color: 'text-yellow-400' },
      connected: { text: 'Real-time ✓', color: 'text-green-400' },
      disconnected: { text: 'Offline', color: 'text-gray-400' },
      error: { text: 'Connection Error', color: 'text-red-400' }
    }
    
    return {
      state,
      isConnected: state === 'connected',
      statusText: statusMap[state].text,
      statusColor: statusMap[state].color
    }
  }
}

// Export singleton instance
export const friendsStore = new FriendsStore()