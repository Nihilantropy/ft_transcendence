/**
 * @brief Essential Socket.IO client service for ft_transcendence
 * 
 * @description Clean Socket.IO implementation with proper nginx proxy support.
 * Handles real-time features: friends, notifications, games, tournaments, chat.
 * Configured to work through nginx HTTPS proxy.
 */

import { io, Socket } from 'socket.io-client'

/**
 * @brief Socket.IO connection states
 */
export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error'

/**
 * @brief Socket.IO event definitions for type safety
 */
export interface SocketEvents {
  // Connection test events
  'ping': { test?: string, timestamp: number }
  'pong': { test?: string, timestamp: number }
  
  // Friend system events
  'friend:request_received': { requestId: string, fromUser: any }
  'friend:request_accepted': { requestId: string, user: any }
  'friend:request_declined': { requestId: string }
  'friend:removed': { userId: string }
  
  // Online status events
  'user:online': { userId: string, status: string }
  'user:offline': { userId: string, lastSeen: string }
  'user:status_update': { status: string }
  'user:status_change': { userId: string, status: string, lastSeen?: string }
  
  // Connection events
  'connection:state_change': { state: ConnectionState }
  'connection:error': { error: string, code?: string }
  
  // Notification events
  'notification:send': { notification: any }
  'notification:received': { notification: any }
  'notification:read': { notificationId: string }
  'notification:delete': { notificationId: string }
  'notification:deleted': { notificationId: string }
  'notification:bulk_read': { notificationIds: string[] }
  
  // Game events
  'game:create': { gameConfig: any }
  'game:join': { gameId: string }
  'game:leave': { gameId: string }
  'game:ready': { gameId: string }
  'game:start': { gameId: string, gameState: any }
  'game:move': { gameId: string, move: any }
  'game:update': { gameId: string, gameState: any }
  'game:end': { gameId: string, result: any }
  'game:pause': { gameId: string }
  'game:resume': { gameId: string }
  
  // Tournament events
  'tournament:create': { tournamentConfig: any }
  'tournament:join': { tournamentId: string }
  'tournament:leave': { tournamentId: string }
  'tournament:start': { tournamentId: string }
  'tournament:match_start': { tournamentId: string, matchId: string }
  'tournament:match_end': { tournamentId: string, matchId: string, result: any }
  'tournament:update': { tournamentId: string, tournament: any }
  'tournament:end': { tournamentId: string, winner: any }
  
  // Chat events
  'chat:join': { roomId: string }
  'chat:leave': { roomId: string }
  'chat:message': { roomId: string, message: string }
  'chat:message_received': { roomId: string, message: any }
  'chat:typing': { roomId: string, isTyping: boolean }
  'chat:user_typing': { roomId: string, userId: string, isTyping: boolean }
}

/**
 * @brief Event handler function type  
 */
export type SocketEventHandler = (...args: any[]) => void

/**
 * @brief Essential Socket.IO service
 */
class WebSocketService {
  private socket: Socket | null = null
  private connectionState: ConnectionState = 'disconnected'
  private readonly serverUrl: string
  private pendingHandlers: Map<string, SocketEventHandler[]> = new Map()

  constructor() {
    // ✅ Use nginx proxy URL for Socket.IO connection
    // In development: connects through nginx proxy (https://localhost)
    // In production: connects to the actual domain
    this.serverUrl = import.meta.env.VITE_WEBSOCKET_URL || window.location.origin
    console.log('🔌 Socket.IO service initialized:', this.serverUrl)
  }

