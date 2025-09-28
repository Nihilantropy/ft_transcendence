/**
 * @brief Maximum security authentication middleware - Cookie only
 * 
 * @description Secure cookie-only authentication:
 * ✅ HTTP-only cookies (XSS immune)
 * ✅ No header fallback (eliminates XSS vector)
 * ✅ SameSite strict (CSRF protection)
 */

import { verifyAccessToken, isJwtConfigured } from '../utils/jwt.js'
import { userService } from '../services/user.service.js'
import { logger } from '../logger.js'

const authLogger = logger.child({ module: 'middleware/auth' })

/**
 * @brief Secure cookie-only authentication
 * @param {FastifyRequest} request - Fastify request object
 * @param {FastifyReply} reply - Fastify reply object
 */
export async function requireAuth(request, reply) {
  // ✅ ONLY extract from HTTP-only cookie
  const token = request.cookies?.accessToken
  
  if (!token) {
    authLogger.warn('Authentication required - no access token cookie')
    reply.status(401)
    throw new Error('Authentication required')
  }

  if (!isJwtConfigured()) {
    authLogger.error('JWT service not configured')
    reply.status(500)
    throw new Error('Authentication service unavailable')
  }

  try {
    const decoded = verifyAccessToken(token)
    const user = userService.getUserById(decoded.userId)
    
    if (!user || !user.is_active) {
      authLogger.warn('User not found or inactive', { userId: decoded.userId })
      reply.status(401)
      throw new Error('User not found or inactive')
    }
    
    request.user = user
    
  } catch (error) {
    authLogger.warn('Token verification failed', { error: error.message })
    reply.status(401)
    throw new Error('Invalid or expired token')
  }
}

/**
 * @brief Optional authentication for public routes
 * @param {FastifyRequest} request - Fastify request object
 * @param {FastifyReply} reply - Fastify reply object
 */
export async function optionalAuth(request, reply) {
  try {
    await requireAuth(request, reply)
  } catch (error) {
    // Continue without user context
    request.user = null
  }
}