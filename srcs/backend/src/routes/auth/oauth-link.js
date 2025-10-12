/**
 * @brief OAuth link route for ft_transcendence backend
 */

import { logger } from '../../logger.js'
import { routeOAuthSchemas } from '../../schemas/index.js'

const oauthLinkLogger = logger.child({ module: 'routes/auth/oauth-link' })

async function oauthLinkRoute(fastify, options) {
  fastify.post('/oauth/link', {
    schema: routeOAuthSchemas.link
  }, async (request, reply) => {
    try {
      const { provider, code, state } = request.body
      
      // TODO: Implement OAuth linking logic
      // 1. Verify JWT token from cookies
      // 2. Exchange OAuth code for user profile
      // 3. Check if OAuth account is already linked to another user
      // 4. Link OAuth account to current user
      // 5. Update oauth_providers array
      
      return {
        user: {}, // TODO: Return updated user object
        message: `${provider} account linked successfully`
      }
    } catch (error) {
      oauthLinkLogger.error('❌ OAuth link failed', { error: error.message })
      reply.status(400)
      return { success: false, message: 'OAuth linking failed' }
    }
  })

  fastify.delete('/oauth/unlink/:provider', {
    schema: routeOAuthSchemas.unlink
  }, async (request, reply) => {
    try {
      const { provider } = request.params
      
      // TODO: Implement OAuth unlinking logic
      // 1. Verify JWT token from Authorization header
      // 2. Check if provider is linked
      // 3. Ensure user has alternative login method (password or other OAuth)
      // 4. Remove OAuth data for the provider
      // 5. Update oauth_providers array
      
      return {
        user: {}, // TODO: Return updated user object
        message: `${provider} account unlinked successfully`
      }
    } catch (error) {
      oauthLinkLogger.error('❌ OAuth unlink failed', { error: error.message })
      reply.status(400)
      return { success: false, message: 'OAuth unlinking failed' }
    }
  })
  
}

export default oauthLinkRoute