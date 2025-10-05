/**
 * @brief Resend verification email route for ft_transcendence backend
 * 
 * @description Handles resending verification emails with rate limiting
 */

import { logger } from '../../logger.js'
import { userService, emailService } from '../../services/index.js'
import { routeSchemas } from '../../schemas/routes/auth.schema.js'

const resendVerificationLogger = logger.child({ module: 'routes/auth/resend-verification' })

/**
 * @brief Register resend verification email route
 * @param {FastifyInstance} fastify - The Fastify instance
 */
async function resendVerificationRoute(fastify, options) {
  fastify.post('/resend-verification', {
    schema: routeSchemas.resendVerification
  }, async (request, reply) => {
    try {
      const { email } = request.body
      
      resendVerificationLogger.info('📤 Resend verification requested', { email })
      
      // 1. Find user and validate (includes rate limiting check)
      const result = userService.regenerateVerificationToken(email)
      
      if (!result) {
        resendVerificationLogger.warn('❌ User not found', { email })
        reply.status(400)
        return {
          success: false,
          message: 'If this email is registered, a verification link will be sent.',
          error: {
            code: 'USER_NOT_FOUND',
            details: 'No user found with this email address'
          }
        }
      }
      
      // 2. Check if already verified
      if (result.alreadyVerified) {
        resendVerificationLogger.info('✅ Email already verified', { 
          userId: result.user.id, 
          email: result.user.email 
        })
        reply.status(400)
        return {
          success: false,
          message: 'Email is already verified. Please log in.',
          error: {
            code: 'ALREADY_VERIFIED',
            details: 'This email address has already been verified'
          }
        }
      }
      
      // 3. Check rate limiting
      if (result.rateLimited) {
        resendVerificationLogger.warn('⏱️ Rate limit exceeded', { 
          email,
          waitMinutes: result.waitMinutes 
        })
        reply.status(429)
        return {
          success: false,
          message: result.message,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            details: `Please wait ${result.waitMinutes} minute(s) before requesting another email`
          }
        }
      }
      
      // 4. Send new verification email
      const emailSent = await emailService.sendVerificationEmail({
        email: result.user.email,
        username: result.user.username,
        verificationToken: result.verificationToken
      })
      
      if (!emailSent) {
        resendVerificationLogger.error('❌ Failed to send verification email', { 
          userId: result.user.id,
          email: result.user.email 
        })
        reply.status(500)
        return {
          success: false,
          message: 'Failed to send verification email. Please try again later.',
          error: {
            code: 'EMAIL_SEND_FAILED',
            details: 'Unable to send verification email at this time'
          }
        }
      }
      
      resendVerificationLogger.info('✅ Verification email resent successfully', {
        userId: result.user.id,
        email: result.user.email
      })
      
      // Return success response
      return {
        success: true,
        message: 'Verification email sent. Please check your inbox.'
      }
      
    } catch (error) {
      resendVerificationLogger.error('❌ Resend verification failed', { 
        error: error.message,
        stack: error.stack 
      })
      reply.status(500)
      return {
        success: false,
        message: 'Failed to resend verification email',
        error: {
          code: 'INTERNAL_ERROR',
          details: 'An unexpected error occurred'
        }
      }
    }
  })
  
}

export default resendVerificationRoute