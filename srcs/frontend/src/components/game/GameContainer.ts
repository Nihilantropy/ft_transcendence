/**
 * @brief Simple GameContainer for local Pong game
 * 
 * @description Simplified game container for 2-player local Pong.
 * No remote play, no spectating - just clean local gameplay.
 * 
 * Phase 4.1 - Simplified GameContainer
 */

import { Component } from '../base/Component'
import type { Score, GameStatus } from '../../types'

/**
 * @brief Props for GameContainer component
 */
export interface GameContainerProps {
  /** Custom CSS classes */
  className?: string
  /** Game mode: lobby or playing */
  mode?: 'lobby' | 'playing'
}

/**
 * @brief State for GameContainer component
 */
export interface GameContainerState {
  /** Current game status */
  gameState: GameStatus | 'lobby'  // Adding lobby for compatibility
  /** Game score */
  score: Score
  /** Player vs AI mode */
  vsAI: boolean
  
  // Backwards compatibility properties
  /** Player 1 score (alias for score.player1) */
  player1Score: number
  /** Player 2 score (alias for score.player2) */
  player2Score: number
}

/**
 * @brief Simple game container for local Pong
 * 
 * @description Clean, minimal container for 2-player Pong on same keyboard.
 * Features:
 * - Game area with Pong canvas
 * - Integrated scoreboard
 * - Simple controls (W/S and ↑/↓)
 * - Player vs Player or Player vs AI
 * - Pause/resume functionality
 */
export class GameContainer extends Component<GameContainerProps, GameContainerState> {

  /**
   * @brief Initialize GameContainer
   */
  constructor(props: GameContainerProps = {}) {
    super(props, {
      gameState: props.mode === 'playing' ? 'playing' : 'lobby',
      score: {
        player1: 0,
        player2: 0,
        maxScore: 5
      },
      player1Score: 0,
      player2Score: 0,
      vsAI: false
    })
    
    console.log('🎮 Simple GameContainer created')
  }

  /**
   * @brief Component lifecycle - after mount
   */
  onMount(): void {
    this.setupKeyboardControls()
    console.log('🎮 GameContainer mounted')
  }

  /**
   * @brief Component lifecycle - before unmount
   */
  onUnmount(): void {
    this.cleanupKeyboardControls()
    console.log('🎮 GameContainer unmounted')
  }

  /**
   * @brief Render GameContainer
   */
  render(): string {
    const { className = '' } = this.props
    
    const containerClasses = [
      'game-container',
      'min-h-screen',
      'bg-black',
      'text-green-400',
      'font-mono',
      'flex',
      'flex-col',
      className
    ].filter(Boolean).join(' ')

    return `
      <div class="${containerClasses}">
        ${this.renderHeader()}
        ${this.renderGameArea()}
        ${this.renderFooter()}
      </div>
    `
  }

  /**
   * @brief Render game header
   */
  private renderHeader(): string {
    const { vsAI } = this.state
    
    return `
      <header class="bg-gray-900 border-b border-green-600 p-4">
        <div class="flex justify-between items-center">
          <h1 class="text-2xl font-bold text-green-400 neon-glow">
            🏓 Pong Game
          </h1>
          <div class="flex items-center space-x-4">
            <span class="px-3 py-1 bg-green-600/20 border border-green-600 rounded text-sm">
              ${vsAI ? 'vs AI' : '2 Player'}
            </span>
            <button 
              onclick="this.handleExitGame()" 
              class="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded transition-colors"
            >
              Exit
            </button>
          </div>
        </div>
      </header>
    `
  }

  /**
   * @brief Render main game area
   */
  private renderGameArea(): string {
    return `
      <main class="flex-1 flex">
        <!-- Game Canvas -->
        <div class="flex-1 p-4">
          ${this.renderGameCanvas()}
        </div>
        
        <!-- Scoreboard Sidebar -->
        <aside class="w-80 p-4 bg-gray-900 border-l border-green-600">
          ${this.renderScoreboard()}
          ${this.renderGameControls()}
        </aside>
      </main>
    `
  }

