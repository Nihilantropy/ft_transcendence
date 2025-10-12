/**
 * @brief Reset password route for ft_transcendence backend
 * 
 * @description Handles password reset with token:
 * - Reset token validation
 * - New password validation
 * - Password update and token cleanup
 */

import { logger } from '../../logger.js'
import { routeAuthSchemas } from '../../schemas/index.js'
import userService from '../../services/user.service.js'

// Create route-specific logger
const resetPasswordLogger = logger.child({ module: 'routes/auth/reset-password' })

/**
 * @brief Register reset password route
 * @param {FastifyInstance} fastify - The Fastify instance
 */
async function resetPasswordRoute(fastify, options) {
  
  /**
   * @route POST /reset-password
   * @description Reset user password with token
   */
  fastify.post('/reset-password', {
    schema: routeAuthSchemas.resetPassword,
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '15 minutes'
      }
    },
    handler: async (request, reply) => {
      try {
        const { token, newPassword, confirmPassword } = request.body
        
        resetPasswordLogger.info('🔄 Password reset attempt')
        
        // Validate passwords match
        if (newPassword !== confirmPassword) {
          resetPasswordLogger.debug('Password mismatch')
          reply.status(400)
          return { 
            success: false, 
            message: 'Passwords do not match' 
          }
        }
        
        // Reset password using token
        const user = userService.resetPasswordWithToken(token, newPassword)
        
        if (!user) {
          resetPasswordLogger.debug('Invalid or expired reset token')
          reply.status(401)
          return { 
            success: false, 
            message: 'Invalid or expired reset token' 
          }
        }
        
        resetPasswordLogger.info('✅ Password reset successful', { userId: user.id })
        
        return {
          success: true,
          message: 'Password reset successful. You can now login with your new password.'
        }
        
      } catch (error) {
        resetPasswordLogger.error('❌ Password reset failed', { error: error.message })
        reply.status(500)
        return { 
          success: false, 
          message: 'An error occurred while resetting your password. Please try again.' 
        }
      }
    }
  })
  
}

export default resetPasswordRoute