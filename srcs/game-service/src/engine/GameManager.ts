/**
 * @file Game Manager
 * @description Manages complete game state and game loop
 * Server-authoritative game logic with 60 TPS
 */

import { Physics } from './Physics.js';
import {
  GameState,
  GameMode,
  GameStatus,
  PlayerSide,
  Player,
  AIPlayer,
  InputAction,
  GameConfig,
  DEFAULT_GAME_CONFIG,
  Score,
  GameStatePayload,
  Paddle
} from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';

export class GameManager {
  private state: GameState;
  private physics: Physics;
  private gameLoopInterval?: NodeJS.Timeout;
  private readonly tickRate: number;
  private readonly tickDuration: number; // milliseconds per tick

  constructor(
    mode: GameMode,
    config: GameConfig = DEFAULT_GAME_CONFIG
  ) {
    this.tickRate = config.tickRate;
    this.tickDuration = 1000 / this.tickRate;
    this.physics = new Physics(config);

    // Initialize game state
    this.state = {
      id: uuidv4(),
      mode,
      status: 'waiting',
      config,
      leftPlayer: null,
      rightPlayer: null,
      ball: this.physics.resetBall(),
      leftPaddle: this.physics.initializePaddle('left'),
      rightPaddle: this.physics.initializePaddle('right'),
      score: { left: 0, right: 0 },
      lastTickTime: Date.now(),
      tickCount: 0
    };
  }

  /**
   * Get current game state
   */
  getState(): GameState {
    return { ...this.state };
  }

  /**
   * Get game ID
   */
  getGameId(): string {
    return this.state.id;
  }

  /**
   * Get game mode
   */
  getMode(): GameMode {
    return this.state.mode;
  }

  /**
   * Get game status
   */
  getStatus(): GameStatus {
    return this.state.status;
  }

  /**
   * Add player to game
   * @param userId - User ID
   * @param username - Username
   * @param preferredSide - Preferred side ('left' or 'right')
   * @returns Assigned side or null if game is full
   */
  addPlayer(userId: number, username: string, preferredSide?: PlayerSide): PlayerSide | null {
    const player: Player = {
      id: userId,
      username,
      side: 'left', // Will be updated
      isReady: false,
      isConnected: true
    };

    // Assign side
    if (preferredSide && this.getSidePlayer(preferredSide) === null) {
      player.side = preferredSide;
    } else if (this.state.leftPlayer === null) {
      player.side = 'left';
    } else if (this.state.rightPlayer === null) {
      player.side = 'right';
    } else {
      return null; // Game is full
    }

    // Add player to state
    if (player.side === 'left') {
      this.state.leftPlayer = player;
    } else {
      this.state.rightPlayer = player;
    }

    return player.side;
  }

  /**
   * Add AI player to game
   * @param side - Side for AI
   * @param difficulty - AI difficulty
   */
  addAIPlayer(side: PlayerSide, difficulty: 'easy' | 'medium' | 'hard' = 'medium'): void {
    const aiPlayer: AIPlayer = {
      id: -1, // AI player ID
      username: `AI (${difficulty})`,
      side,
      isReady: true,
      isConnected: true,
      difficulty,
      lastThinkTime: 0,
      targetY: this.state.config.canvasHeight / 2
    };

    if (side === 'left') {
      this.state.leftPlayer = aiPlayer;
    } else {
      this.state.rightPlayer = aiPlayer;
    }
  }

  /**
   * Get player on specific side
   */
  private getSidePlayer(side: PlayerSide): Player | AIPlayer | null {
    return side === 'left' ? this.state.leftPlayer : this.state.rightPlayer;
  }

  /**
   * Set player ready status
   * @param userId - User ID
   * @param isReady - Ready status
   */
  setPlayerReady(userId: number, isReady: boolean): boolean {
    const player = this.getPlayerById(userId);
    if (!player) return false;

    player.isReady = isReady;

    // Check if both players are ready and start game
    if (this.state.leftPlayer?.isReady && this.state.rightPlayer?.isReady) {
      if (this.state.status === 'waiting') {
        this.startGame();
      }
    }

    return true;
  }

