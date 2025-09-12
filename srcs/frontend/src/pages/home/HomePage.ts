/**
 * @brief HomePage component for ft_transcendence
 * 
 * @description Landing page component following roadmap Phase 3.1.
 * Simple, clean design focusing on core functionality.
 * 
 * Phase 3.1 implementation - HomePage
 * 
 * FILE: src/pages/home/HomePage.ts
 */

import { Component } from '../../components/base/Component'

/**
 * @brief HomePage component properties interface
 * 
 * @description Type-safe props for HomePage component.
 */
export interface HomePageProps {
  /** Optional custom CSS classes */
  className?: string
}

/**
 * @brief HomePage component state interface
 * 
 * @description Internal state for HomePage component.
 */
export interface HomePageState {
  /** Whether user is authenticated */
  isAuthenticated: boolean
  
  /** Loading state */
  isLoading: boolean
}

/**
 * @brief Main HomePage component
 * 
 * @description Landing page for ft_transcendence with gaming theme.
 * Simple layout with navigation to game and profile sections.
 */
export class HomePage extends Component<HomePageProps, HomePageState> {
  /**
   * @brief Initialize HomePage component
   * 
   * @param props - HomePage configuration properties
   * 
   * @description Creates HomePage instance with initial state.
   */
  constructor(props: HomePageProps = {}) {
    super(props, {
      isAuthenticated: false,
      isLoading: false
    })
    
    console.log('🏠 HomePage component created')
  }

  /**
   * @brief Render HomePage to HTML string
   * 
   * @return HTML string representation of HomePage
   * 
   * @description Generates clean landing page HTML with gaming theme.
   */
  render(): string {
    const { className = '' } = this.props
    const { isAuthenticated, isLoading } = this.state
    
    const pageClasses = this.getPageClasses(className)
    
    return `
      <div class="${pageClasses}">
        <!-- Header Section -->
        <header class="text-center py-16 px-4">
          <h1 class="text-6xl font-bold text-green-400 mb-6 neon-glow">
            ft_transcendence
          </h1>
          <p class="text-xl text-green-300 mb-8 max-w-2xl mx-auto">
            Experience the ultimate Pong tournament. 
            Challenge players worldwide in this legendary arcade game.
          </p>
          ${this.renderActionButtons(isAuthenticated, isLoading)}
          

        <!-- Features Section -->
        <main class="max-w-6xl mx-auto px-4 py-16">
          <div class="grid md:grid-cols-3 gap-8">
            ${this.renderFeatureCards()}
          </div>
        </main>

        <!-- Footer -->
        <footer class="text-center py-8 text-green-600 border-t border-green-800">
          <p>&copy; 2025 ft_transcendence - The Ultimate Pong Experience</p>
        </footer>
      </div>
    `
  }

  /**
   * @brief Get page CSS classes
   * 
   * @param className - Additional custom classes
   * @return Complete CSS classes string
   * 
   * @description Returns page classes with gaming theme.
   */
  private getPageClasses(className: string): string {
    return [
      'min-h-screen',
      'bg-black',
      'text-green-400',
      'font-mono',
      className
    ].filter(Boolean).join(' ')
  }

  /**
   * @brief Render action buttons based on auth state
   * 
   * @param isAuthenticated - Whether user is logged in
   * @param isLoading - Whether in loading state
   * @return Action buttons HTML
   * 
   * @description Shows appropriate buttons based on authentication state.
   */
  private renderActionButtons(isAuthenticated: boolean, isLoading: boolean): string {
    if (isLoading) {
      return `
        <div class="flex justify-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400"></div>
        </div>
      `
    }

    if (isAuthenticated) {
      return `
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <button 
            id="play-now-btn"
            class="px-8 py-4 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-colors neon-border"
          >
            🎮 PLAY NOW
          </button>
          <button 
            id="view-profile-btn"
            class="px-8 py-4 border-2 border-green-600 hover:bg-green-600 hover:text-black text-green-400 font-bold rounded-lg transition-colors"
          >
            👤 MY PROFILE
          </button>
        </div>
      `
    }

    return `
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <button 
          id="get-started-btn"
          class="px-8 py-4 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-colors neon-border"
        >
          🚀 GET STARTED
        </button>
        <button 
          id="login-btn"
          class="px-8 py-4 border-2 border-green-600 hover:bg-green-600 hover:text-black text-green-400 font-bold rounded-lg transition-colors"
        >
          🔓 LOGIN
        </button>
      </div>
    `
  }

