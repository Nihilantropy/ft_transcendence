/**
 * @brief GamePage component for ft_transcendence
 * 
 * @description Main game lobby/interface page following roadmap Phase 3.1.
 * Simple layout focusing on game setup and play interface.
 * 
 * Phase 3.1 implementation - GamePage
 * 
 * FILE: src/pages/game/GamePage.ts
 */

import { Component } from '../../components/base/Component'

/**
 * @brief GamePage component properties interface
 */
export interface GamePageProps {
  /** Game mode: 'lobby' | 'playing' | 'waiting' */
  mode?: 'lobby' | 'playing' | 'waiting'
  
  /** Optional game ID if joining specific game */
  gameId?: string
  
  /** Optional custom CSS classes */
  className?: string
}

/**
 * @brief GamePage component state interface
 */
export interface GamePageState {
  /** Current game state */
  gameState: 'lobby' | 'waiting' | 'playing' | 'finished'
  
  /** Player information */
  player: {
    name: string
    ready: boolean
  }
  
  /** Opponent information (if available) */
  opponent?: {
    name: string
    ready: boolean
  }
  
  /** Game settings */
  gameSettings: {
    difficulty: 'easy' | 'medium' | 'hard'
    gameMode: 'classic' | 'tournament'
  }
  
  /** Loading state */
  isLoading: boolean
  
  /** Error message if any */
  error?: string
}

/**
 * @brief Main GamePage component
 * 
 * @description Game lobby and interface page for Pong gameplay.
 * Handles game setup, matchmaking, and game interface preparation.
 */
export class GamePage extends Component<GamePageProps, GamePageState> {
  /**
   * @brief Initialize GamePage component
   */
  constructor(props: GamePageProps = {}) {
    super(props, {
      gameState: 'lobby',
      player: {
        name: 'Player 1', // TODO: Get from auth store
        ready: false
      },
      gameSettings: {
        difficulty: 'medium',
        gameMode: 'classic'
      },
      isLoading: false
    })
    
    console.log('🎮 GamePage component created')
  }

