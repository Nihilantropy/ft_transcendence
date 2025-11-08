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
    const { className = '' } = this.props;
    const { isAuthenticated, isLoading } = this.state;

    const pageClasses = this.getPageClasses(className);

    return `
      <div class="${pageClasses}">
        <!-- Animated Background -->
        <div class="fixed inset-0 pointer-events-none opacity-10">
          <div class="absolute inset-0 bg-gradient-to-br from-green-900 via-black to-green-900"></div>
        </div>

        <!-- Main Content Container -->
        <div class="relative z-10">
          <!-- Header Section -->
          <header class="text-center pt-20 pb-16 px-4">
            <!-- Logo/Title with Neon Effect -->
            <div class="mb-8">
              <div class="text-8xl mb-4 animate-pulse">🏓</div>
              <h1 class="text-7xl font-bold text-green-400 mb-4 tracking-wider neon-glow">
                ft_transcendence
              </h1>
              <div class="h-1 w-32 mx-auto bg-gradient-to-r from-transparent via-green-400 to-transparent"></div>
            </div>

            <!-- Tagline -->
            <p class="text-2xl text-green-300 mb-12 max-w-3xl mx-auto font-light tracking-wide">
              The Ultimate Pong Experience
            </p>
            <p class="text-lg text-green-500 mb-12 max-w-2xl mx-auto">
              Challenge players worldwide. Compete in tournaments. Become a legend.
            </p>

            <!-- Action Buttons -->
            ${this.renderActionButtons(isAuthenticated, isLoading)}
          </header>

          <!-- Feature Grid -->
          <main class="max-w-6xl mx-auto px-4 py-16">
            <div class="grid md:grid-cols-3 gap-8 mb-16">
              ${this.renderFeatureCards()}
            </div>

            <!-- Quick Stats (if authenticated) -->
            ${isAuthenticated ? this.renderQuickStats() : ''}
          </main>

          <!-- Footer -->
          <footer class="text-center py-8 text-green-600 border-t border-green-900/30">
            <div class="flex items-center justify-center space-x-2 mb-2">
              <span class="text-green-400">⚡</span>
              <p>&copy; 2025 ft_transcendence</p>
              <span class="text-green-400">⚡</span>
            </div>
            <p class="text-sm text-green-700">Powered by 42 School</p>
          </footer>
        </div>
      </div>
    `;
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
          <div class="relative">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400"></div>
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="text-2xl">🏓</div>
            </div>
          </div>
        </div>
      `;
    }

    if (isAuthenticated) {
      return `
        <div class="flex flex-col sm:flex-row gap-6 justify-center items-center">
          <button
            id="play-now-btn"
            class="group relative px-12 py-5 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg
                   transition-all duration-300 transform hover:scale-105 neon-border shadow-xl
                   hover:shadow-green-500/50 text-lg"
          >
            <span class="flex items-center space-x-3">
              <span class="text-2xl group-hover:animate-bounce">🎮</span>
              <span>PLAY NOW</span>
            </span>
          </button>

          <button
            id="view-profile-btn"
            class="px-10 py-5 border-2 border-green-600 hover:bg-green-600/20 text-green-400
                   font-bold rounded-lg transition-all duration-300 transform hover:scale-105 text-lg"
          >
            <span class="flex items-center space-x-3">
              <span class="text-2xl">👤</span>
              <span>MY PROFILE</span>
            </span>
          </button>

          <button
            id="friends-btn"
            class="px-10 py-5 border-2 border-green-600 hover:bg-green-600/20 text-green-400
                   font-bold rounded-lg transition-all duration-300 transform hover:scale-105 text-lg"
          >
            <span class="flex items-center space-x-3">
              <span class="text-2xl">👥</span>
              <span>FRIENDS</span>
            </span>
          </button>
        </div>
      `;
    }

    return `
      <div class="flex flex-col sm:flex-row gap-6 justify-center items-center">
        <button
          id="get-started-btn"
          class="group relative px-12 py-5 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg
                 transition-all duration-300 transform hover:scale-105 neon-border shadow-xl
                 hover:shadow-green-500/50 text-lg"
        >
          <span class="flex items-center space-x-3">
            <span class="text-2xl group-hover:animate-bounce">🚀</span>
            <span>GET STARTED</span>
          </span>
        </button>

        <button
          id="login-btn"
          class="px-10 py-5 border-2 border-green-600 hover:bg-green-600/20 text-green-400
                 font-bold rounded-lg transition-all duration-300 transform hover:scale-105 text-lg"
        >
          <span class="flex items-center space-x-3">
            <span class="text-2xl">🔓</span>
            <span>LOGIN</span>
          </span>
        </button>
      </div>
    `;
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
        icon: '🎮',
        title: 'Real-Time Multiplayer',
        description: 'Play against friends or random opponents in lightning-fast matches.',
        gradient: 'from-green-600/20 to-green-900/20'
      },
      {
        icon: '🏆',
        title: 'Tournament Mode',
        description: 'Compete in tournaments and climb the global leaderboards.',
        gradient: 'from-yellow-600/20 to-yellow-900/20'
      },
      {
        icon: '👥',
        title: 'Social Features',
        description: 'Connect with friends, track stats, and build your gaming profile.',
        gradient: 'from-blue-600/20 to-blue-900/20'
      }
    ];

    return features.map(feature => `
      <div class="group relative p-8 border border-green-800/50 rounded-xl
                  hover:border-green-600 transition-all duration-300
                  bg-gradient-to-br ${feature.gradient} backdrop-blur-sm
                  transform hover:scale-105 hover:shadow-xl hover:shadow-green-500/20">
        <div class="text-6xl mb-6 transform group-hover:scale-110 transition-transform duration-300">
          ${feature.icon}
        </div>
        <h3 class="text-2xl font-bold text-green-300 mb-4">${feature.title}</h3>
        <p class="text-green-500 leading-relaxed">${feature.description}</p>

        <!-- Decorative corner accent -->
        <div class="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-green-600/30 rounded-tr-xl"></div>
        <div class="absolute bottom-0 left-0 w-16 h-16 border-b-2 border-l-2 border-green-600/30 rounded-bl-xl"></div>
      </div>
    `).join('');
  }

  /**
   * @brief Render quick stats for authenticated users
   */
  private renderQuickStats(): string {
    return `
      <div class="mt-16 pt-16 border-t border-green-900/30">
        <h2 class="text-3xl font-bold text-green-400 text-center mb-8 neon-glow">
          Your Stats
        </h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
          <div class="text-center p-6 bg-green-900/10 border border-green-800/50 rounded-lg">
            <div class="text-4xl font-bold text-green-400 mb-2">--</div>
            <div class="text-sm text-green-600">Matches Played</div>
          </div>
          <div class="text-center p-6 bg-green-900/10 border border-green-800/50 rounded-lg">
            <div class="text-4xl font-bold text-green-400 mb-2">--</div>
            <div class="text-sm text-green-600">Win Rate</div>
          </div>
          <div class="text-center p-6 bg-green-900/10 border border-green-800/50 rounded-lg">
            <div class="text-4xl font-bold text-green-400 mb-2">--</div>
            <div class="text-sm text-green-600">Rank</div>
          </div>
          <div class="text-center p-6 bg-green-900/10 border border-green-800/50 rounded-lg">
            <div class="text-4xl font-bold text-green-400 mb-2">--</div>
            <div class="text-sm text-green-600">Friends</div>
          </div>
        </div>
      </div>
    `;
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
    const friendsButton = document.getElementById('friends-btn')
    const getStartedButton = document.getElementById('get-started-btn')
    const loginButton = document.getElementById('login-btn')

    if (playButton) {
      playButton.addEventListener('click', () => this.handlePlayNow())
    }

    if (profileButton) {
      profileButton.addEventListener('click', () => this.handleViewProfile())
    }

    if (friendsButton) {
      friendsButton.addEventListener('click', () => this.handleViewFriends())
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
   * @brief Handle view friends button click
   */
  private async handleViewFriends(): Promise<void> {
    console.log('👥 Navigating to friends...')
    const { router } = await import('../../router/router')
    router.navigate('/friends')
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
