/**
 * @brief User logout route for ft_transcendence backend
 * 
 * @description Handles user logout with centralized validation
 */

import { logger } from '../../logger.js'
import { userService } from '../../services/user.service.js'
import { requireAuth } from '../../middleware/authentication.js'
import { routeSchemas } from '../../schemas/index.js'

const logoutLogger = logger.child({ module: 'routes/auth/logout' })

/**
 * @brief Register logout route
 * @param {FastifyInstance} fastify - The Fastify instance
 */
async function logoutRoute(fastify, options) {
  
  fastify.post('/logout', {
    schema: routeSchemas.logout,
    preValidation: requireAuth
  }, async (request, reply) => {
    try {
      // Update user's online status to false
      userService.updateUserOnlineStatus(request.user.id, false)
      
      logoutLogger.info('👋 User logged out successfully', { 
        userId: request.user.id, 
        username: request.user.username 
      })
      
      return {
        success: true,
        message: 'Logout successful'
      }
      
    } catch (error) {
      logoutLogger.error('❌ Logout failed', { error: error.message })
      reply.status(400)
      return { 
        success: false, 
        message: 'Logout failed',
        error: {
          code: 'LOGOUT_ERROR',
          details: error.message
        }
      }
    }
  })
  
  logoutLogger.info('✅ Logout route registered successfully')
}

export default logoutRoute