  /**
   * @brief Connect to Socket.IO server
   */
  async connect(token?: string): Promise<void> {
    if (this.socket?.connected) {
      console.log('🔌 Already connected')
      return
    }

    this.connectionState = 'connecting'

    try {
      // Initialize Socket.IO client with nginx proxy configuration
      this.socket = io(this.serverUrl, {
        // ✅ Use both transports for reliability
        transports: ['websocket', 'polling'],
        timeout: 10000,
        // ✅ Authentication with JWT token
        auth: token ? { token } : undefined,
        autoConnect: false,
        // ✅ Additional options for nginx proxy
        upgrade: true,
        rememberUpgrade: true,
        // ✅ Force new connection to avoid cached issues
        forceNew: false,
      })

      // Connection event handlers
      this.socket.on('connect', () => {
        this.connectionState = 'connected'
        console.log('✅ Socket.IO connected:', this.socket?.id)
        this.applyPendingHandlers()
        this.emit('connection:state_change', { state: 'connected' })
      })

      this.socket.on('disconnect', (reason: string) => {
        this.connectionState = 'disconnected'
        console.log('🔌 Socket.IO disconnected:', reason)
        this.emit('connection:state_change', { state: 'disconnected' })
      })

      this.socket.on('connect_error', (error: Error) => {
        this.connectionState = 'error'
        console.error('❌ Socket.IO connection error:', error)
        this.emit('connection:error', { 
          error: error.message, 
          code: (error as any).code || 'CONNECTION_ERROR'
        })
      })

      // ✅ Manual connection for better control
      this.socket.connect()

      // Wait for connection or timeout
      await new Promise<void>((resolve, reject) => {
        if (!this.socket) return reject(new Error('Socket not initialized'))

        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'))
        }, 10000)

        this.socket.once('connect', () => {
          clearTimeout(timeout)
          resolve()
        })

        this.socket.once('connect_error', (error: Error) => {
          clearTimeout(timeout)
          reject(error)
        })
      })

    } catch (error) {
      this.connectionState = 'error'
      console.error('❌ Failed to connect to Socket.IO:', error)
      throw error
    }
  }

  /**
   * @brief Disconnect from Socket.IO server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.connectionState = 'disconnected'
    console.log('🔌 Socket.IO service disconnected')
  }

  /**
   * @brief Check if currently connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false
  }

  /**
   * @brief Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState
  }

  /**
   * @brief Emit event to server
   */
  emit(event: string, data: any): void {
    if (!this.socket?.connected) {
      console.warn('⚠️ Cannot emit - Socket.IO not connected')
      return
    }
    this.socket.emit(event, data)
  }

  /**
   * @brief Listen for events from server (supports deferred registration)
   */
  on<K extends keyof SocketEvents>(event: K, handler: SocketEventHandler): void {
    if (!this.socket) {
      // Store handler for later when socket is initialized
      const eventName = event as string
      if (!this.pendingHandlers.has(eventName)) {
        this.pendingHandlers.set(eventName, [])
      }
      this.pendingHandlers.get(eventName)!.push(handler)
      return
    }
    this.socket.on(event as string, handler)
  }

  /**
   * @brief Apply pending handlers when socket connects
   */
  private applyPendingHandlers(): void {
    if (!this.socket) return
    
    for (const [event, handlers] of this.pendingHandlers) {
      for (const handler of handlers) {
        this.socket.on(event, handler)
      }
    }
    this.pendingHandlers.clear()
  }

  /**
   * @brief Remove event listener
   */
  off<K extends keyof SocketEvents>(event: K, handler: SocketEventHandler): void {
    if (!this.socket) return
    this.socket.off(event as string, handler)
  }

  /**
   * @brief Join a Socket.IO room
   */
  joinRoom(roomId: string): void {
    this.emit('join_room', { roomId })
  }

  /**
   * @brief Leave a Socket.IO room
   */
  leaveRoom(roomId: string): void {
    this.emit('leave_room', { roomId })
  }

  /**
   * @brief Update user presence status
   */
  updateStatus(status: string): void {
    this.emit('user:status_update', { status })
  }

  /**
   * @brief Subscribe to user presence updates
   */
  subscribeToPresence(userIds: string[]): void {
    this.emit('presence:subscribe', { userIds })
  }

  /**
   * @brief Unsubscribe from user presence updates
   */
  unsubscribeFromPresence(userIds: string[]): void {
    this.emit('presence:unsubscribe', { userIds })
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService()
export default webSocketService