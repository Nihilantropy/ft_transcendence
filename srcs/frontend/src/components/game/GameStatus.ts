/**
 * @brief GameStatus component for ft_transcendence Pong game
 * 
 * @description Simple game state display for local Pong matches.
 * Shows current game status, timer, and visual indicators.
 * 
 * Phase 4.1 implementation - GameStatus Component
 */

import { Component } from '../base/Component'

/**
 * @brief Props for GameStatus component
 */
export interface GameStatusProps {
  /** Current game state */
  gameState?: 'lobby' | 'playing' | 'paused' | 'finished'
  /** Game mode: 'pvp' or 'ai' */
  gameMode?: 'pvp' | 'ai'
  /** Game timer in seconds */
  gameTime?: number
  /** Round number for multi-round games */
  round?: number
  /** Maximum rounds */
  maxRounds?: number
  /** Custom CSS classes */
  className?: string
  /** Show detailed status */
  showDetails?: boolean
}

/**
 * @brief State for GameStatus component
 */
export interface GameStatusState {
  /** Pulsing animation state for status indicator */
  pulsing: boolean
}

/**
 * @brief Game status display for local Pong
 * 
 * @description Clean, simple status display for managing local Pong gameplay state.
 * Features:
 * - Game state indicator (lobby/playing/paused/finished)
 * - Game timer display
 * - Round counter for tournaments
 * - Visual status animations
 * - Gaming theme styling
 */
export class GameStatus extends Component<GameStatusProps, GameStatusState> {

  private timerInterval: number | null = null

  /**
   * @brief Initialize GameStatus component
   */
  constructor(props: GameStatusProps = {}) {
    super(props, {
      pulsing: false
    })
  }

  /**
   * @brief Component lifecycle - setup timer animations
   */
  onMount(): void {
    this.startStatusAnimation()
    console.log('📊 GameStatus mounted')
  }

  /**
   * @brief Component lifecycle - cleanup timers
   */
  onUnmount(): void {
    this.stopStatusAnimation()
    console.log('📊 GameStatus unmounted')
  }

  /**
   * @brief Start status indicator animation
   */
  private startStatusAnimation(): void {
    const { gameState } = this.props
    
    if (gameState === 'playing') {
      this.timerInterval = window.setInterval(() => {
        this.setState({ pulsing: !this.state.pulsing })
      }, 1000)
    }
  }

