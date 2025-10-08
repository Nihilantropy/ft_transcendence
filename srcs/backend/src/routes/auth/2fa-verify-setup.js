/**
 * @brief 2FA verify setup route for ft_transcendence backend
 */

import { logger } from '../../logger.js'
import { routeSchemas } from '../../schemas/routes/auth.schema.js'
import { requireAuth } from '../../middleware/authentication.js'
import speakeasy from 'speakeasy'
import databaseConnection from '../../database.js'

const verify2FASetupLogger = logger.child({ module: 'routes/auth/2fa-verify-setup' })

async function verify2FASetupRoute(fastify, options) {
  // Register the route with schema validation
  fastify.post('/2fa/verify-setup', {
    schema: routeSchemas.verify2FASetup,
    preHandler: requireAuth // Ensure user is authenticated
  }, async (request, reply) => {
    try {
      const { token, secret } = request.body
      const userId = request.user.id
      
      verify2FASetupLogger.info('🔐 Verifying 2FA setup', { userId })

      // Get temporary secret from database (more secure than trusting frontend)
      const user = databaseConnection.get(
        'SELECT two_factor_secret_tmp, backup_codes_tmp, two_factor_enabled FROM users WHERE id = ?',
        [userId]
      )

      if (!user) {
        verify2FASetupLogger.error('❌ User not found', { userId })
        reply.status(404)
        return {
          success: false,
          message: 'User not found'
        }
      }

      if (user.two_factor_enabled) {
        verify2FASetupLogger.warn('⚠️ 2FA already enabled', { userId })
        reply.status(400)
        return {
          success: false,
          message: '2FA is already enabled for this account'
        }
      }

      if (!user.two_factor_secret_tmp) {
        verify2FASetupLogger.warn('⚠️ No 2FA setup in progress', { userId })
        reply.status(400)
        return {
          success: false,
          message: 'No 2FA setup in progress. Please start setup first.'
        }
      }

      // Verify that frontend secret matches database secret (integrity check)
      if (user.two_factor_secret_tmp !== secret) {
        verify2FASetupLogger.warn('⚠️ Secret mismatch', { userId })
        reply.status(400)
        return {
          success: false,
          message: 'Invalid setup data. Please restart 2FA setup.'
        }
      }

      // Verify TOTP token against secret from database
      const verified = speakeasy.totp.verify({
        secret: user.two_factor_secret_tmp,
        encoding: 'base32',
        token: token,
        window: 2 // Allow some time drift
      })

      if (!verified) {
        verify2FASetupLogger.warn('⚠️ Invalid 2FA token', { userId })
        reply.status(400)
        return {
          success: false,
          message: 'Invalid 2FA token. Please try again.'
        }
      }

      // Move temporary data to permanent columns and enable 2FA
      databaseConnection.run(`
        UPDATE users 
        SET 
          two_factor_enabled = ?,
          two_factor_secret = two_factor_secret_tmp,
          backup_codes = backup_codes_tmp,
          two_factor_secret_tmp = NULL,
          backup_codes_tmp = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [1, userId])

      // Get updated user data to return
      const updatedUser = databaseConnection.get(
        'SELECT id, username, email, email_verified, avatar_url as avatar, is_online, two_factor_enabled as twoFactorEnabled FROM users WHERE id = ?',
        [userId]
      )

      if (!updatedUser) {
        throw new Error('Failed to retrieve updated user data')
      }

      verify2FASetupLogger.info('✅ 2FA setup completed successfully', { userId })

      return {
        success: true,
        message: '2FA has been successfully enabled for your account',
        user: updatedUser
      }
    } catch (error) {
      verify2FASetupLogger.error('❌ 2FA verify setup failed', { 
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

export default verify2FASetupRoute