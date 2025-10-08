/**
 * @brief OAuth providers route for ft_transcendence backend
 * 
 * @description Returns available OAuth providers configuration
 */

import { logger } from '../../logger.js'
import { oauthConfig, isOAuthConfigured } from '../../config/oauth.config.js'
import { oauthStateManager } from '../../services/oauth-state.service.js'

// Create route-specific logger
const oauthProvidersLogger = logger.child({ module: 'routes/auth/oauth-providers' })

/**
 * @brief Register OAuth providers route
 * @param {FastifyInstance} fastify - The Fastify instance
 */
async function oauthProvidersRoute(fastify, options) {
  
  /**
   * @route GET /oauth/providers
   * @description Return list of configured OAuth providers with auth URLs
   */
  fastify.get('/oauth/providers', async (request, reply) => {
    try {
      const providers = []
      
      // Check if Google OAuth is configured
      if (isOAuthConfigured()) {
        // Generate state token for OAuth flow
        const state = oauthStateManager.create(request.user?.id)
        
        // Build Google OAuth authorization URL
        const authUrl = new URL(oauthConfig.google.authUrl)
        authUrl.searchParams.append('client_id', oauthConfig.google.clientId)
        authUrl.searchParams.append('redirect_uri', oauthConfig.google.redirectUri)
        authUrl.searchParams.append('response_type', 'code')
        authUrl.searchParams.append('scope', oauthConfig.google.scopes.join(' '))
        authUrl.searchParams.append('state', state)
        authUrl.searchParams.append('access_type', 'offline')
        authUrl.searchParams.append('prompt', 'consent')
        
        providers.push({
          name: 'google',
          displayName: 'Google',
          enabled: true,
          authUrl: authUrl.toString(),
          scopes: oauthConfig.google.scopes
        })
        
        oauthProvidersLogger.debug('Generated Google OAuth URL', {
          state: state.substring(0, 8) + '...'
        })
      }
      
      oauthProvidersLogger.info('OAuth providers requested', { 
        count: providers.length,
        isConfigured: isOAuthConfigured()
      })
      
      return {
        success: true,
        providers
      }
    } catch (error) {
      oauthProvidersLogger.error('❌ OAuth providers failed', { error: error.message })
      reply.status(500)
      return { 
        success: false,
        providers: [],
        message: 'Failed to retrieve OAuth providers'
      }
    }
  })
  
}

export default oauthProvidersRoute
