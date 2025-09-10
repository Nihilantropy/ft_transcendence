/**
 * @brief ProfilePage component for ft_transcendence
 * 
 * @description User profile page following roadmap Phase 3.1.
 * Simple profile display and management interface.
 * 
 * Phase 3.1 implementation - ProfilePage
 * 
 * FILE: src/pages/profile/ProfilePage.ts
 */

import { Component } from '../../components/base/Component'

/**
 * @brief ProfilePage component properties interface
 */
export interface ProfilePageProps {
  /** User ID to display (optional - defaults to current user) */
  userId?: string
  
  /** Optional custom CSS classes */
  className?: string
}

/**
 * @brief User profile data interface
 */
export interface UserProfile {
  id: string
  username: string
  email: string
  avatar?: string
  stats: {
    gamesPlayed: number
    gamesWon: number
    gamesLost: number
    winRate: number
    ranking: number
    totalScore: number
  }
  achievements: {
    id: string
    name: string
    description: string
    earned: boolean
    dateEarned?: string
  }[]
  recentGames: {
    id: string
    opponent: string
    result: 'win' | 'loss'
    score: string
    date: string
  }[]
}

/**
 * @brief ProfilePage component state interface
 */
export interface ProfilePageState {
  /** Current user profile data */
  profile: UserProfile | null
  
  /** Loading state */
  isLoading: boolean
  
  /** Edit mode state */
  isEditing: boolean
  
  /** Error message if any */
  error?: string
  
  /** Success message if any */
  success?: string
}

/**
 * @brief Main ProfilePage component
 * 
 * @description User profile display and management page.
 * Shows user stats, achievements, recent games, and allows profile editing.
 */
export class ProfilePage extends Component<ProfilePageProps, ProfilePageState> {
  /**
   * @brief Initialize ProfilePage component
   */
  constructor(props: ProfilePageProps = {}) {
    super(props, {
      profile: null,
      isLoading: true,
      isEditing: false
    })
    
    console.log('👤 ProfilePage component created')
  }

  /**
   * @brief Render ProfilePage to HTML string
   */
  render(): string {
    const { className = '' } = this.props
    const { isLoading, error, success, profile } = this.state
    
    const pageClasses = this.getPageClasses(className)
    
    return `
      <div class="${pageClasses}">
        <!-- Header -->
        <header class="flex justify-between items-center p-4 border-b border-green-800">
          <h1 class="text-2xl font-bold text-green-400">👤 User Profile</h1>
          <button id="back-btn" class="px-4 py-2 text-green-400 hover:text-green-300 transition-colors">
            ← Back to Home
          </button>
        </header>

        <!-- Main Content -->
        <main class="flex-1 p-6 max-w-6xl mx-auto">
          ${error ? this.renderError(error) : ''}
          ${success ? this.renderSuccess(success) : ''}
          ${isLoading ? this.renderLoading() : (profile ? this.renderProfile(profile) : this.renderNotFound())}
        </main>
      </div>
    `
  }

  /**
   * @brief Get page CSS classes
   */
  private getPageClasses(className: string): string {
    return [
      'min-h-screen',
      'bg-black',
      'text-green-400',
      'font-mono',
      'flex',
      'flex-col',
      className
    ].filter(Boolean).join(' ')
  }

  /**
   * @brief Render error message
   */
  private renderError(error: string): string {
    return `
      <div class="bg-red-900/20 border border-red-600 rounded-lg p-4 mb-6">
        <div class="flex items-center">
          <span class="text-red-400 mr-2">⚠️</span>
          <span class="text-red-300">${error}</span>
        </div>
      </div>
    `
  }

  /**
   * @brief Render success message
   */
  private renderSuccess(success: string): string {
    return `
      <div class="bg-green-900/20 border border-green-600 rounded-lg p-4 mb-6">
        <div class="flex items-center">
          <span class="text-green-400 mr-2">✅</span>
          <span class="text-green-300">${success}</span>
        </div>
      </div>
    `
  }

  /**
   * @brief Render loading spinner
   */
  private renderLoading(): string {
    return `
      <div class="flex flex-col items-center justify-center h-64">
        <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-green-400 mb-4"></div>
        <p class="text-green-300">Loading profile...</p>
      </div>
    `
  }

  /**
   * @brief Render profile not found
   */
  private renderNotFound(): string {
    return `
      <div class="text-center py-16">
        <div class="text-6xl mb-4">👤</div>
        <h2 class="text-2xl font-bold text-green-300 mb-4">Profile Not Found</h2>
        <p class="text-green-500 mb-8">The requested profile could not be loaded.</p>
        <button id="back-btn" class="px-6 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-colors">
          🏠 Back to Home
        </button>
      </div>
    `
  }

