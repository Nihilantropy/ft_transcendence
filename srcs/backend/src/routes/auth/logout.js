/**
 * @brief User logout route for ft_transcendence backend
 * 
 * @description Handles user logout with:
 * - JWT token invalidation
 * - User session cleanup
 * - Online status update
 */

import { logger } from '../../logger.js'
import { extractBearerToken, verifyAccessToken, isJwtConfigured } from '../../utils/jwt.js'
import { getUserById } from '../../utils/auth_utils.js'
import { userService } from '../../services/user.service.js'

// Create route-specific logger
const logoutLogger = logger.child({ module: 'routes/auth/logout' })

/**
 * @brief Register logout route
 * @param {FastifyInstance} fastify - The Fastify instance
 */
async function logoutRoute(fastify, options) {
  
  // =============================================================================
  // OPENAPI SCHEMAS
  // =============================================================================
  
  // Define reusable schemas
  fastify.addSchema({
    $id: 'AuthResponse',
    type: 'object',
    properties: {
      success: { type: 'boolean', description: 'Operation success status' },
      message: { type: 'string', description: 'Human-readable response message' }
    },
    required: ['success', 'message']
  })

  fastify.addSchema({
    $id: 'ErrorResponse',
    type: 'object',
    properties: {
      success: { type: 'boolean', description: 'Operation success status (always false)' },
      message: { type: 'string', description: 'Error description' },
      error: { 
        type: 'object',
        description: 'Detailed error information',
        properties: {
          code: { type: 'string' },
          details: { type: 'string' }
        }
      }
    },
    required: ['success', 'message']
  })

  // =============================================================================
  // ROUTE DEFINITION
  // =============================================================================
  
  /**
   * @route POST /logout
   * @description Invalidate user session and tokens
   */
  fastify.post('/logout', {
    schema: {
      // OpenAPI documentation
      tags: ['auth'],
      operationId: 'logoutUser',
      summary: 'User logout',
      description: 'Invalidate JWT token and cleanup user session. Updates user online status and clears server-side session data.',
      
      // Security requirements
      security: [
        { bearerAuth: [] }
      ],
      
      // Request headers
      headers: {
        type: 'object',
        properties: {
          authorization: {
            type: 'string',
            description: 'Bearer JWT token',
            pattern: '^Bearer .+$'
          }
        },
      },
      
      // Response schemas
      response: {
        200: {
          description: 'Logout successful',
          $ref: 'AuthResponse#'
        },
        400: {
          description: 'Logout failed - invalid or missing token',
          $ref: 'ErrorResponse#'
        },
        401: {
          description: 'Unauthorized - invalid JWT token',
          $ref: 'ErrorResponse#'
        }
      }
    }
  }, async (request, reply) => {
    try {
      // 1. Extract JWT from Authorization header
      const token = extractBearerToken(request.headers.authorization)
      
      if (!token) {
        logoutLogger.warn('🔐 Logout failed: Missing or invalid Authorization header')
        reply.status(401)
        return {
          success: false,
          message: 'Authentication required. Please provide a valid Bearer token.',
          error: {
            code: 'MISSING_TOKEN',
            details: 'Authorization header with Bearer token is required'
          }
        }
      }

      // 2. Check if JWT is configured
      if (!isJwtConfigured()) {
        logoutLogger.error('🔐 JWT_SECRET not configured')
        reply.status(400)
        return {
          success: false,
          message: 'Authentication service unavailable',
          error: {
            code: 'JWT_NOT_CONFIGURED',
            details: 'JWT service is not properly configured'
          }
        }
      }

      // 3. Verify JWT token
      let decoded
      try {
        decoded = verifyAccessToken(token)
      } catch (jwtError) {
        logoutLogger.warn('🔐 Logout failed: Invalid JWT token', { error: jwtError.message })
        reply.status(401)
        return {
          success: false,
          message: 'Invalid or expired token',
          error: {
            code: 'INVALID_TOKEN',
            details: 'JWT token is invalid or has expired'
          }
        }
      }

      // 4. Verify user exists and is active
      const user = getUserById(decoded.userId)
      
      if (!user || !user.is_active) {
        logoutLogger.warn('🔐 Logout failed: User not found or inactive', { userId: decoded.userId })
        reply.status(401)
        return {
          success: false,
          message: 'User not found or account deactivated',
          error: {
            code: 'USER_NOT_FOUND',
            details: 'User account is not active or does not exist'
          }
        }
      }

      // 5. Update user's online status to false
      userService.updateUserOnlineStatus(decoded.userId, false)
      
      logoutLogger.info('👋 User logged out successfully', { 
        userId: decoded.userId, 
        username: user.username 
      })
      
      return {
        success: true,
        message: 'Logout successful'
      }
      
    } catch (error) {
      logoutLogger.error('❌ Logout failed', { error: error.message, stack: error.stack })
      reply.status(400)
      return { 
        success: false, 
        message: 'Logout failed',
        error: {
          code: 'LOGOUT_ERROR',
          details: error.message
        }
      }
    }
  })
  
  logoutLogger.info('✅ Logout route registered successfully')
}

export default logoutRoute