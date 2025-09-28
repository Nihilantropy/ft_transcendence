/**
 * @brief 2FA disable route for ft_transcendence backend
 */

import { logger } from '../../logger.js'

const twoFADisableLogger = logger.child({ module: 'routes/auth/2fa-disable' })

async function twoFADisableRoute(fastify, options) {
  fastify.post('/2fa/disable', async (request, reply) => {
    try {
      const { password, token } = request.body
      
      // TODO: Implement 2FA disable logic
      // 1. Verify JWT token from Authorization header
      // 2. Verify user's password for security
      // 3. Verify current 2FA token to confirm user has access
      // 4. Disable 2FA for the user
      // 5. Clear 2FA secret and backup codes
      // 6. Log security event
      
      return {
        success: true,
        message: '2FA successfully disabled'
      }
    } catch (error) {
      twoFADisableLogger.error('❌ 2FA disable failed', { error: error.message })
      reply.status(400)
      return { success: false, message: '2FA disable failed' }
    }
  })
  
}

export default twoFADisableRoute