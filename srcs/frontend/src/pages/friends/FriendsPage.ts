/**
 * @brief FriendsPage component for ft_transcendence
 * 
 * @description Friends management page for social features.
 * Handles friends list, friend requests, user search, and social interactions.
 */

import { Component } from '../../components/base/Component'
import { friendsService } from '../../services/api/FriendsService'
import { friendsStore } from '../../stores/friends.store'
import type { Friend, FriendRequest, FriendProfile, FriendsFilter } from '../../types/friends.types'

/**
 * @brief FriendsPage component properties interface
 */
export interface FriendsPageProps {
  /** Optional custom CSS classes */
  className?: string
}

/**
 * @brief FriendsPage component state interface
 */
export interface FriendsPageState {
  /** Current active tab */
  activeTab: 'friends' | 'requests' | 'search'
  
  /** Search input value */
  searchQuery: string
  
  /** Loading states */
  isLoading: boolean
  
  /** Error message if any */
  error?: string
  
  /** Success message if any */
  success?: string
}

/**
 * @brief Main FriendsPage component
 * 
 * @description Social features page with friends management, requests, and user search.
 */
export class FriendsPage extends Component<FriendsPageProps, FriendsPageState> {
  
  constructor(props: FriendsPageProps = {}) {
    super(props, {
      activeTab: 'friends',
      searchQuery: '',
      isLoading: true,
      error: undefined,
      success: undefined
    })
  }

  /**
   * @brief Render the friends page
   */
  render(): string {
    const { activeTab, isLoading, error, success } = this.state
    
    return `
      <div class="min-h-screen bg-black text-green-400 font-mono">
        <!-- Header -->
        <div class="border-b border-green-400/30 bg-black/50 backdrop-blur-sm sticky top-0 z-10">
          <div class="max-w-6xl mx-auto px-4 py-4">
            <div class="flex items-center justify-between">
              <h1 class="text-2xl font-bold text-green-400 neon-glow">
                👥 Friends & Social
              </h1>
              
              <div class="flex items-center space-x-4">
                <!-- Real-time Connection Status -->
                <div id="connection-status" class="flex items-center space-x-2">
                  ${this.renderConnectionStatus()}
                </div>
                
                <button 
                  id="back-home-btn"
                  class="px-4 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-400/50 rounded transition-colors"
                >
                  ← Back to Home
                </button>
              </div>
            </div>
            
            <!-- Tab Navigation -->
            <div class="flex space-x-1 mt-4">
              <button 
                id="tab-friends"
                class="px-4 py-2 rounded-t border-b-2 transition-colors ${activeTab === 'friends' ? 'border-green-400 bg-green-400/10 text-green-400' : 'border-transparent text-gray-400 hover:text-green-400'}"
              >
                Friends ${this.getFriendsCount()}
              </button>
              <button 
                id="tab-requests"
                class="px-4 py-2 rounded-t border-b-2 transition-colors ${activeTab === 'requests' ? 'border-green-400 bg-green-400/10 text-green-400' : 'border-transparent text-gray-400 hover:text-green-400'}"
              >
                Requests ${this.getRequestsCount()}
              </button>
              <button 
                id="tab-search"
                class="px-4 py-2 rounded-t border-b-2 transition-colors ${activeTab === 'search' ? 'border-green-400 bg-green-400/10 text-green-400' : 'border-transparent text-gray-400 hover:text-green-400'}"
              >
                Search Users
              </button>
            </div>
          </div>
        </div>

        <!-- Content -->
        <div class="max-w-6xl mx-auto px-4 py-6">
          ${error ? this.renderError(error) : ''}
          ${success ? this.renderSuccess(success) : ''}
          
          ${isLoading ? this.renderLoading() : ''}
          
          <div id="tab-content" class="mt-6">
            ${activeTab === 'friends' ? this.renderFriendsTab() : ''}
            ${activeTab === 'requests' ? this.renderRequestsTab() : ''}
            ${activeTab === 'search' ? this.renderSearchTab() : ''}
          </div>
        </div>
      </div>
    `
  }

  /**
   * @brief Render connection status indicator
   */
  private renderConnectionStatus(): string {
    const connectionStatus = friendsStore.getConnectionStatus()
    
    return `
      <div class="flex items-center space-x-2 text-xs">
        <div class="w-2 h-2 rounded-full ${
          connectionStatus.isConnected ? 'bg-green-400 animate-pulse' : 'bg-gray-400'
        }"></div>
        <span class="${connectionStatus.statusColor}">
          ${connectionStatus.statusText}
        </span>
      </div>
    `
  }

