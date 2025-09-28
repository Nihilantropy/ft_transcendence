/**
 * @brief Forgot password route for ft_transcendence backend
 * 
 * @description Handles password reset requests with:
 * - Email validation
 * - Reset token generation
 * - Password reset email sending
 */

import { logger } from '../../logger.js'
import { routeSchemas } from '../../schemas/index.js'

// Create route-specific logger
const forgotPasswordLogger = logger.child({ module: 'routes/auth/forgot-password' })

/**
 * @brief Register forgot password route
 * @param {FastifyInstance} fastify - The Fastify instance
 */
async function forgotPasswordRoute(fastify, options) {
  
  /**
   * @route POST /forgot-password
   * @description Send password reset email
   */
  fastify.post('/forgot-password', {
    schema: routeSchemas.forgotPassword,
    handler: async (request, reply) => {
      try {
        const { email } = request.body
        
        forgotPasswordLogger.info('🔑 Password reset requested', { email })
        
        // TODO: Implement forgot password logic
        // 1. Validate email format
        // 2. Find user by email
        // 3. Generate secure reset token (crypto.randomBytes)
        // 4. Set token expiration (1 hour)
        // 5. Save token to database
        // 6. Send password reset email
        // 7. Return success (don't reveal if email exists)
        
        return {
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.'
        }
      } catch (error) {
        forgotPasswordLogger.error('❌ Forgot password failed', { error: error.message })
        reply.status(400)
        return { success: false, message: 'Password reset request failed' }
      }
    }
  })
  
}

export default forgotPasswordRoute