/**
 * @brief Scoreboard component for ft_transcendence Pong game
 * 
 * @description Simple score display for local Pong matches.
 * Supports 2-player local game or Player vs AI.
 * 
 * Phase 4.1 implementation - Scoreboard Component
 */

import { Component } from '../base/Component'

/**
 * @brief Props for Scoreboard component
 */
export interface ScoreboardProps {
  /** Player 1 score */
  player1Score?: number
  /** Player 2 score (or AI score) */
  player2Score?: number
  /** Player 1 name */
  player1Name?: string
  /** Player 2 name (or "AI") */
  player2Name?: string
  /** Game mode: 'pvp' or 'ai' */
  gameMode?: 'pvp' | 'ai'
  /** Custom CSS classes */
  className?: string
  /** Score to win the match */
  maxScore?: number
}

/**
 * @brief State for Scoreboard component
 */
export interface ScoreboardState {
  /** Animation state for score changes */
  animatingPlayer1: boolean
  /** Animation state for score changes */
  animatingPlayer2: boolean
  /** Winner if game is finished */
  winner: 'player1' | 'player2' | null
}

/**
 * @brief Simple Pong scoreboard component
 * 
 * @description Displays scores for local Pong game with clean gaming aesthetic.
 * Features:
 * - Clean score display for 2 players
 * - Player vs AI mode support
 * - Score change animations
 * - Winner detection
 * - Gaming theme styling
 */
export class Scoreboard extends Component<ScoreboardProps, ScoreboardState> {

  /**
   * @brief Initialize Scoreboard
   * 
   * @param props - Component properties
   */
  constructor(props: ScoreboardProps = {}) {
    super(props, {
      animatingPlayer1: false,
      animatingPlayer2: false,
      winner: null
    })
    
    console.log('🏆 Scoreboard created')
  }

  /**
   * @brief Component lifecycle - after mount
   */
  onMount(): void {
    this.checkForWinner()
    console.log('🏆 Scoreboard mounted')
  }

  /**
   * @brief Render Scoreboard to HTML
   * 
   * @return HTML string for scoreboard
   */
  render(): string {
    const { 
      player1Score = 0, 
      player2Score = 0, 
      player1Name = 'Player 1',
      player2Name = 'Player 2',
      gameMode = 'pvp',
      className = '',
      maxScore = 11
    } = this.props
    
    const { animatingPlayer1, animatingPlayer2, winner } = this.state
    
    const containerClasses = [
      'scoreboard',
      'bg-gray-900',
      'border',
      'border-green-600',
      'rounded-lg',
      'p-4',
      'text-center',
      className
    ].filter(Boolean).join(' ')

    // Determine display names
    const displayPlayer2Name = gameMode === 'ai' ? '🤖 AI' : player2Name

    return `
      <div class="${containerClasses}">
        <!-- Header -->
        <div class="mb-4">
          <h3 class="text-lg font-bold text-green-400 neon-glow">
            ⚡ SCOREBOARD ⚡
          </h3>
          <p class="text-sm text-green-500">
            ${gameMode === 'ai' ? 'Player vs AI' : '2 Player Game'} | First to ${maxScore}
          </p>
        </div>

        <!-- Score Display -->
        <div class="flex justify-between items-center mb-4">
          ${this.renderPlayerScore(player1Name, player1Score, 'left', animatingPlayer1, winner === 'player1')}
          
          <div class="text-2xl text-green-400 mx-4">VS</div>
          
          ${this.renderPlayerScore(displayPlayer2Name, player2Score, 'right', animatingPlayer2, winner === 'player2')}
        </div>

        <!-- Game Status -->
        ${this.renderGameStatus(winner, maxScore)}
        
        <!-- Match Progress -->
        ${this.renderMatchProgress(player1Score, player2Score, maxScore)}
      </div>
    `
  }

  /**
   * @brief Render individual player score
   */
  private renderPlayerScore(
    playerName: string, 
    score: number, 
    side: 'left' | 'right',
    isAnimating: boolean,
    isWinner: boolean
  ): string {
    const scoreClasses = [
      'text-4xl',
      'font-bold',
      'font-mono',
      isAnimating ? 'animate-pulse text-yellow-400 scale-110' : 'text-green-400',
      isWinner ? 'neon-glow text-yellow-300' : ''
    ].filter(Boolean).join(' ')

    const nameClasses = [
      'text-sm',
      'font-bold',
      'mb-2',
      isWinner ? 'text-yellow-300' : 'text-green-500'
    ].filter(Boolean).join(' ')

    return `
      <div class="player-score flex-1 ${side === 'left' ? 'text-left' : 'text-right'}">
        <div class="${nameClasses}">
          ${isWinner ? '👑 ' : ''}${playerName}
        </div>
        <div class="${scoreClasses}">
          ${score}
        </div>
      </div>
    `
  }