  /**
   * @brief Render friends tab
   */
  private renderFriendsTab(): string {
    const store = friendsStore.getState()
    const filteredFriends = friendsStore.getFilteredFriends()
    
    return `
      <div class="space-y-6">
        <!-- Filter Bar -->
        <div class="flex items-center justify-between">
          <div class="flex space-x-2">
            <button 
              id="filter-all"
              class="px-3 py-1 rounded text-sm transition-colors ${store.currentFilter === 'all' ? 'bg-green-400/20 text-green-400' : 'text-gray-400 hover:text-green-400'}"
            >
              All (${store.friendsCount})
            </button>
            <button 
              id="filter-online"
              class="px-3 py-1 rounded text-sm transition-colors ${store.currentFilter === 'online' ? 'bg-green-400/20 text-green-400' : 'text-gray-400 hover:text-green-400'}"
            >
              🟢 Online (${store.onlineFriendsCount})
            </button>
            <button 
              id="filter-offline"
              class="px-3 py-1 rounded text-sm transition-colors ${store.currentFilter === 'offline' ? 'bg-green-400/20 text-green-400' : 'text-gray-400 hover:text-green-400'}"
            >
              ⚫ Offline (${store.friendsCount - store.onlineFriendsCount})
            </button>
            <button 
              id="filter-recent"
              class="px-3 py-1 rounded text-sm transition-colors ${store.currentFilter === 'recent' ? 'bg-green-400/20 text-green-400' : 'text-gray-400 hover:text-green-400'}"
            >
              📅 Recent
            </button>
          </div>
          
          <button 
            id="refresh-friends-btn"
            class="px-3 py-1 text-sm text-gray-400 hover:text-green-400 transition-colors"
          >
            🔄 Refresh
          </button>
        </div>

        <!-- Friends List -->
        <div class="grid gap-4">
          ${filteredFriends.length === 0 ? this.renderEmptyFriends() : filteredFriends.map(friend => this.renderFriendCard(friend)).join('')}
        </div>
      </div>
    `
  }

  /**
   * @brief Render friend card
   */
  private renderFriendCard(friend: Friend): string {
    const onlineIndicator = friend.friend.isOnline ? '🟢' : '⚫'
    const statusText = friend.friend.isOnline ? friend.friend.onlineStatus : 'offline'
    const lastSeen = friend.friend.lastSeen ? new Date(friend.friend.lastSeen).toLocaleDateString() : 'Never'
    
    return `
      <div class="bg-gray-900/50 border border-green-400/30 rounded-lg p-4 hover:border-green-400/50 transition-colors">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <div class="relative">
              <div class="w-12 h-12 bg-green-400/20 rounded-full flex items-center justify-center text-xl">
                ${friend.friend.avatar ? `<img src="${friend.friend.avatar}" alt="Avatar" class="w-full h-full rounded-full object-cover">` : '👤'}
              </div>
              <div class="absolute -bottom-1 -right-1 text-xs">${onlineIndicator}</div>
            </div>
            
            <div>
              <h3 class="font-bold text-green-400">${friend.friend.username}</h3>
              <p class="text-sm text-gray-400">@${friend.friend.username}</p>
              <p class="text-xs text-gray-500">${statusText} ${!friend.friend.isOnline ? `• Last seen: ${lastSeen}` : ''}</p>
            </div>
          </div>
          
          <div class="flex space-x-2">
            <button 
              class="view-profile-btn px-3 py-1 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-400/50 rounded text-sm transition-colors"
              data-user-id="${friend.friendId}"
            >
              View Profile
            </button>
            <button 
              class="remove-friend-btn px-3 py-1 bg-red-600/20 hover:bg-red-600/30 border border-red-400/50 rounded text-sm transition-colors"
              data-friend-id="${friend.friendId}"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    `
  }

