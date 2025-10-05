/**
 * @brief User login route for ft_transcendence backend
 * 
 * @description Handles user authentication with centralized schema management
 */

import { logger } from '../../logger.js'
import { verifyPassword } from '../../utils/auth_utils.js'
import { generateTokenPair } from '../../utils/jwt.js'
import { userService } from '../../services/user.service.js'
import { routeSchemas } from '../../schemas/index.js'
import { ACCESS_TOKEN_CONFIG, REFRESH_TOKEN_CONFIG, REFRESH_TOKEN_ROTATION_CONFIG } from '../../utils/coockie.js'

const loginLogger = logger.child({ module: 'routes/auth/login' })

/**
 * @brief Register login route
 * @param {FastifyInstance} fastify - The Fastify instance
 */
async function loginRoute(fastify, options) {
  
  fastify.post('/login', {
    schema: routeSchemas.login
  }, async (request, reply) => {
    try {
      const { identifier, password, rememberMe = false, twoFactorToken } = request.body
      
      loginLogger.info('🔐 Login attempt', { identifier, has2FA: !!twoFactorToken })
      
      // 1. Find user by username or email
      const user = userService.getUserByUsername(identifier) || userService.getUserByEmail(identifier)
      
      if (!user || !user.is_active) {
        reply.status(401)
        return {
          success: false,
          message: 'Invalid credentials',
          error: { code: 'INVALID_CREDENTIALS', details: 'Username/email or password is incorrect' }
        }
      }
      
      // 2. Verify password
      const isPasswordValid = await verifyPassword(password, user.password_hash)
      
      if (!isPasswordValid) {
        reply.status(401)
        return {
          success: false,
          message: 'Invalid credentials',
          error: { code: 'INVALID_CREDENTIALS', details: 'Username/email or password is incorrect' }
        }
      }
      
      // 3. Handle 2FA - if enabled, require 2FA verification
      if (user.two_factor_enabled && !twoFactorToken) {
        // Generate temporary token for 2FA verification
        const tempTokenPayload = {
          userId: user.id,
          rememberMe: rememberMe, // Store rememberMe preference for 2FA completion
          type: 'temp_2fa',
          exp: Math.floor(Date.now() / 1000) + (5 * 60) // 5 minutes expiry
        }
        const tempToken = fastify.jwt.sign(tempTokenPayload)
        
        loginLogger.info('🔐 2FA required', { userId: user.id })
        
        return {
          success: true,
          message: 'Two-factor authentication required',
          requiresTwoFactor: true,
          tempToken: tempToken
        }
      }
      
      // TODO: If twoFactorToken is provided, verify it here
      if (user.two_factor_enabled && twoFactorToken) {
        // This should be handled by a separate 2FA verification route
        // For now, we'll reject it
        reply.status(400)
        return {
          success: false,
          message: 'Please use the 2FA verification endpoint',
          error: { code: 'USE_2FA_ENDPOINT', details: 'Use /auth/2fa/verify for 2FA verification' }
        }
      }
      
      // 4. Generate tokens and update status
      const { accessToken, refreshToken } = generateTokenPair(user, {
        access: { expiresIn: '15m' },
        refresh: { expiresIn: rememberMe ? '7d' : '1d' }
      })

      // ✅ SET ACCESS TOKEN AS HTTP-ONLY COOKIE (always)
      reply.setCookie('accessToken', accessToken, ACCESS_TOKEN_CONFIG)

      // ✅ SET REFRESH TOKEN AS HTTP-ONLY COOKIE (always, but different maxAge)
      if (rememberMe) {
        reply.setCookie('refreshToken', refreshToken, REFRESH_TOKEN_CONFIG)
      } else {
        reply.setCookie('refreshToken', refreshToken, REFRESH_TOKEN_ROTATION_CONFIG)
      }

      userService.updateUserOnlineStatus(user.id, true)
      
      loginLogger.info('✅ Login successful', { userId: user.id, username: user.username })
      
      return {
        success: true,
        message: 'Login successful',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          email_verified: user.email_verified || false,
          avatar: user.avatar_url || undefined,
          is_online: true,
          twoFactorEnabled: user.two_factor_enabled || false
        }
      }
      
    } catch (error) {
      loginLogger.error('❌ Login failed', { error: error.message })
      reply.status(500)
      return {
        success: false,
        message: 'Authentication failed',
        error: { code: 'AUTHENTICATION_ERROR', details: error.message }
      }
    }
  })
  
}

export default loginRoute