/**
 * @file Database Service
 * @description SQLite database connection and query methods for user-service
 */

import Database from 'better-sqlite3';
import type { User, FriendRequest, UserStats } from '../types/index.js';

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
  findUserById(id: number): User | undefined {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id) as User | undefined;
  }

  findUserByEmail(email: string): User | undefined {
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email) as User | undefined;
  }

  findUserByUsername(username: string): User | undefined {
    const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username) as User | undefined;
  }

  updateUser(id: number, data: Partial<User>): void {
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) return;

    values.push(id);
    const stmt = this.db.prepare(`
      UPDATE users
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(...values);
  }

  searchUsers(query: string, limit: number = 20): User[] {
    const stmt = this.db.prepare(`
      SELECT * FROM users
      WHERE (username LIKE ? OR email LIKE ?)
      AND is_active = 1
      ORDER BY username
      LIMIT ?
    `);
    const searchPattern = `%${query}%`;
    return stmt.all(searchPattern, searchPattern, limit) as User[];
  }

  // Friend request operations
  sendFriendRequest(fromUserId: number, toUserId: number, message?: string): FriendRequest {
    // Check if request already exists
    const existing = this.db.prepare(`
      SELECT * FROM friend_requests
      WHERE (from_user_id = ? AND to_user_id = ?)
         OR (from_user_id = ? AND to_user_id = ?)
    `).get(fromUserId, toUserId, toUserId, fromUserId);

    if (existing) {
      throw new Error('Friend request already exists');
    }

    // Check if already friends
    if (this.areFriends(fromUserId, toUserId)) {
      throw new Error('Already friends with this user');
    }

    // Check if blocked
    if (this.isBlocked(fromUserId, toUserId) || this.isBlocked(toUserId, fromUserId)) {
      throw new Error('Cannot send friend request to this user');
    }

    const stmt = this.db.prepare(`
      INSERT INTO friend_requests (from_user_id, to_user_id, message, status)
      VALUES (?, ?, ?, 'pending')
    `);

    const info = stmt.run(fromUserId, toUserId, message || null);

    const request = this.db.prepare('SELECT * FROM friend_requests WHERE id = ?')
      .get(info.lastInsertRowid) as FriendRequest;

    return request;
  }

  getFriendRequests(userId: number, status?: string): FriendRequest[] {
    let query = 'SELECT * FROM friend_requests WHERE to_user_id = ?';
    const params: any[] = [userId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as FriendRequest[];
  }

  getSentFriendRequests(userId: number): FriendRequest[] {
    const stmt = this.db.prepare(`
      SELECT * FROM friend_requests
      WHERE from_user_id = ?
      ORDER BY created_at DESC
    `);
    return stmt.all(userId) as FriendRequest[];
  }

  acceptFriendRequest(requestId: number, userId: number): void {
    // Get the request
    const request = this.db.prepare('SELECT * FROM friend_requests WHERE id = ?')
      .get(requestId) as FriendRequest | undefined;

    if (!request) {
      throw new Error('Friend request not found');
    }

    if (request.to_user_id !== userId) {
      throw new Error('Not authorized to accept this request');
    }

    if (request.status !== 'pending') {
      throw new Error('Request already processed');
    }

    // Use transaction for atomicity
    const transaction = this.db.transaction(() => {
      // Update request status
      this.db.prepare(`
        UPDATE friend_requests
        SET status = 'accepted', responded_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(requestId);

      // Create bidirectional friendship
      this.db.prepare(`
        INSERT INTO friendships (user_id, friend_id)
        VALUES (?, ?), (?, ?)
      `).run(request.from_user_id, request.to_user_id, request.to_user_id, request.from_user_id);
    });

    transaction();
  }

  declineFriendRequest(requestId: number, userId: number): void {
    const request = this.db.prepare('SELECT * FROM friend_requests WHERE id = ?')
      .get(requestId) as FriendRequest | undefined;

    if (!request) {
      throw new Error('Friend request not found');
    }

    if (request.to_user_id !== userId) {
      throw new Error('Not authorized to decline this request');
    }

    this.db.prepare(`
      UPDATE friend_requests
      SET status = 'declined', responded_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(requestId);
  }

  getFriends(userId: number): User[] {
    const stmt = this.db.prepare(`
      SELECT u.*
      FROM users u
      INNER JOIN friendships f ON u.id = f.friend_id
      WHERE f.user_id = ?
      AND u.is_active = 1
      ORDER BY u.username
    `);
    return stmt.all(userId) as User[];
  }

  removeFriend(userId: number, friendId: number): void {
    // Remove bidirectional friendship
    this.db.prepare(`
      DELETE FROM friendships
      WHERE (user_id = ? AND friend_id = ?)
         OR (user_id = ? AND friend_id = ?)
    `).run(userId, friendId, friendId, userId);
  }

  areFriends(userId: number, friendId: number): boolean {
    const result = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM friendships
      WHERE user_id = ? AND friend_id = ?
    `).get(userId, friendId) as { count: number };

    return result.count > 0;
  }

  // Block operations
  blockUser(userId: number, blockedUserId: number): void {
    // Can't block yourself
    if (userId === blockedUserId) {
      throw new Error('Cannot block yourself');
    }

    // Check if already blocked
    if (this.isBlocked(userId, blockedUserId)) {
      return; // Already blocked
    }

    const transaction = this.db.transaction(() => {
      // Remove friendship if exists
      this.removeFriend(userId, blockedUserId);

      // Delete any pending friend requests
      this.db.prepare(`
        DELETE FROM friend_requests
        WHERE (from_user_id = ? AND to_user_id = ?)
           OR (from_user_id = ? AND to_user_id = ?)
      `).run(userId, blockedUserId, blockedUserId, userId);

      // Add to blocked list
      this.db.prepare(`
        INSERT INTO blocked_users (user_id, blocked_user_id)
        VALUES (?, ?)
      `).run(userId, blockedUserId);
    });

    transaction();
  }

  unblockUser(userId: number, blockedUserId: number): void {
    this.db.prepare(`
      DELETE FROM blocked_users
      WHERE user_id = ? AND blocked_user_id = ?
    `).run(userId, blockedUserId);
  }

  isBlocked(userId: number, blockedUserId: number): boolean {
    const result = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM blocked_users
      WHERE user_id = ? AND blocked_user_id = ?
    `).get(userId, blockedUserId) as { count: number };

    return result.count > 0;
  }

  getBlockedUsers(userId: number): User[] {
    const stmt = this.db.prepare(`
      SELECT u.*
      FROM users u
      INNER JOIN blocked_users b ON u.id = b.blocked_user_id
      WHERE b.user_id = ?
      ORDER BY u.username
    `);
    return stmt.all(userId) as User[];
  }

  // Stats operations
  getUserStats(userId: number): UserStats | undefined {
    const stmt = this.db.prepare('SELECT * FROM user_stats WHERE user_id = ?');
    return stmt.get(userId) as UserStats | undefined;
  }

  initializeUserStats(userId: number): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO user_stats (user_id)
      VALUES (?)
    `).run(userId);
  }

  updateUserStats(userId: number, stats: Partial<UserStats>): void {
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(stats).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && key !== 'user_id') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) return;

    values.push(userId);
    const stmt = this.db.prepare(`
      UPDATE user_stats
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `);

    stmt.run(...values);
  }

  close(): void {
    this.db.close();
  }
}
