/**
 * @brief 2FA disable route for ft_transcendence backend
 */

import { logger } from '../../logger.js'
import { routeAuthSchemas } from '../../schemas/routes/auth.schema.js'
import { requireAuth } from '../../middleware/authentication.js'
import { userService } from '../../services/user.service.js'
import { verifyPassword } from '../../utils/auth_utils.js'
import { formatAuthUser } from '../../utils/user-formatters.js'
import speakeasy from 'speakeasy'

const disable2FALogger = logger.child({ module: 'routes/auth/2fa-disable' })

async function disable2FAroute(fastify, options) {
  fastify.post('/2fa/disable', {
    schema: routeAuthSchemas.disable2FA,
    preHandler: requireAuth
  }, async (request, reply) => {
    try {
      const { password, token } = request.body
      const userId = request.user.id
      
      disable2FALogger.info('🔐 2FA disable request received', { 
        userId,
        hasPassword: !!password,
        hasToken: !!token 
      })
      
      // 1. Get current user with full authentication details
      const user = userService.getUserWith2FAData(userId)
      
      if (!user || !user.is_active) {
        disable2FALogger.warn('User not found for 2FA disable', { userId })
        reply.status(404)
        return {
          success: false,
          message: 'User not found'
        }
      }
      
      // 2. Verify user's password for security confirmation
      if (!user.password_hash) {
        disable2FALogger.warn('Cannot disable 2FA for OAuth-only user', { userId })
        reply.status(400)
        return {
          success: false,
          message: 'Cannot disable 2FA for OAuth-only accounts'
        }
      }
      
      const passwordValid = await verifyPassword(password, user.password_hash)
      if (!passwordValid) {
        disable2FALogger.warn('Invalid password for 2FA disable', { userId })
        reply.status(400)
        return {
          success: false,
          message: 'Invalid password'
        }
      }
      
      // 3. Check if 2FA is actually enabled
      if (!user.two_factor_enabled) {
        disable2FALogger.info('2FA already disabled for user', { userId })
        return {
          success: true,
          message: '2FA is already disabled',
          user: formatAuthUser(user)
        }
      }
      
      // 4. If token provided, verify current 2FA token to confirm user has access
      if (token && user.two_factor_secret) {
        const tokenValid = speakeasy.totp.verify({
          secret: user.two_factor_secret,
          encoding: 'base32',
          token: token,
          window: 1 // Allow 30 seconds before/after
        })
        
        if (!tokenValid) {
          // Check if it's a backup code
          let backupCodes = []
          try {
            backupCodes = user.backup_codes ? JSON.parse(user.backup_codes) : []
          } catch (error) {
            disable2FALogger.warn('Failed to parse backup codes', { userId })
          }
          
          const backupCodeValid = backupCodes.includes(token)
          if (!backupCodeValid) {
            disable2FALogger.warn('Invalid 2FA token for disable', { userId })
            reply.status(400)
            return {
              success: false,
              message: 'Invalid 2FA token'
            }
          }
        }
      }
      
      // 5. Disable 2FA for the user in database and clear secrets
      const result = userService.disable2FA(userId)
      
      // 6. Log security event
      disable2FALogger.info('✅ 2FA successfully disabled', { 
        userId,
        username: result.username,
        timestamp: new Date().toISOString()
      })
      
      // 7. Return updated user object
      return {
        success: true,
        message: '2FA successfully disabled',
        user: formatAuthUser(result)
      }
      
    } catch (error) {
      disable2FALogger.error('❌ 2FA disable failed', { 
        userId: request.user?.id,
        error: error.message,
        stack: error.stack
      })
      
      reply.status(500)
      return { 
        success: false, 
        message: 'Internal server error during 2FA disable'
      }
    }
  })
}

export default disable2FAroute