  /**
   * Get player by user ID
   */
  private getPlayerById(userId: number): Player | AIPlayer | null {
    if (this.state.leftPlayer?.id === userId) return this.state.leftPlayer;
    if (this.state.rightPlayer?.id === userId) return this.state.rightPlayer;
    return null;
  }

  /**
   * Handle player input
   * @param userId - User ID
   * @param action - Input action
   */
  handleInput(userId: number, action: InputAction): void {
    const player = this.getPlayerById(userId);
    if (!player || this.state.status !== 'playing') return;

    const paddle = player.side === 'left' ? this.state.leftPaddle : this.state.rightPaddle;

    switch (action) {
      case 'up':
        paddle.velocity = -1;
        break;
      case 'down':
        paddle.velocity = 1;
        break;
      case 'stop':
        paddle.velocity = 0;
        break;
    }
  }

  /**
   * Start the game
   */
  private startGame(): void {
    if (this.state.status !== 'waiting' && this.state.status !== 'ready') {
      return;
    }

    this.state.status = 'playing';
    this.state.startTime = Date.now();
    this.state.lastTickTime = Date.now();

    // Reset ball toward random side
    this.state.ball = this.physics.resetBall();

    // Start game loop
    this.startGameLoop();
  }

  /**
   * Start game loop (60 TPS)
   */
  private startGameLoop(): void {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
    }

