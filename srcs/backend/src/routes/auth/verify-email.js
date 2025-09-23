/**
 * @brief Email verification route for ft_transcendence backend
 * 
 * @description Handles email verification with:
 * - Verification token validation
 * - Email activation
 * - Automatic authentication after verification
 */

import { logger } from '../../logger.js'
import { verifyEmailSchema } from '../../middleware/validation.js'
import { userService } from '../../services/index.js'
import { generateAccessToken, generateRefreshToken } from '../../middleware/authentication.js'

// Create route-specific logger
const verifyEmailLogger = logger.child({ module: 'routes/auth/verify-email' })

/**
 * @brief Register email verification route
 * @param {FastifyInstance} fastify - The Fastify instance
 */
async function verifyEmailRoute(fastify, options) {
  
  /**
   * @route POST /verify-email
   * @description Verify user email and activate account
   */
  fastify.post('/verify-email', {
    schema: verifyEmailSchema,
    handler: fastify.errors.asyncHandler(async (request, reply) => {
      const { token } = request.body
      
      verifyEmailLogger.info('📧 Email verification attempt', { token: token.substring(0, 8) + '...' })
      
      // 1. Verify email using user service
      const verifiedUser = await userService.verifyUserEmail(token)
      
      if (!verifiedUser) {
        throw fastify.errors.badRequest('Invalid or expired verification token')
      }
      
      // 2. Generate authentication tokens for auto-login
      const accessToken = generateAccessToken(verifiedUser)
      const refreshToken = generateRefreshToken(verifiedUser)
      
      verifyEmailLogger.info('✅ Email verified successfully', {
        userId: verifiedUser.id,
        username: verifiedUser.username,
        email: verifiedUser.email
      })
      
      // 3. Return success response with tokens
      reply.status(200)
      return {
        success: true,
        message: 'Email verified successfully. You are now logged in.',
        user: {
          id: verifiedUser.id,
          username: verifiedUser.username,
          email: verifiedUser.email,
          email_verified: true
        },
        tokens: {
          accessToken,
          refreshToken
        }
      }
    })
  })
  
  verifyEmailLogger.info('✅ Email verification route registered successfully')
}

export default verifyEmailRoute