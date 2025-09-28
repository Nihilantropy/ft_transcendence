/**
 * @brief Resend verification email route for ft_transcendence backend
 */

import { logger } from '../../logger.js'

const resendVerificationLogger = logger.child({ module: 'routes/auth/resend-verification' })

async function resendVerificationRoute(fastify, options) {
  fastify.post('/resend-verification', async (request, reply) => {
    try {
      const { email } = request.body
      
      resendVerificationLogger.info('📤 Resend verification requested', { email })
      
      // TODO: Implement resend verification logic
      // 1. Find user by email
      // 2. Check if already verified
      // 3. Check rate limiting (max 3 emails per hour)
      // 4. Generate new verification token
      // 5. Update database
      // 6. Send new verification email
      
      return {
        success: true,
        message: 'Verification email sent'
      }
    } catch (error) {
      resendVerificationLogger.error('❌ Resend verification failed', { error: error.message })
      reply.status(400)
      return { success: false, message: 'Resend verification failed' }
    }
  })
  
}

export default resendVerificationRoute