  /**
   * @brief Render requests tab
   */
  private renderRequestsTab(): string {
    const store = friendsStore.getState()
    
    return `
      <div class="space-y-6">
        <!-- Incoming Requests -->
        <div>
          <h2 class="text-xl font-bold text-green-400 mb-4">📨 Incoming Requests (${store.incomingRequests.length})</h2>
          <div class="grid gap-4">
            ${store.incomingRequests.length === 0 ? 
              '<p class="text-gray-400 text-center py-8">No incoming friend requests</p>' :
              store.incomingRequests.map(request => this.renderIncomingRequestCard(request)).join('')
            }
          </div>
        </div>

        <!-- Outgoing Requests -->
        <div>
          <h2 class="text-xl font-bold text-green-400 mb-4">📤 Sent Requests (${store.outgoingRequests.length})</h2>
          <div class="grid gap-4">
            ${store.outgoingRequests.length === 0 ? 
              '<p class="text-gray-400 text-center py-8">No pending sent requests</p>' :
              store.outgoingRequests.map(request => this.renderOutgoingRequestCard(request)).join('')
            }
          </div>
        </div>
      </div>
    `
  }

  /**
   * @brief Render incoming request card
   */
  private renderIncomingRequestCard(request: FriendRequest): string {
    const timeAgo = this.formatTimeAgo(new Date(request.createdAt))
    
    return `
      <div class="bg-gray-900/50 border border-yellow-400/30 rounded-lg p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <div class="w-12 h-12 bg-yellow-400/20 rounded-full flex items-center justify-center text-xl">
              ${request.fromUser.avatar ? `<img src="${request.fromUser.avatar}" alt="Avatar" class="w-full h-full rounded-full object-cover">` : '👤'}
            </div>
            
            <div>
              <h3 class="font-bold text-yellow-400">${request.fromUser.username}</h3>
              <p class="text-sm text-gray-400">@${request.fromUser.username}</p>
              <p class="text-xs text-gray-500">Sent ${timeAgo}</p>
              ${request.message ? `<p class="text-sm mt-1 text-gray-300">"${request.message}"</p>` : ''}
            </div>
          </div>
          
          <div class="flex space-x-2">
            <button 
              class="accept-request-btn px-3 py-1 bg-green-600/20 hover:bg-green-600/30 border border-green-400/50 rounded text-sm transition-colors"
              data-request-id="${request.id}"
            >
              ✅ Accept
            </button>
            <button 
              class="decline-request-btn px-3 py-1 bg-red-600/20 hover:bg-red-600/30 border border-red-400/50 rounded text-sm transition-colors"
              data-request-id="${request.id}"
            >
              ❌ Decline
            </button>
          </div>
        </div>
      </div>
    `
  }

  /**
   * @brief Render outgoing request card
   */
  private renderOutgoingRequestCard(request: FriendRequest): string {
    const timeAgo = this.formatTimeAgo(new Date(request.createdAt))
    
    return `
      <div class="bg-gray-900/50 border border-blue-400/30 rounded-lg p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <div class="w-12 h-12 bg-blue-400/20 rounded-full flex items-center justify-center text-xl">
              ${request.toUser.avatar ? `<img src="${request.toUser.avatar}" alt="Avatar" class="w-full h-full rounded-full object-cover">` : '👤'}
            </div>
            
            <div>
              <h3 class="font-bold text-blue-400">${request.toUser.username}</h3>
              <p class="text-sm text-gray-400">@${request.toUser.username}</p>
              <p class="text-xs text-gray-500">Sent ${timeAgo}</p>
              <p class="text-xs text-yellow-400">⏳ Pending response</p>
            </div>
          </div>
          
          <div class="flex space-x-2">
            <button 
              class="cancel-request-btn px-3 py-1 bg-gray-600/20 hover:bg-gray-600/30 border border-gray-400/50 rounded text-sm transition-colors"
              data-request-id="${request.id}"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    `
  }

  /**
   * @brief Render search tab
   */
  private renderSearchTab(): string {
    const store = friendsStore.getState()
    
    return `
      <div class="space-y-6">
        <!-- Search Bar -->
        <div class="flex space-x-4">
          <div class="flex-1 relative">
            <input 
              id="search-input"
              type="text"
              placeholder="Search users by username..."
              value="${this.state.searchQuery}"
              class="w-full px-4 py-2 bg-gray-900/50 border border-green-400/30 rounded focus:border-green-400 focus:outline-none text-green-400 placeholder-gray-500"
            >
          </div>
          <button 
            id="search-btn"
            class="px-6 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-400/50 rounded transition-colors"
            ${store.isSearching ? 'disabled' : ''}
          >
            ${store.isSearching ? '🔄' : '🔍'} Search
          </button>
        </div>

        <!-- Search Results -->
        <div class="grid gap-4">
          ${store.searchResults.length === 0 && store.searchQuery ? 
            '<p class="text-gray-400 text-center py-8">No users found</p>' :
            store.searchResults.map(user => this.renderSearchResultCard(user)).join('')
          }
          
          ${!store.searchQuery && store.searchResults.length === 0 ? 
            '<p class="text-gray-400 text-center py-8">Search for users to add as friends</p>' : ''
          }
        </div>
      </div>
    `
  }

