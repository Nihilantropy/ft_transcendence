/**
 * @brief GameControls component for ft_transcendence Pong game
 * 
 * @description Simple game controls interface for local Pong matches.
 * Provides start/pause/reset controls and keyboard mapping display.
 * 
 * Phase 4.1 implementation - GameControls Component
 */

import { Component } from '../base/Component'

/**
 * @brief Props for GameControls component
 */
export interface GameControlsProps {
  /** Current game state */
  gameState?: 'lobby' | 'playing' | 'paused' | 'finished'
  /** Player vs AI mode */
  vsAI?: boolean
  /** Custom CSS classes */
  className?: string
  /** Callback when start button is clicked */
  onStart?: () => void
  /** Callback when pause/resume button is clicked */
  onPauseResume?: () => void
  /** Callback when reset button is clicked */
  onReset?: () => void
  /** Callback when game mode is changed */
  onModeChange?: (vsAI: boolean) => void
}

/**
 * @brief State for GameControls component
 */
export interface GameControlsState {
  /** Show controls help */
  showControls: boolean
}

/**
 * @brief Game controls interface for local Pong
 * 
 * @description Clean, simple controls for managing local Pong gameplay.
 * Features:
 * - Start/Pause/Reset buttons
 * - Game mode selection (PvP vs AI)
 * - Keyboard controls display
 * - Responsive gaming theme styling
 */
export class GameControls extends Component<GameControlsProps, GameControlsState> {

  /**
   * @brief Initialize GameControls component
   */
  constructor(props: GameControlsProps = {}) {
    super(props, {
      showControls: false
    })
  }

  /**
   * @brief Component lifecycle - mount event handlers
   */
  onMount(): void {
    console.log('🎮 GameControls mounted')
  }

  /**
   * @brief Handle start button click
   */
  public handleStart(): void {
    if (this.props.onStart) {
      this.props.onStart()
    }
  }

  /**
   * @brief Handle pause/resume button click
   */
  public handlePauseResume(): void {
    if (this.props.onPauseResume) {
      this.props.onPauseResume()
    }
  }

