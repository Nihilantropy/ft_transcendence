/**
 * @brief Check username availability route for ft_transcendence backend
 * 
 * @description Handles username availability checks with:
 * - Username format validation
 * - Reserved words checking
 * - Database uniqueness verification
 */

import { logger } from '../../logger.js'
import { checkUsernameSchema } from '../../middleware/validation.js'

// Create route-specific logger
const checkUsernameLogger = logger.child({ module: 'routes/auth/check-username' })

/**
 * @brief Register check username route
 * @param {FastifyInstance} fastify - The Fastify instance
 */
async function checkUsernameRoute(fastify, options) {
  
  /**
   * @route POST /check-username
   * @description Check if username is available for registration
   */
  fastify.post('/check-username', {
    schema: checkUsernameSchema,
    handler: async (request, reply) => {
      try {
        const { username } = request.body
        
        // TODO: Implement username check logic
        // 1. Validate username format (3-20 chars, alphanumeric + underscore/hyphen)
        // 2. Check against reserved words list
        // 3. Check database for existing username (case-insensitive)
        // 4. Return availability status
        
        return {
          available: true, // TODO: Check database
          message: 'Username is available'
        }
      } catch (error) {
        checkUsernameLogger.error('❌ Username check failed', { error: error.message })
        reply.status(400)
        return { available: false, message: 'Username check failed' }
      }
    }
  })
  
  checkUsernameLogger.info('✅ Check username route registered successfully')
}

export default checkUsernameRoute