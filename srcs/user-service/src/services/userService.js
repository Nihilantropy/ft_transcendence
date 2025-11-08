/**
 * @file User Service
 * @description Business logic for user profiles, search, and management
 */

import { logger } from '../logger.js'
import db from '../database.js'

const userServiceLogger = logger.child({ module: 'services/user' })

export class UserService {
  /**
   * Get user by ID
   */
  getUserById(userId) {
    try {
      const user = db.prepare(`
        SELECT id, username, email, email_verified,
               avatar_base64, two_factor_enabled,
               is_active, is_online, last_seen, created_at, updated_at
        FROM users
        WHERE id = ? AND is_active = 1
        LIMIT 1
      `).get(userId)

      return user || null
    } catch (error) {
      userServiceLogger.error('Failed to get user by ID', { userId, error: error.message })
      throw new Error('Database error while retrieving user')
    }
  }

  /**
   * Get public user profile (safe for public consumption)
   */
  getPublicProfile(userId) {
    try {
      const user = db.prepare(`
        SELECT id, username, avatar_base64, is_online, created_at
        FROM users
        WHERE id = ? AND is_active = 1
        LIMIT 1
      `).get(userId)

      return user || null
    } catch (error) {
      userServiceLogger.error('Failed to get public profile', { userId, error: error.message })
      throw error
    }
  }

  /**
   * Get complete user profile (includes private fields)
   */
  getCompleteProfile(userId) {
    try {
      const user = db.prepare(`
        SELECT
          id, username, email, email_verified,
          avatar_base64,
          two_factor_enabled, is_online, last_seen,
          created_at, updated_at
        FROM users
        WHERE id = ? AND is_active = 1
        LIMIT 1
      `).get(userId)

      return user || null
    } catch (error) {
      userServiceLogger.error('Failed to get complete profile', { userId, error: error.message })
      throw error
    }
  }

  /**
   * Search users by username
   */
  searchUsersByUsername(searchQuery, limit = 10) {
    try {
      if (!searchQuery || searchQuery.trim().length === 0) {
        return []
      }

      const users = db.prepare(`
        SELECT id, username, avatar_base64, is_online
        FROM users
        WHERE LOWER(username) LIKE LOWER(?) AND is_active = 1
        ORDER BY username ASC
        LIMIT ?
      `).all(`%${searchQuery}%`, limit)

      return users
    } catch (error) {
      userServiceLogger.error('User search failed', { searchQuery, error: error.message })
      throw error
    }
  }

  /**
   * Check if username is taken
   */
  isUsernameTaken(username) {
    try {
      const result = db.prepare(`
        SELECT id FROM users
        WHERE LOWER(username) = LOWER(?)
        LIMIT 1
      `).get(username)

      return !!result
    } catch (error) {
      userServiceLogger.error('Failed to check username', { username, error: error.message })
      throw error
    }
  }

  /**
   * Validate username format
   */
  validateUsernameFormat(username) {
    const minLength = 3
    const maxLength = 20
    const validPattern = /^[a-zA-Z0-9_-]+$/

    if (!username || typeof username !== 'string') {
      return { isValid: false, message: 'Username is required' }
    }

    if (username.length < minLength) {
      return { isValid: false, message: `Username must be at least ${minLength} characters` }
    }

    if (username.length > maxLength) {
      return { isValid: false, message: `Username must be at most ${maxLength} characters` }
    }

    if (!validPattern.test(username)) {
      return { isValid: false, message: 'Username can only contain letters, numbers, underscores and hyphens' }
    }

    const reserved = ['admin', 'root', 'system', 'api', 'null', 'undefined']
    if (reserved.includes(username.toLowerCase())) {
      return { isValid: false, message: 'This username is reserved' }
    }

    return { isValid: true, message: 'Valid username' }
  }

  /**
   * Update username
   */
  updateUsername(userId, newUsername) {
    try {
      // Validate format
      const validation = this.validateUsernameFormat(newUsername)
      if (!validation.isValid) {
        throw new Error(`Invalid username format: ${validation.message}`)
      }

      // Get current user
      const currentUser = this.getUserById(userId)
      if (!currentUser) {
        throw new Error('User not found')
      }

      // If keeping current username, allow it
      if (currentUser.username.toLowerCase() === newUsername.toLowerCase()) {
        return currentUser
      }

      // Check availability
      if (this.isUsernameTaken(newUsername)) {
        throw new Error('Username is already taken')
      }

      // Update database
      const result = db.prepare(`
        UPDATE users
        SET username = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND is_active = 1
      `).run(newUsername, userId)

      if (result.changes === 0) {
        throw new Error('User not found or update failed')
      }

      userServiceLogger.info('✅ Username updated', { userId, newUsername })
      return this.getUserById(userId)
    } catch (error) {
      userServiceLogger.error('Failed to update username', { userId, newUsername, error: error.message })
      throw error
    }
  }

  /**
   * Update user avatar
   */
  updateAvatar(userId, avatarBase64) {
    try {
      const result = db.prepare(`
        UPDATE users
        SET avatar_base64 = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND is_active = 1
      `).run(avatarBase64, userId)

      if (result.changes === 0) {
        throw new Error('User not found or update failed')
      }

      userServiceLogger.info('✅ Avatar updated', { userId })
      return this.getUserById(userId)
    } catch (error) {
      userServiceLogger.error('Failed to update avatar', { userId, error: error.message })
      throw error
    }
  }

  /**
   * Delete user account (hard delete)
   */
  deleteUser(userId) {
    try {
      const user = db.prepare(`
        SELECT id, username FROM users WHERE id = ? AND is_active = 1
      `).get(userId)

      if (!user) {
        throw new Error('User not found')
      }

      // Perform hard deletion using transaction
      const result = db.transaction(() => {
        db.prepare('DELETE FROM user_roles WHERE user_id = ?').run(userId)
        db.prepare('DELETE FROM user_stats WHERE user_id = ?').run(userId)
        db.prepare('DELETE FROM friendships WHERE user_id = ? OR friend_id = ?').run(userId, userId)
        db.prepare('DELETE FROM friend_requests WHERE from_user_id = ? OR to_user_id = ?').run(userId, userId)
        db.prepare('DELETE FROM blocked_users WHERE user_id = ? OR blocked_user_id = ?').run(userId, userId)

        const deleteResult = db.prepare('DELETE FROM users WHERE id = ?').run(userId)
        return deleteResult
      })()

      if (result.changes === 0) {
        throw new Error('Failed to delete user account')
      }

      userServiceLogger.info('✅ User account deleted', { userId, username: user.username })
      return true
    } catch (error) {
      userServiceLogger.error('Failed to delete user', { userId, error: error.message })
      throw error
    }
  }
}

export const userService = new UserService()
export default userService
