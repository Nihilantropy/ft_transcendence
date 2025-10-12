/**
 * @brief User login route for ft_transcendence backend
 * 
 * @description Handles user authentication with centralized schema management
 * - Step 1: Validates credentials (username/email + password)
 * - Step 2: If 2FA enabled, returns temp token for 2FA verification
 * - Step 3: If 2FA disabled, completes login with access/refresh tokens
 */

import { logger } from '../../logger.js'
import { verifyPassword } from '../../utils/auth_utils.js'
import { generateTokenPair, generateTemp2FAToken } from '../../utils/jwt.js'
import { userService } from '../../services/user.service.js'
import { routeAuthSchemas } from '../../schemas/index.js'
import { ACCESS_TOKEN_CONFIG, REFRESH_TOKEN_CONFIG, REFRESH_TOKEN_ROTATION_CONFIG } from '../../utils/coockie.js'
import { formatAuthUser } from '../../utils/user-formatters.js'

const loginLogger = logger.child({ module: 'routes/auth/login' })

/**
 * @brief Register login route
 * @param {FastifyInstance} fastify - The Fastify instance
 */
async function loginRoute(fastify, options) {
  
  fastify.post('/login', {
    schema: routeAuthSchemas.login
  }, async (request, reply) => {
    try {
      const { identifier, password, rememberMe = false } = request.body
      
      loginLogger.info('🔐 Login attempt', { identifier })
      
      // =========================================================================
      // STEP 1: FIND USER BY USERNAME OR EMAIL
      // =========================================================================
      
      const user = userService.getUserByUsername(identifier) || userService.getUserByEmail(identifier)
      
      if (!user || !user.is_active) {
        loginLogger.warn('⚠️ Login failed - user not found or inactive', { identifier })
        reply.status(401)
        return {
          success: false,
          message: 'Invalid credentials',
          error: { code: 'INVALID_CREDENTIALS', details: 'Username/email or password is incorrect' }
        }
      }
      
      // =========================================================================
      // STEP 2: VERIFY PASSWORD
      // =========================================================================
      
      const isPasswordValid = await verifyPassword(password, user.password_hash)
      
      if (!isPasswordValid) {
        loginLogger.warn('⚠️ Login failed - invalid password', { userId: user.id, username: user.username })
        reply.status(401)
        return {
          success: false,
          message: 'Invalid credentials',
          error: { code: 'INVALID_CREDENTIALS', details: 'Username/email or password is incorrect' }
        }
      }
      
      loginLogger.debug('✅ Password verified', { userId: user.id })
      
      // =========================================================================
      // STEP 3: CHECK IF 2FA IS ENABLED
      // =========================================================================
      
      if (user.two_factor_enabled) {
        // User has 2FA enabled - generate temporary token and require 2FA verification
        const tempToken = generateTemp2FAToken(user.id, rememberMe)
        
        loginLogger.info('🔐 2FA required - temp token generated', { 
          userId: user.id, 
          username: user.username 
        })
        
        return {
          success: true,
          message: 'Two-factor authentication required',
          requiresTwoFactor: true,
          tempToken: tempToken
        }
      }
      
      // =========================================================================
      // STEP 4: NO 2FA - COMPLETE LOGIN
      // =========================================================================
      
      loginLogger.debug('✅ No 2FA required - generating tokens', { userId: user.id })
      
      // Generate access and refresh tokens
      const { accessToken, refreshToken } = generateTokenPair(user, {
        access: { expiresIn: '15m' },
        refresh: { expiresIn: rememberMe ? '7d' : '1d' }
      })

      // Set access token as HTTP-only cookie
      reply.setCookie('accessToken', accessToken, ACCESS_TOKEN_CONFIG)

      // Set refresh token as HTTP-only cookie (different expiry based on rememberMe)
      if (rememberMe) {
        reply.setCookie('refreshToken', refreshToken, REFRESH_TOKEN_CONFIG)
      } else {
        reply.setCookie('refreshToken', refreshToken, REFRESH_TOKEN_ROTATION_CONFIG)
      }

      // Update user online status
      userService.updateUserOnlineStatus(user.id, true)
      
      loginLogger.info('✅ Login successful (no 2FA)', { 
        userId: user.id, 
        username: user.username,
        rememberMe 
      })
      
      return {
        success: true,
        message: 'Login successful',
        user: formatAuthUser({ ...user, is_online: true })
      }
      
    } catch (error) {
      loginLogger.error('❌ Login failed', { 
        error: error.message,
        stack: error.stack 
      })
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