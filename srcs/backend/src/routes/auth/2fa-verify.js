/**
 * @brief 2FA verification route for ft_transcendence backend
 */

import { logger } from '../../logger.js'

const twoFAVerifyLogger = logger.child({ module: 'routes/auth/2fa-verify' })

async function twoFAVerifyRoute(fastify, options) {
  fastify.post('/2fa/verify', async (request, reply) => {
    try {
      const { token, backupCode } = request.body
      
      // TODO: Implement 2FA verification logic
      // 1. Verify JWT token from Authorization header
      // 2. Get user's 2FA secret from database
      // 3. If token provided, verify TOTP token
      // 4. If backupCode provided, verify backup code and mark as used
      // 5. Update user's last_2fa_verification timestamp
      // 6. Return success status
      
      return {
        success: true,
        message: '2FA verification successful'
      }
    } catch (error) {
      twoFAVerifyLogger.error('❌ 2FA verification failed', { error: error.message })
      reply.status(400)
      return { success: false, message: 'Invalid 2FA token or backup code' }
    }
  })
  
  twoFAVerifyLogger.info('✅ 2FA verification routes registered successfully')
}

export default twoFAVerifyRoute