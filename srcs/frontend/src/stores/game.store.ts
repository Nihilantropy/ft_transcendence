/**
 * @brief Game session store for ft_transcendence
 * 
 * @description Manages game state, sessions, scores, and real-time game updates.
 * Coordinates with server-side game engine for multiplayer sessions.
 * 
 * Phase B2.2 implementation extending BaseStore<GameState>.
 */

import { BaseStore } from './BaseStore'
import type { GameState, GameSession, GameMode, GameStatus, GameScore, GameSettings } from '../types/store.types'

/**
 * @brief Game session state management store
 * 
 * @description Concrete implementation of BaseStore for game sessions.
 * Handles game creation, real-time updates, and score tracking.
 */
export class GameStore extends BaseStore<GameState> {
  private readonly SETTINGS_KEY = 'ft_transcendence_game_settings'

  /**
   * @brief Initialize game store
   * 
   * @description Creates store with default idle game state.
   * Restores user game settings from localStorage.
   */
  constructor() {
    const initialState: GameState = {
      currentGame: null,
      gameMode: 'singleplayer',
      isPlaying: false,
      status: 'idle',
      loading: false,
      error: null
    }

    super(initialState, 'GameStore')
    
    // Restore game settings if available
    this.restoreSettings()
  }

  /**
   * @brief Set loading state
   * 
   * @param loading - Loading state
   * @param error - Optional error to clear
   * 
   * @description Updates loading state and optionally clears errors.
   */
  setLoading(loading: boolean, error: string | null = null): void {
    this.setState({ loading, error })
  }

  /**
   * @brief Set game error
   * 
   * @param error - Error message
   * 
   * @description Sets error state and stops loading.
   */
  setError(error: string): void {
    this.setState({ 
      error, 
      loading: false 
    })
  }

  /**
   * @brief Clear game error
   * 
   * @description Removes current error state.
   */
  clearError(): void {
    this.setState({ error: null })
  }

  /**
   * @brief Set game mode
   * 
   * @param mode - Game mode to set
   * 
   * @description Changes current game mode and resets game state.
   */
  setGameMode(mode: GameMode): void {
    this.setState({ 
      gameMode: mode,
      currentGame: null,
      isPlaying: false,
      status: 'idle'
    })
  }

  /**
   * @brief Create new game session
   * 
   * @param sessionData - Game session data
   * 
   * @description Initializes new game session with provided data.
   */
  createGame(sessionData: GameSession): void {
    this.setState({
      currentGame: sessionData,
      isPlaying: false,
      status: 'waiting',
      loading: false,
      error: null
    })
  }

  /**
   * @brief Start current game
   * 
   * @description Transitions game from waiting to playing state.
   */
  startGame(): void {
    const state = this.getState()
    
    if (!state.currentGame) {
      this.setError('No game session to start')
      return
    }

    this.setState({
      isPlaying: true,
      status: 'playing'
    })
  }

  /**
   * @brief Pause current game
   * 
   * @description Pauses active game session.
   */
  pauseGame(): void {
    const state = this.getState()
    
    if (!state.isPlaying) {
      return
    }

    this.setState({ status: 'paused' })
  }

  /**
   * @brief Resume paused game
   * 
   * @description Resumes paused game session.
   */
  resumeGame(): void {
    const state = this.getState()
    
    if (state.status !== 'paused') {
      return
    }

    this.setState({ status: 'playing' })
  }

  /**
   * @brief End current game
   * 
   * @param winner - Optional winner information
   * 
   * @description Finishes current game session and updates state.
   */
  endGame(winner?: { playerId: string; username: string }): void {
    this.setState({
      isPlaying: false,
      status: 'finished'
    })

    // Auto-reset after 5 seconds
    setTimeout(() => {
      this.resetGame()
    }, 5000)
  }

  /**
   * @brief Reset game to idle state
   * 
   * @description Clears current game session and returns to idle.
   */
  resetGame(): void {
    this.setState({
      currentGame: null,
      isPlaying: false,
      status: 'idle'
    })
  }

  /**
   * @brief Update game score
   * 
   * @param score - New score data
   * 
   * @description Updates current game score state.
   */
  updateScore(score: GameScore): void {
    const state = this.getState()
    
    if (!state.currentGame) {
      return
    }

    const updatedGame: GameSession = {
      ...state.currentGame,
      score
    }

    this.setState({ currentGame: updatedGame })
  }

  /**
   * @brief Update player paddle position
   * 
   * @param playerId - Player ID
   * @param position - New paddle position (0-100)
   * 
   * @description Updates specific player's paddle position.
   */
  updatePlayerPosition(playerId: string, position: number): void {
    const state = this.getState()
    
    if (!state.currentGame) {
      return
    }

    const updatedPlayers = state.currentGame.players.map(player => 
      player.id === playerId 
        ? { ...player, paddlePosition: Math.max(0, Math.min(100, position)) }
        : player
    )

    const updatedGame: GameSession = {
      ...state.currentGame,
      players: updatedPlayers
    }

    this.setState({ currentGame: updatedGame })
  }

  /**
   * @brief Update game settings
   * 
   * @param settings - New game settings
   * 
   * @description Updates current game settings and persists to storage.
   */
  updateSettings(settings: Partial<GameSettings>): void {
    const state = this.getState()
    
    if (!state.currentGame) {
      return
    }

    const updatedSettings: GameSettings = {
      ...state.currentGame.settings,
      ...settings
    }

    const updatedGame: GameSession = {
      ...state.currentGame,
      settings: updatedSettings
    }

    this.setState({ currentGame: updatedGame })
    this.persistSettings(updatedSettings)
  }

  /**
   * @brief Get current game (convenience method)
   * 
   * @return Current game session or null
   * 
   * @description Helper to get current game without full state.
   */
  getCurrentGame(): GameSession | null {
    return this.getState().currentGame
  }

  /**
   * @brief Get current score (convenience method)
   * 
   * @return Current game score or null
   * 
   * @description Helper to get current score.
   */
  getCurrentScore(): GameScore | null {
    const game = this.getCurrentGame()
    return game ? game.score : null
  }

  /**
   * @brief Check if game is active (convenience method)
   * 
   * @return True if game is currently active
   * 
   * @description Helper to check if user is in active game.
   */
  isGameActive(): boolean {
    const state = this.getState()
    return state.isPlaying && state.status === 'playing'
  }

  /**
   * @brief Get default game settings
   * 
   * @return Default game settings object
   * 
   * @description Returns standard game configuration.
   */
  getDefaultSettings(): GameSettings {
    return {
      ballSpeed: 1.0,
      paddleSpeed: 1.0,
      powerUpsEnabled: false,
      difficulty: 'medium'
    }
  }

  /**
   * @brief Persist game settings to localStorage
   * 
   * @param settings - Game settings to persist
   * 
   * @description Saves game settings to browser storage.
   */
  private persistSettings(settings: GameSettings): void {
    try {
      localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings))
    } catch (error) {
      console.warn('Failed to persist game settings:', error)
    }
  }

  /**
   * @brief Restore game settings from localStorage
   * 
   * @description Attempts to restore game settings from browser storage.
   */
  private restoreSettings(): void {
    try {
      const stored = localStorage.getItem(this.SETTINGS_KEY)
      
      if (stored) {
        const settings = JSON.parse(stored)
        // Settings will be applied when creating new games
        console.log('Restored game settings:', settings)
      }
    } catch (error) {
      console.warn('Failed to restore game settings:', error)
    }
  }
}

// Export singleton instance
export const gameStore = new GameStore()