  /**
   * @brief Render game canvas area
   */
  private renderGameCanvas(): string {
    const { gameState } = this.state
    
    if (gameState === 'lobby') {
      return `
        <div class="bg-gray-900 border border-green-600 rounded-lg p-8 h-full flex items-center justify-center">
          <div class="text-center">
            <div class="text-6xl mb-4">🏓</div>
            <h2 class="text-2xl font-bold mb-4 neon-glow">Ready to Play Pong?</h2>
            <p class="text-green-500 mb-6">Choose your game mode and start playing!</p>
            
            <div class="space-y-4">
              <button 
                onclick="this.startGame(false)" 
                class="w-full px-6 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-colors"
              >
                👥 2 Player Mode
              </button>
              <button 
                onclick="this.startGame(true)" 
                class="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors"
              >
                🤖 vs AI Mode
              </button>
            </div>
          </div>
        </div>
      `
    }
    
    return `
      <div class="bg-black border border-green-600 rounded-lg relative h-full min-h-96 overflow-hidden">
        <!-- Pong Canvas -->
        <canvas 
          id="pong-canvas" 
          class="w-full h-full"
          width="800" 
          height="400"
        ></canvas>
        
        <!-- Game Area Decorations -->
        <div class="absolute inset-4 border border-green-400/30 rounded pointer-events-none"></div>
        <div class="absolute left-1/2 top-4 bottom-4 w-px bg-green-400/50 transform -translate-x-1/2"></div>
        
        <!-- Pause Overlay -->
        ${gameState === 'paused' ? this.renderPauseOverlay() : ''}
        
        <!-- Game Over Overlay -->
        ${gameState === 'finished' ? this.renderGameOverOverlay() : ''}
      </div>
    `
  }

  /**
   * @brief Render pause overlay
   */
  private renderPauseOverlay(): string {
    return `
      <div class="absolute inset-0 bg-black/75 flex items-center justify-center">
        <div class="text-center">
          <div class="text-6xl mb-4">⏸️</div>
          <h3 class="text-2xl font-bold mb-4 neon-glow">Game Paused</h3>
          <p class="text-green-500 mb-6">Press SPACE to resume</p>
        </div>
      </div>
    `
  }

  /**
   * @brief Render game over overlay
   */
  private renderGameOverOverlay(): string {
    const { player1Score, player2Score, vsAI } = this.state
    const winner = player1Score > player2Score ? 'Player 1' : (vsAI ? 'AI' : 'Player 2')
    
    return `
      <div class="absolute inset-0 bg-black/75 flex items-center justify-center">
        <div class="text-center p-8 border border-yellow-600 rounded-lg bg-yellow-900/20">
          <div class="text-6xl mb-4">🏆</div>
          <h3 class="text-2xl font-bold mb-4 text-yellow-300 neon-glow">${winner} Wins!</h3>
          <p class="text-yellow-500 mb-6">Final Score: ${player1Score} - ${player2Score}</p>
          <button 
            onclick="this.resetGame()" 
            class="px-6 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-colors"
          >
            🔄 Play Again
          </button>
        </div>
      </div>
    `
  }

  /**
   * @brief Render simple scoreboard
   */
  private renderScoreboard(): string {
    const { player1Score, player2Score, vsAI } = this.state
    
    return `
      <div class="bg-black border border-green-600 rounded-lg p-4 mb-4">
        <h3 class="text-lg font-bold text-center mb-4 neon-glow">⚡ SCORE ⚡</h3>
        
        <div class="flex justify-between items-center mb-4">
          <div class="text-center">
            <div class="text-sm font-bold text-green-500 mb-1">Player 1</div>
            <div class="text-3xl font-bold font-mono text-green-400">${player1Score}</div>
          </div>
          
          <div class="text-xl text-green-400">VS</div>
          
          <div class="text-center">
            <div class="text-sm font-bold text-green-500 mb-1">${vsAI ? '🤖 AI' : 'Player 2'}</div>
            <div class="text-3xl font-bold font-mono text-green-400">${player2Score}</div>
          </div>
        </div>
        
        <div class="text-center text-sm text-green-600">
          First to 11 wins
        </div>
      </div>
    `
  }

