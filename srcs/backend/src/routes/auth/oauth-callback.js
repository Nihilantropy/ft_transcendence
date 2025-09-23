/**
 * @brief OAuth Google callback route for ft_transcendence backend
 */

import { logger } from '../../logger.js'

const oauthCallbackLogger = logger.child({ module: 'routes/auth/oauth-callback' })

async function oauthCallbackRoute(fastify, options) {
  fastify.post('/oauth/google/callback', async (request, reply) => {
    try {
      const { code, state } = request.body
      
      oauthCallbackLogger.info('🌐 Google OAuth callback received')
      
      // TODO: Implement Google OAuth logic
      // 1. Exchange code for tokens with Google
      // 2. Get user profile from Google API
      // 3. Check if user exists by google_id or email
      // 4. If new user: create account with OAuth data
      // 5. If existing user: update OAuth data
      // 6. Generate JWT tokens
      // 7. Update user status
      
      return {
        success: true,
        user: {}, // TODO: Return user object
        token: 'jwt-access-token',
        refreshToken: 'jwt-refresh-token',
        isNewUser: false // TODO: Determine if this is a new user
      }
    } catch (error) {
      oauthCallbackLogger.error('❌ Google OAuth failed', { error: error.message })
      reply.status(400)
      return { success: false, message: 'OAuth authentication failed' }
    }
  })
  
  oauthCallbackLogger.info('✅ OAuth callback route registered successfully')
}

export default oauthCallbackRoute