  /**
   * @brief Handle reset button click
   */
  public handleReset(): void {
    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  /**
   * @brief Handle game mode change
   */
  public handleModeChange(vsAI: boolean): void {
    if (this.props.onModeChange) {
      this.props.onModeChange(vsAI)
    }
  }

  /**
   * @brief Toggle controls help display
   */
  public toggleControls(): void {
    this.setState({ showControls: !this.state.showControls })
  }

  /**
   * @brief Render the component
   */
  public render(): string {
    const { gameState = 'lobby', vsAI = false, className = '' } = this.props
    const { showControls } = this.state
    
    return `
      <div class="game-controls ${className}">
        ${this.renderGameButtons(gameState)}
        ${this.renderGameModeSelection(gameState, vsAI)}
        ${this.renderControlsSection(showControls, gameState)}
      </div>
    `
  }

  /**
   * @brief Render main game control buttons
   */
  private renderGameButtons(gameState: string): string {
    return `
      <div class="bg-gray-800 border border-green-600 rounded-lg p-4 mb-4">
        <h3 class="text-lg font-bold text-center mb-4 neon-glow">🎮 Game Controls</h3>
        
        <div class="flex flex-col space-y-2">
          ${this.renderStartButton(gameState)}
          ${this.renderPauseResumeButton(gameState)}
          ${this.renderResetButton(gameState)}
        </div>
      </div>
    `
  }

  /**
   * @brief Render start button
   */
  private renderStartButton(gameState: string): string {
    const isDisabled = gameState === 'playing' || gameState === 'paused'
    
    return `
      <button 
        onclick="this.handleStart()"
        class="w-full px-4 py-3 font-bold rounded transition-colors ${
          isDisabled 
            ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
            : 'bg-green-600 hover:bg-green-500 text-white'
        }"
        ${isDisabled ? 'disabled' : ''}
      >
        🚀 Start Game
      </button>
    `
  }

  /**
   * @brief Render pause/resume button
   */
  private renderPauseResumeButton(gameState: string): string {
    const isVisible = gameState === 'playing' || gameState === 'paused'
    
    if (!isVisible) {
      return ''
    }
    
    const isPaused = gameState === 'paused'
    
    return `
      <button 
        onclick="this.handlePauseResume()"
        class="w-full px-4 py-3 bg-yellow-600 hover:bg-yellow-500 text-black font-bold rounded transition-colors"
      >
        ${isPaused ? '▶️ Resume Game' : '⏸️ Pause Game'}
      </button>
    `
  }

  /**
   * @brief Render reset button
   */
  private renderResetButton(gameState: string): string {
    const isVisible = gameState !== 'lobby'
    
    if (!isVisible) {
      return ''
    }
    
    return `
      <button 
        onclick="this.handleReset()"
        class="w-full px-4 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded transition-colors"
      >
        🔄 Reset Game
      </button>
    `
  }

  /**
   * @brief Render game mode selection
   */
  private renderGameModeSelection(gameState: string, vsAI: boolean): string {
    const isDisabled = gameState === 'playing' || gameState === 'paused'
    
    return `
      <div class="bg-gray-800 border border-green-600 rounded-lg p-4 mb-4">
        <h4 class="text-md font-bold text-center mb-3 neon-glow">🎯 Game Mode</h4>
        
        <select 
          onchange="this.handleModeChange(this.value === 'ai')"
          class="w-full px-3 py-2 bg-gray-700 border border-green-600 text-green-500 rounded focus:outline-none focus:border-green-400 ${
            isDisabled ? 'opacity-50 cursor-not-allowed' : ''
          }"
          ${isDisabled ? 'disabled' : ''}
        >
          <option value="pvp" ${!vsAI ? 'selected' : ''}>👥 Player vs Player</option>
          <option value="ai" ${vsAI ? 'selected' : ''}>🤖 Player vs AI</option>
        </select>
      </div>
    `
  }

  /**
   * @brief Render controls help section
   */
  private renderControlsSection(showControls: boolean, gameState: string): string {
    return `
      <div class="bg-gray-800 border border-green-600 rounded-lg p-4">
        <button 
          onclick="this.toggleControls()"
          class="w-full flex items-center justify-between px-3 py-2 text-green-500 hover:text-green-400 transition-colors"
        >
          <span class="font-bold">⌨️ Keyboard Controls</span>
          <span class="text-xl">${showControls ? '▼' : '▶'}</span>
        </button>
        
        ${showControls ? this.renderControlsHelp(gameState) : ''}
      </div>
    `
  }

  /**
   * @brief Render keyboard controls help
   */
  private renderControlsHelp(gameState: string): string {
    return `
      <div class="mt-3 pt-3 border-t border-green-600/30 space-y-3 text-sm">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <div class="text-green-500 font-semibold mb-2">Player 1:</div>
            <div class="space-y-1">
              <div class="flex justify-between">
                <span>Move Up:</span>
                <kbd class="kbd-key">W</kbd>
              </div>
              <div class="flex justify-between">
                <span>Move Down:</span>
                <kbd class="kbd-key">S</kbd>
              </div>
            </div>
          </div>
          
          <div>
            <div class="text-green-500 font-semibold mb-2">Player 2:</div>
            <div class="space-y-1">
              <div class="flex justify-between">
                <span>Move Up:</span>
                <kbd class="kbd-key">↑</kbd>
              </div>
              <div class="flex justify-between">
                <span>Move Down:</span>
                <kbd class="kbd-key">↓</kbd>
              </div>
            </div>
          </div>
        </div>
        
        ${gameState === 'playing' ? `
          <div class="pt-2 border-t border-green-600/30">
            <div class="text-green-500 font-semibold mb-2">Game Controls:</div>
            <div class="flex justify-between">
              <span>Pause/Resume:</span>
              <kbd class="kbd-key">SPACE</kbd>
            </div>
          </div>
        ` : ''}
        
        <div class="pt-2 border-t border-green-600/30 text-xs text-green-400 text-center">
          💡 First to ${gameState === 'lobby' ? '5' : '5'} points wins!
        </div>
      </div>
      
      <style>
        .kbd-key {
          @apply font-mono bg-green-600/20 text-green-400 px-2 py-1 rounded text-xs border border-green-600/40;
        }
      </style>
    `
  }
}
