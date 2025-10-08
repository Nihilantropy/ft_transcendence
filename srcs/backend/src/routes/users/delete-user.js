/**
 * @brief DELETE /api/users/me - Delete user account (soft delete)
 * 
 * @route DELETE /api/users/me
 * @access Private (requires authentication)
 * @returns {Object} 200 - Success response
 * @returns {Object} 400 - Invalid request (missing password or confirmation)
 * @returns {Object} 401 - Unauthorized (not authenticated)
 * @returns {Object} 403 - Forbidden (incorrect password)
 * @returns {Object} 500 - Server error
 * 
 * @description Soft deletes user account by setting is_active=0
 * Requires password verification and confirmation string for safety
 * Clears all sensitive data and logs user out
 * 
 * @security
 * - Requires valid JWT token
 * - Requires correct password
 * - Requires confirmation="DELETE" string
 * - Soft delete (preserves data, sets is_active=0)
 * - Clears 2FA secrets
 * - Invalidates session
 */

import { logger } from '../../logger.js'
import { requireAuth } from '../../middleware/authentication.js'
import { userService } from '../../services/user.service.js'
import { routeUserSchemas } from '../../schemas/routes/user.schema.js'

const routeLogger = logger.child({ module: 'routes/users/delete-user' })

export default async function deleteUserRoute(fastify) {
  fastify.delete(
    '/me',
    {
      preHandler: requireAuth,
      schema: routeUserSchemas.deleteAccount,
    },
    async (request, reply) => {
      const userId = request.user.id

      routeLogger.info('User account deletion request', {
        userId,
        username: request.user.username,
      })

      try {
        const { password, confirmation } = request.body

        // Validate required fields
        if (!password || typeof password !== 'string' || password.trim().length === 0) {
          routeLogger.debug('Delete account failed - password missing', { userId })
          return reply.code(400).send({
            error: 'Bad Request',
            message: 'Password is required',
            statusCode: 400,
          })
        }

        if (!confirmation || confirmation !== 'DELETE') {
          routeLogger.debug('Delete account failed - invalid confirmation', { 
            userId,
            confirmation 
          })
          return reply.code(400).send({
            error: 'Bad Request',
            message: 'Confirmation must be "DELETE"',
            statusCode: 400,
          })
        }

        // Attempt to delete user (includes password verification)
        try {
          await userService.deleteUser(userId, password)
          
          // Clear session cookie to log user out
          reply.clearCookie('access_token', {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
          })

          routeLogger.info('✅ User account deleted successfully', {
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
            routeLogger.debug('Delete account failed - user not found', { userId })
            return reply.code(404).send({
              error: 'Not Found',
              message: 'User not found',
              statusCode: 404,
            })
          }

          if (serviceError.message === 'Invalid password') {
            routeLogger.debug('Delete account failed - incorrect password', { userId })
            return reply.code(403).send({
              error: 'Forbidden',
              message: 'Incorrect password',
              statusCode: 403,
            })
          }

          // Re-throw other service errors to be caught by outer catch
          throw serviceError
        }

      } catch (error) {
        routeLogger.error('❌ Delete account failed', {
          userId,
          error: error.message,
          stack: error.stack,
        })

        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to delete account',
          statusCode: 500,
        })
      }
    }
  )
}
