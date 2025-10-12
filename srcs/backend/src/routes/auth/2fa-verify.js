/**
 * @brief 2FA verification route for login process
 * 
 * @description Completes login after 2FA verification
 * - Verifies temporary 2FA token from login
 * - Validates TOTP code or backup code
 * - Generates access/refresh tokens on success
 */

import { logger } from '../../logger.js'
import { routeAuthSchemas } from '../../schemas/routes/auth.schema.js'
import { generateTokenPair, verifyTemp2FAToken } from '../../utils/jwt.js'
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
      
      verify2FALogger.info('🔐 2FA verification attempt')

      // =========================================================================
      // STEP 1: VERIFY TEMPORARY TOKEN
      // =========================================================================
      
      let tempPayload
      try {
        tempPayload = verifyTemp2FAToken(tempToken)
        
        verify2FALogger.debug('✅ Temp token verified', { 
          userId: tempPayload.userId,
          rememberMe: tempPayload.rememberMe 
        })
        
      } catch (error) {
        verify2FALogger.warn('⚠️ Invalid temp token', { error: error.message })
        reply.status(401)
        return {
          success: false,
          message: 'Invalid or expired temporary token. Please log in again.'
        }
      }

      // =========================================================================
      // STEP 2: GET USER AND VALIDATE 2FA STATUS
      // =========================================================================
      
      const userId = tempPayload.userId
      const user = userService.getUserById(userId)
      
      if (!user || !user.is_active) {
        verify2FALogger.warn('⚠️ User not found or inactive', { userId })
        reply.status(401)
        return {
          success: false,
          message: 'Invalid user'
        }
      }

      if (!user.two_factor_enabled) {
        verify2FALogger.warn('⚠️ 2FA not enabled for user', { userId })
        reply.status(400)
        return {
          success: false,
          message: '2FA is not enabled for this account'
        }
      }

      if (!user.two_factor_secret) {
        verify2FALogger.error('❌ 2FA secret missing', { userId })
        reply.status(500)
        return {
          success: false,
          message: 'Invalid 2FA configuration'
        }
      }

      // =========================================================================
      // STEP 3: VERIFY TOTP TOKEN OR BACKUP CODE
      // =========================================================================
      
      let verified = false
      let usedBackupCode = false
      
      if (token) {
        // Verify TOTP token from authenticator app
        verify2FALogger.debug('Verifying TOTP token', { userId })
        
        verified = speakeasy.totp.verify({
          secret: user.two_factor_secret,
          encoding: 'base32',
          token: token,
          window: 2 // Allow ±2 time steps (±60 seconds) for clock drift
        })
        
        if (verified) {
          verify2FALogger.debug('✅ TOTP token verified', { userId })
        }
        
      } else if (backupCode) {
        // Verify backup code
        verify2FALogger.debug('Verifying backup code', { userId })
        
        const backupCodes = user.backup_codes ? JSON.parse(user.backup_codes) : []
        const normalizedBackupCode = backupCode.trim().toUpperCase()
        
        verified = backupCodes.includes(normalizedBackupCode)
        
        if (verified) {
          verify2FALogger.debug('✅ Backup code verified', { userId })
          usedBackupCode = true
          
          // Remove used backup code from database
          try {
            userService.useBackupCode(userId, normalizedBackupCode)
            verify2FALogger.info('Backup code removed', { userId })
          } catch (error) {
            verify2FALogger.error('Failed to remove backup code', { 
              userId, 
              error: error.message 
            })
          }
        }
      }

      if (!verified) {
        verify2FALogger.warn('⚠️ 2FA verification failed - invalid token/code', { userId })
        reply.status(400)
        return {
          success: false,
          message: 'Invalid 2FA token or backup code'
        }
      }

      // =========================================================================
      // STEP 4: GENERATE TOKENS AND COMPLETE LOGIN
      // =========================================================================
      
      const rememberMe = tempPayload.rememberMe || false
      
      verify2FALogger.debug('Generating tokens', { userId, rememberMe })

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

      verify2FALogger.info('✅ 2FA verification successful - login complete', { 
        userId,
        username: user.username,
        rememberMe,
        usedBackupCode
      })

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