/**
 * @file Profile Routes
 * @description Routes for user profiles (own and public)
 */

import { logger } from '../logger.js'
import { userService } from '../services/userService.js'
import { processAvatarImage } from '../utils/imageProcessing.js'

const profileLogger = logger.child({ module: 'routes/profile' })

/**
 * Extract user ID from API Gateway headers
 * API Gateway verifies JWT and forwards user ID via x-user-id header
 */
function getUserId(request) {
  const userId = request.headers['x-user-id']
  if (!userId) {
    throw new Error('User ID not found in request headers')
  }
  return parseInt(userId)
}

export default async function profileRoutes(fastify, options) {
  /**
   * GET /me - Get own complete profile
   */
  fastify.get('/me', async (request, reply) => {
    try {
      const userId = getUserId(request)

      const user = userService.getCompleteProfile(userId)

      if (!user) {
        return reply.code(404).send({
          success: false,
          message: 'User not found'
        })
      }

      return reply.code(200).send({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          email_verified: !!user.email_verified,
          avatar: user.avatar_base64,
          twoFactorEnabled: !!user.two_factor_enabled,
          isOnline: !!user.is_online,
          lastSeen: user.last_seen,
          createdAt: user.created_at,
          updatedAt: user.updated_at
        }
      })
    } catch (error) {
      profileLogger.error('Failed to get own profile', { error: error.message })
      return reply.code(500).send({
        success: false,
        message: 'Failed to retrieve profile'
      })
    }
  })

  /**
   * GET /:userId - Get public profile
   */
  fastify.get('/:userId', async (request, reply) => {
    try {
      const { userId } = request.params
      const targetUserId = parseInt(userId)

      if (isNaN(targetUserId)) {
        return reply.code(400).send({
          success: false,
          message: 'Invalid user ID'
        })
      }

      const user = userService.getPublicProfile(targetUserId)

      if (!user) {
        return reply.code(404).send({
          success: false,
          message: 'User not found'
        })
      }

      return reply.code(200).send({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          avatar: user.avatar_base64,
          isOnline: !!user.is_online,
          joinedAt: user.created_at
        }
      })
    } catch (error) {
      profileLogger.error('Failed to get public profile', { error: error.message })
      return reply.code(500).send({
        success: false,
        message: 'Failed to retrieve profile'
      })
    }
  })

  /**
   * GET /search - Search users by username
   */
  fastify.get('/search', async (request, reply) => {
    try {
      const { q: searchQuery, limit = 10 } = request.query

      if (!searchQuery || searchQuery.trim().length === 0) {
        return reply.code(400).send({
          success: false,
          message: 'Search query is required'
        })
      }

      const users = userService.searchUsersByUsername(searchQuery, parseInt(limit))

      return reply.code(200).send({
        success: true,
        users: users.map(user => ({
          id: user.id,
          username: user.username,
          avatar: user.avatar_base64,
          isOnline: !!user.is_online
        })),
        count: users.length
      })
    } catch (error) {
      profileLogger.error('User search failed', { error: error.message })
      return reply.code(500).send({
        success: false,
        message: 'Failed to search users'
      })
    }
  })

  /**
   * GET /check-username - Check username availability
   */
  fastify.get('/check-username', async (request, reply) => {
    try {
      const { username } = request.query

      if (!username) {
        return reply.code(400).send({
          available: false,
          message: 'Username is required'
        })
      }

      // Validate format
      const validation = userService.validateUsernameFormat(username)

      if (!validation.isValid) {
        return reply.code(200).send({
          available: false,
          message: validation.message
        })
      }

      // Check if authenticated user owns this username
      try {
        const userId = getUserId(request)
        const currentUser = userService.getUserById(userId)
        if (currentUser && currentUser.username.toLowerCase() === username.toLowerCase()) {
          return reply.code(200).send({
            available: true,
            message: 'This is your current username'
          })
        }
      } catch (e) {
        // Not authenticated, continue with regular check
      }

      // Check availability
      const isTaken = userService.isUsernameTaken(username)

      return reply.code(200).send({
        available: !isTaken,
        message: isTaken ? 'Username is already taken' : 'Username is available'
      })
    } catch (error) {
      profileLogger.error('Username check failed', { error: error.message })
      return reply.code(500).send({
        available: false,
        message: 'Failed to check username availability'
      })
    }
  })

  /**
   * PATCH /me/username - Update username
   */
  fastify.patch('/me/username', async (request, reply) => {
    try {
      const userId = getUserId(request)
      const { username } = request.body

      if (!username) {
        return reply.code(400).send({
          success: false,
          message: 'Username is required'
        })
      }

      const updatedUser = userService.updateUsername(userId, username)

      return reply.code(200).send({
        success: true,
        message: 'Username updated successfully',
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          email: updatedUser.email,
          avatar: updatedUser.avatar_base64
        }
      })
    } catch (error) {
      profileLogger.error('Username update failed', { error: error.message })

      if (error.message.includes('Invalid username format')) {
        return reply.code(400).send({
          success: false,
          message: error.message
        })
      }

      if (error.message.includes('already taken')) {
        return reply.code(409).send({
          success: false,
          message: 'Username is already taken'
        })
      }

      return reply.code(500).send({
        success: false,
        message: 'Failed to update username'
      })
    }
  })

  /**
   * POST /me/avatar - Upload avatar
   */
  fastify.post('/me/avatar', async (request, reply) => {
    try {
      const userId = getUserId(request)

      // Get uploaded file
      const data = await request.file()

      if (!data) {
        return reply.code(400).send({
          success: false,
          message: 'No file uploaded'
        })
      }

      if (!data.mimetype.startsWith('image/')) {
        return reply.code(400).send({
          success: false,
          message: 'Only image files are allowed'
        })
      }

      // Read file buffer
      const buffer = await data.toBuffer()

      // Check file size (5MB max)
      if (buffer.length > 5 * 1024 * 1024) {
        return reply.code(400).send({
          success: false,
          message: 'File too large (max 5MB)'
        })
      }

      // Process image
      const avatarBase64 = await processAvatarImage(buffer)

      // Update user avatar
      const updatedUser = userService.updateAvatar(userId, avatarBase64)

      return reply.code(200).send({
        success: true,
        message: 'Avatar uploaded successfully',
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          avatar: updatedUser.avatar_base64
        }
      })
    } catch (error) {
      profileLogger.error('Avatar upload failed', { error: error.message })

      if (error.message.includes('file type')) {
        return reply.code(400).send({
          success: false,
          message: 'Invalid file type'
        })
      }

      if (error.message.includes('too large')) {
        return reply.code(400).send({
          success: false,
          message: 'Image too large after processing'
        })
      }

      return reply.code(500).send({
        success: false,
        message: 'Failed to upload avatar'
      })
    }
  })

  /**
   * DELETE /me - Delete account
   */
  fastify.delete('/me', async (request, reply) => {
    try {
      const userId = getUserId(request)

      userService.deleteUser(userId)

      return reply.code(200).send({
        success: true,
        message: 'Account deleted successfully'
      })
    } catch (error) {
      profileLogger.error('Account deletion failed', { error: error.message })

      return reply.code(500).send({
        success: false,
        message: 'Failed to delete account'
      })
    }
  })
}
