/**
 * @file Database Service
 * @description SQLite database operations for game service
 */

import Database from 'better-sqlite3';
import { GameRecord, GameMode } from '../types/index.js';

export class DatabaseService {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath, { verbose: console.log });

    // Set pragmas for performance
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');
  }

  /**
   * Create a new game record
   */
  createGame(
    mode: GameMode,
    player1Id: number,
    player2Id: number | null
  ): string {
    const gameId = require('crypto').randomUUID();

    const stmt = this.db.prepare(`
      INSERT INTO games (id, mode, player1_id, player2_id, status, created_at)
      VALUES (?, ?, ?, ?, 'playing', CURRENT_TIMESTAMP)
    `);

    stmt.run(gameId, mode, player1Id, player2Id);

    return gameId;
  }

  /**
   * Complete a game record
   */
  completeGame(
    gameId: string,
    player1Score: number,
    player2Score: number,
    winnerId: number | null,
    duration: number
  ): void {
    const stmt = this.db.prepare(`
      UPDATE games
      SET
        player1_score = ?,
        player2_score = ?,
        winner_id = ?,
        duration = ?,
        status = 'finished',
        completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(player1Score, player2Score, winnerId, duration, gameId);

    // Update user stats
    if (winnerId) {
      this.updateUserStats(winnerId, true, duration);
    }

    // Update loser stats
    const loserId = winnerId === player1Score ? player2Score : player1Score;
    if (loserId && loserId !== -1) { // -1 is AI
      this.updateUserStats(loserId, false, duration);
    }
  }

  /**
   * Update user statistics after game
   */
  private updateUserStats(userId: number, won: boolean, _duration: number): void {
    // First, ensure user_stats record exists
    this.db.prepare(`
      INSERT OR IGNORE INTO user_stats (user_id)
      VALUES (?)
    `).run(userId);

    // Update stats
    const stmt = this.db.prepare(`
      UPDATE user_stats
      SET
        games_played = games_played + 1,
        games_won = games_won + ?,
        games_lost = games_lost + ?,
        win_rate = CAST(games_won AS REAL) / games_played,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `);

    stmt.run(won ? 1 : 0, won ? 0 : 1, userId);
  }

  /**
   * Get game by ID
   */
  getGame(gameId: string): GameRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM games WHERE id = ?');
    return stmt.get(gameId) as GameRecord | undefined;
  }

  /**
   * Get user's game history
   */
  getUserGames(userId: number, limit: number = 20): GameRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM games
      WHERE player1_id = ? OR player2_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);

    return stmt.all(userId, userId, limit) as GameRecord[];
  }

  /**
   * Get active games
   */
  getActiveGames(): GameRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM games
      WHERE status IN ('waiting', 'playing')
      ORDER BY created_at DESC
    `);

    return stmt.all() as GameRecord[];
  }

  /**
   * Get database instance (for direct queries in other services)
   */
  getDb(): Database.Database {
    return this.db;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}
