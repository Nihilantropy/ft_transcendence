/**
 * @brief WebSocket service for real-time game management
 * 
 * @description Handles game rooms, player connections, and real-time sync
 */

import { WebSocket } from 'ws';

interface GameRoom {
  id: string;
  gameId: number;
  players: Map<number, WebSocket>;
  spectators: Set<WebSocket>;
  gameState?: any; // Will be expanded for server-side Pong
}

interface WebSocketMessage {
  type: string;
  data?: any;
  gameId?: number;
  playerId?: number;
}

class WebSocketService {
  private rooms: Map<string, GameRoom> = new Map();
  private connections: Map<WebSocket, { userId?: number; roomId?: string }> = new Map();

  /**
   * @brief Add client connection
   * 
   * @param ws WebSocket connection
   * @param userId User ID if authenticated
   * @return void
   */
  addConnection(ws: WebSocket, userId?: number): void {
    this.connections.set(ws, { userId });

    ws.on('message', (data) => this.handleMessage(ws, data));
    ws.on('close', () => this.removeConnection(ws));
    
    this.sendMessage(ws, { type: 'connected', data: { userId } });
  }

  /**
   * @brief Remove client connection
   * 
   * @param ws WebSocket connection
   * @return void
   */
  private removeConnection(ws: WebSocket): void {
    const connection = this.connections.get(ws);
    if (connection?.roomId) {
      this.leaveRoom(ws, connection.roomId);
    }
    this.connections.delete(ws);
  }

  /**
   * @brief Handle incoming WebSocket message
   * 
   * @param ws WebSocket connection
   * @param data Raw message data
   * @return void
   */
  private handleMessage(ws: WebSocket, data: any): void {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'join_game':
          this.handleJoinGame(ws, message);
          break;
        case 'player_move':
          this.handlePlayerMove(ws, message);
          break;
        case 'game_action':
          this.handleGameAction(ws, message);
          break;
        default:
          this.sendMessage(ws, { 
            type: 'error', 
            data: { message: 'Unknown message type' }
          });
      }
    } catch (error) {
      this.sendMessage(ws, { 
        type: 'error', 
        data: { message: 'Invalid message format' }
      });
    }
  }

  /**
   * @brief Handle player joining game
   * 
   * @param ws WebSocket connection
   * @param message Join game message
   * @return void
   */
  private handleJoinGame(ws: WebSocket, message: WebSocketMessage): void {
    const { gameId } = message;
    if (!gameId) return;

    const roomId = `game_${gameId}`;
    const connection = this.connections.get(ws);
    
    if (!connection?.userId) {
      this.sendMessage(ws, { 
        type: 'error', 
        data: { message: 'Authentication required' }
      });
      return;
    }

    this.joinRoom(ws, roomId, gameId, connection.userId);
  }

  /**
   * @brief Handle player movement
   * 
   * @param ws WebSocket connection
   * @param message Move message
   * @return void
   */
  private handlePlayerMove(ws: WebSocket, message: WebSocketMessage): void {
    const connection = this.connections.get(ws);
    if (!connection?.roomId) return;

    const room = this.rooms.get(connection.roomId);
    if (!room) return;

    // Broadcast move to other players in room
    this.broadcastToRoom(connection.roomId, {
      type: 'player_move',
      data: message.data,
      playerId: connection.userId,
    }, ws);
  }

  /**
   * @brief Handle game actions (start, pause, etc.)
   * 
   * @param ws WebSocket connection
   * @param message Action message
   * @return void
   */
  private handleGameAction(ws: WebSocket, message: WebSocketMessage): void {
    const connection = this.connections.get(ws);
    if (!connection?.roomId) return;

    // TODO: Implement server-side game logic here
    this.broadcastToRoom(connection.roomId, {
      type: 'game_action',
      data: message.data,
    });
  }

  /**
   * @brief Join player to game room
   * 
   * @param ws WebSocket connection
   * @param roomId Room identifier
   * @param gameId Game ID
   * @param playerId Player ID
   * @return void
   */
  private joinRoom(ws: WebSocket, roomId: string, gameId: number, playerId: number): void {
    let room = this.rooms.get(roomId);
    
    if (!room) {
      room = {
        id: roomId,
        gameId,
        players: new Map(),
        spectators: new Set(),
      };
      this.rooms.set(roomId, room);
    }

    // Add as player or spectator
    if (room.players.size < 2) {
      room.players.set(playerId, ws);
    } else {
      room.spectators.add(ws);
    }

    // Update connection info
    const connection = this.connections.get(ws);
    if (connection) {
      connection.roomId = roomId;
    }

    this.sendMessage(ws, {
      type: 'joined_game',
      data: {
        roomId,
        gameId,
        playersCount: room.players.size,
        spectatorsCount: room.spectators.size,
      },
    });

    // Notify other players
    this.broadcastToRoom(roomId, {
      type: 'player_joined',
      data: { playerId, playersCount: room.players.size },
    }, ws);
  }

  /**
   * @brief Remove player from room
   * 
   * @param ws WebSocket connection
   * @param roomId Room identifier
   * @return void
   */
  private leaveRoom(ws: WebSocket, roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const connection = this.connections.get(ws);
    if (connection?.userId) {
      room.players.delete(connection.userId);
    }
    room.spectators.delete(ws);

    // Clean up empty rooms
    if (room.players.size === 0 && room.spectators.size === 0) {
      this.rooms.delete(roomId);
    } else {
      // Notify remaining players
      this.broadcastToRoom(roomId, {
        type: 'player_left',
        data: { playerId: connection?.userId, playersCount: room.players.size },
      });
    }
  }

  /**
   * @brief Broadcast message to all clients in room
   * 
   * @param roomId Room identifier
   * @param message Message to broadcast
   * @param excludeWs WebSocket to exclude from broadcast
   * @return void
   */
  private broadcastToRoom(roomId: string, message: any, excludeWs?: WebSocket): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const messageStr = JSON.stringify(message);

    // Broadcast to players
    room.players.forEach((ws) => {
      if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    });

    // Broadcast to spectators
    room.spectators.forEach((ws) => {
      if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    });
  }

  /**
   * @brief Send message to specific WebSocket
   * 
   * @param ws WebSocket connection
   * @param message Message to send
   * @return void
   */
  private sendMessage(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * @brief Get room information
   * 
   * @param roomId Room identifier
   * @return Room info or null
   */
  getRoomInfo(roomId: string): any {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    return {
      id: room.id,
      gameId: room.gameId,
      playersCount: room.players.size,
      spectatorsCount: room.spectators.size,
    };
  }
}

export const wsService = new WebSocketService();