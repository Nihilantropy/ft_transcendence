/**
 * @file Username availability check route - /users/check-username
 * @description Route for checking if username is available and valid
 */

import { logger } from '../../logger.js'
import { userService } from '../../services/user.service.js'
import { routeUserSchemas } from '../../schemas/index.js'

const checkUsernameLogger = logger.child({ module: 'routes/users/check-username' })

/**
 * @brief Register /users/check-username route
 * @param {FastifyInstance} fastify - Fastify instance
 */
async function checkUsernameRoute(fastify) {
  
  /**
   * @route GET /users/check-username
   * @description Check if username is available and valid
   * @authentication Optional (if authenticated, allows user to keep their current username)
   * @query username - Username to check (required)
   */
  fastify.get('/check-username', {
    schema: routeUserSchemas.checkUsername
  }, async (request, reply) => {
    try {
      const { username } = request.query
      const userId = request.user?.id // Optional authentication
      
      checkUsernameLogger.debug('Checking username availability', { username, userId })
      
      // 1. Validate format
      const validation = userService.validateUsernameFormat(username)
      
      if (!validation.isValid) {
        checkUsernameLogger.debug('Username validation failed', { 
          username, 
          reason: validation.message 
        })
        
        return reply.code(200).send({
          available: false,
          message: validation.message
        })
      }
      
      // 2. If user is authenticated, check if this is their current username
      if (userId) {
        const currentUser = userService.getUserById(userId)
        if (currentUser && currentUser.username.toLowerCase() === username.toLowerCase()) {
          checkUsernameLogger.debug('✅ User keeping current username', { username, userId })
          
          return reply.code(200).send({
            available: true,
            message: 'This is your current username'
          })
        }
      }
      
      // 3. Check availability
      const isTaken = userService.isUsernameTaken(username)
      
      if (isTaken) {
        checkUsernameLogger.debug('Username is taken', { username })
        
        return reply.code(200).send({
          available: false,
          message: 'Username is already taken'
        })
      }
      
      // 4. Username is available
      checkUsernameLogger.debug('✅ Username is available', { username })
      
      return reply.code(200).send({
        available: true,
        message: 'Username is available'
      })
      
    } catch (error) {
      checkUsernameLogger.error('❌ Username check failed', {
        username: request.query.username,
        error: error.message
      })
      
      return reply.code(500).send({
        available: false,
        message: 'Failed to check username availability'
      })
    }
  })
}

export default checkUsernameRoute
