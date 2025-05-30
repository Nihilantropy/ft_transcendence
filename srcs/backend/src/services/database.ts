/**
 * @brief SQLite database service for ft_transcendence
 * 
 * @description Handles database connections and operations
 */

import sqlite3 from 'sqlite3';
import { config } from '../config/config';

export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  display_name?: string;
  avatar_url?: string;
  is_online: boolean;
  created_at: string;
}

export interface Game {
  id: number;
  player1_id: number;
  player2_id: number;
  winner_id?: number;
  player1_score: number;
  player2_score: number;
  game_type: string;
  status: string;
  started_at?: string;
  ended_at?: string;
  created_at: string;
}

class DatabaseService {
  private db: sqlite3.Database | null = null;

  /**
   * @brief Initialize database connection
   * 
   * @return Promise<void>
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(config.DB_PATH, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          resolve();
        }
      });
    });
  }

  /**
   * @brief Execute SQL query
   * 
   * @param sql SQL query string
   * @param params Query parameters
   * @return Promise with query result
   */
  private query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not connected'));
        return;
      }

      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows as T[]);
        }
      });
    });
  }

  /**
   * @brief Execute SQL query and return single row
   * 
   * @param sql SQL query string
   * @param params Query parameters
   * @return Promise with single result
   */
  private queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not connected'));
        return;
      }

      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row as T || null);
        }
      });
    });
  }

  /**
   * @brief Execute SQL query with changes
   * 
   * @param sql SQL query string
   * @param params Query parameters
   * @return Promise with lastID and changes
   */
  private run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not connected'));
        return;
      }

      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  // User operations
  async createUser(userData: Omit<User, 'id' | 'created_at' | 'is_online'>): Promise<User> {
    const result = await this.run(
      `INSERT INTO users (username, email, password_hash, display_name, avatar_url)
       VALUES (?, ?, ?, ?, ?)`,
      [userData.username, userData.email, userData.password_hash, userData.display_name, userData.avatar_url]
    );

    const user = await this.queryOne<User>('SELECT * FROM users WHERE id = ?', [result.lastID]);
    if (!user) throw new Error('Failed to create user');
    return user;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    return this.queryOne<User>('SELECT * FROM users WHERE username = ?', [username]);
  }

  async getUserById(id: number): Promise<User | null> {
    return this.queryOne<User>('SELECT * FROM users WHERE id = ?', [id]);
  }

  async updateUserOnlineStatus(userId: number, isOnline: boolean): Promise<void> {
    await this.run('UPDATE users SET is_online = ? WHERE id = ?', [isOnline ? 1 : 0, userId]);
  }

  // Game operations
  async createGame(gameData: Omit<Game, 'id' | 'created_at'>): Promise<Game> {
    const result = await this.run(
      `INSERT INTO games (player1_id, player2_id, player1_score, player2_score, game_type, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [gameData.player1_id, gameData.player2_id, gameData.player1_score, gameData.player2_score, gameData.game_type, gameData.status]
    );

    const game = await this.queryOne<Game>('SELECT * FROM games WHERE id = ?', [result.lastID]);
    if (!game) throw new Error('Failed to create game');
    return game;
  }

  async getGameById(id: number): Promise<Game | null> {
    return this.queryOne<Game>('SELECT * FROM games WHERE id = ?', [id]);
  }

  async updateGameScore(gameId: number, player1Score: number, player2Score: number): Promise<Game | null> {
    await this.run(
      'UPDATE games SET player1_score = ?, player2_score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [player1Score, player2Score, gameId]
    );

    return this.getGameById(gameId);
  }

  async finishGame(gameId: number, winnerId: number): Promise<void> {
    await this.run(
      'UPDATE games SET winner_id = ?, status = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?',
      [winnerId, 'finished', gameId]
    );
  }

  async getActiveGames(): Promise<Game[]> {
    return this.query<Game>('SELECT * FROM games WHERE status IN (?, ?)', ['pending', 'in_progress']);
  }

  /**
   * @brief Close database connection
   * 
   * @return Promise<void>
   */
  async close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close(() => {
          console.log('Database connection closed');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

export const db = new DatabaseService();