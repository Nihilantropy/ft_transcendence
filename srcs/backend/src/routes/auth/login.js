/**
 * @brief User login route for ft_transcendence backend
 * 
 * @description Handles user authentication with centralized schema management
 */

import { logger } from '../../logger.js'
import { verifyPassword } from '../../utils/auth_utils.js'
import { generateTokenPair } from '../../utils/jwt.js'
import { userService } from '../../services/user.service.js'

const loginLogger = logger.child({ module: 'routes/auth/login' })

/**
 * @brief Register login route
 * @param {FastifyInstance} fastify - The Fastify instance
 */
async function loginRoute(fastify, options) {
  
  fastify.post('/login', {
    schema: loginRouteSchema
  }, async (request, reply) => {
    try {
      const { username, password, rememberMe = false, twoFactorToken } = request.body
      
      loginLogger.info('🔐 Login attempt', { username, has2FA: !!twoFactorToken })
      
      // 1. Find user by username or email
      const user = userService.getUserByUsername(username) || userService.getUserByEmail(username)
      
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
      
      // 3. Handle 2FA
      if (user.two_factor_enabled && !twoFactorToken) {
        return {
          success: false,
          requiresTwoFactor: true,
          message: 'Two-factor authentication required',
          tempToken: 'temp-2fa-token'
        }
      }
      
      // 4. Generate tokens and update status
      const tokens = generateTokenPair(user, {
        access: { expiresIn: '15m' },
        refresh: rememberMe ? { expiresIn: '7d' } : null
      })
      
      userService.updateUserOnlineStatus(user.id, true)
      
      loginLogger.info('✅ Login successful', { userId: user.id, username: user.username })
      
      return {
        success: true,
        message: 'Login successful',
        user: { ...sanitizeUser(user), is_online: true },
        tokens: rememberMe ? tokens : {
          accessToken: tokens.accessToken,
          tokenType: tokens.tokenType,
          expiresIn: tokens.expiresIn
        },
        expiresAt: Date.now() + (15 * 60 * 1000)
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
  
  loginLogger.info('✅ Login route registered successfully')
}

export default loginRoute