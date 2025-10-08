/**
 * @brief OAuth initiation route
 * @description Generates OAuth authorization URL with CSRF protection
 */

import { logger } from '../../logger.js'
import { oauthStateManager } from '../../services/oauth-state.service.js'
import { oauthConfig, isOAuthConfigured } from '../../config/oauth.config.js'

const oauthInitiateLogger = logger.child({ module: 'routes/auth/oauth-initiate' })

async function oauthInitiateRoute(fastify) {
  
  /**
   * @route GET /oauth/google/login
   * @description Initiate Google OAuth flow with CSRF protection
   */
  fastify.get('/oauth/google/login', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    try {
      // Check if OAuth is configured
      if (!isOAuthConfigured()) {
        oauthInitiateLogger.error('OAuth not configured')
        return reply.redirect('https://localhost/login?error=oauth_not_configured')
      }

      // Generate secure state token
      const state = oauthStateManager.create(request.user?.id)
      
      // Build Google OAuth URL
      const authUrl = new URL(oauthConfig.google.authUrl)
      authUrl.searchParams.append('client_id', oauthConfig.google.clientId)
      authUrl.searchParams.append('redirect_uri', oauthConfig.google.redirectUri)
      authUrl.searchParams.append('response_type', 'code')
      authUrl.searchParams.append('scope', oauthConfig.google.scopes.join(' '))
      authUrl.searchParams.append('state', state)
      authUrl.searchParams.append('access_type', 'offline')
      authUrl.searchParams.append('prompt', 'consent') // Force consent to get refresh token
      
      oauthInitiateLogger.info('🌐 Initiating Google OAuth flow', {
        userId: request.user?.id,
        state: state.substring(0, 8) + '...'
      })
      
      // Redirect to Google
      return reply.redirect(authUrl.toString())
      
    } catch (error) {
      oauthInitiateLogger.error('❌ OAuth initiation failed', { 
        error: error.message,
        stack: error.stack
      })
      return reply.redirect('https://localhost/login?error=oauth_init_failed')
    }
  })
}

export default oauthInitiateRoute
