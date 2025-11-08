/**
 * @file Friend Service
 * @description Business logic for friend requests, friendships, and blocking
 */

import { logger } from '../logger.js'
import db from '../database.js'

const friendServiceLogger = logger.child({ module: 'services/friend' })

export class FriendService {
  /**
   * Send friend request
   */
  sendFriendRequest(fromUserId, toUserId, message = null) {
    try {
      // Prevent self-friending
      if (fromUserId === toUserId) {
        throw new Error('Cannot send friend request to yourself')
      }

      // Check if users exist
      const toUser = db.prepare('SELECT id FROM users WHERE id = ? AND is_active = 1').get(toUserId)
      if (!toUser) {
        throw new Error('Target user not found')
      }

      // Check if already friends
      const existingFriendship = db.prepare(`
        SELECT id FROM friendships
        WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
      `).get(fromUserId, toUserId, toUserId, fromUserId)

      if (existingFriendship) {
        throw new Error('Already friends with this user')
      }

      // Check for existing pending request
      const existingRequest = db.prepare(`
        SELECT id, status FROM friend_requests
        WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)
      `).get(fromUserId, toUserId, toUserId, fromUserId)

      if (existingRequest && existingRequest.status === 'pending') {
        throw new Error('Friend request already pending')
      }

      // Check if blocked
      const isBlocked = db.prepare(`
        SELECT id FROM blocked_users
        WHERE (user_id = ? AND blocked_user_id = ?) OR (user_id = ? AND blocked_user_id = ?)
      `).get(fromUserId, toUserId, toUserId, fromUserId)

      if (isBlocked) {
        throw new Error('Cannot send friend request to this user')
      }

      // Create friend request
      const result = db.prepare(`
        INSERT INTO friend_requests (from_user_id, to_user_id, message, status, created_at)
        VALUES (?, ?, ?, 'pending', CURRENT_TIMESTAMP)
      `).run(fromUserId, toUserId, message)

      friendServiceLogger.info('✅ Friend request sent', { fromUserId, toUserId, requestId: result.lastInsertRowid })

      return {
        id: result.lastInsertRowid,
        from_user_id: fromUserId,
        to_user_id: toUserId,
        message,
        status: 'pending'
      }
    } catch (error) {
      friendServiceLogger.error('Failed to send friend request', { fromUserId, toUserId, error: error.message })
      throw error
    }
  }

