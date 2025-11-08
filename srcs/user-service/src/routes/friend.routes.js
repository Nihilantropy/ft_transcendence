/**
 * @file Friend Routes
 * @description Routes for friend system (requests, friendships, blocking)
 */

import { logger } from '../logger.js'
import { friendService } from '../services/friendService.js'

const friendLogger = logger.child({ module: 'routes/friend' })

function getUserId(request) {
  const userId = request.headers['x-user-id']
  if (!userId) {
    throw new Error('User ID not found in request headers')
  }
  return parseInt(userId)
}

export default async function friendRoutes(fastify, options) {
  /**
   * POST /friends/request - Send friend request
   */
  fastify.post('/request', async (request, reply) => {
    try {
      const userId = getUserId(request)
      const { toUserId, message } = request.body

      if (!toUserId) {
        return reply.code(400).send({
          success: false,
          message: 'Target user ID is required'
        })
      }

      const result = friendService.sendFriendRequest(userId, parseInt(toUserId), message)

      return reply.code(201).send({
        success: true,
        message: 'Friend request sent',
        request: result
      })
    } catch (error) {
      friendLogger.error('Failed to send friend request', { error: error.message })

      if (error.message.includes('Cannot send') || error.message.includes('not found') || error.message.includes('Already') || error.message.includes('pending')) {
        return reply.code(400).send({
          success: false,
          message: error.message
        })
      }

      return reply.code(500).send({
        success: false,
        message: 'Failed to send friend request'
      })
    }
  })

  /**
   * POST /friends/accept/:requestId - Accept friend request
   */
  fastify.post('/accept/:requestId', async (request, reply) => {
    try {
      const userId = getUserId(request)
      const { requestId } = request.params

      const result = friendService.acceptFriendRequest(parseInt(requestId), userId)

      return reply.code(200).send({
        success: true,
        message: 'Friend request accepted',
        ...result
      })
    } catch (error) {
      friendLogger.error('Failed to accept friend request', { error: error.message })

      if (error.message.includes('not found') || error.message.includes('Not authorized') || error.message.includes('not pending')) {
        return reply.code(400).send({
          success: false,
          message: error.message
        })
      }

      return reply.code(500).send({
        success: false,
        message: 'Failed to accept friend request'
      })
    }
  })

  /**
   * POST /friends/decline/:requestId - Decline friend request
   */
  fastify.post('/decline/:requestId', async (request, reply) => {
    try {
      const userId = getUserId(request)
      const { requestId } = request.params

      const result = friendService.declineFriendRequest(parseInt(requestId), userId)

      return reply.code(200).send({
        success: true,
        message: 'Friend request declined',
        ...result
      })
    } catch (error) {
      friendLogger.error('Failed to decline friend request', { error: error.message })

      if (error.message.includes('not found') || error.message.includes('Not authorized') || error.message.includes('not pending')) {
        return reply.code(400).send({
          success: false,
          message: error.message
        })
      }

      return reply.code(500).send({
        success: false,
        message: 'Failed to decline friend request'
      })
    }
  })

  /**
   * GET /friends/requests - Get pending friend requests
   */
  fastify.get('/requests', async (request, reply) => {
    try {
      const userId = getUserId(request)

      const requests = friendService.getPendingRequests(userId)

      return reply.code(200).send({
        success: true,
        requests: requests.map(req => ({
          id: req.id,
          fromUserId: req.from_user_id,
          username: req.username,
          avatar: req.avatar_base64,
          message: req.message,
          createdAt: req.created_at
        })),
        count: requests.length
      })
    } catch (error) {
      friendLogger.error('Failed to get pending requests', { error: error.message })
      return reply.code(500).send({
        success: false,
        message: 'Failed to retrieve friend requests'
      })
    }
  })

  /**
   * GET /friends - Get friends list
   */
  fastify.get('/', async (request, reply) => {
    try {
      const userId = getUserId(request)

      const friends = friendService.getFriendsList(userId)

      return reply.code(200).send({
        success: true,
        friends: friends.map(friend => ({
          id: friend.id,
          username: friend.username,
          avatar: friend.avatar_base64,
          isOnline: !!friend.is_online,
          friendsSince: friend.friends_since
        })),
        count: friends.length
      })
    } catch (error) {
      friendLogger.error('Failed to get friends list', { error: error.message })
      return reply.code(500).send({
        success: false,
        message: 'Failed to retrieve friends list'
      })
    }
  })

  /**
   * DELETE /friends/:friendId - Remove friend
   */
  fastify.delete('/:friendId', async (request, reply) => {
    try {
      const userId = getUserId(request)
      const { friendId } = request.params

      const result = friendService.removeFriend(userId, parseInt(friendId))

      return reply.code(200).send({
        success: true,
        message: 'Friend removed'
      })
    } catch (error) {
      friendLogger.error('Failed to remove friend', { error: error.message })
      return reply.code(500).send({
        success: false,
        message: 'Failed to remove friend'
      })
    }
  })

  /**
   * POST /friends/block/:userId - Block user
   */
  fastify.post('/block/:userId', async (request, reply) => {
    try {
      const userId = getUserId(request)
      const { userId: targetUserId } = request.params
      const { reason } = request.body

      const result = friendService.blockUser(userId, parseInt(targetUserId), reason)

      return reply.code(200).send({
        success: true,
        message: 'User blocked'
      })
    } catch (error) {
      friendLogger.error('Failed to block user', { error: error.message })

      if (error.message.includes('Cannot block yourself')) {
        return reply.code(400).send({
          success: false,
          message: error.message
        })
      }

      return reply.code(500).send({
        success: false,
        message: 'Failed to block user'
      })
    }
  })

  /**
   * DELETE /friends/block/:userId - Unblock user
   */
  fastify.delete('/block/:userId', async (request, reply) => {
    try {
      const userId = getUserId(request)
      const { userId: targetUserId } = request.params

      const result = friendService.unblockUser(userId, parseInt(targetUserId))

      return reply.code(200).send({
        success: true,
        message: 'User unblocked'
      })
    } catch (error) {
      friendLogger.error('Failed to unblock user', { error: error.message })

      if (error.message.includes('not blocked')) {
        return reply.code(400).send({
          success: false,
          message: error.message
        })
      }

      return reply.code(500).send({
        success: false,
        message: 'Failed to unblock user'
      })
    }
  })

  /**
   * GET /friends/blocked - Get blocked users list
   */
  fastify.get('/blocked', async (request, reply) => {
    try {
      const userId = getUserId(request)

      const blocked = friendService.getBlockedUsers(userId)

      return reply.code(200).send({
        success: true,
        blocked: blocked.map(user => ({
          id: user.id,
          username: user.username,
          avatar: user.avatar_base64,
          reason: user.reason,
          blockedAt: user.blocked_at
        })),
        count: blocked.length
      })
    } catch (error) {
      friendLogger.error('Failed to get blocked users', { error: error.message })
      return reply.code(500).send({
        success: false,
        message: 'Failed to retrieve blocked users'
      })
    }
  })
}
