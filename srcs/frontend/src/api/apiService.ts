/**
 * @brief API service for backend communication
 * 
 * @description Handles HTTP requests and WebSocket connections
 */

import type { ApiResponse, GameState, Player, Tournament } from '@/types';

class ApiService {
  private baseUrl: string;
  private wsConnection: WebSocket | null = null;

  constructor() {
    this.baseUrl = window.location.origin + '/api';
  }

  /**
   * @brief Make HTTP request to backend
   * 
   * @param endpoint API endpoint
   * @param options Fetch options
   * @return Promise<ApiResponse>
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: data.error || { code: 'HTTP_ERROR', message: 'Request failed' },
        };
      }

      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network error',
        },
      };
    }
  }

  /**
   * @brief Check backend health
   * 
   * @return Promise<ApiResponse>
   */
  async healthCheck(): Promise<ApiResponse> {
    return this.request('/health');
  }

  /**
   * @brief Create new game
   * 
   * @param player1 Player 1 name
   * @param player2 Player 2 name
   * @return Promise<ApiResponse<GameState>>
   */
  async createGame(player1: string, player2: string): Promise<ApiResponse<GameState>> {
    return this.request('/game/create', {
      method: 'POST',
      body: JSON.stringify({ player1, player2 }),
    });
  }

  /**
   * @brief Get game by ID
   * 
   * @param gameId Game ID
   * @return Promise<ApiResponse<GameState>>
   */
  async getGame(gameId: number): Promise<ApiResponse<GameState>> {
    return this.request(`/game/${gameId}`);
  }

  /**
   * @brief Update game score
   * 
   * @param gameId Game ID
   * @param player1Score Player 1 score
   * @param player2Score Player 2 score
   * @return Promise<ApiResponse<GameState>>
   */
  async updateScore(gameId: number, player1Score: number, player2Score: number): Promise<ApiResponse<GameState>> {
    return this.request(`/game/${gameId}/score`, {
      method: 'PUT',
      body: JSON.stringify({ player1Score, player2Score }),
    });
  }

  /**
   * @brief Connect to WebSocket for real-time updates
   * 
   * @param onMessage Message handler
   * @param onError Error handler
   * @return void
   */
  connectWebSocket(
    onMessage: (data: any) => void,
    onError?: (error: Event) => void
  ): void {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    this.wsConnection = new WebSocket(wsUrl);

    this.wsConnection.onopen = () => {
      console.log('WebSocket connected');
    };

    this.wsConnection.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    };

    this.wsConnection.onerror = (error) => {
      console.error('WebSocket error:', error);
      onError?.(error);
    };

    this.wsConnection.onclose = () => {
      console.log('WebSocket disconnected');
      this.wsConnection = null;
    };
  }

  /**
   * @brief Send WebSocket message
   * 
   * @param message Message to send
   * @return void
   */
  sendWebSocketMessage(message: any): void {
    if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
      this.wsConnection.send(JSON.stringify(message));
    }
  }

  /**
   * @brief Disconnect WebSocket
   * 
   * @return void
   */
  disconnectWebSocket(): void {
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
  }
}

export const apiService = new ApiService();