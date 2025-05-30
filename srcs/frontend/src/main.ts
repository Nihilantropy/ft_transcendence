/**
 * @brief Main application entry point with modular architecture
 * 
 * @description Initializes SPA with game engine, API service, and routing
 */

import './styles.css';
import { apiService } from '@/api/apiService';
import { PongEngine } from '@/game/pongEngine';
import type { Route } from '@/types';

class App {
  private pongEngine: PongEngine | null = null;
  private currentRoute: Route = '/';

  /**
   * @brief Initialize the application
   * 
   * @return void
   */
  init(): void {
    this.setupRouting();
    this.setupUI();
    this.checkBackendHealth();
    this.initializeGame();
  }

  /**
   * @brief Setup SPA routing
   * 
   * @return void
   */
  private setupRouting(): void {
    window.addEventListener('popstate', () => this.handleRoute());
    
    // Handle navigation clicks
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('nav-link')) {
        e.preventDefault();
        const href = target.getAttribute('href') as Route;
        if (href) {
          this.navigateTo(href);
        }
      }
    });

    this.handleRoute();
  }

  /**
   * @brief Navigate to route
   * 
   * @param route Target route
   * @return void
   */
  private navigateTo(route: Route): void {
    window.history.pushState({}, '', route);
    this.handleRoute();
  }

  /**
   * @brief Handle current route
   * 
   * @return void
   */
  private handleRoute(): void {
    this.currentRoute = window.location.pathname as Route;
    this.updateActiveNavigation();
    
    // Simple route handling - can be expanded
    console.log(`Navigated to: ${this.currentRoute}`);
  }

  /**
   * @brief Update active navigation link
   * 
   * @return void
   */
  private updateActiveNavigation(): void {
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('nav-link-active');
      if (link.getAttribute('href') === this.currentRoute) {
        link.classList.add('nav-link-active');
      }
    });
  }

  /**
   * @brief Setup UI event handlers
   * 
   * @return void
   */
  private setupUI(): void {
    const quickMatchBtn = document.querySelector('.btn-primary');
    const tournamentBtn = document.querySelector('.btn-secondary');
    
    quickMatchBtn?.addEventListener('click', () => this.startQuickMatch());
    tournamentBtn?.addEventListener('click', () => this.createTournament());
  }

  /**
   * @brief Initialize Pong game
   * 
   * @return void
   */
  private initializeGame(): void {
    const canvas = document.getElementById('pong-canvas') as HTMLCanvasElement;
    if (canvas) {
      this.pongEngine = new PongEngine(canvas);
    }
  }

  /**
   * @brief Start quick match
   * 
   * @return void
   */
  private async startQuickMatch(): Promise<void> {
    if (!this.pongEngine) {
      console.error('Game engine not initialized');
      return;
    }

    // Start local game for now
    this.pongEngine.startGame('Player 1', 'Player 2');
    
    // Setup WebSocket for real-time multiplayer (future)
    apiService.connectWebSocket(
      (data) => this.handleWebSocketMessage(data),
      (error) => console.error('WebSocket error:', error)
    );

    this.updateScoreDisplay();
  }

  /**
   * @brief Create tournament
   * 
   * @return void
   */
  private createTournament(): void {
    // TODO: Implement tournament creation
    console.log('Tournament creation not implemented yet');
  }

  /**
   * @brief Handle WebSocket messages
   * 
   * @param data Message data
   * @return void
   */
  private handleWebSocketMessage(data: any): void {
    console.log('WebSocket message:', data);
    
    switch (data.type) {
      case 'game_update':
        // Handle real-time game updates
        break;
      case 'player_move':
        // Handle opponent moves
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  }

  /**
   * @brief Update score display
   * 
   * @return void
   */
  private updateScoreDisplay(): void {
    const updateLoop = () => {
      if (this.pongEngine) {
        const gameState = this.pongEngine.getGameState();
        if (gameState) {
          const scoreElements = document.querySelectorAll('.pong-score');
          if (scoreElements.length >= 2) {
            scoreElements[0].textContent = gameState.score.player1.toString();
            scoreElements[1].textContent = gameState.score.player2.toString();
          }

          // Check for game end
          if (gameState.status === 'finished') {
            this.handleGameEnd(gameState);
            return;
          }
        }
      }
      
      requestAnimationFrame(updateLoop);
    };
    
    updateLoop();
  }

  /**
   * @brief Handle game end
   * 
   * @param gameState Final game state
   * @return void
   */
  private handleGameEnd(gameState: any): void {
    const winner = gameState.score.player1 > gameState.score.player2 
      ? gameState.player1.username 
      : gameState.player2.username;
    
    alert(`Game Over! ${winner} wins!`);
    
    // Reset for new game
    setTimeout(() => {
      if (this.pongEngine) {
        this.pongEngine.startGame();
      }
    }, 2000);
  }

  /**
   * @brief Check backend connectivity
   * 
   * @return void
   */
  private async checkBackendHealth(): Promise<void> {
    const response = await apiService.healthCheck();
    
    if (response.success) {
      console.log('Backend connected:', response.data);
    } else {
      console.error('Backend connection failed:', response.error);
    }
  }
}

// Initialize application
const app = new App();
document.addEventListener('DOMContentLoaded', () => app.init());