/**
 * @brief 2FA disable route for ft_transcendence backend
 */

import { logger } from '../../logger.js'
import { routeSchemas } from '../../schemas/routes/auth.schema.js'
import { requireAuth } from '../../middleware/authentication.js'
import { userService } from '../../services/user.service.js'
import { verifyPassword } from '../../utils/auth_utils.js'
import databaseConnection from '../../database.js'
import speakeasy from 'speakeasy'

const disable2FALogger = logger.child({ module: 'routes/auth/2fa-disable' })

async function disable2FAroute(fastify, options) {
  fastify.post('/2fa/disable', {
    schema: routeSchemas.disable2FA,
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
      const user = databaseConnection.get(`
        SELECT id, username, email, password_hash, email_verified,
               two_factor_enabled, two_factor_secret, backup_codes,
               is_active, is_online
        FROM users 
        WHERE id = ? AND is_active = 1
        LIMIT 1
      `, [userId])
      
      if (!user) {
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
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            email_verified: !!user.email_verified,
            twoFactorEnabled: false,
            avatar: null,
            is_online: !!user.is_online
          }
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
      const result = databaseConnection.transaction(() => {
        const updateResult = databaseConnection.run(`
          UPDATE users 
          SET two_factor_enabled = 0,
              two_factor_secret = NULL,
              two_factor_secret_tmp = NULL,
              backup_codes = NULL,
              backup_codes_tmp = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [userId])
        
        if (updateResult.changes === 0) {
          throw new Error('Failed to update user 2FA settings')
        }
        
        // Get updated user data
        const updatedUser = databaseConnection.get(`
          SELECT id, username, email, email_verified, 
                 two_factor_enabled, avatar_url, is_online
          FROM users 
          WHERE id = ?
          LIMIT 1
        `, [userId])
        
        return updatedUser
      })
      
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
        user: {
          id: result.id,
          username: result.username,
          email: result.email,
          email_verified: !!result.email_verified,
          twoFactorEnabled: false, // Now disabled
          avatar: result.avatar_url,
          is_online: !!result.is_online
        }
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