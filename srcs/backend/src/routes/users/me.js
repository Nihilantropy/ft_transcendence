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
async function meRoute(fastify) {
  
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

export default meRoute
