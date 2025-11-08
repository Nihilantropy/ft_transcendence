/**
 * @file Physics Engine
 * @description Core physics calculations for Pong game
 * Handles ball movement, collision detection, and physics simulation
 */

import { Vector2D, Ball, Paddle, GameConfig, DEFAULT_GAME_CONFIG } from '../types/index.js';

/**
 * Physics engine for Pong game
 * Handles all physics calculations with deterministic results
 */
export class Physics {
  private config: GameConfig;

  constructor(config: GameConfig = DEFAULT_GAME_CONFIG) {
    this.config = config;
  }

  /**
   * Update ball position based on velocity
   * @param ball - Current ball state
   * @param deltaTime - Time delta (should be 1/60 for 60 TPS)
   * @returns Updated ball position
   */
  updateBallPosition(ball: Ball, deltaTime: number = 1): Ball {
    const newBall = { ...ball };

    // Update position based on velocity
    newBall.position = {
      x: ball.position.x + ball.velocity.x * deltaTime,
      y: ball.position.y + ball.velocity.y * deltaTime
    };

    return newBall;
  }

  /**
   * Update paddle position based on velocity
   * @param paddle - Current paddle state
   * @param deltaTime - Time delta
   * @returns Updated paddle Y position
   */
  updatePaddlePosition(paddle: Paddle, deltaTime: number = 1): number {
    let newY = paddle.y + (paddle.velocity * this.config.paddleSpeed * deltaTime);

    // Clamp paddle to screen boundaries
    newY = Math.max(0, Math.min(newY, this.config.canvasHeight - paddle.height));

    return newY;
  }

  /**
   * Check collision between ball and top/bottom walls
   * @param ball - Current ball state
   * @returns True if collision occurred
   */
  checkWallCollision(ball: Ball): boolean {
    const ballTop = ball.position.y - ball.size / 2;
    const ballBottom = ball.position.y + ball.size / 2;

    return ballTop <= 0 || ballBottom >= this.config.canvasHeight;
  }

  /**
   * Handle ball collision with wall (bounce)
   * @param ball - Current ball state
   * @returns Ball with updated velocity
   */
  handleWallCollision(ball: Ball): Ball {
    const newBall = { ...ball };
    const ballTop = ball.position.y - ball.size / 2;
    const ballBottom = ball.position.y + ball.size / 2;

    if (ballTop <= 0 || ballBottom >= this.config.canvasHeight) {
      // Reverse Y velocity
      newBall.velocity.y = -ball.velocity.y;

      // Correct position to prevent ball getting stuck
      if (ballTop <= 0) {
        newBall.position.y = ball.size / 2;
      } else if (ballBottom >= this.config.canvasHeight) {
        newBall.position.y = this.config.canvasHeight - ball.size / 2;
      }
    }

    return newBall;
  }

  /**
   * Check collision between ball and paddle
   * Uses AABB (Axis-Aligned Bounding Box) collision detection
   * @param ball - Current ball state
   * @param paddle - Current paddle state
   * @returns True if collision occurred
   */
  checkPaddleCollision(ball: Ball, paddle: Paddle): boolean {
    // Calculate paddle position based on side
    const paddleX = paddle.side === 'left'
      ? this.config.paddleWidth
      : this.config.canvasWidth - this.config.paddleWidth;

    // Ball bounding box
    const ballLeft = ball.position.x - ball.size / 2;
    const ballRight = ball.position.x + ball.size / 2;
    const ballTop = ball.position.y - ball.size / 2;
    const ballBottom = ball.position.y + ball.size / 2;

    // Paddle bounding box
    const paddleLeft = paddleX - paddle.width / 2;
    const paddleRight = paddleX + paddle.width / 2;
    const paddleTop = paddle.y;
    const paddleBottom = paddle.y + paddle.height;

    // AABB collision detection
    return (
      ballRight > paddleLeft &&
      ballLeft < paddleRight &&
      ballBottom > paddleTop &&
      ballTop < paddleBottom
    );
  }

