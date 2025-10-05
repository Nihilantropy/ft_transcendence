/**
 * @brief Email verification route for ft_transcendence backend
 * 
 * @description Clean email verification using schema-driven validation
 */

import { logger } from '../../logger.js'
import { routeSchemas } from '../../schemas/routes/auth.schema.js'
import { userService } from '../../services/index.js'
import { generateTokenPair } from '../../utils/jwt.js'
import { ACCESS_TOKEN_CONFIG, REFRESH_TOKEN_ROTATION_CONFIG } from '../../utils/coockie.js'

const verifyEmailLogger = logger.child({ module: 'routes/auth/verify-email' })

/**
 * @brief Register email verification route
 * @param {FastifyInstance} fastify - The Fastify instance
 */
async function verifyEmailRoute(fastify) {
  
  fastify.get('/verify-email', {
    schema: routeSchemas.verifyEmail
  }, async (request, reply) => {
    try {
      const { token } = request.query
      
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
      }      // 2. Generate authentication tokens for auto-login
      const { accessToken, refreshToken } = generateTokenPair(verifiedUser, {
        access: { expiresIn: '15m' },
        refresh: { expiresIn: '1d' }
      })

      // ✅ SET ACCESS TOKEN AS HTTP-ONLY COOKIE
      reply.setCookie('accessToken', accessToken, ACCESS_TOKEN_CONFIG)

      reply.setCookie('refreshToken', refreshToken, REFRESH_TOKEN_ROTATION_CONFIG)

      verifyEmailLogger.info('✅ Email verified successfully', {
        userId: verifiedUser.id,
        username: verifiedUser.username,
        email: verifiedUser.email
      })
      
      // 3. Return success response
      return {
        success: true,
        message: 'Email verified successfully. You are now logged in.',
        user: {
          id: parseInt(verifiedUser.id), // Ensure integer type
          username: verifiedUser.username,
          email: verifiedUser.email,
          email_verified: true
        },
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
  
}

export default verifyEmailRoute