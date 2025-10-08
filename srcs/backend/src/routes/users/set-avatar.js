/**
 * @file Avatar update route - /users/set-avatar
 * @description Route for updating avatar URL for authenticated user
 */

import { logger } from '../../logger.js'
import { requireAuth } from '../../middleware/authentication.js'
import { userService } from '../../services/user.service.js'
import { formatOwnProfile } from '../../utils/user-formatters.js'
import { routeUserSchemas } from '../../schemas/index.js'

const setAvatarLogger = logger.child({ module: 'routes/users/set-avatar' })

/**
 * @brief Register /users/set-avatar route
 * @param {FastifyInstance} fastify - Fastify instance
 */
async function setAvatarRoute(fastify) {
  
  /**
   * @route POST /users/set-avatar
   * @description Update avatar URL for authenticated user
   * @authentication Required (JWT cookie)
   * @body avatarUrl - New avatar URL or null to remove (required)
   */
  fastify.post('/set-avatar', {
    preHandler: requireAuth,
    schema: routeUserSchemas.updateAvatar
  }, async (request, reply) => {
    try {
      const { avatarUrl } = request.body
      const userId = request.user.id
      
      setAvatarLogger.info('Avatar update requested', { 
        userId, 
        hasAvatar: !!avatarUrl 
      })
      
      // Update avatar using service
      const updatedUser = userService.updateAvatar(userId, avatarUrl)
      
      // Format response
      const formattedUser = formatOwnProfile(updatedUser)
      
      const message = avatarUrl 
        ? 'Avatar updated successfully' 
        : 'Avatar removed successfully'
      
      setAvatarLogger.info('✅ Avatar updated successfully', { 
        userId, 
        removed: !avatarUrl 
      })
      
      return reply.code(200).send({
        success: true,
        message: message,
        user: formattedUser
      })
      
    } catch (error) {
      setAvatarLogger.error('❌ Avatar update failed', {
        userId: request.user?.id,
        error: error.message
      })
      
      // Handle specific error cases
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
        message: 'Failed to update avatar',
        error: {
          code: 'UPDATE_FAILED',
          details: error.message
        }
      })
    }
  })
}

export default setAvatarRoute