  /**
   * @brief Render GamePage to HTML string
   */
  render(): string {
    const { className = '' } = this.props
    const { gameState, isLoading, error } = this.state
    
    const pageClasses = this.getPageClasses(className)
    
    return `
      <div class="${pageClasses}">
        <!-- Header -->
        <header class="flex justify-between items-center p-4 border-b border-green-800">
          <h1 class="text-2xl font-bold text-green-400">🏓 Pong Arena</h1>
          <button id="back-btn" class="px-4 py-2 text-green-400 hover:text-green-300 transition-colors">
            ← Back to Home
          </button>
        </header>

        <!-- Main Content -->
        <main class="flex-1 p-6">
          ${error ? this.renderError(error) : ''}
          ${isLoading ? this.renderLoading() : this.renderGameContent(gameState)}
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
   * @brief Render loading spinner
   */
  private renderLoading(): string {
    return `
      <div class="flex flex-col items-center justify-center h-64">
        <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-green-400 mb-4"></div>
        <p class="text-green-300">Loading game...</p>
      </div>
    `
  }

  /**
   * @brief Render game content based on state
   */
  private renderGameContent(gameState: string): string {
    switch (gameState) {
      case 'lobby':
        return this.renderLobby()
      case 'waiting':
        return this.renderWaiting()
      case 'playing':
        return this.renderPlaying()
      case 'finished':
        return this.renderFinished()
      default:
        return this.renderLobby()
    }
  }

  /**
   * @brief Render game lobby interface
   */
  private renderLobby(): string {
    const { player, gameSettings } = this.state
    
    return `
      <div class="max-w-4xl mx-auto">
        <!-- Player Info Section -->
        <section class="mb-8">
          <h2 class="text-xl font-bold text-green-300 mb-4">👤 Player Setup</h2>
          <div class="bg-green-900/10 border border-green-800 rounded-lg p-6">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-green-300">Player: <span class="text-green-400 font-bold">${player.name}</span></p>
                <p class="text-green-500 text-sm">Status: ${player.ready ? '✅ Ready' : '⏳ Not Ready'}</p>
              </div>
              <button id="toggle-ready-btn" class="px-6 py-3 ${player.ready ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'} text-black font-bold rounded-lg transition-colors">
                ${player.ready ? '❌ Not Ready' : '✅ Ready Up'}
              </button>
            </div>
          </div>
        </section>

        <!-- Game Settings Section -->
        <section class="mb-8">
          <h2 class="text-xl font-bold text-green-300 mb-4">⚙️ Game Settings</h2>
          <div class="grid md:grid-cols-2 gap-6">
            ${this.renderGameSettings(gameSettings)}
          </div>
        </section>

        <!-- Game Actions -->
        <section class="text-center">
          <div class="flex flex-col sm:flex-row gap-4 justify-center">
            <button id="quick-match-btn" class="px-8 py-4 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-colors neon-border">
              ⚡ Quick Match
            </button>
            <button id="create-room-btn" class="px-8 py-4 border-2 border-green-600 hover:bg-green-600 hover:text-black text-green-400 font-bold rounded-lg transition-colors">
              🏠 Create Room
            </button>
            <button id="join-room-btn" class="px-8 py-4 border-2 border-green-600 hover:bg-green-600 hover:text-black text-green-400 font-bold rounded-lg transition-colors">
              🚪 Join Room
            </button>
          </div>
        </section>
      </div>
    `
  }

  /**
   * @brief Render game settings controls
   */
  private renderGameSettings(settings: GamePageState['gameSettings']): string {
    return `
      <!-- Difficulty Setting -->
      <div class="bg-green-900/10 border border-green-800 rounded-lg p-4">
        <h3 class="text-green-300 font-bold mb-3">🎯 Difficulty</h3>
        <div class="space-y-2">
          ${['easy', 'medium', 'hard'].map(level => `
            <label class="flex items-center cursor-pointer">
              <input type="radio" name="difficulty" value="${level}" ${settings.difficulty === level ? 'checked' : ''} class="mr-2">
              <span class="text-green-400 capitalize">${level}</span>
            </label>
          `).join('')}
        </div>
      </div>

      <!-- Game Mode Setting -->
      <div class="bg-green-900/10 border border-green-800 rounded-lg p-4">
        <h3 class="text-green-300 font-bold mb-3">🏆 Game Mode</h3>
        <div class="space-y-2">
          ${['classic', 'tournament'].map(mode => `
            <label class="flex items-center cursor-pointer">
              <input type="radio" name="gameMode" value="${mode}" ${settings.gameMode === mode ? 'checked' : ''} class="mr-2">
              <span class="text-green-400 capitalize">${mode}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `
  }

  /**
   * @brief Render waiting for opponent state
   */
  private renderWaiting(): string {
    return `
      <div class="text-center max-w-2xl mx-auto">
        <div class="mb-8">
          <div class="animate-pulse text-6xl mb-4">⏳</div>
          <h2 class="text-2xl font-bold text-green-300 mb-4">Waiting for Opponent</h2>
          <p class="text-green-500">Searching for a worthy challenger...</p>
        </div>
        
        <div class="bg-green-900/10 border border-green-800 rounded-lg p-6 mb-6">
          <div class="flex items-center justify-between">
            <div class="text-left">
              <p class="text-green-400 font-bold">${this.state.player.name}</p>
              <p class="text-green-300 text-sm">✅ Ready</p>
            </div>
            <div class="text-2xl">VS</div>
            <div class="text-right">
              <p class="text-green-500">Searching...</p>
              <p class="text-green-600 text-sm">⏳ Waiting</p>
            </div>
          </div>
        </div>

        <button id="cancel-search-btn" class="px-6 py-3 border-2 border-red-600 hover:bg-red-600 hover:text-black text-red-400 font-bold rounded-lg transition-colors">
          ❌ Cancel Search
        </button>
      </div>
    `
  }

  /**
   * @brief Render playing state (game interface placeholder)
   */
  private renderPlaying(): string {
    return `
      <div class="text-center">
        <h2 class="text-3xl font-bold text-green-300 mb-8">🏓 GAME IN PROGRESS</h2>
        
        <!-- Game Canvas Placeholder -->
        <div class="bg-black border-2 border-green-600 rounded-lg mx-auto mb-6" style="width: 800px; height: 400px; max-width: 100%;">
          <div class="flex items-center justify-center h-full">
            <p class="text-green-500 text-xl">Game Canvas Will Load Here</p>
          </div>
        </div>

        <!-- Score Display -->
        <div class="flex justify-center mb-6">
          <div class="bg-green-900/20 border border-green-600 rounded-lg p-4 mx-4">
            <p class="text-green-300">${this.state.player.name}</p>
            <p class="text-3xl font-bold text-green-400">0</p>
          </div>
          <div class="bg-green-900/20 border border-green-600 rounded-lg p-4 mx-4">
            <p class="text-green-300">${this.state.opponent?.name || 'Opponent'}</p>
            <p class="text-3xl font-bold text-green-400">0</p>
          </div>
        </div>

        <!-- Controls Info -->
        <div class="text-green-500">
          <p>Use ↑ and ↓ arrow keys to control your paddle</p>
        </div>
      </div>
    `
  }

  /**
   * @brief Render game finished state
   */
  private renderFinished(): string {
    return `
      <div class="text-center max-w-2xl mx-auto">
        <div class="text-6xl mb-4">🏆</div>
        <h2 class="text-3xl font-bold text-green-300 mb-6">Game Finished!</h2>
        
        <div class="bg-green-900/20 border border-green-600 rounded-lg p-6 mb-8">
          <p class="text-xl text-green-400 mb-2">Victory!</p>
          <p class="text-green-300">Great game! Ready for another round?</p>
        </div>

        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <button id="play-again-btn" class="px-8 py-4 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-colors">
            🔄 Play Again
          </button>
          <button id="back-to-lobby-btn" class="px-8 py-4 border-2 border-green-600 hover:bg-green-600 hover:text-black text-green-400 font-bold rounded-lg transition-colors">
            🏠 Back to Lobby
          </button>
        </div>
      </div>
    `
  }

  /**
   * @brief Setup event handlers after component mount
   */
  public mount(parent: HTMLElement): void {
    super.mount(parent)
    
    this.setupEventHandlers()
    
    console.log('🎮 GamePage mounted and ready')
  }

  /**
   * @brief Setup all event handlers
   */
  private setupEventHandlers(): void {
    // Navigation handlers
    const backBtn = document.getElementById('back-btn')
    if (backBtn) {
      backBtn.addEventListener('click', () => this.handleBackToHome())
    }

    // Lobby handlers
    const readyBtn = document.getElementById('toggle-ready-btn')
    const quickMatchBtn = document.getElementById('quick-match-btn')
    const createRoomBtn = document.getElementById('create-room-btn')
    const joinRoomBtn = document.getElementById('join-room-btn')

    if (readyBtn) readyBtn.addEventListener('click', () => this.toggleReady())
    if (quickMatchBtn) quickMatchBtn.addEventListener('click', () => this.startQuickMatch())
    if (createRoomBtn) createRoomBtn.addEventListener('click', () => this.createRoom())
    if (joinRoomBtn) joinRoomBtn.addEventListener('click', () => this.joinRoom())

    // Game settings handlers
    const difficultyInputs = document.querySelectorAll('input[name="difficulty"]')
    const gameModeInputs = document.querySelectorAll('input[name="gameMode"]')

    difficultyInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement
        this.updateGameSettings({ difficulty: target.value as any })
      })
    })

    gameModeInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement
        this.updateGameSettings({ gameMode: target.value as any })
      })
    })

    // Waiting state handlers
    const cancelBtn = document.getElementById('cancel-search-btn')
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.cancelSearch())
    }

    // Finished state handlers
    const playAgainBtn = document.getElementById('play-again-btn')
    const backToLobbyBtn = document.getElementById('back-to-lobby-btn')

    if (playAgainBtn) playAgainBtn.addEventListener('click', () => this.playAgain())
    if (backToLobbyBtn) backToLobbyBtn.addEventListener('click', () => this.backToLobby())
  }

  /**
   * @brief Navigate back to home page
   */
  private handleBackToHome(): void {
    console.log('🏠 Navigating back to home...')
    // TODO: Use router to navigate to /
    window.location.href = '/'
  }

  /**
   * @brief Toggle player ready state
   */
  private toggleReady(): void {
    const newReadyState = !this.state.player.ready
    this.setState({
      player: { ...this.state.player, ready: newReadyState }
    })
    console.log(`Player ready state: ${newReadyState}`)
  }

  /**
   * @brief Start quick match
   */
  private startQuickMatch(): void {
    if (!this.state.player.ready) {
      this.setError('Please ready up before starting a match!')
      return
    }

    console.log('⚡ Starting quick match...')
    this.setState({ gameState: 'waiting', isLoading: true, error: undefined })
    
    // Simulate matchmaking delay
    setTimeout(() => {
      this.setState({ 
        isLoading: false,
        opponent: { name: 'Random Player', ready: true }
      })
    }, 2000)
  }

  /**
   * @brief Create game room
   */
  private createRoom(): void {
    console.log('🏠 Creating game room...')
    // TODO: Implement room creation
    this.setError('Room creation coming soon!')
  }

  /**
   * @brief Join game room
   */
  private joinRoom(): void {
    console.log('🚪 Joining game room...')
    // TODO: Implement room joining
    this.setError('Room joining coming soon!')
  }

  /**
   * @brief Update game settings
   */
  private updateGameSettings(updates: Partial<GamePageState['gameSettings']>): void {
    this.setState({
      gameSettings: { ...this.state.gameSettings, ...updates }
    })
  }

  /**
   * @brief Cancel matchmaking search
   */
  private cancelSearch(): void {
    console.log('❌ Cancelling search...')
    this.setState({ gameState: 'lobby', opponent: undefined })
  }

  /**
   * @brief Play another game
   */
  private playAgain(): void {
    console.log('🔄 Starting new game...')
    this.setState({ gameState: 'lobby' })
  }

  /**
   * @brief Return to lobby
   */
  private backToLobby(): void {
    console.log('🏠 Returning to lobby...')
    this.setState({ gameState: 'lobby' })
  }

  /**
   * @brief Set error message
   */
  private setError(error: string): void {
    this.setState({ error })
    // Clear error after 5 seconds
    setTimeout(() => {
      this.setState({ error: undefined })
    }, 5000)
  }

  /**
   * @brief Start actual game (when opponent found)
   */
  public startGame(): void {
    this.setState({ gameState: 'playing' })
  }

  /**
   * @brief Finish game
   */
  public finishGame(): void {
    this.setState({ gameState: 'finished' })
  }
}
