/**
 * @brief Pong game engine implementation
 * 
 * @description Canvas-based Pong game with collision detection and game loop
 */

import type { GameState, Ball, Paddle, GameConfig } from '@/types';

export class PongEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: GameConfig;
  private gameState: GameState | null = null;
  private animationId: number | null = null;
  private lastTime: number = 0;
  private keys: Set<string> = new Set();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    
    this.config = {
      canvasWidth: 800,
      canvasHeight: 400,
      paddleWidth: 15,
      paddleHeight: 80,
      paddleSpeed: 300,
      ballRadius: 8,
      ballSpeed: 250,
      maxScore: 5,
    };

    this.setupCanvas();
    this.setupControls();
  }

  /**
   * @brief Setup canvas dimensions and styling
   * 
   * @return void
   */
  private setupCanvas(): void {
    this.canvas.width = this.config.canvasWidth;
    this.canvas.height = this.config.canvasHeight;
    this.canvas.style.border = '2px solid #00ff41';
    this.canvas.style.backgroundColor = '#000';
  }

  /**
   * @brief Setup keyboard controls
   * 
   * @return void
   */
  private setupControls(): void {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase());
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
  }

  /**
   * @brief Initialize new game
   * 
   * @param player1Name Player 1 name
   * @param player2Name Player 2 name
   * @return void
   */
  startGame(player1Name: string = 'Player 1', player2Name: string = 'Player 2'): void {
    this.gameState = {
      id: 1,
      player1: { id: 1, username: player1Name, isOnline: true },
      player2: { id: 2, username: player2Name, isOnline: true },
      ball: this.createBall(),
      paddles: this.createPaddles(),
      score: { player1: 0, player2: 0, maxScore: this.config.maxScore },
      status: 'playing',
      startTime: new Date(),
    };

    this.gameLoop(0);
  }

  /**
   * @brief Create ball object
   * 
   * @return Ball object
   */
  private createBall(): Ball {
    return {
      x: this.config.canvasWidth / 2,
      y: this.config.canvasHeight / 2,
      velocityX: Math.random() > 0.5 ? this.config.ballSpeed : -this.config.ballSpeed,
      velocityY: (Math.random() - 0.5) * this.config.ballSpeed,
      radius: this.config.ballRadius,
    };
  }

  /**
   * @brief Create paddle objects
   * 
   * @return Array of paddle objects
   */
  private createPaddles(): Paddle[] {
    return [
      {
        x: 20,
        y: this.config.canvasHeight / 2 - this.config.paddleHeight / 2,
        width: this.config.paddleWidth,
        height: this.config.paddleHeight,
        velocityY: 0,
        playerId: 1,
      },
      {
        x: this.config.canvasWidth - 35,
        y: this.config.canvasHeight / 2 - this.config.paddleHeight / 2,
        width: this.config.paddleWidth,
        height: this.config.paddleHeight,
        velocityY: 0,
        playerId: 2,
      },
    ];
  }

  /**
   * @brief Main game loop
   * 
   * @param currentTime Current timestamp
   * @return void
   */
  private gameLoop(currentTime: number): void {
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    if (this.gameState && this.gameState.status === 'playing') {
      this.update(deltaTime);
      this.render();
    }

    this.animationId = requestAnimationFrame((time) => this.gameLoop(time));
  }

  /**
   * @brief Update game state
   * 
   * @param deltaTime Time since last frame
   * @return void
   */
  private update(deltaTime: number): void {
    if (!this.gameState) return;

    this.updatePaddles(deltaTime);
    this.updateBall(deltaTime);
    this.checkCollisions();
    this.checkScore();
  }

  /**
   * @brief Update paddle positions based on input
   * 
   * @param deltaTime Time since last frame
   * @return void
   */
  private updatePaddles(deltaTime: number): void {
    if (!this.gameState) return;

    const [leftPaddle, rightPaddle] = this.gameState.paddles;
    const speed = this.config.paddleSpeed * deltaTime;

    // Player 1 controls (W/S)
    if (this.keys.has('w') && leftPaddle.y > 0) {
      leftPaddle.y -= speed;
    }
    if (this.keys.has('s') && leftPaddle.y < this.config.canvasHeight - leftPaddle.height) {
      leftPaddle.y += speed;
    }

    // Player 2 controls (Arrow keys)
    if (this.keys.has('arrowup') && rightPaddle.y > 0) {
      rightPaddle.y -= speed;
    }
    if (this.keys.has('arrowdown') && rightPaddle.y < this.config.canvasHeight - rightPaddle.height) {
      rightPaddle.y += speed;
    }
  }

  /**
   * @brief Update ball position
   * 
   * @param deltaTime Time since last frame
   * @return void
   */
  private updateBall(deltaTime: number): void {
    if (!this.gameState) return;

    const ball = this.gameState.ball;
    ball.x += ball.velocityX * deltaTime;
    ball.y += ball.velocityY * deltaTime;

    // Top/bottom wall collision
    if (ball.y <= ball.radius || ball.y >= this.config.canvasHeight - ball.radius) {
      ball.velocityY = -ball.velocityY;
    }
  }

  /**
   * @brief Check ball-paddle collisions
   * 
   * @return void
   */
  private checkCollisions(): void {
    if (!this.gameState) return;

    const ball = this.gameState.ball;
    const [leftPaddle, rightPaddle] = this.gameState.paddles;

    // Left paddle collision
    if (ball.x - ball.radius <= leftPaddle.x + leftPaddle.width &&
        ball.y >= leftPaddle.y && ball.y <= leftPaddle.y + leftPaddle.height) {
      ball.velocityX = Math.abs(ball.velocityX);
      ball.velocityY += (ball.y - (leftPaddle.y + leftPaddle.height / 2)) * 5;
    }

    // Right paddle collision
    if (ball.x + ball.radius >= rightPaddle.x &&
        ball.y >= rightPaddle.y && ball.y <= rightPaddle.y + rightPaddle.height) {
      ball.velocityX = -Math.abs(ball.velocityX);
      ball.velocityY += (ball.y - (rightPaddle.y + rightPaddle.height / 2)) * 5;
    }
  }

  /**
   * @brief Check for scoring
   * 
   * @return void
   */
  private checkScore(): void {
    if (!this.gameState) return;

    const ball = this.gameState.ball;

    // Player 2 scores (ball goes past left edge)
    if (ball.x < 0) {
      this.gameState.score.player2++;
      this.resetBall();
    }

    // Player 1 scores (ball goes past right edge)
    if (ball.x > this.config.canvasWidth) {
      this.gameState.score.player1++;
      this.resetBall();
    }

    // Check for game end
    if (this.gameState.score.player1 >= this.config.maxScore || 
        this.gameState.score.player2 >= this.config.maxScore) {
      this.gameState.status = 'finished';
      this.gameState.endTime = new Date();
    }
  }

  /**
   * @brief Reset ball to center
   * 
   * @return void
   */
  private resetBall(): void {
    if (!this.gameState) return;

    this.gameState.ball = this.createBall();
  }

  /**
   * @brief Render game graphics
   * 
   * @return void
   */
  private render(): void {
    if (!this.gameState) return;

    // Clear canvas
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.config.canvasWidth, this.config.canvasHeight);

    // Draw center line
    this.ctx.strokeStyle = '#00ff41';
    this.ctx.setLineDash([5, 5]);
    this.ctx.beginPath();
    this.ctx.moveTo(this.config.canvasWidth / 2, 0);
    this.ctx.lineTo(this.config.canvasWidth / 2, this.config.canvasHeight);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // Draw paddles
    this.ctx.fillStyle = '#00ff41';
    this.gameState.paddles.forEach(paddle => {
      this.ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
    });

    // Draw ball
    this.ctx.beginPath();
    this.ctx.arc(this.gameState.ball.x, this.gameState.ball.y, this.gameState.ball.radius, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw scores
    this.ctx.font = '30px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(
      this.gameState.score.player1.toString(),
      this.config.canvasWidth / 4,
      40
    );
    this.ctx.fillText(
      this.gameState.score.player2.toString(),
      (this.config.canvasWidth * 3) / 4,
      40
    );
  }

  /**
   * @brief Stop game and cleanup
   * 
   * @return void
   */
  stop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.gameState = null;
  }

  /**
   * @brief Get current game state
   * 
   * @return GameState or null
   */
  getGameState(): GameState | null {
    return this.gameState;
  }
}