  /**
   * Accept friend request
   */
  acceptFriendRequest(requestId, userId) {
    try {
      return db.transaction(() => {
        // Get the request
        const request = db.prepare(`
          SELECT id, from_user_id, to_user_id, status
          FROM friend_requests
          WHERE id = ?
        `).get(requestId)

        if (!request) {
          throw new Error('Friend request not found')
        }

        if (request.to_user_id !== userId) {
          throw new Error('Not authorized to accept this request')
        }

        if (request.status !== 'pending') {
          throw new Error('Friend request is not pending')
        }

        // Update request status
        db.prepare(`
          UPDATE friend_requests
          SET status = 'accepted', responded_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(requestId)

        // Create friendship (bidirectional)
        db.prepare(`
          INSERT INTO friendships (user_id, friend_id, created_at)
          VALUES (?, ?, CURRENT_TIMESTAMP)
        `).run(request.from_user_id, request.to_user_id)

        db.prepare(`
          INSERT INTO friendships (user_id, friend_id, created_at)
          VALUES (?, ?, CURRENT_TIMESTAMP)
        `).run(request.to_user_id, request.from_user_id)

        friendServiceLogger.info('✅ Friend request accepted', { requestId, userId })

        return { success: true, requestId }
      })()
    } catch (error) {
      friendServiceLogger.error('Failed to accept friend request', { requestId, userId, error: error.message })
      throw error
    }
  }

  /**
   * Decline friend request
   */
  declineFriendRequest(requestId, userId) {
    try {
      const request = db.prepare(`
        SELECT id, from_user_id, to_user_id, status
        FROM friend_requests
        WHERE id = ?
      `).get(requestId)

      if (!request) {
        throw new Error('Friend request not found')
      }

      if (request.to_user_id !== userId) {
        throw new Error('Not authorized to decline this request')
      }

      if (request.status !== 'pending') {
        throw new Error('Friend request is not pending')
      }

      // Update request status
      db.prepare(`
        UPDATE friend_requests
        SET status = 'declined', responded_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(requestId)

      friendServiceLogger.info('✅ Friend request declined', { requestId, userId })

      return { success: true, requestId }
    } catch (error) {
      friendServiceLogger.error('Failed to decline friend request', { requestId, userId, error: error.message })
      throw error
    }
  }

  /**
   * Get pending friend requests for user
   */
  getPendingRequests(userId) {
    try {
      const requests = db.prepare(`
        SELECT
          fr.id, fr.from_user_id, fr.message, fr.created_at,
          u.username, u.avatar_base64
        FROM friend_requests fr
        JOIN users u ON fr.from_user_id = u.id
        WHERE fr.to_user_id = ? AND fr.status = 'pending'
        ORDER BY fr.created_at DESC
      `).all(userId)

      return requests
    } catch (error) {
      friendServiceLogger.error('Failed to get pending requests', { userId, error: error.message })
      throw error
    }
  }

  /**
   * Get user's friends list
   */
  getFriendsList(userId) {
    try {
      const friends = db.prepare(`
        SELECT
          u.id, u.username, u.avatar_base64, u.is_online,
          f.created_at as friends_since
        FROM friendships f
        JOIN users u ON f.friend_id = u.id
        WHERE f.user_id = ? AND u.is_active = 1
        ORDER BY u.username ASC
      `).all(userId)

      return friends
    } catch (error) {
      friendServiceLogger.error('Failed to get friends list', { userId, error: error.message })
      throw error
    }
  }

  /**
   * Remove friend
   */
  removeFriend(userId, friendId) {
    try {
      return db.transaction(() => {
        // Remove both directions of friendship
        db.prepare('DELETE FROM friendships WHERE user_id = ? AND friend_id = ?').run(userId, friendId)
        db.prepare('DELETE FROM friendships WHERE user_id = ? AND friend_id = ?').run(friendId, userId)

        friendServiceLogger.info('✅ Friend removed', { userId, friendId })

        return { success: true }
      })()
    } catch (error) {
      friendServiceLogger.error('Failed to remove friend', { userId, friendId, error: error.message })
      throw error
    }
  }

  /**
   * Block user
   */
  blockUser(userId, blockedUserId, reason = null) {
    try {
      if (userId === blockedUserId) {
        throw new Error('Cannot block yourself')
      }

      return db.transaction(() => {
        // Remove any existing friendship
        db.prepare('DELETE FROM friendships WHERE user_id = ? AND friend_id = ?').run(userId, blockedUserId)
        db.prepare('DELETE FROM friendships WHERE user_id = ? AND friend_id = ?').run(blockedUserId, userId)

        // Remove any pending friend requests
        db.prepare('DELETE FROM friend_requests WHERE from_user_id = ? AND to_user_id = ?').run(userId, blockedUserId)
        db.prepare('DELETE FROM friend_requests WHERE from_user_id = ? AND to_user_id = ?').run(blockedUserId, userId)

        // Add to blocked users
        db.prepare(`
          INSERT OR IGNORE INTO blocked_users (user_id, blocked_user_id, reason, created_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `).run(userId, blockedUserId, reason)

        friendServiceLogger.info('✅ User blocked', { userId, blockedUserId })

        return { success: true }
      })()
    } catch (error) {
      friendServiceLogger.error('Failed to block user', { userId, blockedUserId, error: error.message })
      throw error
    }
  }

  /**
   * Unblock user
   */
  unblockUser(userId, blockedUserId) {
    try {
      const result = db.prepare('DELETE FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?').run(userId, blockedUserId)

      if (result.changes === 0) {
        throw new Error('User is not blocked')
      }

      friendServiceLogger.info('✅ User unblocked', { userId, blockedUserId })

      return { success: true }
    } catch (error) {
      friendServiceLogger.error('Failed to unblock user', { userId, blockedUserId, error: error.message })
      throw error
    }
  }

  /**
   * Get blocked users list
   */
  getBlockedUsers(userId) {
    try {
      const blocked = db.prepare(`
        SELECT
          u.id, u.username, u.avatar_base64,
          b.reason, b.created_at as blocked_at
        FROM blocked_users b
        JOIN users u ON b.blocked_user_id = u.id
        WHERE b.user_id = ?
        ORDER BY b.created_at DESC
      `).all(userId)

      return blocked
    } catch (error) {
      friendServiceLogger.error('Failed to get blocked users', { userId, error: error.message })
      throw error
    }
  }
}

export const friendService = new FriendService()
export default friendService