  /**
   * Handle ball collision with paddle
   * Applies spin based on where ball hits paddle
   * @param ball - Current ball state
   * @param paddle - Current paddle state
   * @returns Ball with updated velocity
   */
  handlePaddleCollision(ball: Ball, paddle: Paddle): Ball {
    const newBall = { ...ball };

    // Calculate paddle position
    const paddleX = paddle.side === 'left'
      ? this.config.paddleWidth
      : this.config.canvasWidth - this.config.paddleWidth;

    // Reverse X velocity
    newBall.velocity.x = -ball.velocity.x;

    // Add spin based on hit position (relative to paddle center)
    const paddleCenter = paddle.y + paddle.height / 2;
    const hitOffset = ball.position.y - paddleCenter;
    const normalizedOffset = hitOffset / (paddle.height / 2); // -1 to 1

    // Apply spin to Y velocity
    const spinFactor = 3; // Adjust for more/less spin
    newBall.velocity.y = ball.velocity.y + (normalizedOffset * spinFactor);

    // Ensure ball doesn't get stuck in paddle
    if (paddle.side === 'left') {
      newBall.position.x = paddleX + paddle.width / 2 + ball.size / 2 + 1;
    } else {
      newBall.position.x = paddleX - paddle.width / 2 - ball.size / 2 - 1;
    }

    // Increase ball speed slightly on each hit (up to max)
    const speedIncrease = 1.05;
    const currentSpeed = Math.sqrt(newBall.velocity.x ** 2 + newBall.velocity.y ** 2);
    const newSpeed = Math.min(currentSpeed * speedIncrease, this.config.maxBallSpeed);

    // Normalize and apply new speed
    const normalizedVelocity = this.normalizeVector(newBall.velocity);
    newBall.velocity.x = normalizedVelocity.x * newSpeed;
    newBall.velocity.y = normalizedVelocity.y * newSpeed;
    newBall.speed = newSpeed;

    return newBall;
  }

  /**
   * Check if ball is out of bounds (scored)
   * @param ball - Current ball state
   * @returns 'left' if left player scored, 'right' if right player scored, null otherwise
   */
  checkScore(ball: Ball): 'left' | 'right' | null {
    if (ball.position.x - ball.size / 2 <= 0) {
      return 'right'; // Right player scored
    } else if (ball.position.x + ball.size / 2 >= this.config.canvasWidth) {
      return 'left'; // Left player scored
    }
    return null;
  }

  /**
   * Reset ball to center with random direction
   * @param towardsSide - Optional: 'left' or 'right' to serve toward specific side
   * @returns New ball state
   */
  resetBall(towardsSide?: 'left' | 'right'): Ball {
    const initialSpeed = 4;

    // Random angle between -30 and 30 degrees
    const angle = (Math.random() * 60 - 30) * (Math.PI / 180);

    // Direction: toward loser or random
    let directionX: number;
    if (towardsSide === 'left') {
      directionX = -1;
    } else if (towardsSide === 'right') {
      directionX = 1;
    } else {
      directionX = Math.random() > 0.5 ? 1 : -1;
    }

    return {
      position: {
        x: this.config.canvasWidth / 2,
        y: this.config.canvasHeight / 2
      },
      velocity: {
        x: Math.cos(angle) * initialSpeed * directionX,
        y: Math.sin(angle) * initialSpeed
      },
      size: this.config.ballSize,
      speed: initialSpeed
    };
  }

  /**
   * Initialize paddle at starting position
   * @param side - 'left' or 'right'
   * @returns New paddle state
   */
  initializePaddle(side: 'left' | 'right'): Paddle {
    return {
      side,
      y: (this.config.canvasHeight - this.config.paddleHeight) / 2,
      height: this.config.paddleHeight,
      width: this.config.paddleWidth,
      velocity: 0
    };
  }

  /**
   * Predict where ball will be when it reaches a specific X position
   * Used by AI to anticipate ball position
   * @param ball - Current ball state
   * @param targetX - X position to predict at
   * @returns Predicted Y position
   */
  predictBallPosition(ball: Ball, targetX: number): number {
    // Simulate ball movement
    let simBall = { ...ball, position: { ...ball.position }, velocity: { ...ball.velocity } };
    let iterations = 0;
    const maxIterations = 1000; // Prevent infinite loop

    while (iterations < maxIterations) {
      // Check if we've reached target X
      if (
        (ball.velocity.x > 0 && simBall.position.x >= targetX) ||
        (ball.velocity.x < 0 && simBall.position.x <= targetX)
      ) {
        break;
      }

      // Update position
      simBall = this.updateBallPosition(simBall, 1);

      // Handle wall collisions
      if (this.checkWallCollision(simBall)) {
        simBall = this.handleWallCollision(simBall);
      }

      iterations++;
    }

    return simBall.position.y;
  }

  /**
   * Normalize a vector to unit length
   * @param vector - Vector to normalize
   * @returns Normalized vector
   */
  private normalizeVector(vector: Vector2D): Vector2D {
    const magnitude = Math.sqrt(vector.x ** 2 + vector.y ** 2);
    if (magnitude === 0) return { x: 0, y: 0 };

    return {
      x: vector.x / magnitude,
      y: vector.y / magnitude
    };
  }

  /**
   * Calculate distance between two points
   * @param p1 - First point
   * @param p2 - Second point
   * @returns Distance
   */
  distance(p1: Vector2D, p2: Vector2D): number {
    return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  }

  /**
   * Get configuration
   * @returns Current game configuration
   */
  getConfig(): GameConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   * @param config - New configuration (partial)
   */
  updateConfig(config: Partial<GameConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
