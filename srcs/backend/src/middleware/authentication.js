/**
 * @brief Authentication middleware for ft_transcendence backend
 * 
 * @description JWT validation using existing auth utilities
 */

import { extractBearerToken, verifyAccessToken, isJwtConfigured } from '../utils/jwt.js'
import { userService } from '../services/user.service.js'
import { logger } from '../logger.js'

const authLogger = logger.child({ module: 'middleware/auth' })

/**
 * @brief JWT authentication hook for protected routes
 * @param {FastifyRequest} request - Fastify request object
 * @param {FastifyReply} reply - Fastify reply object
 */
export async function requireAuth(request, reply) {
  // Extract token
  const token = extractBearerToken(request.headers.authorization)
  
  if (!token) {
    reply.status(401)
    throw new Error('Authentication required')
  }

  // Check JWT configuration
  if (!isJwtConfigured()) {
    reply.status(500)
    throw new Error('Authentication service unavailable')
  }

  // Verify token
  try {
    const decoded = verifyAccessToken(token)
    
    // Verify user exists and is active
    const user = userService.getUserById(decoded.userId)
    if (!user || !user.is_active) {
      reply.status(401)
      throw new Error('User not found or inactive')
    }
    
    // Attach user to request
    request.user = user
    
  } catch (error) {
    authLogger.warn('Authentication failed', { error: error.message })
    reply.status(401)
    throw new Error('Invalid or expired token')
  }
}