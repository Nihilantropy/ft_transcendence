/**
 * @brief Game Service for ft_transcendence
 * 
 * @description Handles game-related API operations including game creation,
 * joining, status management, and game state synchronization.
 */

import { ApiService } from '../api/BaseApiService'
import type { ApiResponse } from '../api/BaseApiService'
import { catchErrorTyped } from '../error'
import { authService } from '../auth/AuthService'
import { webSocketService, type SocketEventHandler } from '../websocket'
import type { 
  GameSession, 
  GameSettings
} from '../../types'

export interface CreateGameRequest {
  type: 'classic' | 'tournament' | 'ai'
  settings?: GameSettings
}

export interface JoinGameResponse {
  game: GameSession
  message: string
}

export interface ReadyResponse {
  message: string
  allPlayersReady: boolean
}

export interface AvailableGamesResponse {
  games: GameSession[]
}

/**
 * @brief Game service class for managing game operations
 */
export class GameService extends ApiService {
  private static instance: GameService
  private eventHandlers: Map<string, SocketEventHandler> = new Map()
  private currentGameId: string | null = null
  private isWebSocketConnected: boolean = false

  /**
   * @brief Get singleton instance
   */
  public static getInstance(): GameService {
    if (!GameService.instance) {
      GameService.instance = new GameService()
    }
    return GameService.instance
  }

  /**
   * @brief Initialize WebSocket connection for real-time game events
   */
  public async initializeRealTimeConnection(authToken?: string): Promise<void> {
    const [error] = await catchErrorTyped(
      (async () => {
        // Connect WebSocket if not already connected
        if (!webSocketService.isConnected()) {
          await webSocketService.connect(authToken)
        }

        // Setup game event listeners
        this.setupGameEventHandlers()
        this.isWebSocketConnected = true

        console.log('🎮 Game WebSocket connection initialized')
      })()
    )

    if (error) {
      console.error('❌ Failed to initialize game WebSocket:', error.message)
      throw new Error(error.message || 'Failed to initialize WebSocket connection')
    }
  }

  /**
   * @brief Disconnect WebSocket and clean up event listeners
   */
  public disconnectRealTime(): void {
    this.cleanupEventHandlers()
    this.isWebSocketConnected = false
    this.currentGameId = null
    console.log('🔌 Game WebSocket disconnected')
  }

  /**
   * @brief Setup WebSocket event handlers for game events
   */
  private setupGameEventHandlers(): void {
    const handlers: Array<[string, SocketEventHandler]> = [
      ['game:start', this.handleGameStart.bind(this)],
      ['game:update', this.handleGameUpdate.bind(this)],
      ['game:move', this.handleGameMove.bind(this)],
      ['game:pause', this.handleGamePause.bind(this)],
      ['game:resume', this.handleGameResume.bind(this)],
      ['game:end', this.handleGameEnd.bind(this)],
      ['connection:error', this.handleConnectionError.bind(this)]
    ]

    handlers.forEach(([event, handler]) => {
      webSocketService.on(event, handler)
      this.eventHandlers.set(event, handler)
    })
  }

  /**
   * @brief Clean up WebSocket event handlers
   */
  private cleanupEventHandlers(): void {
    this.eventHandlers.forEach((handler, event) => {
      webSocketService.off(event, handler)
    })
    this.eventHandlers.clear()
  }

  /**
   * @brief Join a game room for real-time updates
   */
  public async joinGameRoom(gameId: string): Promise<void> {
    const [error] = await catchErrorTyped(
      (async () => {
        if (!this.isWebSocketConnected) {
          throw new Error('WebSocket not connected. Call initializeRealTimeConnection first.')
        }

        this.currentGameId = gameId
        webSocketService.joinRoom(gameId)
        
        // Emit join event
        webSocketService.emit('game:join', { gameId })
        
        console.log(`🎮 Joined game room: ${gameId}`)
      })()
    )

    if (error) {
      console.error('❌ Failed to join game room:', error.message)
      throw new Error(error.message || 'Failed to join game room')
    }
  }

  /**
   * @brief Leave current game room
   */
  public async leaveGameRoom(): Promise<void> {
    const [error] = await catchErrorTyped(
      (async () => {
        if (!this.currentGameId) {
          return // Nothing to leave
        }

        const gameId = this.currentGameId
        webSocketService.emit('game:leave', { gameId })
        webSocketService.leaveRoom(gameId)
        
        this.currentGameId = null
        console.log(`🚪 Left game room: ${gameId}`)
      })()
    )

    if (error) {
      console.error('❌ Failed to leave game room:', error.message)
    }
  }

  /**
   * @brief Send player ready signal
   */
  public async markPlayerReady(): Promise<void> {
    const [error] = await catchErrorTyped(
      (async () => {
        if (!this.currentGameId) {
          throw new Error('No active game session')
        }

        webSocketService.emit('game:ready', { gameId: this.currentGameId })
        console.log(`✋ Player marked ready for game: ${this.currentGameId}`)
      })()
    )

    if (error) {
      console.error('❌ Failed to mark player ready:', error.message)
      throw new Error(error.message || 'Failed to mark player ready')
    }
  }

