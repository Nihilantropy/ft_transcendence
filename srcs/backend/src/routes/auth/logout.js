/**
 * @brief User logout route for ft_transcendence backend
 * 
 * @description Handles user logout with:
 * - JWT token invalidation
 * - User session cleanup
 * - Online status update
 */

import { logger } from '../../logger.js'

// Create route-specific logger
const logoutLogger = logger.child({ module: 'routes/auth/logout' })

/**
 * @brief Register logout route
 * @param {FastifyInstance} fastify - The Fastify instance
 */
async function logoutRoute(fastify, options) {
  
  /**
   * @route POST /logout
   * @description Invalidate user session and tokens
   */
  fastify.post('/logout', async (request, reply) => {
    try {
      // TODO: Implement logout logic
      // 1. Extract JWT from Authorization header
      // 2. Verify JWT token
      // 3. Update user's is_online status to false
      // 4. Add token to blacklist (optional)
      // 5. Clear any server-side session data
      
      logoutLogger.info('👋 User logged out')
      
      return {
        success: true,
        message: 'Logout successful'
      }
    } catch (error) {
      logoutLogger.error('❌ Logout failed', { error: error.message })
      reply.status(400)
      return { success: false, message: 'Logout failed' }
    }
  })
  
  logoutLogger.info('✅ Logout route registered successfully')
}

export default logoutRoute