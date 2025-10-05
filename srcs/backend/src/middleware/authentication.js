/**
 * @brief Maximum security authentication middleware - Cookie only
 * 
 * @description Secure cookie-only authentication:
 * ✅ HTTP-only cookies (XSS immune)
 * ✅ No header fallback (eliminates XSS vector)
 * ✅ SameSite strict (CSRF protection)
 * ✅ Schema-compliant error responses (no serialization errors)
 */

import { verifyAccessToken, isJwtConfigured } from '../utils/jwt.js'
import { userService } from '../services/user.service.js'
import { logger } from '../logger.js'

const authLogger = logger.child({ module: 'middleware/auth' })

/**
 * @brief Create standardized auth error response
 * @param {string} message - Error message
 * @param {string} code - Error code
 * @return {Object} Schema-compliant error response
 */
function createAuthError(message, code = 'AUTH_ERROR') {
  return {
    success: false,
    message,
    error: {
      code,
      details: message
    }
  }
}

/**
 * @brief Secure cookie-only authentication
 * @param {FastifyRequest} request - Fastify request object
 * @param {FastifyReply} reply - Fastify reply object
 * 
 * @description Fastify preHandler that sends error responses directly.
 * This avoids serialization issues by matching the response schema immediately.
 * Returns early on error, preventing route handler execution.
 */
export async function requireAuth(request, reply) {
  // ✅ ONLY extract from HTTP-only cookie
  const token = request.cookies?.accessToken
  
  if (!token) {
    authLogger.warn('Authentication required - no access token cookie')
    return reply.code(401).send(createAuthError('Authentication required', 'NO_TOKEN'))
  }

  if (!isJwtConfigured()) {
    authLogger.error('JWT service not configured')
    return reply.code(500).send(createAuthError('Authentication service unavailable', 'SERVICE_ERROR'))
  }

  try {
    const decoded = verifyAccessToken(token)
    const user = userService.getUserById(decoded.userId)
    
    if (!user || !user.is_active) {
      authLogger.warn('User not found or inactive', { userId: decoded.userId })
      return reply.code(401).send(createAuthError('User not found or inactive', 'INVALID_USER'))
    }
    
    // ✅ Success: Attach user to request and continue to route handler
    request.user = user
    
  } catch (error) {
    // Handle JWT verification errors
    if (error.name === 'TokenExpiredError') {
      authLogger.warn('❌ Access token verification failed', {
        tokenType: error.name,
        error: error.message
      })
      return reply.code(401).send(createAuthError('Token expired', 'TOKEN_EXPIRED'))
    }
    
    if (error.name === 'JsonWebTokenError') {
      authLogger.warn('❌ Access token verification failed', {
        tokenType: error.name,
        error: error.message
      })
      return reply.code(401).send(createAuthError('Invalid token', 'INVALID_TOKEN'))
    }
    
    // Handle custom errors with statusCode
    if (error.statusCode) {
      authLogger.warn('Token verification failed', { error: error.message })
      return reply.code(error.statusCode).send(createAuthError(error.message, 'AUTH_ERROR'))
    }
    
    // Unknown error - log and return generic message
    authLogger.error('Unexpected error in authentication', { error: error.message, stack: error.stack })
    return reply.code(401).send(createAuthError('Invalid or expired token', 'AUTH_ERROR'))
  }
}

/**
 * @brief Optional authentication for public routes
 * @param {FastifyRequest} request - Fastify request object
 * @param {FastifyReply} reply - Fastify reply object
 * 
 * @description Attempts authentication but continues if it fails.
 * Sets request.user to null for unauthenticated requests.
 * Does not send error responses - fails silently.
 */
export async function optionalAuth(request, reply) {
  const token = request.cookies?.accessToken
  
  if (!token || !isJwtConfigured()) {
    request.user = null
    return
  }

  try {
    const decoded = verifyAccessToken(token)
    const user = userService.getUserById(decoded.userId)
    
    if (user && user.is_active) {
      request.user = user
    } else {
      request.user = null
    }
  } catch (error) {
    // Silently fail - continue without user context
    request.user = null
  }
}