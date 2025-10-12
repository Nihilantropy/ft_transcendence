/**
 * @file Profile Page component for ft_transcendence
 * 
 * @description Comprehensive profile page with tabs for:
 * - View profile information
 * - Edit profile (username, avatar)
 * - Search for other users
 * - Delete account
 */

import { Component } from '../../components/base/Component'
import { userService } from '../../services/user'
import { authService } from '../../services/auth'
import { showPopup } from '../../components/ui/Popup'
import { router } from '../../router/router'
import type { CompleteUser, UserPreview } from '../../services/user/schemas/user.schema'

// FilePond imports
import * as FilePond from 'filepond'
import 'filepond/dist/filepond.min.css'
import FilePondPluginImagePreview from 'filepond-plugin-image-preview'
import 'filepond-plugin-image-preview/dist/filepond-plugin-image-preview.css'

// Register FilePond plugins
FilePond.registerPlugin(FilePondPluginImagePreview)

export interface ProfilePageProps {
  /** Custom CSS classes */
  className?: string
}

export interface ProfilePageState {
  /** Current active tab */
  activeTab: 'view' | 'edit' | 'search'
  /** Current user profile data */
  profile: CompleteUser | null
  /** Loading state */
  isLoading: boolean
  /** Error message */
  errorMessage: string | null
  
  // Edit tab states
  editUsername: string
  editAvatarFile: File | null
  editAvatarPreview: string | null
  isCheckingUsername: boolean
  usernameAvailable: boolean | null
  usernameMessage: string | null
  isSavingProfile: boolean
  
  // Search tab states
  searchQuery: string
  searchResults: UserPreview[]
  searchCount: number
  isSearching: boolean
  
  // Delete account states
  deletePassword: string
  deleteConfirmation: string
  isDeleting: boolean
}

/**
 * @brief Profile page component with view, edit, and search functionality
 */
export class ProfilePage extends Component<ProfilePageProps, ProfilePageState> {

  private usernameCheckTimeout: number | null = null
  private lastFocusedElement: string | null = null
  private filePond: FilePond.FilePond | null = null

  constructor(props: ProfilePageProps = {}) {
    super(props, {
      activeTab: 'view',
      profile: null,
      isLoading: true,
      errorMessage: null,
      
      editUsername: '',
      editAvatarFile: null,
      editAvatarPreview: null,
      isCheckingUsername: false,
      usernameAvailable: null,
      usernameMessage: null,
      isSavingProfile: false,
      
      searchQuery: '',
      searchResults: [],
      searchCount: 0,
      isSearching: false,
      
      deletePassword: '',
      deleteConfirmation: '',
      isDeleting: false
    })
    
    // Load user profile on mount
    this.loadProfile()
  }

  /**
   * @brief Load current user profile
   */
  private async loadProfile(): Promise<void> {
    this.setState({ isLoading: true, errorMessage: null })
    
    try {
      console.log('📋 Loading user profile...')
      const response = await userService.getMyProfile()
      
      if (response.success && response.user) {
        console.log('✅ Profile loaded:', response.user.username)
        this.setState({
          profile: response.user,
          editUsername: response.user.username,
          editAvatarFile: null,
          editAvatarPreview: null,
          isLoading: false
        })
      } else {
        throw new Error('Failed to load profile')
      }
    } catch (error: any) {
      console.error('❌ Error loading profile:', error)
      this.setState({
        isLoading: false,
        errorMessage: error.message || 'Failed to load profile'
      })
      showPopup('Failed to load profile. Please try again.')
    }
  }

  /**
   * @brief Switch to different tab
   */
  private switchTab(tab: 'view' | 'edit' | 'search'): void {
    this.setState({ activeTab: tab })
    
    // Reset edit form when switching to edit tab
    if (tab === 'edit' && this.state.profile) {
      this.setState({
        editUsername: this.state.profile.username,
        editAvatarFile: null,
        editAvatarPreview: null,
        usernameAvailable: null,
        usernameMessage: null
      })
    }
    
    // Clear search when switching away
    if (tab !== 'search') {
      this.setState({
        searchQuery: '',
        searchResults: [],
        searchCount: 0
      })
    }
  }

  // ==========================================================================
  // EDIT PROFILE METHODS
  // ==========================================================================

