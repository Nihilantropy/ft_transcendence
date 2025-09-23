/**
 * @brief Simple GamePage for local Pong game
 * 
 * @description Simplified game page that directly renders GameContainer.
 * Phase 4.1 - Simplified GamePage
 * 
 * FILE: src/pages/game/GamePage.ts
 */

import { Component } from '../../components/base/Component'
import { GameContainer } from '../../components/game/GameContainer'

/**
 * @brief GamePage component properties interface
 */
export interface GamePageProps {
  /** Game mode: 'lobby' | 'playing' */
  mode?: 'lobby' | 'playing'
  /** Optional custom CSS classes */
  className?: string
}

/**
 * @brief GamePage component state interface
 */
export interface GamePageState {
  /** Loading state */
  isLoading: boolean
  /** Error message if any */
  error?: string
}

/**
 * @brief Simple game page component
 * 
 * @description Minimal page wrapper for GameContainer. Handles basic
 * page-level concerns while GameContainer manages all game logic.
 */
export class GamePage extends Component<GamePageProps, GamePageState> {

  /**
   * @brief Initialize GamePage
   */
  constructor(props: GamePageProps = {}) {
    super(props, {
      isLoading: false
    })
    
    console.log('🎮 Simple GamePage created')
  }

  /**
   * @brief Render GamePage with GameContainer
   */
  render(): string {
    const { mode = 'lobby', className = '' } = this.props
    const { error, isLoading } = this.state

    // Handle error state
    if (error) {
      return this.renderError(error)
    }

    // Handle loading state
    if (isLoading) {
      return this.renderLoading()
    }

    // Render GameContainer directly
    const gameContainer = new GameContainer({
      mode,
      className
    })

    return gameContainer.render()
  }

  /**
   * @brief Render error state
   */
  private renderError(error: string): string {
    return `
      <div class="min-h-screen bg-black text-green-400 font-mono flex items-center justify-center">
        <div class="text-center p-8 border border-red-600 rounded-lg bg-red-900/10">
          <div class="text-6xl mb-4">💀</div>
          <h1 class="text-2xl font-bold text-red-400 mb-4">Game Error</h1>
          <p class="text-red-300 mb-6">${error}</p>
          <button 
            onclick="import('../../router/router').then(({router}) => router.navigate('/'))" 
            class="px-6 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-colors"
          >
            🏠 Back to Home
          </button>
        </div>
      </div>
    `
  }

  /**
   * @brief Render loading state
   */
  private renderLoading(): string {
    return `
      <div class="min-h-screen bg-black text-green-400 font-mono flex items-center justify-center">
        <div class="text-center">
          <div class="animate-spin text-6xl mb-4">🏓</div>
          <h2 class="text-2xl font-bold mb-4 neon-glow">Loading Game...</h2>
          <p class="text-green-500 mb-6">Preparing your Pong experience...</p>
        </div>
      </div>
    `
  }

  /**
   * @brief Set loading state
   */
  public setLoading(isLoading: boolean): void {
    this.setState({ isLoading })
  }

  /**
   * @brief Set error state
   */
  public setError(error: string): void {
    this.setState({ error })
  }

  /**
   * @brief Clear error state
   */
  public clearError(): void {
    this.setState({ error: undefined })
  }
}
