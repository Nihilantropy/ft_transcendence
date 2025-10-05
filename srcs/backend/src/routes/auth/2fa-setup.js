/**
 * @brief 2FA setup route for ft_transcendence backend
 */

import { logger } from '../../logger.js'
import { routeSchemas } from '../../schemas/routes/auth.schema.js'
import { requireAuth } from '../../middleware/authentication.js'
import speakeasy from 'speakeasy'
import qrcode from 'qrcode'
import crypto from 'crypto'
import databaseConnection from '../../database.js'

const setup2FArouteLogger = logger.child({ module: 'routes/auth/2fa-setup' })

async function setup2FAroute(fastify, options) {
  // Register the route with schema validation
  fastify.post('/2fa/setup', {
    schema: routeSchemas.setup2FA,
    preHandler: requireAuth // Ensure user is authenticated
  }, async (request, reply) => {
    try {
      const userId = request.user.id
      setup2FArouteLogger.info('🔐 Starting 2FA setup', { userId })

      // Check if 2FA is already enabled for user
      const existingUser = databaseConnection.get(
        'SELECT two_factor_enabled FROM users WHERE id = ?',
        [userId]
      )

      if (existingUser?.two_factor_enabled) {
        setup2FArouteLogger.warn('⚠️ 2FA already enabled', { userId })
        reply.status(400)
        return {
          success: false,
          message: '2FA is already enabled for this account'
        }
      }

      // Generate TOTP secret
      const secret = speakeasy.generateSecret({
        name: `ft_transcendence:${request.user.email}`,
        issuer: 'ft_transcendence',
        length: 32
      })

      // Generate QR code as base64 image
      const qrCodeDataURL = await qrcode.toDataURL(secret.otpauth_url)
      setup2FArouteLogger.debug("generated QR code data URL", { qrCodeDataURL })
      
      // Extract base64 data (remove data:image/png;base64, prefix)
      const qrCodeBase64 = qrCodeDataURL.split(',')[1]
      setup2FArouteLogger.debug("extracted QR code base64", { qrCodeBase64 })

      // Generate backup codes (8 codes, 8 characters each)
      const backupCodes = []
      for (let i = 0; i < 8; i++) {
        const code = crypto.randomBytes(4).toString('hex').toUpperCase()
        backupCodes.push(code)
      }

      // Store temporary secret and backup codes (not yet verified)
      databaseConnection.run(`
        UPDATE users 
        SET 
          two_factor_secret = ?,
          backup_codes = ?
        WHERE id = ?
      `, [secret.base32, JSON.stringify(backupCodes), userId])

      setup2FArouteLogger.info('✅ 2FA setup data generated', { userId })

      return {
        success: true,
        message: 'Scan QR code with authenticator app',
        setupData: {
          secret: secret.base32,
          qrCode: qrCodeBase64,
          backupCodes: backupCodes
        }
      }
    } catch (error) {
      setup2FArouteLogger.error('❌ 2FA setup failed', { 
        error: error.message,
        stack: error.stack 
      })
      reply.status(500)
      return { 
        success: false, 
        message: 'Internal server error during 2FA setup' 
      }
    }
  })
}

export default setup2FAroute