  /**
   * @brief Render game controls info
   */
  private renderGameControls(): string {
    const { gameState } = this.state
    
    return `
      <div class="bg-gray-800 border border-green-600 rounded-lg p-4">
        <h4 class="text-lg font-bold text-center mb-4 neon-glow">🎮 Controls</h4>
        
        <div class="space-y-3 text-sm">
          <div class="flex justify-between">
            <span class="text-green-500">Player 1:</span>
            <span class="font-mono bg-green-600/20 px-2 py-1 rounded">W / S</span>
          </div>
          
          <div class="flex justify-between">
            <span class="text-green-500">Player 2:</span>
            <span class="font-mono bg-green-600/20 px-2 py-1 rounded">↑ / ↓</span>
          </div>
          
          ${gameState === 'playing' ? `
            <div class="flex justify-between">
              <span class="text-green-500">Pause:</span>
              <span class="font-mono bg-green-600/20 px-2 py-1 rounded">SPACE</span>
            </div>
          ` : ''}
        </div>
        
        ${gameState === 'playing' || gameState === 'paused' ? `
          <button 
            onclick="this.togglePause()" 
            class="w-full mt-4 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-black font-bold rounded transition-colors"
          >
            ${gameState === 'paused' ? '▶️ Resume' : '⏸️ Pause'}
          </button>
        ` : ''}
      </div>
    `
  }

  /**
   * @brief Render footer
   */
  private renderFooter(): string {
    return `
      <footer class="bg-gray-900 border-t border-green-600 p-4 text-center text-sm text-green-500">
        🏓 Local Pong Game - Use keyboard controls to play
      </footer>
    `
  }

  /**
   * @brief Setup keyboard controls
   */
  private setupKeyboardControls(): void {
    document.addEventListener('keydown', this.handleKeyDown.bind(this))
  }

  /**
   * @brief Handle keyboard input
   */
  private handleKeyDown(event: KeyboardEvent): void {
    const { gameState } = this.state
    
    switch (event.code) {
      case 'Space':
        event.preventDefault()
        if (gameState === 'playing' || gameState === 'paused') {
          this.togglePause()
        }
        break
      case 'Escape':
        event.preventDefault()
        this.handleExitGame()
        break
    }
  }

  /**
   * @brief Cleanup keyboard controls
   */
  private cleanupKeyboardControls(): void {
    document.removeEventListener('keydown', this.handleKeyDown.bind(this))
  }

  /**
   * @brief Start game
   */
  public startGame(vsAI: boolean = false): void {
    this.setState({ 
      gameState: 'playing',
      vsAI,
      player1Score: 0,
      player2Score: 0,
      score: {
        player1: 0,
        player2: 0,
        maxScore: 5
      }
    })
    console.log(`🎮 Game started: ${vsAI ? 'vs AI' : '2 Player'}`)
  }

  /**
   * @brief Toggle pause/resume
   */
  public togglePause(): void {
    const { gameState } = this.state
    
    if (gameState === 'playing') {
      this.setState({ gameState: 'paused' })
      console.log('⏸️ Game paused')
    } else if (gameState === 'paused') {
      this.setState({ gameState: 'playing' })
      console.log('▶️ Game resumed')
    }
  }

  /**
   * @brief Reset game to lobby
   */
  public resetGame(): void {
    this.setState({
      gameState: 'lobby',
      player1Score: 0,
      player2Score: 0,
      score: {
        player1: 0,
        player2: 0,
        maxScore: 5
      },
      vsAI: false
    })
    console.log('🔄 Game reset to lobby')
  }

  /**
   * @brief Update scores (for integration with actual Pong game logic)
   */
  public updateScore(player1Score: number, player2Score: number): void {
    this.setState({ 
      player1Score, 
      player2Score,
      score: {
        player1: player1Score,
        player2: player2Score,
        maxScore: this.state.score.maxScore
      }
    })
    
    // Check for winner (first to 11, must win by 2)
    if ((player1Score >= 11 && player1Score - player2Score >= 2) ||
        (player2Score >= 11 && player2Score - player1Score >= 2)) {
      this.setState({ gameState: 'finished' })
      console.log('🏆 Game finished!')
    }
  }

  /**
   * @brief Exit game and return to home
   */
  private async handleExitGame(): Promise<void> {
    console.log('🚪 Exiting game...')
    const { router } = await import('../../router/router')
    router.navigate('/')
  }
}