  /**
   * @brief Send player move update
   */
  public sendPlayerMove(move: { paddlePosition: number; playerId: string; timestamp: number }): void {
    try {
      if (!this.currentGameId) {
        console.warn('No active game session for move')
        return
      }

      webSocketService.emit('game:move', {
        gameId: this.currentGameId,
        move
      })
    } catch (error) {
      console.error('❌ Failed to send player move:', error instanceof Error ? error.message : 'Unknown error')
    }
  }

  /**
   * @brief Send pause game request
   */
  public async pauseGame(): Promise<void> {
    const [error] = await catchErrorTyped(
      (async () => {
        if (!this.currentGameId) {
          throw new Error('No active game session')
        }

        webSocketService.emit('game:pause', { gameId: this.currentGameId })
        console.log(`⏸️ Pause request sent for game: ${this.currentGameId}`)
      })()
    )

    if (error) {
      console.error('❌ Failed to pause game:', error.message)
      throw new Error(error.message || 'Failed to pause game')
    }
  }

  /**
   * @brief Send resume game request
   */
  public async resumeGame(): Promise<void> {
    const [error] = await catchErrorTyped(
      (async () => {
        if (!this.currentGameId) {
          throw new Error('No active game session')
        }

        webSocketService.emit('game:resume', { gameId: this.currentGameId })
        console.log(`▶️ Resume request sent for game: ${this.currentGameId}`)
      })()
    )

    if (error) {
      console.error('❌ Failed to resume game:', error.message)
      throw new Error(error.message || 'Failed to resume game')
    }
  }

  // Event handlers for incoming WebSocket events
  private handleGameStart(data: { gameId: string; gameState: any }): void {
    console.log(`🎮 Game started: ${data.gameId}`)
    this.currentGameId = data.gameId
    this.emitGameEvent('game:started', data)
  }

  private handleGameUpdate(data: { gameId: string; gameState: any }): void {
    if (data.gameId === this.currentGameId) {
      this.emitGameEvent('game:state_updated', data)
    }
  }

  private handleGameMove(data: { gameId: string; move: any }): void {
    if (data.gameId === this.currentGameId) {
      this.emitGameEvent('game:move_received', data)
    }
  }

  private handleGamePause(data: { gameId: string }): void {
    if (data.gameId === this.currentGameId) {
      console.log(`⏸️ Game paused: ${data.gameId}`)
      this.emitGameEvent('game:paused', data)
    }
  }

  private handleGameResume(data: { gameId: string }): void {
    if (data.gameId === this.currentGameId) {
      console.log(`▶️ Game resumed: ${data.gameId}`)
      this.emitGameEvent('game:resumed', data)
    }
  }

  private handleGameEnd(data: { gameId: string; result: any }): void {
    if (data.gameId === this.currentGameId) {
      console.log(`🏁 Game ended: ${data.gameId}`)
      this.emitGameEvent('game:ended', data)
      this.currentGameId = null
    }
  }

  private handleConnectionError(data: { error: string; code?: string }): void {
    console.error('🔌 Game WebSocket connection error:', data.error)
    this.isWebSocketConnected = false
    this.emitGameEvent('game:connection_error', data)
  }

  /**
   * @brief Emit custom game event for other parts of the application
   */
  private emitGameEvent(eventType: string, data: any): void {
    const event = new CustomEvent(eventType, { detail: data })
    document.dispatchEvent(event)
  }

  /**
   * @brief Check if WebSocket is connected and ready for real-time gaming
   */
  public isRealTimeReady(): boolean {
    return this.isWebSocketConnected && webSocketService.isConnected()
  }

  /**
   * @brief Get current game ID
   */
  public getCurrentGameId(): string | null {
    return this.currentGameId
  }