  /**
   * @brief Render game status section
   */
  private renderGameStatus(winner: string | null, maxScore: number): string {
    if (winner) {
      const winnerName = winner === 'player1' 
        ? this.props.player1Name || 'Player 1'
        : this.props.gameMode === 'ai' ? 'AI' : this.props.player2Name || 'Player 2'

      return `
        <div class="game-status bg-yellow-900/20 border border-yellow-600 rounded-lg p-3 mb-4">
          <div class="text-yellow-300 font-bold text-lg neon-glow">
            🏆 ${winnerName} Wins!
          </div>
          <p class="text-yellow-500 text-sm mt-1">
            Game Over - First to ${maxScore} points
          </p>
        </div>
      `
    }

    return `
      <div class="game-status text-green-500 text-sm mb-4">
        <div class="flex items-center justify-center space-x-2">
          <span class="animate-pulse">🏓</span>
          <span>Game in Progress</span>
          <span class="animate-pulse">🏓</span>
        </div>
      </div>
    `
  }

  /**
   * @brief Render match progress bar
   */
  private renderMatchProgress(player1Score: number, player2Score: number, maxScore: number): string {
    const totalProgress = Math.max(player1Score, player2Score)
    const progressPercent = Math.min((totalProgress / maxScore) * 100, 100)

    return `
      <div class="match-progress">
        <div class="flex justify-between text-xs text-green-600 mb-1">
          <span>Match Progress</span>
          <span>${Math.round(progressPercent)}%</span>
        </div>
        <div class="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
          <div 
            class="h-full bg-gradient-to-r from-green-600 to-green-400 rounded-full transition-all duration-300"
            style="width: ${progressPercent}%"
          ></div>
        </div>
        <div class="flex justify-between text-xs text-green-500 mt-1">
          <span>0</span>
          <span>${maxScore} to win</span>
        </div>
      </div>
    `
  }

  /**
   * @brief Update player 1 score
   */
  public updatePlayer1Score(newScore: number): void {
    // Animate score change
    this.setState({ animatingPlayer1: true })
    
    // Update props (in a real app, this would come from parent)
    this.props.player1Score = newScore
    
    // Stop animation after delay
    setTimeout(() => {
      this.setState({ animatingPlayer1: false })
      this.checkForWinner()
    }, 600)
    
    console.log(`🎯 Player 1 scored! New score: ${newScore}`)
  }

  /**
   * @brief Update player 2 score
   */
  public updatePlayer2Score(newScore: number): void {
    // Animate score change
    this.setState({ animatingPlayer2: true })
    
    // Update props (in a real app, this would come from parent)
    this.props.player2Score = newScore
    
    // Stop animation after delay
    setTimeout(() => {
      this.setState({ animatingPlayer2: false })
      this.checkForWinner()
    }, 600)
    
    const playerName = this.props.gameMode === 'ai' ? 'AI' : 'Player 2'
    console.log(`🎯 ${playerName} scored! New score: ${newScore}`)
  }

  /**
   * @brief Check if there's a winner
   */
  private checkForWinner(): void {
    const { player1Score = 0, player2Score = 0, maxScore = 11 } = this.props
    
    let winner: 'player1' | 'player2' | null = null
    
    if (player1Score >= maxScore && player1Score - player2Score >= 2) {
      winner = 'player1'
    } else if (player2Score >= maxScore && player2Score - player1Score >= 2) {
      winner = 'player2'
    }
    
    if (winner !== this.state.winner) {
      this.setState({ winner })
      
      if (winner) {
        const winnerName = winner === 'player1' 
          ? this.props.player1Name || 'Player 1'
          : this.props.gameMode === 'ai' ? 'AI' : this.props.player2Name || 'Player 2'
        console.log(`🏆 Game Over! ${winnerName} wins!`)
      }
    }
  }

  /**
   * @brief Reset the scoreboard for new game
   */
  public resetScore(): void {
    // Reset props
    this.props.player1Score = 0
    this.props.player2Score = 0
    
    // Reset state
    this.setState({
      animatingPlayer1: false,
      animatingPlayer2: false,
      winner: null
    })
    
    console.log('🔄 Scoreboard reset for new game')
  }

  /**
   * @brief Get current winner
   */
  public getWinner(): 'player1' | 'player2' | null {
    return this.state.winner
  }

  /**
   * @brief Check if game is finished
   */
  public isGameFinished(): boolean {
    return this.state.winner !== null
  }
}
