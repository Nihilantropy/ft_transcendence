/**
 * @brief Forgot password route for ft_transcendence backend
 * 
 * @description Handles password reset requests with:
 * - Email validation
 * - Reset token generation
 * - Password reset email sending
 */

import { logger } from '../../logger.js'
import { routeAuthSchemas } from '../../schemas/index.js'
import { emailService } from '../../services/email.service.js'
import userService from '../../services/user.service.js'
import crypto from 'crypto'

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
    schema: routeAuthSchemas.forgotPassword,
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '15 minutes'
      }
    },
    handler: async (request, reply) => {
      try {
        const { email } = request.body
        
        forgotPasswordLogger.info('🔑 Password reset requested', { email })
        
        // Generate secure reset token (32 bytes = 64 hex chars)
        const resetToken = crypto.randomBytes(32).toString('hex')
        
        // Set reset token in database (returns user if exists)
        const user = userService.setPasswordResetToken(email, resetToken)
        
        // If user exists, send email
        if (user) {
          await emailService.sendPasswordResetEmail({
            email: user.email,
            username: user.username,
            resetToken
          })
          forgotPasswordLogger.info('✅ Password reset email sent', { email })
        } else {
          // Don't reveal if user exists (security best practice)
          forgotPasswordLogger.debug('No user found for email, but returning success anyway', { email })
        }
        
        // Always return success to prevent email enumeration
        return {
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.'
        }
        
      } catch (error) {
        forgotPasswordLogger.error('❌ Forgot password failed', { error: error.message })
        reply.status(500)
        return { 
          success: false, 
          message: 'An error occurred while processing your request. Please try again later.' 
        }
      }
    }
  })
  
}

export default forgotPasswordRoute