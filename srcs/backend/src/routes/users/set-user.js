/**
 * @brief Set username route for ft_transcendence backend
 */

import { logger } from '../../logger.js'

const setUsernameLogger = logger.child({ module: 'routes/auth/set-username' })

async function setUsernameRoute(fastify, options) {
  fastify.post('/set-username', async (request, reply) => {
    try {
      const { username } = request.body
      
      // TODO: Implement username setting logic
      // 1. Verify JWT token from Authorization header
      // 2. Validate new username
      // 3. Check username availability
      // 4. Update user record
      // 5. Return updated user data
      
      return {
        success: true,
        message: 'Username updated successfully',
        user: {} // TODO: Return updated user object
      }
    } catch (error) {
      setUsernameLogger.error('❌ Set username failed', { error: error.message })
      reply.status(400)
      return { success: false, message: 'Username update failed' }
    }
  })
  
}

export default setUsernameRoute