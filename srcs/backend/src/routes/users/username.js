/**
 * @file Username update route - /users/me/username
 * @description Route for updating username for authenticated user
 */

import { logger } from '../../logger.js'
import { requireAuth } from '../../middleware/authentication.js'
import { userService } from '../../services/user.service.js'
import { formatOwnProfile } from '../../utils/user-formatters.js'
import { routeUserSchemas } from '../../schemas/index.js'

const setUsernameLogger = logger.child({ module: 'routes/users/set-username' })

/**
 * @brief Register /users/me/username route
 * @param {FastifyInstance} fastify - Fastify instance
 */
async function updateUsernameRoute(fastify) {
  
  /**
   * @route PATCH /users/me/username
   * @description Update username for authenticated user
   * @authentication Required (JWT cookie)
   * @body username - New username (required)
   */
  fastify.patch('/me/username', {
    preHandler: requireAuth,
    schema: routeUserSchemas.updateUsername
  }, async (request, reply) => {
    try {
      const { username } = request.body
      const userId = request.user.id
      
      setUsernameLogger.info('Username update requested', { userId, username })
      
      // Update username using service
      const updatedUser = userService.updateUsername(userId, username)
      
      // Format response
      const formattedUser = formatOwnProfile(updatedUser)
      
      setUsernameLogger.info('✅ Username updated successfully', { 
        userId, 
        newUsername: username 
      })
      
      return reply.code(200).send({
        success: true,
        message: 'Username updated successfully',
        user: formattedUser
      })
      
    } catch (error) {
      setUsernameLogger.error('❌ Username update failed', {
        userId: request.user?.id,
        username: request.body?.username,
        error: error.message
      })
      
      // Handle specific error cases
      if (error.message.includes('Invalid username format')) {
        return reply.code(400).send({
          success: false,
          message: 'Invalid username format',
          error: {
            code: 'INVALID_USERNAME_FORMAT',
            details: error.message
          }
        })
      }
      
      if (error.message.includes('already taken')) {
        return reply.code(409).send({
          success: false,
          message: 'Username is already taken',
          error: {
            code: 'USERNAME_TAKEN',
            details: error.message
          }
        })
      }
      
      if (error.message.includes('not found')) {
        return reply.code(404).send({
          success: false,
          message: 'User not found',
          error: {
            code: 'USER_NOT_FOUND',
            details: error.message
          }
        })
      }
      
      // Generic error
      return reply.code(500).send({
        success: false,
        message: 'Failed to update username',
        error: {
          code: 'UPDATE_FAILED',
          details: error.message
        }
      })
    }
  })
}

export default updateUsernameRoute