  /**
   * @brief Render feature cards
   * 
   * @return Feature cards HTML
   * 
   * @description Shows key features of the game.
   */
  private renderFeatureCards(): string {
    const features = [
      {
        icon: '⚡',
        title: 'Real-time Gameplay',
        description: 'Experience lightning-fast Pong matches with real-time multiplayer action.'
      },
      {
        icon: '🏆',
        title: 'Tournament Mode',
        description: 'Compete in tournaments and climb the leaderboards to become champion.'
      },
      {
        icon: '👥',
        title: 'Social Features',
        description: 'Connect with friends, track stats, and build your gaming profile.'
      }
    ]

    return features.map(feature => `
      <div class="p-6 border border-green-800 rounded-lg hover:border-green-600 transition-colors">
        <div class="text-4xl mb-4">${feature.icon}</div>
        <h3 class="text-xl font-bold text-green-300 mb-3">${feature.title}</h3>
        <p class="text-green-500">${feature.description}</p>
      </div>
    `).join('')
  }

  /**
   * @brief Setup event handlers after component mount
   * 
   * @param parent - Parent DOM element to mount to
   * 
   * @description Attaches click handlers to navigation buttons.
   */
  public mount(parent: HTMLElement): void {
    super.mount(parent)
    
    // Setup navigation handlers
    this.setupNavigationHandlers()
    
    console.log('🏠 HomePage mounted and ready')
  }

  /**
   * @brief Setup navigation event handlers
   * 
   * @description Attaches click events to navigation buttons.
   */
  private setupNavigationHandlers(): void {
    const playButton = document.getElementById('play-now-btn')
    const profileButton = document.getElementById('view-profile-btn')
    const getStartedButton = document.getElementById('get-started-btn')
    const loginButton = document.getElementById('login-btn')

    if (playButton) {
      playButton.addEventListener('click', () => this.handlePlayNow())
    }

    if (profileButton) {
      profileButton.addEventListener('click', () => this.handleViewProfile())
    }

    if (getStartedButton) {
      getStartedButton.addEventListener('click', () => this.handleGetStarted())
    }

    if (loginButton) {
      loginButton.addEventListener('click', () => this.handleLogin())
    }
  }

  /**
   * @brief Handle play now button click
   */
  private async handlePlayNow(): Promise<void> {
    console.log('🎮 Navigating to game...')
    const { router } = await import('../../router/router')
    router.navigate('/game')
  }

  /**
   * @brief Handle view profile button click
   */
  private async handleViewProfile(): Promise<void> {
    console.log('👤 Navigating to profile...')
    const { router } = await import('../../router/router')
    router.navigate('/profile')
  }

  /**
   * @brief Handle get started button click
   */
  private handleGetStarted(): void {
    console.log('🚀 Getting started...')
    // TODO: Show registration/onboarding flow
    this.handleLogin() // For now, redirect to login
  }

  /**
   * @brief Handle login button click
   */
  private async handleLogin(): Promise<void> {
    console.log('🔓 Navigating to login...')
    // TODO: Implement proper login flow with auth system
    const { router } = await import('../../router/router')
    router.navigate('/login')
  }

  /**
   * @brief Update authentication state
   * 
   * @param isAuthenticated - New authentication state
   * 
   * @description Updates component state and re-renders if needed.
   */
  public setAuthState(isAuthenticated: boolean): void {
    this.setState({ isAuthenticated })
  }

  /**
   * @brief Set loading state
   * 
   * @param isLoading - New loading state
   * 
   * @description Updates loading state for user feedback.
   */
  public setLoading(isLoading: boolean): void {
    this.setState({ isLoading })
  }
}
