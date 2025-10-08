/**
 * @brief 2FA verification route for login process
 */

import { logger } from '../../logger.js'
import { routeAuthSchemas } from '../../schemas/routes/auth.schema.js'
import { generateTokenPair } from '../../utils/jwt.js'
import { userService } from '../../services/user.service.js'
import { ACCESS_TOKEN_CONFIG, REFRESH_TOKEN_CONFIG, REFRESH_TOKEN_ROTATION_CONFIG } from '../../utils/coockie.js'
import { formatAuthUser } from '../../utils/user-formatters.js'
import speakeasy from 'speakeasy'

const verify2FALogger = logger.child({ module: 'routes/auth/2fa-verify' })

async function verify2FARoute(fastify, options) {
  // Register the route with schema validation
  fastify.post('/2fa/verify', {
    schema: routeAuthSchemas.verify2FA
  }, async (request, reply) => {
    try {
      const { tempToken, token, backupCode } = request.body
      
      verify2FALogger.info('🔐 Verifying 2FA for login')

      // Verify and decode temp token
      let tempPayload
      try {
        tempPayload = fastify.jwt.verify(tempToken)
        
        if (tempPayload.type !== 'temp_2fa') {
          throw new Error('Invalid token type')
        }
      } catch (error) {
        verify2FALogger.warn('⚠️ Invalid temp token', { error: error.message })
        reply.status(401)
        return {
          success: false,
          message: 'Invalid or expired temporary token'
        }
      }

      const userId = tempPayload.userId
      const user = userService.getUserById(userId)
      
      if (!user || !user.is_active || !user.two_factor_enabled) {
        verify2FALogger.warn('⚠️ Invalid user for 2FA', { userId })
        reply.status(401)
        return {
          success: false,
          message: 'Invalid user or 2FA not enabled'
        }
      }

      // Verify TOTP token or backup code
      let verified = false
      
      if (token) {
        // Verify TOTP token
        verified = speakeasy.totp.verify({
          secret: user.two_factor_secret,
          encoding: 'base32',
          token: token,
          window: 2 // Allow some time drift
        })
      } else if (backupCode) {
        // Verify backup code
        const backupCodes = JSON.parse(user.backup_codes || '[]')
        verified = backupCodes.includes(backupCode.toUpperCase())
        
        if (verified) {
          // Remove used backup code
          userService.useBackupCode(userId, backupCode)
        }
      }

      if (!verified) {
        verify2FALogger.warn('⚠️ Invalid 2FA token/code', { userId })
        reply.status(400)
        return {
          success: false,
          message: 'Invalid 2FA token or backup code'
        }
      }

      // Get rememberMe from temp token payload
      const rememberMe = tempPayload.rememberMe || false

      // Generate tokens and complete login
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

      // Update user online status
      userService.updateUserOnlineStatus(user.id, true)

      verify2FALogger.info('✅ 2FA verification successful', { userId, rememberMe })

      return {
        success: true,
        message: 'Login successful',
        user: formatAuthUser({ ...user, is_online: true })
      }

    } catch (error) {
      verify2FALogger.error('❌ 2FA verification failed', { 
        error: error.message,
        stack: error.stack 
      })
      reply.status(500)
      return { 
        success: false, 
        message: 'Internal server error during 2FA verification' 
      }
    }
  })
}

export default verify2FARoute