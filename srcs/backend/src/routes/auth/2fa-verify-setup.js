/**
 * @brief 2FA verify setup route for ft_transcendence backend
 */

import { logger } from '../../logger.js'

const twoFAVerifySetupLogger = logger.child({ module: 'routes/auth/2fa-verify-setup' })

async function twoFAVerifySetupRoute(fastify, options) {
  fastify.post('/2fa/verify-setup', async (request, reply) => {
    try {
      const { token } = request.body
      
      // TODO: Implement 2FA setup verification logic
      // 1. Verify JWT token from Authorization header
      // 2. Get temporary TOTP secret from user session/db
      // 3. Verify TOTP token against secret
      // 4. If valid, permanently enable 2FA for user
      // 5. Store secret and mark 2FA as enabled
      // 6. Generate and return backup codes
      
      return {
        success: true,
        backupCodes: [], // TODO: Generate and return backup codes
        message: '2FA successfully enabled'
      }
    } catch (error) {
      twoFAVerifySetupLogger.error('❌ 2FA verify setup failed', { error: error.message })
      reply.status(400)
      return { success: false, message: 'Invalid 2FA token' }
    }
  })
  
}

export default twoFAVerifySetupRoute