  /**
   * @brief Render complete profile interface
   */
  private renderProfile(profile: UserProfile): string {
    return `
      <div class="grid lg:grid-cols-3 gap-6">
        <!-- Left Column: Profile Info & Stats -->
        <div class="lg:col-span-1 space-y-6">
          ${this.renderProfileInfo(profile)}
          ${this.renderStats(profile.stats)}
        </div>

        <!-- Right Column: Achievements & Recent Games -->
        <div class="lg:col-span-2 space-y-6">
          ${this.renderAchievements(profile.achievements)}
          ${this.renderRecentGames(profile.recentGames)}
        </div>
      </div>
    `
  }

  /**
   * @brief Render profile information section
   */
  private renderProfileInfo(profile: UserProfile): string {
    const { isEditing } = this.state
    
    return `
      <section class="bg-green-900/10 border border-green-800 rounded-lg p-6">
        <div class="flex justify-between items-start mb-4">
          <h2 class="text-xl font-bold text-green-300">Profile Info</h2>
          <button id="edit-profile-btn" class="text-sm px-3 py-1 border border-green-600 hover:bg-green-600 hover:text-black text-green-400 rounded transition-colors">
            ${isEditing ? '💾 Save' : '✏️ Edit'}
          </button>
        </div>

        <!-- Avatar Section -->
        <div class="text-center mb-6">
          <div class="w-24 h-24 bg-green-600 rounded-full mx-auto mb-3 flex items-center justify-center text-3xl">
            ${profile.avatar ? `<img src="${profile.avatar}" class="rounded-full w-full h-full object-cover" alt="Avatar">` : '👤'}
          </div>
          ${isEditing ? '<button id="change-avatar-btn" class="text-sm text-green-400 hover:text-green-300">Change Avatar</button>' : ''}
        </div>

        <!-- Profile Fields -->
        <div class="space-y-4">
          <div>
            <label class="block text-green-300 text-sm mb-1">Username</label>
            ${isEditing ? 
              `<input id="username-input" type="text" value="${profile.username}" class="w-full bg-black border border-green-800 rounded px-3 py-2 text-green-400 focus:border-green-600 focus:outline-none">` :
              `<p class="text-green-400 font-mono">${profile.username}</p>`
            }
          </div>

          <div>
            <label class="block text-green-300 text-sm mb-1">Email</label>
            ${isEditing ? 
              `<input id="email-input" type="email" value="${profile.email}" class="w-full bg-black border border-green-800 rounded px-3 py-2 text-green-400 focus:border-green-600 focus:outline-none">` :
              `<p class="text-green-400 font-mono">${profile.email}</p>`
            }
          </div>

          <div>
            <label class="block text-green-300 text-sm mb-1">User ID</label>
            <p class="text-green-500 text-xs font-mono">${profile.id}</p>
          </div>
        </div>
      </section>
    `
  }

  /**
   * @brief Render user statistics
   */
  private renderStats(stats: UserProfile['stats']): string {
    return `
      <section class="bg-green-900/10 border border-green-800 rounded-lg p-6">
        <h2 class="text-xl font-bold text-green-300 mb-4">📊 Statistics</h2>
        
        <div class="grid grid-cols-2 gap-4">
          <div class="text-center">
            <p class="text-2xl font-bold text-green-400">${stats.gamesPlayed}</p>
            <p class="text-green-500 text-sm">Games Played</p>
          </div>
          
          <div class="text-center">
            <p class="text-2xl font-bold text-green-400">${stats.winRate}%</p>
            <p class="text-green-500 text-sm">Win Rate</p>
          </div>
          
          <div class="text-center">
            <p class="text-2xl font-bold text-green-400">${stats.gamesWon}</p>
            <p class="text-green-500 text-sm">Victories</p>
          </div>
          
          <div class="text-center">
            <p class="text-2xl font-bold text-green-400">#${stats.ranking}</p>
            <p class="text-green-500 text-sm">Ranking</p>
          </div>
        </div>

        <div class="mt-4 pt-4 border-t border-green-800">
          <div class="flex justify-between">
            <span class="text-green-300">Total Score:</span>
            <span class="text-green-400 font-bold">${stats.totalScore.toLocaleString()}</span>
          </div>
        </div>
      </section>
    `
  }