  /**
   * @brief Render search result card
   */
  private renderSearchResultCard(user: FriendProfile): string {
    const isFriend = friendsStore.isFriend(user.id)
    const pendingRequest = friendsStore.hasPendingRequest(user.id)
    
    let actionButton = ''
    if (isFriend) {
      actionButton = '<span class="px-3 py-1 bg-green-600/20 border border-green-400/50 rounded text-sm text-green-400">✅ Friends</span>'
    } else if (pendingRequest === 'outgoing') {
      actionButton = '<span class="px-3 py-1 bg-yellow-600/20 border border-yellow-400/50 rounded text-sm text-yellow-400">⏳ Request Sent</span>'
    } else if (pendingRequest === 'incoming') {
      actionButton = '<span class="px-3 py-1 bg-blue-600/20 border border-blue-400/50 rounded text-sm text-blue-400">📨 Request Received</span>'
    } else {
      actionButton = `
        <button 
          class="add-friend-btn px-3 py-1 bg-green-600/20 hover:bg-green-600/30 border border-green-400/50 rounded text-sm transition-colors"
          data-user-id="${user.id}"
        >
          + Add Friend
        </button>
      `
    }
    
    const onlineIndicator = user.isOnline ? '🟢' : '⚫'
    
    return `
      <div class="bg-gray-900/50 border border-green-400/30 rounded-lg p-4 hover:border-green-400/50 transition-colors">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <div class="relative">
              <div class="w-12 h-12 bg-green-400/20 rounded-full flex items-center justify-center text-xl">
                ${user.avatar ? `<img src="${user.avatar}" alt="Avatar" class="w-full h-full rounded-full object-cover">` : '👤'}
              </div>
              <div class="absolute -bottom-1 -right-1 text-xs">${onlineIndicator}</div>
            </div>
            
            <div>
              <h3 class="font-bold text-green-400">${user.username}</h3>
              <p class="text-sm text-gray-400">@${user.username}</p>
              <p class="text-xs text-gray-500">${user.isOnline ? user.onlineStatus : 'offline'}</p>
            </div>
          </div>
          
          <div class="flex space-x-2">
            <button 
              class="view-profile-btn px-3 py-1 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-400/50 rounded text-sm transition-colors"
              data-user-id="${user.id}"
            >
              View Profile
            </button>
            ${actionButton}
          </div>
        </div>
      </div>
    `
  }

  /**
   * @brief Render empty friends state
   */
  private renderEmptyFriends(): string {
    return `
      <div class="text-center py-12">
        <div class="text-6xl mb-4">👥</div>
        <h3 class="text-xl font-bold text-green-400 mb-2">No Friends Yet</h3>
        <p class="text-gray-400 mb-6">Start building your social network by searching for users to add as friends.</p>
        <button 
          id="goto-search-tab"
          class="px-6 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-400/50 rounded transition-colors"
        >
          🔍 Search Users
        </button>
      </div>
    `
  }

  /**
   * @brief Render loading state
   */
  private renderLoading(): string {
    return `
      <div class="text-center py-12">
        <div class="text-4xl mb-4 animate-spin">⚙️</div>
        <p class="text-gray-400">Loading friends...</p>
      </div>
    `
  }

  /**
   * @brief Render error message
   */
  private renderError(message: string): string {
    return `
      <div class="bg-red-900/20 border border-red-400/50 rounded-lg p-4 mb-6">
        <div class="flex items-center space-x-2">
          <span class="text-red-400">❌</span>
          <span class="text-red-400">${message}</span>
        </div>
      </div>
    `
  }

  /**
   * @brief Render success message
   */
  private renderSuccess(message: string): string {
    return `
      <div class="bg-green-900/20 border border-green-400/50 rounded-lg p-4 mb-6">
        <div class="flex items-center space-x-2">
          <span class="text-green-400">✅</span>
          <span class="text-green-400">${message}</span>
        </div>
      </div>
    `
  }