  /**
   * @brief Handle username change with debounced availability check
   */
  private async handleUsernameChange(username: string): Promise<void> {
    this.setState({ 
      editUsername: username,
      usernameAvailable: null,
      usernameMessage: null
    })
    
    // Clear previous timeout
    if (this.usernameCheckTimeout !== null) {
      clearTimeout(this.usernameCheckTimeout)
    }
    
    // Skip check if username hasn't changed or is invalid
    if (username === this.state.profile?.username) {
      this.setState({ usernameMessage: 'Current username' })
      return
    }
    
    if (username.length < 3 || username.length > 20) {
      return
    }
    
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      this.setState({ usernameMessage: 'Invalid characters' })
      return
    }
    
    // Debounce availability check (500ms)
    this.usernameCheckTimeout = window.setTimeout(() => {
      this.checkUsernameAvailability(username)
    }, 500)
  }

  /**
   * @brief Check username availability
   */
  private async checkUsernameAvailability(username: string): Promise<void> {
    this.setState({ isCheckingUsername: true })
    
    try {
      const response = await userService.checkUsernameAvailability(username)
      this.setState({
        isCheckingUsername: false,
        usernameAvailable: response.available,
        usernameMessage: response.message
      })
    } catch (error: any) {
      console.error('❌ Error checking username:', error)
      this.setState({
        isCheckingUsername: false,
        usernameAvailable: null,
        usernameMessage: 'Failed to check availability'
      })
    }
  }

  /**
   * @brief Handle avatar file selection
   */
  private async handleAvatarChange(file: File | null): Promise<void> {
    if (!file) {
      this.setState({ 
        editAvatarFile: null,
        editAvatarPreview: null
      })
      return
    }
    
    // Validate file (client-side preview)
    if (file.size > 5 * 1024 * 1024) {
      showPopup('File size must be less than 5MB')
      return
    }
    
    if (!file.type.startsWith('image/')) {
      showPopup('Please select an image file')
      return
    }
    
    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      this.setState({
        editAvatarFile: file,
        editAvatarPreview: e.target?.result as string
      })
    }
    reader.readAsDataURL(file)
  }

  /**
   * @brief Save profile changes
   */
  private async saveProfile(): Promise<void> {
    const { editUsername, editAvatarFile, profile, isSavingProfile } = this.state
    
    if (isSavingProfile || !profile) {
      return
    }
    
    const usernameChanged = editUsername !== profile.username
    const avatarChanged = editAvatarFile !== null
    
    if (!usernameChanged && !avatarChanged) {
      showPopup('No changes to save')
      return
    }
    
    this.setState({ isSavingProfile: true })
    
    try {
      // Update username if changed
      if (usernameChanged) {
        console.log('📝 Updating username to:', editUsername)
        const response = await userService.updateUsername(editUsername)
        if (response.success && response.user) {
          this.setState({ profile: response.user })
          showPopup('Username updated successfully!')
        }
      }
      
      // Upload avatar if changed
      if (avatarChanged && editAvatarFile) {
        console.log('🖼️ Uploading avatar file:', editAvatarFile.name)
        const response = await userService.uploadAvatar(editAvatarFile)
        if (response.success && response.user) {
          this.setState({ profile: response.user })
          showPopup('Avatar uploaded successfully!')
        }
      }
      
      this.setState({ 
        isSavingProfile: false,
        editAvatarFile: null,
        editAvatarPreview: null,
        activeTab: 'view'
      })
    } catch (error: any) {
      console.error('❌ Error saving profile:', error)
      this.setState({ isSavingProfile: false })
      showPopup(`Failed to save: ${error.message}`)
    }
  }

  // ==========================================================================
  // SEARCH USERS METHODS
  // ==========================================================================

  /**
   * @brief Handle search query change
   */
  private handleSearchChange(query: string): void {
    this.setState({ searchQuery: query })
  }

  /**
   * @brief Execute user search
   */
  private async executeSearch(): Promise<void> {
    const { searchQuery, isSearching } = this.state
    
    if (isSearching || searchQuery.length < 1) {
      return
    }
    
    this.setState({ isSearching: true })
    
    try {
      console.log('🔍 Searching for users:', searchQuery)
      const response = await userService.searchUsers(searchQuery, 20)
      
      this.setState({
        isSearching: false,
        searchResults: response.users,
        searchCount: response.count
      })
      
      console.log(`✅ Found ${response.count} users`)
    } catch (error: any) {
      console.error('❌ Error searching users:', error)
      this.setState({ 
        isSearching: false,
        searchResults: [],
        searchCount: 0
      })
      showPopup(`Search failed: ${error.message}`)
    }
  }

  /**
   * @brief View another user's profile
   */
  private viewUserProfile(userId: number): void {
    router.navigate(`/users/${userId}`)
  }

  // ==========================================================================
  // DELETE ACCOUNT METHODS
  // ==========================================================================

  /**
   * @brief Handle delete account
   */
  private async deleteAccount(): Promise<void> {
    const { deletePassword, deleteConfirmation, isDeleting } = this.state
    
    if (isDeleting) {
      return
    }
    
    // Note: Password validation is handled by backend
    // OAuth users don't need password, password users do
    // Backend will reject if password-based account tries to delete without password
    
    if (deleteConfirmation !== 'DELETE') {
      showPopup('Please type DELETE to confirm')
      return
    }
    
    // Final confirmation
    const confirmed = confirm(
      '⚠️ WARNING: This action cannot be undone!\n\n' +
      'Are you absolutely sure you want to delete your account?\n' +
      'All your data, games, and statistics will be permanently lost.'
    )
    
    if (!confirmed) {
      return
    }
    
    this.setState({ isDeleting: true })
    
    try {
      console.log('🗑️ Deleting account...')
      // Pass password if provided, undefined if not (for OAuth users)
      const response = await userService.deleteAccount(
        deletePassword || undefined,
        deleteConfirmation
      )
      
      if (response.success) {
        console.log('✅ Account deleted successfully')
        showPopup('Account deleted successfully. Goodbye!')
        
        // Logout and redirect to home
        await authService.logout()
        setTimeout(() => {
          router.navigate('/')
        }, 2000)
      }
    } catch (error: any) {
      console.error('❌ Error deleting account:', error)
      this.setState({ isDeleting: false })
      
      // Show helpful error message
      const errorMsg = error.message || 'Unknown error'
      if (errorMsg.includes('Password is required')) {
        showPopup('Password is required for password-based accounts')
      } else if (errorMsg.includes('Incorrect password')) {
        showPopup('Incorrect password. Please try again.')
      } else {
        showPopup(`Failed to delete account: ${errorMsg}`)
      }
    }
  }

  // ==========================================================================
  // RENDER METHODS
  // ==========================================================================

  /**
   * @brief Render tab navigation
   */
  private renderTabs(): string {
    const { activeTab } = this.state
    
    const tabClass = (tab: string) => {
      const base = 'px-6 py-3 font-bold transition-colors'
      return activeTab === tab
        ? `${base} bg-green-600 text-black`
        : `${base} bg-gray-800 text-green-400 hover:bg-gray-700`
    }
    
    return `
      <div class="flex gap-2 mb-6">
        <button data-tab="view" class="${tabClass('view')} rounded-l-lg">
          👤 View Profile
        </button>
        <button data-tab="edit" class="${tabClass('edit')}">
          ✏️ Edit Profile
        </button>
        <button data-tab="search" class="${tabClass('search')} rounded-r-lg">
          🔍 Search Users
        </button>
      </div>
    `
  }

  /**
   * @brief Render view profile tab
   */
  private renderViewTab(): string {
    const { profile } = this.state
    
    if (!profile) {
      return '<div class="text-center text-gray-400">No profile data</div>'
    }
    
    return `
      <div class="space-y-6">
        <!-- Avatar -->
        <div class="flex justify-center">
          <div class="w-32 h-32 rounded-full border-4 border-green-600 overflow-hidden bg-gray-800 flex items-center justify-center">
            ${profile.avatar 
              ? `<img src="${profile.avatar}" alt="${profile.username}" class="w-full h-full object-cover" />`
              : `<span class="text-6xl">👤</span>`
            }
          </div>
        </div>
        
        <!-- Profile Info -->
        <div class="space-y-4">
          <div class="bg-gray-900/50 p-4 rounded-lg border border-green-600/30">
            <label class="text-sm text-green-400 block mb-1">Username</label>
            <div class="text-xl font-bold text-green-300">${profile.username}</div>
          </div>
          
          <div class="bg-gray-900/50 p-4 rounded-lg border border-green-600/30">
            <label class="text-sm text-green-400 block mb-1">Email</label>
            <div class="text-green-300">${profile.email}</div>
            <div class="text-xs mt-1 ${profile.emailVerified ? 'text-green-400' : 'text-yellow-400'}">
              ${profile.emailVerified ? '✅ Verified' : '⚠️ Not verified'}
            </div>
          </div>
          
          <div class="bg-gray-900/50 p-4 rounded-lg border border-green-600/30">
            <label class="text-sm text-green-400 block mb-1">Status</label>
            <div class="text-green-300">
              ${profile.isOnline ? '🟢 Online' : '⚫ Offline'}
            </div>
          </div>
          
          <div class="bg-gray-900/50 p-4 rounded-lg border border-green-600/30">
            <label class="text-sm text-green-400 block mb-1">Two-Factor Authentication</label>
            <div class="text-green-300">
              ${profile.twoFactorEnabled ? '🔒 Enabled' : '🔓 Disabled'}
            </div>
          </div>
          
          <div class="bg-gray-900/50 p-4 rounded-lg border border-green-600/30">
            <label class="text-sm text-green-400 block mb-1">Member Since</label>
            <div class="text-green-300">${new Date(profile.createdAt || '').toLocaleDateString()}</div>
          </div>
        </div>
      </div>
    `
  }

  /**
   * @brief Render edit profile tab
   */
  private renderEditTab(): string {
    const { 
      editUsername, 
      editAvatarFile,
      editAvatarPreview,
      profile,
      isCheckingUsername,
      usernameAvailable,
      usernameMessage,
      isSavingProfile
    } = this.state
    
    const usernameChanged = editUsername !== profile?.username
    const avatarChanged = editAvatarFile !== null
    const hasChanges = usernameChanged || avatarChanged
    
    let usernameIndicator = ''
    if (usernameChanged) {
      if (isCheckingUsername) {
        usernameIndicator = '<div class="text-sm text-yellow-400 mt-1">🔍 Checking...</div>'
      } else if (usernameAvailable === true) {
        usernameIndicator = `<div class="text-sm text-green-400 mt-1">✅ ${usernameMessage}</div>`
      } else if (usernameAvailable === false) {
        usernameIndicator = `<div class="text-sm text-red-400 mt-1">❌ ${usernameMessage}</div>`
      } else if (usernameMessage) {
        usernameIndicator = `<div class="text-sm text-gray-400 mt-1">${usernameMessage}</div>`
      }
    }
    
    const canSave = hasChanges && !isSavingProfile && (!usernameChanged || usernameAvailable === true)
    
    // Display avatar preview (new file or existing avatar)
    const avatarDisplay = editAvatarPreview 
      ? editAvatarPreview 
      : (profile?.avatar || '')
    
    return `
      <div class="space-y-6">
        <!-- Avatar Preview -->
        <div class="flex justify-center">
          <div class="w-32 h-32 rounded-full border-4 border-green-600 overflow-hidden bg-gray-800 flex items-center justify-center">
            ${avatarDisplay 
              ? `<img src="${avatarDisplay}" alt="Avatar preview" class="w-full h-full object-cover" onerror="this.style.display='none'; this.parentElement.innerHTML='<span class=\\'text-6xl\\'>👤</span>'" />`
              : `<span class="text-6xl">👤</span>`
            }
          </div>
        </div>
        
        <!-- Username Field -->
        <div>
          <label class="block text-sm font-medium text-green-400 mb-2">
            Username
          </label>
          <input
            type="text"
            data-edit-username
            value="${editUsername}"
            placeholder="Enter username"
            maxlength="20"
            class="w-full px-4 py-3 bg-black border border-green-600 rounded-lg text-green-400 placeholder-green-700 focus:outline-none focus:border-green-400 transition-colors"
            ${isSavingProfile ? 'disabled' : ''}
          />
          ${usernameIndicator}
          <div class="text-xs text-gray-500 mt-1">
            3-20 characters, letters, numbers, underscores, and hyphens only
          </div>
        </div>
        
        <!-- Avatar File Upload -->
        <div>
          <label class="block text-sm font-medium text-green-400 mb-2">
            Avatar Image
          </label>
          <!-- FilePond will be initialized here -->
          <input
            type="file"
            data-filepond-avatar
            accept="image/jpeg,image/png,image/gif,image/webp"
          />
          <div class="text-xs text-gray-500 mt-1">
            Drag & drop or click to select image (max 5MB, JPEG/PNG/GIF/WebP)
          </div>
        </div>
        
        <!-- Save Button -->
        <button
          data-save-profile
          class="w-full px-6 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          ${!canSave ? 'disabled' : ''}
        >
          ${isSavingProfile ? '⏳ Saving...' : '💾 Save Changes'}
        </button>
        
        ${hasChanges ? `
          <div class="text-center text-xs text-yellow-400">
            ⚠️ You have unsaved changes
          </div>
        ` : ''}
        
        <!-- Delete Account Section -->
        <div class="mt-8 pt-8 border-t border-red-600/30">
          <h3 class="text-xl font-bold text-red-400 mb-4">⚠️ Danger Zone</h3>
          <details class="bg-red-900/10 border border-red-600/30 rounded-lg p-4">
            <summary class="cursor-pointer text-red-400 font-bold hover:text-red-300">
              Delete Account
            </summary>
            <div class="mt-4 space-y-4">
              <p class="text-sm text-gray-400">
                Once you delete your account, there is no going back. Please be certain.
              </p>
              
              <div>
                <label class="block text-sm font-medium text-red-400 mb-2">
                  Password <span class="text-xs text-gray-500">(required for password-based accounts only)</span>
                </label>
                <input
                  type="password"
                  data-delete-password
                  placeholder="Enter your password (if applicable)"
                  class="w-full px-4 py-3 bg-black border border-red-600 rounded-lg text-red-400 placeholder-red-700 focus:outline-none focus:border-red-400 transition-colors"
                  ${this.state.isDeleting ? 'disabled' : ''}
                />
                <p class="mt-1 text-xs text-gray-500">
                  💡 OAuth users (Google sign-in) can skip the password field
                </p>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-red-400 mb-2">
                  Type "DELETE" to confirm <span class="text-xs text-gray-300">(required)</span>
                </label>
                <input
                  type="text"
                  data-delete-confirmation
                  placeholder="DELETE"
                  class="w-full px-4 py-3 bg-black border border-red-600 rounded-lg text-red-400 placeholder-red-700 focus:outline-none focus:border-red-400 transition-colors"
                  ${this.state.isDeleting ? 'disabled' : ''}
                />
              </div>
              
              <button
                data-delete-account
                class="w-full px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                ${this.state.isDeleting ? 'disabled' : ''}
              >
                ${this.state.isDeleting ? '⏳ Deleting...' : '🗑️ Delete Account'}
              </button>
            </div>
          </details>
        </div>
      </div>
    `
  }

  /**
   * @brief Render search users tab
   */
  private renderSearchTab(): string {
    const { searchQuery, searchResults, searchCount, isSearching } = this.state
    
    return `
      <div class="space-y-6">
        <!-- Search Bar -->
        <div class="flex gap-2">
          <input
            type="text"
            data-search-input
            value="${searchQuery}"
            placeholder="Search users by username..."
            maxlength="50"
            class="flex-1 px-4 py-3 bg-black border border-green-600 rounded-lg text-green-400 placeholder-green-700 focus:outline-none focus:border-green-400 transition-colors"
            ${isSearching ? 'disabled' : ''}
          />
          <button
            data-search-submit
            class="px-6 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            ${isSearching || searchQuery.length < 1 ? 'disabled' : ''}
          >
            ${isSearching ? '⏳' : '🔍'}
          </button>
        </div>
        
        <!-- Search Results -->
        ${searchResults.length > 0 ? `
          <div class="space-y-2">
            <div class="text-sm text-green-400 mb-3">
              Found ${searchCount} user${searchCount !== 1 ? 's' : ''}
            </div>
            ${searchResults.map(user => `
              <div 
                data-user-id="${user.id}"
                class="bg-gray-900/50 border border-green-600/30 rounded-lg p-4 hover:border-green-600 hover:bg-gray-900/80 transition-colors cursor-pointer"
              >
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 rounded-full border-2 border-green-600 overflow-hidden bg-gray-800 flex items-center justify-center flex-shrink-0">
                    ${user.avatar 
                      ? `<img src="${user.avatar}" alt="${user.username}" class="w-full h-full object-cover" />`
                      : `<span class="text-2xl">👤</span>`
                    }
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="font-bold text-green-300 truncate">${user.username}</div>
                  </div>
                  <div class="text-2xl">
                    ${user.isOnline ? '🟢' : '⚫'}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : searchQuery && !isSearching ? `
          <div class="text-center text-gray-400 py-8">
            No users found matching "${searchQuery}"
          </div>
        ` : !isSearching ? `
          <div class="text-center text-gray-500 py-8">
            💡 Enter a username to search for other players
          </div>
        ` : `
          <div class="text-center text-green-400 py-8 animate-pulse">
            🔍 Searching...
          </div>
        `}
      </div>
    `
  }

  /**
   * @brief Render loading state
   */
  private renderLoading(): string {
    return `
      <div class="text-center py-12">
        <div class="text-6xl mb-4 animate-pulse">👤</div>
        <div class="text-green-400">Loading profile...</div>
      </div>
    `
  }

  /**
   * @brief Render error state
   */
  private renderError(): string {
    return `
      <div class="text-center py-12">
        <div class="text-6xl mb-4">❌</div>
        <div class="text-red-400 mb-4">${this.state.errorMessage}</div>
        <button
          data-retry
          class="px-6 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-colors"
        >
          🔄 Retry
        </button>
      </div>
    `
  }

  /**
   * @brief Render component
   */
  public render(): string {
    const { className = '' } = this.props
    const { isLoading, errorMessage, activeTab } = this.state
    
    let content = ''
    if (isLoading) {
      content = this.renderLoading()
    } else if (errorMessage) {
      content = this.renderError()
    } else {
      content = `
        ${this.renderTabs()}
        ${activeTab === 'view' ? this.renderViewTab() : ''}
        ${activeTab === 'edit' ? this.renderEditTab() : ''}
        ${activeTab === 'search' ? this.renderSearchTab() : ''}
      `
    }
    
    return `
      <div class="min-h-screen bg-black text-green-400 font-mono py-8 px-4 ${className}">
        <div class="max-w-4xl mx-auto">
          <div class="mb-8">
            <h1 class="text-4xl font-bold text-green-400 mb-2">👤 Profile</h1>
            <p class="text-green-500">Manage your account and search for other players</p>
          </div>
          
          <div class="bg-gray-900/30 border border-green-600 rounded-lg p-6">
            ${content}
          </div>
        </div>
      </div>
    `
  }

  /**
   * @brief Mount component and set up event listeners
   */
  public mount(container: HTMLElement): void {
    container.innerHTML = this.render()
    this.element = container.firstElementChild as HTMLElement
    this.mounted = true
    this.afterMount()
  }

  /**
   * @brief After mount lifecycle - set up event listeners
   */
  protected afterMount(): void {
    if (!this.element) {
      return
    }
    this.setupEventListeners(this.element)
    this.initializeFilePond()
    this.restoreFocus()
  }

  /**
   * @brief Save currently focused element before re-render
   */
  private saveFocus(): void {
    const activeElement = document.activeElement as HTMLElement
    if (activeElement && this.element?.contains(activeElement)) {
      // Save data attribute identifier
      this.lastFocusedElement = 
        activeElement.getAttribute('data-edit-username') !== null ? 'data-edit-username' :
        activeElement.getAttribute('data-edit-avatar') !== null ? 'data-edit-avatar' :
        activeElement.getAttribute('data-search-input') !== null ? 'data-search-input' :
        activeElement.getAttribute('data-delete-password') !== null ? 'data-delete-password' :
        activeElement.getAttribute('data-delete-confirmation') !== null ? 'data-delete-confirmation' :
        null
    }
  }

  /**
   * @brief Restore focus after re-render
   */
  private restoreFocus(): void {
    if (this.lastFocusedElement && this.element) {
      const elementToFocus = this.element.querySelector(`[${this.lastFocusedElement}]`) as HTMLElement
      if (elementToFocus) {
        // Restore focus and cursor position
        setTimeout(() => {
          elementToFocus.focus()
          // Restore cursor to end for input elements
          if (elementToFocus instanceof HTMLInputElement) {
            const len = elementToFocus.value.length
            elementToFocus.setSelectionRange(len, len)
          }
        }, 0)
      }
    }
  }

  /**
   * @brief Override setState to save focus before re-render
   */
  protected setState(stateUpdates: Partial<ProfilePageState>): void {
    this.saveFocus()
    super.setState(stateUpdates)
  }

  /**
   * @brief Initialize FilePond for avatar upload
   */
  private initializeFilePond(): void {
    // Only initialize if on edit tab
    if (this.state.activeTab !== 'edit') {
      return
    }

    const inputElement = this.element?.querySelector('[data-filepond-avatar]') as HTMLInputElement
    if (!inputElement) {
      return
    }

    // Destroy existing FilePond instance if any
    if (this.filePond) {
      this.filePond.destroy()
      this.filePond = null
    }

    // Create FilePond instance
    this.filePond = FilePond.create(inputElement, {
      acceptedFileTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      maxFileSize: '5MB',
      imagePreviewHeight: 170,
      imageCropAspectRatio: '1:1',
      imageResizeTargetWidth: 256,
      imageResizeTargetHeight: 256,
      labelIdle: 'Drag & Drop your avatar or <span class="filepond--label-action">Browse</span>',
      
      // Handle file add
      onaddfile: (error: any, file: any) => {
        if (error) {
          console.error('FilePond error:', error)
          showPopup(error.body || 'Failed to add file')
          return
        }
        
        // Store file in state for upload (cast to File type)
        this.handleAvatarChange(file.file as File)
      },
      
      // Handle file remove
      onremovefile: () => {
        this.handleAvatarChange(null)
      }
    } as any) // Use 'as any' to bypass strict type checking for FilePond options
  }

  /**
   * @brief Set up event listeners
   */
  private setupEventListeners(container: HTMLElement): void {
    // Tab navigation
    const tabButtons = container.querySelectorAll('[data-tab]')
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tab = button.getAttribute('data-tab') as 'view' | 'edit' | 'search'
        this.switchTab(tab)
      })
    })
    
    // Edit tab listeners
    const usernameInput = container.querySelector('[data-edit-username]') as HTMLInputElement
    if (usernameInput) {
      usernameInput.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement
        this.handleUsernameChange(target.value)
      })
    }
    
    // Note: Avatar upload is handled by FilePond (see initializeFilePond method)
    
    const saveButton = container.querySelector('[data-save-profile]')
    if (saveButton) {
      saveButton.addEventListener('click', () => {
        this.saveProfile()
      })
    }
    
    // Delete account listeners
    // Delete inputs: Don't store in state to avoid re-renders losing focus
    // Values will be read from DOM when delete button is clicked
    
    const deleteButton = container.querySelector('[data-delete-account]')
    if (deleteButton) {
      deleteButton.addEventListener('click', () => {
        // Read password values from DOM at submission time
        const deletePasswordInput = container.querySelector('[data-delete-password]') as HTMLInputElement
        const deleteConfirmationInput = container.querySelector('[data-delete-confirmation]') as HTMLInputElement
        
        const password = deletePasswordInput?.value || ''
        const confirmation = deleteConfirmationInput?.value || ''
        
        // Update state only when submitting
        this.setState({ deletePassword: password, deleteConfirmation: confirmation })
        this.deleteAccount()
      })
    }
    
    // Search tab listeners
    const searchInput = container.querySelector('[data-search-input]') as HTMLInputElement
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement
        this.handleSearchChange(target.value)
      })
      
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          this.executeSearch()
        }
      })
    }
    
    const searchButton = container.querySelector('[data-search-submit]')
    if (searchButton) {
      searchButton.addEventListener('click', () => {
        this.executeSearch()
      })
    }
    
    // User result click listeners
    const userResults = container.querySelectorAll('[data-user-id]')
    userResults.forEach(result => {
      result.addEventListener('click', () => {
        const userId = result.getAttribute('data-user-id')
        if (userId) {
          this.viewUserProfile(parseInt(userId))
        }
      })
    })
    
    // Retry button
    const retryButton = container.querySelector('[data-retry]')
    if (retryButton) {
      retryButton.addEventListener('click', () => {
        this.loadProfile()
      })
    }
  }

  /**
   * @brief Before unmount lifecycle - clean up timers and FilePond
   */
  protected beforeUnmount(): void {
    if (this.usernameCheckTimeout !== null) {
      clearTimeout(this.usernameCheckTimeout)
      this.usernameCheckTimeout = null
    }
    
    // Destroy FilePond instance
    if (this.filePond) {
      this.filePond.destroy()
      this.filePond = null
    }
  }
}
