/**
 * @file User profile routes - /users/me
 * @description Routes for authenticated user to view their own complete profile
 */

import { logger } from '../../logger.js'
import { requireAuth } from '../../middleware/authentication.js'
import { userService } from '../../services/user.service.js'
import { formatOwnProfile } from '../../utils/user-formatters.js'
import { routeUserSchemas } from '../../schemas/index.js'

const meLogger = logger.child({ module: 'routes/users/me' })

/**
 * @brief Register /users/me route
 * @param {FastifyInstance} fastify - Fastify instance
 */
export async function meRoute(fastify) {
  /**
   * @route GET /users/me
   * @description Get complete profile for authenticated user
   * @authentication Required (JWT cookie)
   */
  fastify.get('/me', {
    preHandler: requireAuth,
    schema: routeUserSchemas.me
  }, async (request, reply) => {
    try {
      const userId = request.user.id
      
      meLogger.debug('Getting complete profile for user', { userId })
      
      // Get complete profile from service
      const user = userService.getCompleteProfile(userId)
      
      if (!user) {
        meLogger.warn('User not found', { userId })
        return reply.code(404).send({
          success: false,
          message: 'User not found'
        })
      }
      
      // Format response using formatter
      const formattedUser = formatOwnProfile(user)
      
      meLogger.info('✅ Complete profile retrieved', { userId })
      
      return reply.code(200).send({
        success: true,
        user: formattedUser
      })
      
    } catch (error) {
      meLogger.error('❌ Failed to get complete profile', {
        userId: request.user?.id,
        error: error.message
      })
      
      return reply.code(500).send({
        success: false,
        message: 'Failed to retrieve profile'
      })
    }
  })
}

/**
 * @brief DELETE /api/users/me - Delete user account (hard delete)
 * 
 * @route DELETE /api/users/me
 * @access Private (requires authentication)
 * @returns {Object} 200 - Success response
 * @returns {Object} 400 - Invalid request (missing password or confirmation)
 * @returns {Object} 401 - Unauthorized (not authenticated)
 * @returns {Object} 403 - Forbidden (incorrect password)
 * @returns {Object} 500 - Server error
 *
 * @description Hard deletes user account by removing all data
 * Requires password verification and confirmation string for safety
 * Clears all sensitive data and logs user out
 * 
 * @security
 * - Requires valid JWT token
 * - Requires correct password
 * - Requires confirmation="DELETE" string
 * - Hard delete (removes all data)
 * - Clears 2FA secrets
 * - Invalidates session
 */
export async function deleteMeRoute(fastify) {
  /**
   * @route DELETE /users/me
   * @description Delete authenticated user's account (hard delete)
   * @authentication Required (JWT cookie)
   * @body password - Current password (required for password-based accounts)
   * @body confirmation - Must be "DELETE" to confirm (required)
   */
  fastify.delete(
    '/me',
    {
      preHandler: requireAuth,
      schema: routeUserSchemas.deleteAccount,
    },
    async (request, reply) => {
      const userId = request.user.id

      meLogger.info('User account deletion request', {
        userId,
        username: request.user.username,
      })

      try {
        const { password, confirmation } = request.body

        // Step 1: Validate confirmation (required for all users)
        if (!confirmation || confirmation !== 'DELETE') {
          meLogger.debug('Delete account failed - invalid confirmation', { 
            userId,
            confirmation 
          })
          return reply.code(400).send({
            success: false,
            error: 'Bad Request',
            message: 'Confirmation must be "DELETE"',
            statusCode: 400,
          })
        }

        // Step 2: Check if user has password (to determine account type)
        const user = userService.getUserById(userId)
        if (!user) {
          meLogger.debug('Delete account failed - user not found', { userId })
          return reply.code(404).send({
            success: false,
            error: 'Not Found',
            message: 'User not found',
            statusCode: 404,
          })
        }

        const isPasswordUser = !!user.password_hash
        const isOAuthUser = !user.password_hash
        // Step 3: For password users, validate password is provided
        if (isPasswordUser && (!password || password.trim() === '')) {
          meLogger.debug('Delete account failed - password required for password-based account', { userId })
          return reply.code(400).send({
            success: false,
            error: 'Bad Request',
            message: 'Password is required for password-based accounts',
            statusCode: 400,
          })
        }

        // Step 4: Attempt to delete user
        try {
          // For OAuth users, pass null as password (no verification needed)
          // For password users, pass the provided password
          userService.deleteUser(userId, isOAuthUser ? null : password)
          
          // Clear session cookie to log user out
          reply.clearCookie('access_token', {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
          })

          meLogger.info('✅ User account deleted successfully', {
            userId,
            username: request.user.username,
          })

          return reply.code(200).send({
            success: true,
            message: 'Account deleted successfully',
          })
          
        } catch (serviceError) {
          // Handle specific service errors
          if (serviceError.message === 'User not found') {
            meLogger.debug('Delete account failed - user not found', { userId })
            return reply.code(404).send({
              success: false,
              error: 'Not Found',
              message: 'User not found',
              statusCode: 404,
            })
          }

          if (serviceError.message === 'Invalid password') {
            meLogger.debug('Delete account failed - incorrect password', { userId })
            return reply.code(403).send({
              success: false,
              error: 'Forbidden',
              message: 'Incorrect password',
              statusCode: 403,
            })
          }

          if (serviceError.message === 'Password is required for this account') {
            meLogger.debug('Delete account failed - password required', { userId })
            return reply.code(400).send({
              success: false,
              error: 'Bad Request',
              message: 'Password is required for password-based accounts',
              statusCode: 400,
            })
          }

          // Re-throw other service errors to be caught by outer catch
          throw serviceError
        }

      } catch (error) {
        meLogger.error('❌ Delete account failed', {
          userId,
          error: error.message,
          stack: error.stack,
        })

        return reply.code(500).send({
          success: false,
          error: 'Internal Server Error',
          message: 'Failed to delete account',
          statusCode: 500,
        })
      }
    }
  )
}