  /**
   * @brief Mount component and setup event handlers
   */
  public mount(parent: HTMLElement): void {
    parent.innerHTML = this.render()
    this.setupEventHandlers()
    this.loadInitialData()
  }

  /**
   * @brief Setup event handlers
   */
  private setupEventHandlers(): void {
    // Tab navigation
    const tabFriends = document.getElementById('tab-friends')
    const tabRequests = document.getElementById('tab-requests')
    const tabSearch = document.getElementById('tab-search')
    
    if (tabFriends) {
      tabFriends.addEventListener('click', () => this.switchTab('friends'))
    }
    if (tabRequests) {
      tabRequests.addEventListener('click', () => this.switchTab('requests'))
    }
    if (tabSearch) {
      tabSearch.addEventListener('click', () => this.switchTab('search'))
    }

    // Navigation buttons
    const backHomeBtn = document.getElementById('back-home-btn')
    if (backHomeBtn) {
      backHomeBtn.addEventListener('click', () => this.handleBackToHome())
    }

    const gotoSearchTab = document.getElementById('goto-search-tab')
    if (gotoSearchTab) {
      gotoSearchTab.addEventListener('click', () => this.switchTab('search'))
    }

    // Filter buttons
    const filterAll = document.getElementById('filter-all')
    const filterOnline = document.getElementById('filter-online')
    const filterOffline = document.getElementById('filter-offline')
    const filterRecent = document.getElementById('filter-recent')
    
    if (filterAll) filterAll.addEventListener('click', () => this.setFilter('all'))
    if (filterOnline) filterOnline.addEventListener('click', () => this.setFilter('online'))
    if (filterOffline) filterOffline.addEventListener('click', () => this.setFilter('offline'))
    if (filterRecent) filterRecent.addEventListener('click', () => this.setFilter('recent'))

    // Refresh button
    const refreshBtn = document.getElementById('refresh-friends-btn')
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshFriends())
    }

    // Search functionality
    const searchInput = document.getElementById('search-input') as HTMLInputElement
    const searchBtn = document.getElementById('search-btn')
    
    if (searchInput) {
      searchInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
          this.handleSearch()
        }
      })
      searchInput.addEventListener('input', (event) => {
        this.setState({ searchQuery: (event.target as HTMLInputElement).value })
      })
    }
    if (searchBtn) {
      searchBtn.addEventListener('click', () => this.handleSearch())
    }

    // Friend action buttons
    this.setupFriendActionButtons()
  }

  /**
   * @brief Setup friend action buttons
   */
  private setupFriendActionButtons(): void {
    // Remove friend buttons
    document.querySelectorAll('.remove-friend-btn').forEach(btn => {
      btn.addEventListener('click', (event) => {
        const friendId = (event.target as HTMLElement).dataset.friendId
        if (friendId) this.handleRemoveFriend(friendId)
      })
    })

    // Accept request buttons
    document.querySelectorAll('.accept-request-btn').forEach(btn => {
      btn.addEventListener('click', (event) => {
        const requestId = (event.target as HTMLElement).dataset.requestId
        if (requestId) this.handleAcceptRequest(requestId)
      })
    })

    // Decline request buttons
    document.querySelectorAll('.decline-request-btn').forEach(btn => {
      btn.addEventListener('click', (event) => {
        const requestId = (event.target as HTMLElement).dataset.requestId
        if (requestId) this.handleDeclineRequest(requestId)
      })
    })

    // Cancel request buttons
    document.querySelectorAll('.cancel-request-btn').forEach(btn => {
      btn.addEventListener('click', (event) => {
        const requestId = (event.target as HTMLElement).dataset.requestId
        if (requestId) this.handleCancelRequest(requestId)
      })
    })

    // Add friend buttons
    document.querySelectorAll('.add-friend-btn').forEach(btn => {
      btn.addEventListener('click', (event) => {
        const userId = (event.target as HTMLElement).dataset.userId
        if (userId) this.handleAddFriend(userId)
      })
    })

    // View profile buttons
    document.querySelectorAll('.view-profile-btn').forEach(btn => {
      btn.addEventListener('click', (event) => {
        const userId = (event.target as HTMLElement).dataset.userId
        if (userId) this.handleViewProfile(userId)
      })
    })
  }

  /**
   * @brief Load initial data
   */
  private async loadInitialData(): Promise<void> {
    try {
      this.setState({ isLoading: true, error: undefined })
      
      // Load friends and requests simultaneously
      await Promise.all([
        this.loadFriends(),
        this.loadFriendRequests()
      ])
      
      // Initialize real-time updates after loading friends
      await this.initializeRealTimeUpdates()
      
      this.setState({ isLoading: false })
    } catch (error: any) {
      console.error('Failed to load initial data:', error)
      this.setError('Failed to load friends data. Please try again.')
    }
  }

  /**
   * @brief Initialize real-time updates
   */
  private async initializeRealTimeUpdates(): Promise<void> {
    try {
      // Get auth token from auth store if available
      const authToken = await this.getAuthToken()
      await friendsService.initializeRealTimeUpdates(authToken)
      
      console.log('🔌 Real-time updates started for FriendsPage')
    } catch (error: any) {
      console.warn('Real-time updates not available:', error)
      // Don't show error to user - real-time is optional
    }
  }

  /**
   * @brief Get auth token from auth store
   */
  private async getAuthToken(): Promise<string | undefined> {
    try {
      const { authStore } = await import('../../stores/auth.store')
      const authState = authStore.getState()
      return authState.token || undefined
    } catch (error) {
      console.warn('Could not get auth token:', error)
      return undefined
    }
  }

  /**
   * @brief Load friends list
   */
  private async loadFriends(): Promise<void> {
    try {
      const response = await friendsService.getFriends()
      friendsStore.setFriends(response.friends, response.total, response.page * response.limit < response.total)
    } catch (error: any) {
      console.error('Failed to load friends:', error)
      
      // Use mock data for development
      this.loadMockFriends()
    }
  }

  /**
   * @brief Load friend requests
   */
  private async loadFriendRequests(): Promise<void> {
    try {
      const response = await friendsService.getFriendRequests()
      friendsStore.setFriendRequests(response.incoming, response.outgoing)
    } catch (error: any) {
      console.error('Failed to load friend requests:', error)
      
      // Use mock data for development
      this.loadMockRequests()
    }
  }

  /**
   * @brief Load mock data for development
   */
  private loadMockFriends(): void {
    console.log('⚠️ Using mock friends data for development')
    
    const mockFriends: Friend[] = [
      {
        id: 'friendship_1',
        userId: 'current_user',
        friendId: 'user_1',
        status: 'accepted',
        createdAt: new Date('2025-09-10'),
        acceptedAt: new Date('2025-09-10'),
        friend: {
          id: 'user_1',
          username: 'pongmaster',
          isOnline: true,
          onlineStatus: 'online',
          lastSeen: new Date()
        }
      },
      {
        id: 'friendship_2',
        userId: 'current_user',
        friendId: 'user_2',
        status: 'accepted',
        createdAt: new Date('2025-09-08'),
        acceptedAt: new Date('2025-09-08'),
        friend: {
          id: 'user_2',
          username: 'speedball',
          isOnline: false,
          onlineStatus: 'offline',
          lastSeen: new Date('2025-09-13')
        }
      }
    ]
    
    friendsStore.setFriends(mockFriends, mockFriends.length)
  }

  /**
   * @brief Load mock requests for development
   */
  private loadMockRequests(): void {
    console.log('⚠️ Using mock friend requests data for development')
    
    const mockIncoming: FriendRequest[] = [
      {
        id: 'request_1',
        fromUserId: 'user_3',
        toUserId: 'current_user',
        status: 'pending',
        message: 'Hey! Want to be friends?',
        createdAt: new Date('2025-09-14'),
        fromUser: {
          id: 'user_3',
          username: 'newplayer',
          isOnline: true,
          onlineStatus: 'online'
        },
        toUser: {
          id: 'current_user',
          username: 'currentuser',
          isOnline: true,
          onlineStatus: 'online'
        }
      }
    ]
    
    const mockOutgoing: FriendRequest[] = [
      {
        id: 'request_2',
        fromUserId: 'current_user',
        toUserId: 'user_4',
        status: 'pending',
        createdAt: new Date('2025-09-13'),
        fromUser: {
          id: 'current_user',
          username: 'currentuser',
          isOnline: true,
          onlineStatus: 'online'
        },
        toUser: {
          id: 'user_4',
          username: 'progamer',
          isOnline: false,
          onlineStatus: 'offline'
        }
      }
    ]
    
    friendsStore.setFriendRequests(mockIncoming, mockOutgoing)
  }

  // Helper methods
  private getFriendsCount(): string {
    const count = friendsStore.getState().friendsCount
    return count > 0 ? `(${count})` : ''
  }

  private getRequestsCount(): string {
    const store = friendsStore.getState()
    const count = store.incomingRequests.length + store.outgoingRequests.length
    return count > 0 ? `(${count})` : ''
  }

  private formatTimeAgo(date: Date): string {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  // Event handlers
  private switchTab(tab: 'friends' | 'requests' | 'search'): void {
    this.setState({ activeTab: tab })
    this.remount()
  }

  private setFilter(filter: FriendsFilter): void {
    friendsStore.setFilter(filter)
    this.remount()
  }

  private async refreshFriends(): Promise<void> {
    await this.loadFriends()
    this.remount()
  }

  private async handleSearch(): Promise<void> {
    const query = this.state.searchQuery.trim()
    if (!query) return

    try {
      friendsStore.setSearching(true)
      this.remount()

      const response = await friendsService.searchUsers({ query })
      friendsStore.setSearchResults(response.users, query)
      
      this.remount()
    } catch (error: any) {
      console.error('Search failed:', error)
      this.setError('Search failed. Please try again.')
    }
  }

  private async handleAddFriend(userId: string): Promise<void> {
    try {
      const response = await friendsService.sendFriendRequest({ userId })
      friendsStore.addOutgoingRequest(response.request)
      this.setSuccess('Friend request sent!')
      this.remount()
    } catch (error: any) {
      console.error('Failed to send friend request:', error)
      this.setError('Failed to send friend request.')
    }
  }

  private async handleAcceptRequest(requestId: string): Promise<void> {
    try {
      await friendsService.respondToFriendRequest({ requestId, action: 'accept' })
      friendsStore.removeFriendRequest(requestId)
      // Note: In real implementation, you'd also add the new friend to the friends list
      this.setSuccess('Friend request accepted!')
      this.remount()
    } catch (error: any) {
      console.error('Failed to accept request:', error)
      this.setError('Failed to accept friend request.')
    }
  }

  private async handleDeclineRequest(requestId: string): Promise<void> {
    try {
      await friendsService.respondToFriendRequest({ requestId, action: 'decline' })
      friendsStore.removeFriendRequest(requestId)
      this.setSuccess('Friend request declined.')
      this.remount()
    } catch (error: any) {
      console.error('Failed to decline request:', error)
      this.setError('Failed to decline friend request.')
    }
  }

  private async handleCancelRequest(requestId: string): Promise<void> {
    try {
      await friendsService.cancelFriendRequest(requestId)
      friendsStore.removeFriendRequest(requestId)
      this.setSuccess('Friend request cancelled.')
      this.remount()
    } catch (error: any) {
      console.error('Failed to cancel request:', error)
      this.setError('Failed to cancel friend request.')
    }
  }

  private async handleRemoveFriend(friendId: string): Promise<void> {
    if (!confirm('Are you sure you want to remove this friend?')) return

    try {
      await friendsService.removeFriend(friendId)
      friendsStore.removeFriend(friendId)
      this.setSuccess('Friend removed.')
      this.remount()
    } catch (error: any) {
      console.error('Failed to remove friend:', error)
      this.setError('Failed to remove friend.')
    }
  }

  private handleViewProfile(userId: string): void {
    // Navigate to user profile
    import('../../router/router').then(({ router }) => {
      router.navigate(`/profile/${userId}`)
    }).catch(error => {
      console.error('Navigation failed:', error)
    })
  }

  private async handleBackToHome(): Promise<void> {
    import('../../router/router').then(({ router }) => {
      router.navigate('/')
    }).catch(error => {
      console.error('Navigation failed:', error)
    })
  }

  private setError(message: string): void {
    this.setState({ error: message, success: undefined })
    setTimeout(() => this.setState({ error: undefined }), 5000)
  }

  private setSuccess(message: string): void {
    this.setState({ success: message, error: undefined })
    setTimeout(() => this.setState({ success: undefined }), 3000)
  }

  private remount(): void {
    const container = document.getElementById('app')
    if (container) {
      this.mount(container)
    }
  }
}