  /**
   * @brief Render achievements section
   */
  private renderAchievements(achievements: UserProfile['achievements']): string {
    const earnedCount = achievements.filter(a => a.earned).length
    
    return `
      <section class="bg-green-900/10 border border-green-800 rounded-lg p-6">
        <h2 class="text-xl font-bold text-green-300 mb-4">🏆 Achievements (${earnedCount}/${achievements.length})</h2>
        
        <div class="grid sm:grid-cols-2 gap-4">
          ${achievements.map(achievement => `
            <div class="flex items-center p-3 rounded-lg ${achievement.earned ? 'bg-green-900/20 border border-green-700' : 'bg-gray-900/20 border border-gray-700'} transition-colors">
              <div class="text-2xl mr-3">${achievement.earned ? '🏆' : '🔒'}</div>
              <div class="flex-1">
                <h3 class="${achievement.earned ? 'text-green-300' : 'text-gray-400'} font-bold text-sm">${achievement.name}</h3>
                <p class="${achievement.earned ? 'text-green-500' : 'text-gray-500'} text-xs">${achievement.description}</p>
                ${achievement.earned && achievement.dateEarned ? `<p class="text-green-600 text-xs mt-1">Earned: ${achievement.dateEarned}</p>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `
  }

  /**
   * @brief Render recent games section
   */
  private renderRecentGames(games: UserProfile['recentGames']): string {
    return `
      <section class="bg-green-900/10 border border-green-800 rounded-lg p-6">
        <h2 class="text-xl font-bold text-green-300 mb-4">🎮 Recent Games</h2>
        
        ${games.length === 0 ? 
          '<p class="text-green-500 text-center py-8">No games played yet. Start your first match!</p>' :
          `<div class="space-y-3">
            ${games.map(game => `
              <div class="flex items-center justify-between p-3 bg-green-900/5 border border-green-800 rounded">
                <div class="flex items-center">
                  <div class="text-xl mr-3">${game.result === 'win' ? '🏆' : '💀'}</div>
                  <div>
                    <p class="text-green-400 font-bold">vs ${game.opponent}</p>
                    <p class="text-green-500 text-sm">${game.date}</p>
                  </div>
                </div>
                <div class="text-right">
                  <p class="${game.result === 'win' ? 'text-green-400' : 'text-red-400'} font-bold">${game.score}</p>
                  <p class="text-xs ${game.result === 'win' ? 'text-green-300' : 'text-red-300'}">${game.result.toUpperCase()}</p>
                </div>
              </div>
            `).join('')}
          </div>`
        }

        <div class="mt-4 text-center">
          <button id="view-all-games-btn" class="px-4 py-2 border border-green-600 hover:bg-green-600 hover:text-black text-green-400 rounded transition-colors">
            📋 View All Games
          </button>
        </div>
      </section>
    `
  }

  /**
   * @brief Setup event handlers after component mount
   */
  public mount(parent: HTMLElement): void {
    super.mount(parent)
    
    // Load profile data
    this.loadProfile()
    
    // Setup event handlers
    this.setupEventHandlers()
    
    console.log('👤 ProfilePage mounted and ready')
  }

  /**
   * @brief Setup all event handlers
   */
  private setupEventHandlers(): void {
    // Navigation
    const backBtn = document.getElementById('back-btn')
    if (backBtn) {
      backBtn.addEventListener('click', () => this.handleBackToHome())
    }

    // Profile editing
    const editBtn = document.getElementById('edit-profile-btn')
    if (editBtn) {
      editBtn.addEventListener('click', () => this.toggleEditMode())
    }

    // Avatar change
    const avatarBtn = document.getElementById('change-avatar-btn')
    if (avatarBtn) {
      avatarBtn.addEventListener('click', () => this.handleChangeAvatar())
    }

    // View all games
    const viewGamesBtn = document.getElementById('view-all-games-btn')
    if (viewGamesBtn) {
      viewGamesBtn.addEventListener('click', () => this.handleViewAllGames())
    }
  }

  /**
   * @brief Load user profile data
   */
  private async loadProfile(): Promise<void> {
    this.setState({ isLoading: true, error: undefined })

    try {
      // Try to get current user from API
      const { userApiService } = await import('../../services/api/UserApiService')
      
      console.log('📡 Fetching user profile from API...')
      const profile = await userApiService.getCurrentUser()
      
      this.setState({ 
        profile, 
        isLoading: false 
      })
      
      console.log('✅ Profile loaded successfully:', profile.username)
      
    } catch (error: any) {
      console.error('❌ Failed to load profile:', error)
      
      // Check error type for appropriate handling
      if (error?.status === 500 || error?.code === 'NETWORK_ERROR') {
        // Backend service unavailable - show error page
        this.showServiceError(error)
        return
      }
      
      // Fallback to mock data for development
      console.log('⚠️ Using mock profile data as fallback')
      const mockProfile: UserProfile = {
        id: 'user_123456',
        username: 'PongMaster',
        email: 'player@example.com',
        stats: {
          gamesPlayed: 42,
          gamesWon: 28,
          gamesLost: 14,
          winRate: 67,
          ranking: 15,
          totalScore: 15420
        },
        achievements: [
          {
            id: 'first_win',
            name: 'First Victory',
            description: 'Win your first game',
            earned: true,
            dateEarned: '2025-09-01'
          },
          {
            id: 'win_streak_5',
            name: 'On Fire',
            description: 'Win 5 games in a row',
            earned: true,
            dateEarned: '2025-09-05'
          },
          {
            id: 'win_streak_10',
            name: 'Unstoppable',
            description: 'Win 10 games in a row',
            earned: false
          },
          {
            id: 'tournament_win',
            name: 'Tournament Champion',
            description: 'Win a tournament',
            earned: false
          }
        ],
        recentGames: [
          {
            id: 'game_1',
            opponent: 'SpeedDemon',
            result: 'win',
            score: '11-7',
            date: '2025-09-09'
          },
          {
            id: 'game_2',
            opponent: 'PaddlePro',
            result: 'loss',
            score: '8-11',
            date: '2025-09-08'
          },
          {
            id: 'game_3',
            opponent: 'QuickReflexes',
            result: 'win',
            score: '11-4',
            date: '2025-09-07'
          }
        ]
      }

      // Simulate API delay for mock data
      await new Promise(resolve => setTimeout(resolve, 500))

      this.setState({ 
        profile: mockProfile, 
        isLoading: false 
      })
      
      console.log('⚠️ Using mock data - API service unavailable')
    }
  }

  /**
   * @brief Show service error page
   */
  private showServiceError(error: any): void {
    const container = this.element?.parentElement || document.getElementById('app')
    if (container) {
      import('../../components/ui/ErrorPage').then(({ showErrorPage }) => {
        const errorType = error?.status >= 500 ? '500' : 'api'
        const errorMessage = error?.message || 'Backend service is currently unavailable'
        showErrorPage(container, errorType, errorMessage, error?.details)
      })
    }
  }

  /**
   * @brief Navigate back to home page
   */
  private async handleBackToHome(): Promise<void> {
    console.log('🏠 Navigating back to home...')
    const { router } = await import('../../router/router')
    router.navigate('/')
  }

  /**
   * @brief Toggle profile edit mode
   */
  private toggleEditMode(): void {
    if (this.state.isEditing) {
      this.saveProfile()
    } else {
      this.setState({ isEditing: true })
    }
  }

  /**
   * @brief Save profile changes
   */
  private async saveProfile(): Promise<void> {
    const usernameInput = document.getElementById('username-input') as HTMLInputElement
    const emailInput = document.getElementById('email-input') as HTMLInputElement

    if (!usernameInput || !emailInput) return

    const newUsername = usernameInput.value.trim()
    const newEmail = emailInput.value.trim()

    if (!newUsername || !newEmail) {
      this.setError('Please fill in all required fields.')
      return
    }

    try {
      // Save profile via API
      console.log('💾 Saving profile:', { username: newUsername, email: newEmail })
      
      if (!this.state.profile) {
        this.setError('Profile not loaded. Please refresh the page.')
        return
      }

      const { userApiService } = await import('../../services/api/UserApiService')
      
      const updatedProfile = await userApiService.updateUserProfile(this.state.profile.id, {
        username: newUsername,
        email: newEmail
      })
      
      // Update local state with API response
      this.setState({
        profile: updatedProfile,
        isEditing: false
      })
      
      this.setSuccess('Profile updated successfully!')
      console.log('✅ Profile saved successfully')
    } catch (error) {
      console.error('Error saving profile:', error)
      this.setError('Failed to save profile changes.')
    }
  }

  /**
   * @brief Handle avatar change
   */
  private handleChangeAvatar(): void {
    console.log('📷 Opening avatar upload...')
    
    // Create file input
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = 'image/*'
    fileInput.style.display = 'none'
    
    fileInput.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        this.uploadAvatar(file)
      }
    })
    
    document.body.appendChild(fileInput)
    fileInput.click()
    document.body.removeChild(fileInput)
  }

  /**
   * @brief Upload avatar file
   */
  private async uploadAvatar(file: File): Promise<void> {
    if (!this.state.profile) {
      this.setError('Profile not loaded. Please refresh the page.')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      this.setError('Avatar file must be smaller than 5MB.')
      return
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      this.setError('Please select a valid image file.')
      return
    }

    try {
      console.log('📤 Uploading avatar...')
      const { userApiService } = await import('../../services/api/UserApiService')
      
      const newAvatarUrl = await userApiService.uploadAvatar(this.state.profile.id, file)
      
      // Update profile with new avatar
      this.setState({
        profile: {
          ...this.state.profile,
          avatar: newAvatarUrl
        }
      })
      
      console.log('✅ Avatar uploaded successfully')
      this.setSuccess('Avatar updated successfully!')
      
    } catch (error: any) {
      console.error('Failed to upload avatar:', error)
      
      if (error?.status === 500 || error?.code === 'NETWORK_ERROR') {
        this.setError('Avatar upload service is currently unavailable. Please try again later.')
      } else {
        this.setError('Failed to upload avatar. Please try again.')
      }
    }
  }

  /**
   * @brief Handle view all games
   */
  private async handleViewAllGames(): Promise<void> {
    console.log('📋 Loading full game history...')
    
    try {
      const { userApiService } = await import('../../services/api/UserApiService')
      
      if (!this.state.profile) {
        this.setError('Please reload the page to view game history.')
        return
      }
      
      // Get expanded game history from API
      const gameHistory = await userApiService.getUserGameHistory(this.state.profile.id, 1, 50)
      
      // Create and show games modal
      this.showGamesModal(gameHistory)
      
    } catch (error: any) {
      console.error('Failed to load game history:', error)
      
      if (error?.status === 500 || error?.code === 'NETWORK_ERROR') {
        this.setError('Game history service is currently unavailable. Please try again later.')
      } else {
        // Show expanded view with current data
        this.showGamesModal(this.state.profile?.recentGames || [])
      }
    }
  }

  /**
   * @brief Show games history modal
   */
  private showGamesModal(games: any[]): void {
    const modalHtml = `
      <div class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" id="games-modal">
        <div class="bg-gray-900 border border-green-600 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden mx-4">
          <div class="p-6 border-b border-green-600 flex justify-between items-center">
            <h2 class="text-2xl font-bold text-green-400">📋 Game History</h2>
            <button id="close-modal" class="text-green-400 hover:text-green-300 text-2xl">&times;</button>
          </div>
          <div class="p-6 overflow-y-auto max-h-[60vh]">
            ${games.length === 0 ? `
              <div class="text-center text-green-500 py-8">
                <div class="text-4xl mb-4">🎮</div>
                <p>No games played yet. Start your first match!</p>
              </div>
            ` : `
              <div class="space-y-3">
                ${games.map((game, index) => `
                  <div class="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-green-600 transition-colors">
                    <div class="flex justify-between items-center">
                      <div class="flex items-center space-x-4">
                        <div class="text-2xl">${game.result === 'win' ? '🏆' : '💥'}</div>
                        <div>
                          <div class="font-bold text-green-400">vs ${game.opponent}</div>
                          <div class="text-sm text-gray-400">Game #${index + 1}</div>
                        </div>
                      </div>
                      <div class="text-right">
                        <div class="font-mono text-lg ${game.result === 'win' ? 'text-green-400' : 'text-red-400'}">
                          ${game.score}
                        </div>
                        <div class="text-sm text-gray-400">${game.date}</div>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
          <div class="p-6 border-t border-green-600 text-center">
            <button id="close-modal-btn" class="px-6 py-2 bg-green-600 hover:bg-green-500 text-black font-bold rounded transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    `

    // Add modal to document
    document.body.insertAdjacentHTML('beforeend', modalHtml)

    // Setup modal event handlers
    const modal = document.getElementById('games-modal')
    const closeBtn = document.getElementById('close-modal')
    const closeBtnBottom = document.getElementById('close-modal-btn')

    const closeModal = () => {
      modal?.remove()
    }

    closeBtn?.addEventListener('click', closeModal)
    closeBtnBottom?.addEventListener('click', closeModal)
    
    // Close on backdrop click
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeModal()
    })

    // Close on Escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal()
        document.removeEventListener('keydown', handleEscape)
      }
    }
    document.addEventListener('keydown', handleEscape)
  }

  /**
   * @brief Set error message
   */
  private setError(error: string): void {
    this.setState({ error })
    setTimeout(() => {
      this.setState({ error: undefined })
    }, 5000)
  }



  /**
   * @brief Set success message
   */
  private setSuccess(success: string): void {
    this.setState({ success })
    setTimeout(() => {
      this.setState({ success: undefined })
    }, 5000)
  }
}
