/**
 * @file Database Service
 * @description SQLite database connection and query methods
 */

import Database from 'better-sqlite3';
import type { User } from '../types/index.js';

export class DatabaseService {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath, { verbose: console.log });

    // Set pragmas for performance
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');
  }

  // User operations
  findUserByEmail(email: string): User | undefined {
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email) as User | undefined;
  }

  /**
   * Find user by email or username
   * @param identifier - Email address or username
   * @returns User if found, undefined otherwise
   */
  findUserByIdentifier(identifier: string): User | undefined {
    // Try email first (most common case, indexed)
    let user = this.findUserByEmail(identifier);

    // If not found by email, try username
    if (!user) {
      const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
      user = stmt.get(identifier) as User | undefined;
    }

    return user;
  }

  findUserById(id: number): User | undefined {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id) as User | undefined;
  }

  findUserByGoogleId(googleId: string): User | undefined {
    const stmt = this.db.prepare('SELECT * FROM users WHERE google_id = ?');
    return stmt.get(googleId) as User | undefined;
  }

  createUser(data: {
    username: string;
    email: string;
    password_hash?: string;
    google_id?: string;
  }): User {
    const stmt = this.db.prepare(`
      INSERT INTO users (username, email, password_hash, google_id, email_verified)
      VALUES (?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      data.username,
      data.email,
      data.password_hash || null,
      data.google_id || null,
      data.google_id ? 1 : 0 // Auto-verify Google users
    );

    const user = this.findUserById(Number(info.lastInsertRowid));
    if (!user) {
      throw new Error('Failed to create user');
    }

    return user;
  }

  updateUser(id: number, data: Partial<User>): void {
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) return;

    values.push(id);
    const stmt = this.db.prepare(`
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);
  }

  // 2FA operations
  enable2FA(userId: number, secret: string, backupCodesJson?: string): void {
    const stmt = this.db.prepare(`
      UPDATE users
      SET two_factor_enabled = 1,
          two_factor_secret = ?,
          two_factor_secret_tmp = NULL,
          backup_codes = ?,
          backup_codes_tmp = NULL
      WHERE id = ?
    `);
    stmt.run(secret, backupCodesJson || null, userId);
  }

  disable2FA(userId: number): void {
    const stmt = this.db.prepare(`
      UPDATE users
      SET two_factor_enabled = 0,
          two_factor_secret = NULL,
          backup_codes = NULL
      WHERE id = ?
    `);
    stmt.run(userId);
  }

  // Save temporary 2FA setup data
  saveTempBackupCodes(userId: number, backupCodesJson: string): void {
    const stmt = this.db.prepare(`
      UPDATE users
      SET backup_codes_tmp = ?
      WHERE id = ?
    `);
    stmt.run(backupCodesJson, userId);
  }

  // Verify and use a backup code
  useBackupCode(userId: number, codeHash: string): boolean {
    const user = this.findUserById(userId);
    if (!user || !user.backup_codes) {
      return false;
    }

    const backupCodes = JSON.parse(user.backup_codes as string) as string[];
    const index = backupCodes.findIndex(hash => hash === codeHash);

    if (index === -1) {
      return false;
    }

    // Remove used backup code
    backupCodes.splice(index, 1);

    // Update database
    const stmt = this.db.prepare(`
      UPDATE users
      SET backup_codes = ?
      WHERE id = ?
    `);
    stmt.run(JSON.stringify(backupCodes), userId);

    return true;
  }

  // OAuth state management
  saveOAuthState(state: string, userId?: number): void {
    const stmt = this.db.prepare(`
      INSERT INTO oauth_state (state, user_id, expires_at)
      VALUES (?, ?, datetime('now', '+10 minutes'))
    `);
    stmt.run(state, userId || null);
  }

  validateOAuthState(state: string): boolean {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM oauth_state
      WHERE state = ? AND expires_at > datetime('now')
    `);
    const result = stmt.get(state) as { count: number };
    return result.count > 0;
  }

  deleteOAuthState(state: string): void {
    const stmt = this.db.prepare('DELETE FROM oauth_state WHERE state = ?');
    stmt.run(state);
  }

  // Cleanup expired states
  cleanupExpiredStates(): void {
    const stmt = this.db.prepare(`
      DELETE FROM oauth_state WHERE expires_at < datetime('now')
    `);
    stmt.run();
  }

  close(): void {
    this.db.close();
  }
}
