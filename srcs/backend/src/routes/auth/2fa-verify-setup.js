/**
 * @brief 2FA verify setup route for ft_transcendence backend
 */

import { logger } from '../../logger.js'
import { routeSchemas } from '../../schemas/routes/auth.schema.js'
import { requireAuth } from '../../middleware/authentication.js'
import speakeasy from 'speakeasy'

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

      // Verify TOTP token against secret
      const verified = speakeasy.totp.verify({
        secret: secret,
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

      // Permanently enable 2FA for user
      await fastify.db.query(`
        UPDATE users 
        SET 
          two_factor_enabled = true,
          two_factor_secret = $1
        WHERE id = $2
      `, [secret, userId])

      // Get updated user data to return
      const updatedUserResult = await fastify.db.query(
        'SELECT id, username, email, email_verified, avatar_url as avatar, is_online, two_factor_enabled as twoFactorEnabled FROM users WHERE id = $1',
        [userId]
      )

      const updatedUser = updatedUserResult.rows[0]
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