  /**
   * @brief Stop status indicator animation
   */
  private stopStatusAnimation(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }
  }

  /**
   * @brief Format time in MM:SS format
   */
  private formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  /**
   * @brief Get status indicator emoji and color
   */
  private getStatusIndicator(gameState: string): { emoji: string, color: string, text: string } {
    switch (gameState) {
      case 'lobby':
        return { emoji: '⏸️', color: 'text-gray-400', text: 'Waiting' }
      case 'playing':
        return { emoji: '🟢', color: 'text-green-500', text: 'Playing' }
      case 'paused':
        return { emoji: '⏸️', color: 'text-yellow-500', text: 'Paused' }
      case 'finished':
        return { emoji: '🏁', color: 'text-red-500', text: 'Finished' }
      default:
        return { emoji: '⚪', color: 'text-gray-500', text: 'Unknown' }
    }
  }

  /**
   * @brief Render the component
   */
  public render(): string {
    const { 
      gameState = 'lobby', 
      gameMode = 'pvp', 
      gameTime = 0, 
      round = 1,
      maxRounds = 1,
      showDetails = true,
      className = '' 
    } = this.props
    
    const { pulsing } = this.state
    
    return `
      <div class="game-status ${className}">
        ${this.renderMainStatus(gameState, pulsing)}
        ${showDetails ? this.renderGameDetails(gameMode, gameTime, round, maxRounds) : ''}
        ${this.renderStatusBar(gameState)}
      </div>
    `
  }

  /**
   * @brief Render main status indicator
   */
  private renderMainStatus(gameState: string, pulsing: boolean): string {
    const { emoji, color, text } = this.getStatusIndicator(gameState)
    
    return `
      <div class="bg-gray-800 border border-green-600 rounded-lg p-4 mb-4">
        <div class="flex items-center justify-center space-x-3">
          <span class="text-2xl ${pulsing && gameState === 'playing' ? 'animate-pulse' : ''}">${emoji}</span>
          <div class="text-center">
            <h3 class="text-lg font-bold ${color} neon-glow">${text}</h3>
            <p class="text-sm text-green-400">Game Status</p>
          </div>
        </div>
      </div>
    `
  }

  /**
   * @brief Render detailed game information
   */
  private renderGameDetails(gameMode: string, gameTime: number, round: number, maxRounds: number): string {
    return `
      <div class="bg-gray-800 border border-green-600 rounded-lg p-4 mb-4">
        <h4 class="text-md font-bold text-center mb-3 neon-glow">📊 Game Info</h4>
        
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div class="text-center">
            <div class="text-green-500 font-semibold mb-1">Mode</div>
            <div class="text-green-400">
              ${gameMode === 'ai' ? '🤖 vs AI' : '👥 2 Player'}
            </div>
          </div>
          
          <div class="text-center">
            <div class="text-green-500 font-semibold mb-1">Time</div>
            <div class="text-green-400 font-mono">
              ${this.formatTime(gameTime)}
            </div>
          </div>
          
          ${maxRounds > 1 ? `
            <div class="text-center col-span-2">
              <div class="text-green-500 font-semibold mb-1">Round</div>
              <div class="text-green-400">
                ${round} / ${maxRounds}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `
  }

  /**
   * @brief Render status progress bar
   */
  private renderStatusBar(gameState: string): string {
    const steps = [
      { key: 'lobby', label: 'Lobby', active: true },
      { key: 'playing', label: 'Playing', active: gameState === 'playing' || gameState === 'paused' || gameState === 'finished' },
      { key: 'finished', label: 'Finished', active: gameState === 'finished' }
    ]
    
    return `
      <div class="bg-gray-800 border border-green-600 rounded-lg p-4">
        <h4 class="text-sm font-bold text-center mb-3 text-green-500">Progress</h4>
        
        <div class="flex items-center justify-between">
          ${steps.map((step, index) => `
            <div class="flex-1 text-center">
              <div class="flex items-center">
                ${index > 0 ? `<div class="flex-1 h-1 ${steps[index - 1].active ? 'bg-green-600' : 'bg-gray-600'}"></div>` : ''}
                <div class="w-8 h-8 rounded-full flex items-center justify-center ${
                  step.active 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-600 text-gray-400'
                } ${step.key === gameState ? 'ring-2 ring-green-400 ring-opacity-50' : ''}">
                  ${this.getStepIcon(step.key)}
                </div>
                ${index < steps.length - 1 ? `<div class="flex-1 h-1 ${step.active ? 'bg-green-600' : 'bg-gray-600'}"></div>` : ''}
              </div>
              <div class="text-xs mt-2 ${step.active ? 'text-green-400' : 'text-gray-500'}">${step.label}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `
  }

  /**
   * @brief Get icon for progress step
   */
  private getStepIcon(step: string): string {
    switch (step) {
      case 'lobby':
        return '1'
      case 'playing':
        return '2'
      case 'finished':
        return '3'
      default:
        return '?'
    }
  }

  /**
   * @brief Update component props and restart animations if needed
   */
  public updateStatus(newProps: Partial<GameStatusProps>): void {
    const oldGameState = this.props.gameState
    
    // Update props using parent method
    super.updateProps(newProps)
    
    // Restart animation if game state changed
    if (newProps.gameState && newProps.gameState !== oldGameState) {
      this.stopStatusAnimation()
      this.startStatusAnimation()
    }
  }
}
