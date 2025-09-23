/**
 * @brief Game session store for ft_transcendence
 * 
 * @description Manages game state, sessions, scores, and real-time game updates.
 * 
 * Phase B2.2 implementation extending BaseStore<GameState>.
 */

import { BaseStore } from './BaseStore'
import { catchErrorTyped } from '../services/error'
import type { GameState, GameSession, GameMode, GameScore, GameSettings } from '../types/store.types'

/**
 * @brief Game session state management store
 * 
 * @description Concrete implementation of BaseStore for game sessions.
 * Handles game creation, real-time updates, and score tracking.
 */
export class GameStore extends BaseStore<GameState> {
  private readonly SETTINGS_KEY = 'ft_transcendence_game_settings'
  private eventListeners: Map<string, EventListener> = new Map()

  /**
   * @brief Initialize game store
   * 
   * @description Creates store with default idle game state.
   * Restores user game settings from localStorage and sets up WebSocket event listeners.
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
    
    // Setup WebSocket event listeners for real-time game updates
    this.setupWebSocketEventHandlers()
  }

  /**
   * @brief Setup WebSocket event listeners for real-time game updates
   */
  private setupWebSocketEventHandlers(): void {
    try {
      // Game lifecycle events
      this.addEventListener('game:started', this.handleGameStarted.bind(this) as EventListener)
      this.addEventListener('game:state_updated', this.handleGameStateUpdated.bind(this) as EventListener)
      this.addEventListener('game:move_received', this.handleMoveReceived.bind(this) as EventListener)
      this.addEventListener('game:paused', this.handleGamePaused.bind(this) as EventListener)
      this.addEventListener('game:resumed', this.handleGameResumed.bind(this) as EventListener)
      this.addEventListener('game:ended', this.handleGameEnded.bind(this) as EventListener)
      this.addEventListener('game:connection_error', this.handleConnectionError.bind(this) as EventListener)

      console.log('🎮 GameStore WebSocket event handlers setup')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to setup game WebSocket handlers'
      console.error('❌ Failed to setup game WebSocket handlers:', errorMessage)
      this.setError(errorMessage)
    }
  }

  /**
   * @brief Add event listener and track for cleanup
   */
  private addEventListener(eventType: string, handler: EventListener): void {
    document.addEventListener(eventType, handler)
    this.eventListeners.set(eventType, handler)
  }

  /**
   * @brief Clean up all event listeners
   */
  private cleanupEventListeners(): void {
    this.eventListeners.forEach((handler, eventType) => {
      document.removeEventListener(eventType, handler)
    })
    this.eventListeners.clear()
  }

