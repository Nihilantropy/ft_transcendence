/**
 * @brief Email verification route for ft_transcendence backend
 * 
 * @description Clean email verification using schema-driven validation
 */

import { logger } from '../../logger.js'
import { routeSchemas } from '../../schemas/routes/auth.js'
import { userService } from '../../services/index.js'
import { generateAccessToken, generateRefreshToken } from '../../utils/jwt.js'

const verifyEmailLogger = logger.child({ module: 'routes/auth/verify-email' })

/**
 * @brief Register email verification route
 * @param {FastifyInstance} fastify - The Fastify instance
 */
async function verifyEmailRoute(fastify) {
  
  fastify.post('/verify-email', {
    schema: routeSchemas.verifyEmail
  }, async (request, reply) => {
    try {
      const { token } = request.body
      
      verifyEmailLogger.info('📧 Email verification attempt', { 
        token: token.substring(0, 8) + '...'
      })
      
      // 1. Verify email using user service
      const verifiedUser = userService.verifyUserEmail(token)
      
      if (!verifiedUser) {
        verifyEmailLogger.warn('❌ Email verification failed - invalid token')
        reply.status(400)
        return {
          success: false,
          message: 'Invalid or expired verification token',
          error: {
            code: 'INVALID_TOKEN',
            details: 'Verification token is invalid or has already been used'
          }
        }
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
      
    } catch (error) {
      verifyEmailLogger.error('❌ Email verification failed', { error: error.message })
      reply.status(400)
      return {
        success: false,
        message: 'Email verification failed',
        error: {
          code: 'VERIFICATION_ERROR',
          details: error.message
        }
      }
    }
  })
  
  verifyEmailLogger.info('✅ Email verification route registered successfully')
}

export default verifyEmailRoute