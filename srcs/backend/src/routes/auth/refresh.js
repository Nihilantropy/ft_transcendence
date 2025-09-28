/**
 * @brief Token refresh route for ft_transcendence backend
 * 
 * @description Handles JWT token refresh with:
 * - Refresh token validation
 * - New access token generation
 * - Token rotation (optional)
 */

import { logger } from '../../logger.js'
import { routeSchemas } from '../../schemas/index.js'

// Create route-specific logger
const refreshLogger = logger.child({ module: 'routes/auth/refresh' })

/**
 * @brief Secure token refresh with HTTP-only cookies
 */
async function refreshRoute(fastify, options) {
  fastify.post('/refresh', {
    schema: routeSchemas.refresh
    
  }, async (request, reply) => {
    try {
      // Get refresh token from body OR cookie
      const refreshToken = request.body.refreshToken || request.cookies.refreshToken
      refreshLogger.info('🔄 Token refresh attempt', { refreshToken })

      if (!refreshToken) {
        reply.status(401)
        return {
          success: false,
          message: 'Refresh token required'
        }
      }
      
      // Verify refresh token and generate new access token
      const { accessToken, refreshToken: newRefreshToken } = await refreshTokenPair(refreshToken)
      
      // ✅ SET NEW ACCESS TOKEN AS HTTP-ONLY COOKIE
      reply.setCookie('accessToken', accessToken, ACCESS_TOKEN_CONFIG)
      
      // ✅ OPTIONALLY ROTATE REFRESH TOKEN
      if (newRefreshToken) {
        reply.setCookie('refreshToken', newRefreshToken, REFRESH_TOKEN_CONFIG)
      }
      
      return {
        success: true,
        message: 'Token refreshed successfully',
        refreshToken: newRefreshToken // Only if not using cookie storage
      }
      
    } catch (error) {
      reply.status(401)
      return {
        success: false,
        message: 'Invalid refresh token'
      }
    }
  })
}

export default refreshRoute