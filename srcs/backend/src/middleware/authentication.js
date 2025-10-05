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
 * 
 * @description Fastify preHandler that throws errors to stop execution.
 * When an error is thrown, Fastify's error handler catches it and sends the response.
 */
export async function requireAuth(request, reply) {
  // ✅ ONLY extract from HTTP-only cookie
  const token = request.cookies?.accessToken
  
  if (!token) {
    authLogger.warn('Authentication required - no access token cookie')
    // Throw error to stop execution - Fastify error handler will catch it
    throw { statusCode: 401, message: 'Authentication required' }
  }

  if (!isJwtConfigured()) {
    authLogger.error('JWT service not configured')
    throw { statusCode: 500, message: 'Authentication service unavailable' }
  }

  try {
    const decoded = verifyAccessToken(token)
    const user = userService.getUserById(decoded.userId)
    
    if (!user || !user.is_active) {
      authLogger.warn('User not found or inactive', { userId: decoded.userId })
      throw { statusCode: 401, message: 'User not found or inactive' }
    }
    
    // ✅ Success: Attach user to request and continue to route handler
    request.user = user
    
  } catch (error) {
    // Handle JWT verification errors
    if (error.statusCode) {
      throw error // Re-throw our custom errors
    }
    
    authLogger.warn('Token verification failed', { error: error.message })
    throw { statusCode: 401, message: 'Invalid or expired token' }
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