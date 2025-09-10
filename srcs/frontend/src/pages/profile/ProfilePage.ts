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
      // TODO: Replace with actual API call
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

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000))

      this.setState({ 
        profile: mockProfile, 
        isLoading: false 
      })

    } catch (error) {
      console.error('Error loading profile:', error)
      this.setState({ 
        error: 'Failed to load profile data. Please try again.',
        isLoading: false 
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
      // TODO: API call to save profile
      console.log('💾 Saving profile:', { username: newUsername, email: newEmail })
      
      // Update local state
      if (this.state.profile) {
        this.setState({
          profile: {
            ...this.state.profile,
            username: newUsername,
            email: newEmail
          },
          isEditing: false
        })
        
        this.setSuccess('Profile updated successfully!')
      }
    } catch (error) {
      console.error('Error saving profile:', error)
      this.setError('Failed to save profile changes.')
    }
  }

  /**
   * @brief Handle avatar change
   */
  private handleChangeAvatar(): void {
    console.log('📷 Changing avatar...')
    // TODO: Implement avatar upload functionality
    this.setError('Avatar upload coming soon!')
  }

  /**
   * @brief Handle view all games
   */
  private handleViewAllGames(): void {
    console.log('📋 Viewing all games...')
    // TODO: Navigate to games history page
    this.setError('Game history page coming soon!')
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