  /**
   * @brief Handle game started event from WebSocket
   */
  private handleGameStarted(event: CustomEvent): void {
    try {
      const { gameId, gameState } = event.detail
      console.log(`🎮 Game started: ${gameId}`)
      
      // Update store state
      this.setState({
        isPlaying: true,
        status: 'playing',
        loading: false,
        error: null
      })

      // Update current game with new state if available
      const currentState = this.getState()
      if (gameState && currentState.currentGame) {
        const updatedGame: GameSession = {
          ...currentState.currentGame,
          id: gameId
        }
        this.setState({ currentGame: updatedGame })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error handling game started event'
      console.error('❌ Error handling game started event:', errorMessage)
      this.setError(errorMessage)
    }
  }

  /**
   * @brief Handle game state update event from WebSocket
   */
  private handleGameStateUpdated(event: CustomEvent): void {
    try {
      const { gameId, gameState } = event.detail
      const currentState = this.getState()
      
      if (!currentState.currentGame || currentState.currentGame.id !== gameId) {
        return // Not our game
      }

      // Update game state with new data
      if (gameState) {
        const updatedGame: GameSession = {
          ...currentState.currentGame,
          ...gameState
        }
        this.setState({ currentGame: updatedGame })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error handling game state update'
      console.error('❌ Error handling game state update:', errorMessage)
    }
  }

  /**
   * @brief Handle player move received from WebSocket
   */
  private handleMoveReceived(event: CustomEvent): void {
    try {
      const { gameId, move } = event.detail
      const currentState = this.getState()
      
      if (!currentState.currentGame || currentState.currentGame.id !== gameId) {
        return // Not our game
      }

      // Update player positions if the move data contains paddle information
      if (move && move.paddlePosition !== undefined && move.playerId) {
        this.updatePlayerPosition(move.playerId, move.paddlePosition)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error handling game move'
      console.error('❌ Error handling game move:', errorMessage)
    }
  }

  /**
   * @brief Handle game paused event from WebSocket
   */
  private handleGamePaused(event: CustomEvent): void {
    try {
      const { gameId } = event.detail
      const currentState = this.getState()
      
      if (!currentState.currentGame || currentState.currentGame.id !== gameId) {
        return // Not our game
      }

      this.setState({ status: 'paused' })
      console.log(`⏸️ Game paused: ${gameId}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error handling game pause'
      console.error('❌ Error handling game pause:', errorMessage)
    }
  }

  /**
   * @brief Handle game resumed event from WebSocket
   */
  private handleGameResumed(event: CustomEvent): void {
    try {
      const { gameId } = event.detail
      const currentState = this.getState()
      
      if (!currentState.currentGame || currentState.currentGame.id !== gameId) {
        return // Not our game
      }

      this.setState({ status: 'playing' })
      console.log(`▶️ Game resumed: ${gameId}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error handling game resume'
      console.error('❌ Error handling game resume:', errorMessage)
    }
  }

  /**
   * @brief Handle game ended event from WebSocket
   */
  private handleGameEnded(event: CustomEvent): void {
    try {
      const { gameId, result } = event.detail
      const currentState = this.getState()
      
      if (!currentState.currentGame || currentState.currentGame.id !== gameId) {
        return // Not our game
      }

      console.log(`🏁 Game ended: ${gameId}`, result)
      
      this.setState({
        isPlaying: false,
        status: 'finished'
      })

      // Update current game with final result
      if (result && currentState.currentGame) {
        // Log the result but don't add it to GameSession since it's not in the type
        console.log('🏁 Game result:', result)
        
        // Just keep the current game without adding result property
        this.setState({ currentGame: currentState.currentGame })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error handling game end'
      console.error('❌ Error handling game end:', errorMessage)
    }
  }

  /**
   * @brief Handle connection error from WebSocket
   */
  private handleConnectionError(event: CustomEvent): void {
    try {
      const { error } = event.detail
      const errorMessage = `Connection error: ${error}`
      
      console.error('🔌 Game WebSocket connection error:', error)
      this.setError(errorMessage)
      
      // If we were playing, pause the game
      const currentState = this.getState()
      if (currentState.isPlaying && currentState.status === 'playing') {
        this.setState({ status: 'paused' })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error handling connection error'
      console.error('❌ Error handling connection error:', errorMessage)
    }
  }

  /**
   * @brief Start real-time connection for current game
   */
  public async startRealTimeUpdates(gameId: string, authToken?: string): Promise<void> {
    const [error] = await catchErrorTyped(
      (async () => {
        const { gameService } = await import('../services/game/GameService')
        
        // Initialize WebSocket connection
        await gameService.initializeRealTimeConnection(authToken)
        
        // Join the game room
        await gameService.joinGameRoom(gameId)
        
        console.log(`🔌 Real-time updates started for game: ${gameId}`)
      })()
    )

    if (error) {
      const errorMessage = error.message || 'Failed to start real-time updates'
      console.error('❌ Failed to start real-time updates:', errorMessage)
      this.setError(errorMessage)
      throw new Error(errorMessage)
    }
  }

  /**
   * @brief Stop real-time connection
   */
  public async stopRealTimeUpdates(): Promise<void> {
    const [error] = await catchErrorTyped(
      (async () => {
        const { gameService } = await import('../services/game/GameService')
        
        // Disconnect WebSocket
        await gameService.disconnectRealTime()
        
        console.log('🔌 Real-time updates stopped')
      })()
    )

    if (error) {
      const errorMessage = error.message || 'Failed to stop real-time updates'
      console.error('❌ Failed to stop real-time updates:', errorMessage)
      this.setError(errorMessage)
      throw new Error(errorMessage)
    }
  }

  /**
   * @brief Send player move to the server
   */
  public async sendPlayerMove(move: { paddlePosition: number; playerId: string; timestamp: number }): Promise<void> {
    const [error] = await catchErrorTyped(
      (async () => {
        const { gameService } = await import('../services/game/GameService')
        
        // Send move through WebSocket
        await gameService.sendPlayerMove(move)
        
        console.log('📤 Player move sent successfully')
      })()
    )

    if (error) {
      const errorMessage = error.message || 'Failed to send player move'
      console.error('❌ Failed to send player move:', errorMessage)
      this.setError(errorMessage)
      throw new Error(errorMessage)
    }
  }

  /**
   * @brief Send ready signal via WebSocket
   */
  public async markPlayerReady(): Promise<void> {
    const [error] = await catchErrorTyped(
      (async () => {
        const { gameService } = await import('../services/game/GameService')
        await gameService.markPlayerReady()
      })()
    )

    if (error) {
      const errorMessage = error.message || 'Failed to mark player ready'
      console.error('❌ Failed to mark player ready:', errorMessage)
      this.setError(errorMessage)
      throw new Error(errorMessage)
    }
  }

  /**
   * @brief Pause game via WebSocket
   */
  public async pauseGameRealTime(): Promise<void> {
    const [error] = await catchErrorTyped(
      (async () => {
        const { gameService } = await import('../services/game/GameService')
        await gameService.pauseGame()
      })()
    )

    if (error) {
      const errorMessage = error.message || 'Failed to pause game'
      console.error('❌ Failed to pause game:', errorMessage)
      this.setError(errorMessage)
      throw new Error(errorMessage)
    }
  }

  /**
   * @brief Resume game via WebSocket
   */
  public async resumeGameRealTime(): Promise<void> {
    const [error] = await catchErrorTyped(
      (async () => {
        const { gameService } = await import('../services/game/GameService')
        await gameService.resumeGame()
      })()
    )

    if (error) {
      const errorMessage = error.message || 'Failed to resume game'
      console.error('❌ Failed to resume game:', errorMessage)
      this.setError(errorMessage)
      throw new Error(errorMessage)
    }
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
  endGame(_winner?: { playerId: string; username: string }): void {
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
   * @brief Clean up store resources
   * 
   * @description Cleans up event listeners and WebSocket connections
   */
  public cleanup(): void {
    this.cleanupEventListeners()
    this.stopRealTimeUpdates().catch(error => {
      console.warn('Error during cleanup:', error)
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