    this.gameLoopInterval = setInterval(() => {
      this.gameTick();
    }, this.tickDuration);
  }

  /**
   * Single game tick (called 60 times per second)
   */
  private gameTick(): void {
    if (this.state.status !== 'playing') {
      return;
    }

    const now = Date.now();
    const deltaTime = 1; // Fixed delta for deterministic physics

    // Update AI if present
    this.updateAI(now);

    // Update paddle positions
    this.state.leftPaddle.y = this.physics.updatePaddlePosition(this.state.leftPaddle, deltaTime);
    this.state.rightPaddle.y = this.physics.updatePaddlePosition(this.state.rightPaddle, deltaTime);

    // Update ball position
    this.state.ball = this.physics.updateBallPosition(this.state.ball, deltaTime);

    // Check wall collisions
    if (this.physics.checkWallCollision(this.state.ball)) {
      this.state.ball = this.physics.handleWallCollision(this.state.ball);
    }

    // Check paddle collisions
    if (this.physics.checkPaddleCollision(this.state.ball, this.state.leftPaddle)) {
      this.state.ball = this.physics.handlePaddleCollision(this.state.ball, this.state.leftPaddle);
    }
    if (this.physics.checkPaddleCollision(this.state.ball, this.state.rightPaddle)) {
      this.state.ball = this.physics.handlePaddleCollision(this.state.ball, this.state.rightPaddle);
    }

    // Check scoring
    const scored = this.physics.checkScore(this.state.ball);
    if (scored) {
      this.handleScore(scored);
    }

    // Update tick count and time
    this.state.tickCount++;
    this.state.lastTickTime = now;
  }

  /**
   * Update AI player logic
   * AI can only "think" once per second (per subject requirements)
   */
  private updateAI(currentTime: number): void {
    // Update left AI
    if (this.isAIPlayer(this.state.leftPlayer)) {
      this.updateAIPlayer(this.state.leftPlayer, this.state.leftPaddle, currentTime);
    }

    // Update right AI
    if (this.isAIPlayer(this.state.rightPlayer)) {
      this.updateAIPlayer(this.state.rightPlayer, this.state.rightPaddle, currentTime);
    }
  }

  /**
   * Check if player is AI
   */
  private isAIPlayer(player: Player | AIPlayer | null): player is AIPlayer {
    return player !== null && 'difficulty' in player;
  }

  /**
   * Update single AI player
   */
  private updateAIPlayer(ai: AIPlayer, paddle: Paddle, currentTime: number): void {
    // AI can only think once per second (per subject requirements)
    if (currentTime - ai.lastThinkTime >= 1000) {
      ai.lastThinkTime = currentTime;

      // Predict where ball will be at AI's paddle position
      const paddleX = ai.side === 'left'
        ? this.state.config.paddleWidth
        : this.state.config.canvasWidth - this.state.config.paddleWidth;

      ai.targetY = this.physics.predictBallPosition(this.state.ball, paddleX);

      // Add difficulty-based error
      const error = this.getAIDifficultyError(ai.difficulty);
      ai.targetY += (Math.random() - 0.5) * error;
    }

    // Move paddle toward target (simulates keyboard input)
    const paddleCenter = paddle.y + paddle.height / 2;
    const distance = ai.targetY - paddleCenter;
    const threshold = 10; // Don't move if close enough

    if (Math.abs(distance) > threshold) {
      paddle.velocity = distance > 0 ? 1 : -1;
    } else {
      paddle.velocity = 0;
    }
  }

  /**
   * Get AI difficulty error margin
   */
  private getAIDifficultyError(difficulty: 'easy' | 'medium' | 'hard'): number {
    switch (difficulty) {
      case 'easy':
        return 100; // Large error margin
      case 'medium':
        return 30; // Medium error margin
      case 'hard':
        return 5; // Small error margin
      default:
        return 30;
    }
  }

  /**
   * Handle scoring
   */
  private handleScore(scorer: 'left' | 'right'): void {
    // Update score
    if (scorer === 'left') {
      this.state.score.left++;
    } else {
      this.state.score.right++;
    }

    // Check for winner
    if (this.state.score.left >= this.state.config.scoreToWin) {
      this.endGame(this.state.leftPlayer?.id);
      return;
    } else if (this.state.score.right >= this.state.config.scoreToWin) {
      this.endGame(this.state.rightPlayer?.id);
      return;
    }

    // Reset ball toward the loser
    const loser = scorer === 'left' ? 'right' : 'left';
    this.state.ball = this.physics.resetBall(loser);

    // Stop paddles
    this.state.leftPaddle.velocity = 0;
    this.state.rightPaddle.velocity = 0;
  }

  /**
   * End the game
   */
  private endGame(winnerId?: number): void {
    this.state.status = 'finished';
    this.state.endTime = Date.now();
    this.state.winnerId = winnerId;

    // Stop game loop
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = undefined;
    }
  }

  /**
   * Pause the game
   */
  pauseGame(): void {
    if (this.state.status === 'playing') {
      this.state.status = 'paused';
      if (this.gameLoopInterval) {
        clearInterval(this.gameLoopInterval);
        this.gameLoopInterval = undefined;
      }
    }
  }

  /**
   * Resume the game
   */
  resumeGame(): void {
    if (this.state.status === 'paused') {
      this.state.status = 'playing';
      this.state.lastTickTime = Date.now();
      this.startGameLoop();
    }
  }

  /**
   * Get game state payload for broadcasting
   * (Minimal state for network efficiency)
   */
  getStatePayload(): GameStatePayload {
    return {
      ball: this.state.ball,
      leftPaddle: this.state.leftPaddle,
      rightPaddle: this.state.rightPaddle,
      score: this.state.score,
      tickCount: this.state.tickCount
    };
  }

  /**
   * Get game duration in milliseconds
   */
  getDuration(): number {
    if (!this.state.startTime) return 0;
    const endTime = this.state.endTime || Date.now();
    return endTime - this.state.startTime;
  }

  /**
   * Get winner ID
   */
  getWinnerId(): number | undefined {
    return this.state.winnerId;
  }

  /**
   * Get final score
   */
  getScore(): Score {
    return { ...this.state.score };
  }

  /**
   * Cleanup and destroy game
   */
  destroy(): void {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = undefined;
    }
  }

  /**
   * Force start game (for testing)
   */
  forceStart(): void {
    this.state.status = 'ready';
    if (this.state.leftPlayer) this.state.leftPlayer.isReady = true;
    if (this.state.rightPlayer) this.state.rightPlayer.isReady = true;
    this.startGame();
  }
}
