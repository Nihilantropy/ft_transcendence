/**
 * @brief OAuth providers route for ft_transcendence backend
 * 
 * @description Returns available OAuth providers configuration
 */

import { logger } from '../../logger.js'

// Create route-specific logger
const oauthProvidersLogger = logger.child({ module: 'routes/auth/oauth-providers' })

/**
 * @brief Register OAuth providers route
 * @param {FastifyInstance} fastify - The Fastify instance
 */
async function oauthProvidersRoute(fastify, options) {
  
  /**
   * @route GET /oauth/providers
   * @description Return list of configured OAuth providers
   */
  fastify.get('/oauth/providers', async (request, reply) => {
    try {
      // TODO: Return configured OAuth providers
      // 1. Check environment variables for OAuth configs
      // 2. Return available providers with their settings
      
      return {
        providers: [
          {
            name: 'google',
            enabled: true,
            clientId: process.env.GOOGLE_CLIENT_ID || null,
            scopes: ['openid', 'email', 'profile']
          }
        ]
      }
    } catch (error) {
      oauthProvidersLogger.error('❌ OAuth providers failed', { error: error.message })
      reply.status(500)
      return { providers: [] }
    }
  })
  
}

export default oauthProvidersRoute