  /**
   * @brief Make authenticated API request
   */
  private async makeAuthenticatedRequest<T>(
    endpoint: string, 
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: unknown
  ): Promise<ApiResponse<T>> {
    if (!authService.isAuthenticated()) {
      throw new Error('Authentication required')
    }

    const token = authService.getAuthToken()
    if (!token) {
      throw new Error('Authentication required - no token available')
    }

    const [error, response] = await catchErrorTyped(
      (async () => {
        // Make authenticated request using fetch directly since we need to add auth headers
        const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
        const url = `${baseUrl}${endpoint}`
        
        const options: RequestInit = {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }

        if (data && (method === 'POST' || method === 'PUT')) {
          options.body = JSON.stringify(data)
        }

        console.log(`🌐 Making authenticated ${method} request to:`, url)
        
        const response = await fetch(url, options)
        const responseData = await response.json()

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${responseData.message || response.statusText}`)
        }
        
        return {
          data: responseData,
          success: true,
          status: response.status,
          timestamp: Date.now()
        }
      })()
    )

    if (error) {
      throw new Error(error.message || `Request failed for ${endpoint}`)
    }

    return response!
  }

  /**
   * @brief Create a new game session
   */
  public async createGame(request: CreateGameRequest): Promise<GameSession> {
    console.log('🎮 Creating game:', request)
    
    const [error, response] = await catchErrorTyped(
      this.makeAuthenticatedRequest<GameSession>('/games', 'POST', request)
    )

    if (error) {
      console.error('❌ Game creation failed:', error.message)
      throw new Error(error.message || 'Failed to create game')
    }

    if (response?.success && response.data) {
      console.log('✅ Game created successfully:', response.data)
      return response.data
    }

    throw new Error('Failed to create game - invalid response')
  }

  /**
   * @brief Get list of available games to join
   */
  public async getAvailableGames(): Promise<GameSession[]> {
    console.log('🔍 Fetching available games')
    
    const [error, response] = await catchErrorTyped(
      this.makeAuthenticatedRequest<AvailableGamesResponse>('/games/available')
    )

    if (error) {
      console.error('❌ Failed to fetch available games:', error.message)
      throw new Error(error.message || 'Failed to fetch available games')
    }

    if (response?.success && response.data && response.data.games) {
      console.log('✅ Available games fetched:', response.data.games.length, 'games')
      return response.data.games
    }

    console.log('📝 No available games found')
    return []
  }

  /**
   * @brief Join an existing game session
   */
  public async joinGame(gameId: string): Promise<JoinGameResponse> {
    console.log('🎯 Joining game:', gameId)
    
    const [error, response] = await catchErrorTyped(
      this.makeAuthenticatedRequest<JoinGameResponse>(`/games/${gameId}/join`, 'POST')
    )

    if (error) {
      console.error('❌ Failed to join game:', error.message)
      throw new Error(error.message || 'Failed to join game')
    }

    if (response?.success && response.data) {
      console.log('✅ Successfully joined game:', response.data)
      return response.data
    }

    throw new Error('Failed to join game - invalid response')
  }

  /**
   * @brief Get detailed information about a specific game
   */
  public async getGame(gameId: string): Promise<GameSession> {
    console.log('📋 Fetching game details:', gameId)
    
    const [error, response] = await catchErrorTyped(
      this.makeAuthenticatedRequest<{ game: GameSession }>(`/games/${gameId}`)
    )

    if (error) {
      console.error('❌ Failed to fetch game details:', error.message)
      throw new Error(error.message || 'Failed to fetch game details')
    }

    if (response?.success && response.data && response.data.game) {
      console.log('✅ Game details fetched:', response.data.game)
      return response.data.game
    }

    throw new Error('Failed to fetch game details - invalid response')
  }

  /**
   * @brief Mark player as ready for the game
   */
  public async markReady(gameId: string): Promise<ReadyResponse> {
    console.log('✋ Marking ready for game:', gameId)
    
    const [error, response] = await catchErrorTyped(
      this.makeAuthenticatedRequest<ReadyResponse>(`/games/${gameId}/ready`, 'POST')
    )

    if (error) {
      console.error('❌ Failed to mark ready:', error.message)
      throw new Error(error.message || 'Failed to mark ready')
    }

    if (response?.success && response.data) {
      console.log('✅ Successfully marked ready:', response.data)
      return response.data
    }

    throw new Error('Failed to mark ready - invalid response')
  }

  /**
   * @brief Check if user can create a game (has required authentication)
   */
  public canCreateGame(): boolean {
    return authService.isAuthenticated()
  }

  /**
   * @brief Check if user can join games (has required authentication)
   */
  public canJoinGame(): boolean {
    return authService.isAuthenticated()
  }

  /**
   * @brief Get current user's game status
   */
  public async getCurrentUserGame(): Promise<GameSession | null> {
    try {
      const availableGames = await this.getAvailableGames()
      const currentUser = authService.getCurrentUser()
      
      if (!currentUser) {
        return null
      }

      // Find game where current user is a player
      const userGame = availableGames.find(game => 
        game.players.some(player => player.id === currentUser.id)
      )

      return userGame || null
    } catch (error) {
      console.error('❌ Failed to get current user game:', error)
      return null
    }
  }

  /**
   * @brief Validate game creation request
   */
  public validateCreateGameRequest(request: CreateGameRequest): boolean {
    if (!request.type || !['classic', 'tournament', 'ai'].includes(request.type)) {
      return false
    }

    // Optional settings validation
    if (request.settings) {
      const settings = request.settings
      if (typeof settings.ballSpeed !== 'number' || settings.ballSpeed <= 0) {
        return false
      }
      if (typeof settings.paddleSpeed !== 'number' || settings.paddleSpeed <= 0) {
        return false
      }
      if (typeof settings.maxScore !== 'number' || settings.maxScore <= 0) {
        return false
      }
    }

    return true
  }
}

// Export singleton instance
export const gameService = GameService.getInstance()