/**
 * @file Public user profile route - /users/:userId
 * @description Route for viewing public user profiles
 */

import { logger } from '../../logger.js'
import { optionalAuth } from '../../middleware/authentication.js'
import { userService } from '../../services/user.service.js'
import { formatPublicUser } from '../../utils/user-formatters.js'
import { routeUserSchemas } from '../../schemas/index.js'

const profileLogger = logger.child({ module: 'routes/users/profile' })

/**
 * @brief Register /users/:userId route
 * @param {FastifyInstance} fastify - Fastify instance
 */
async function publicProfileRoute(fastify) {
  
  /**
   * @route GET /users/:userId
   * @description Get public profile for any user
   * @authentication Optional (can be viewed without login)
   */
  fastify.get('/:userId', {
    preHandler: optionalAuth,
    schema: routeUserSchemas.publicProfile
  }, async (request, reply) => {
    try {
      const { userId } = request.params
      const viewerId = request.user?.id
      
      profileLogger.debug('Getting public profile', { userId, viewerId })
      
      // Prevent viewing own profile via public endpoint
      // (should use /users/me instead)
      if (viewerId && viewerId === userId) {
        profileLogger.debug('Redirecting to /me endpoint', { userId })
        return reply.code(200).send({
          success: true,
          message: 'Use /users/me for your own profile',
          redirectTo: '/api/users/me'
        })
      }
      
      // Get public profile from service
      const user = userService.getPublicProfile(userId)
      
      if (!user) {
        profileLogger.debug('User not found', { userId })
        return reply.code(404).send({
          success: false,
          message: 'User not found'
        })
      }
      
      // Format response using formatter
      const formattedUser = formatPublicUser(user)
      
      profileLogger.debug('✅ Public profile retrieved', { userId, viewerId })
      
      return reply.code(200).send({
        success: true,
        user: formattedUser
      })
      
    } catch (error) {
      profileLogger.error('❌ Failed to get public profile', {
        userId: request.params.userId,
        error: error.message
      })
      
      return reply.code(500).send({
        success: false,
        message: 'Failed to retrieve profile'
      })
    }
  })
}

export default publicProfileRoute
