/**
 * @brief Authentication middleware for ft_transcendence backend
 * 
 * @description JWT token verification and authentication middleware:
 * - JWT token validation
 * - User authentication checks
 * - Role-based access control
 * - Session management
 */

import jwt from 'jsonwebtoken'
import { logger } from '../logger.js'
import databaseConnection from '../database.js'
import { getUserById } from '../utils/auth_utils.js'

// Create middleware-specific logger
const authMiddlewareLogger = logger.child({ module: 'middleware/authentication' })

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * @brief Sanitize user object for API response (remove sensitive data)
 * @param {object} user - Raw user object from database
 * @returns {object} - Sanitized user object
 */
export function sanitizeUser(user) {
  if (!user) return null
  
  const {
    password_hash,
    two_factor_secret,
    backup_codes,
    email_verification_token,
    password_reset_token,
    password_reset_expires,
    ...sanitizedUser
  } = user
  
  return sanitizedUser
}

// =============================================================================
// JWT MIDDLEWARE FUNCTIONS
// =============================================================================

/**
 * @brief Extract and verify JWT token from request
 * @param {FastifyRequest} request - Fastify request object
 * @param {FastifyReply} reply - Fastify reply object
 */
export async function requireAuth(request, reply) {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      authMiddlewareLogger.warn('🔐 Authentication failed: Missing or invalid Authorization header')
      reply.status(401)
      return { success: false, message: 'Authentication required. Please provide a valid Bearer token.' }
    }
    
    const token = authHeader.replace('Bearer ', '')
    
    // Verify JWT token
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      authMiddlewareLogger.error('🔐 JWT_SECRET not configured')
      reply.status(500)
      return { success: false, message: 'Authentication service unavailable' }
    }
    
    const decoded = jwt.verify(token, jwtSecret)
    
    // Get user from database
    const user = await getUserById(decoded.userId)
    
    if (!user || !user.is_active) {
      authMiddlewareLogger.warn('🔐 Authentication failed: User not found or inactive', { userId: decoded.userId })
      reply.status(401)
      return { success: false, message: 'Authentication failed. User not found or account deactivated.' }
    }
    
    // Attach user to request for use in route handlers
    request.user = sanitizeUser(user)
    request.token = token
    
    authMiddlewareLogger.info('✅ User authenticated successfully', { 
      userId: user.id, 
      username: user.username 
    })
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      authMiddlewareLogger.warn('🔐 Authentication failed: Invalid JWT token', { error: error.message })
      reply.status(401)
      return { success: false, message: 'Invalid authentication token' }
    }
    
    if (error.name === 'TokenExpiredError') {
      authMiddlewareLogger.warn('🔐 Authentication failed: Expired JWT token', { error: error.message })
      reply.status(401)
      return { success: false, message: 'Authentication token has expired' }
    }
    
    authMiddlewareLogger.error('🔐 Authentication failed: Unexpected error', { error: error.message })
    reply.status(500)
    return { success: false, message: 'Authentication service error' }
  }
}

/**
 * @brief Require verified email for access
 * @param {FastifyRequest} request - Fastify request object
 * @param {FastifyReply} reply - Fastify reply object
 */
export async function requireEmailVerified(request, reply) {
  if (!request.user) {
    reply.status(401)
    return { success: false, message: 'Authentication required' }
  }
  
  if (!request.user.email_verified) {
    authMiddlewareLogger.warn('📧 Access denied: Email not verified', { 
      userId: request.user.id,
      email: request.user.email 
    })
    reply.status(403)
    return { 
      success: false, 
      message: 'Email verification required. Please verify your email before accessing this feature.' 
    }
  }
}

/**
 * @brief Require specific role for access
 * @param {string} requiredRole - Required role name
 * @returns {Function} - Middleware function
 */
export function requireRole(requiredRole) {
  return async (request, reply) => {
    if (!request.user) {
      reply.status(401)
      return { success: false, message: 'Authentication required' }
    }
    
    // Get user roles from database
    const db = databaseConnection.getDatabase()
    const stmt = db.prepare(`
      SELECT r.name 
      FROM user_roles ur 
      JOIN roles r ON ur.role_id = r.id 
      WHERE ur.user_id = ?
    `)
    const userRoles = stmt.all(request.user.id).map(row => row.name)
    
    if (!userRoles.includes(requiredRole)) {
      authMiddlewareLogger.warn('🔒 Access denied: Insufficient permissions', { 
        userId: request.user.id,
        requiredRole,
        userRoles 
      })
      reply.status(403)
      return { 
        success: false, 
        message: `Access denied. Required role: ${requiredRole}` 
      }
    }
    
    // Attach roles to request for further use
    request.userRoles = userRoles
  }
}

/**
 * @brief Optional authentication (don't fail if no token)
 * @param {FastifyRequest} request - Fastify request object
 * @param {FastifyReply} reply - Fastify reply object
 */
export async function optionalAuth(request, reply) {
  try {
    const authHeader = request.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without authentication
      return
    }
    
    const token = authHeader.replace('Bearer ', '')
    const jwtSecret = process.env.JWT_SECRET
    
    if (!jwtSecret) {
      return // Continue without authentication if JWT_SECRET not configured
    }
    
    const decoded = jwt.verify(token, jwtSecret)
    const user = getUserById(decoded.userId)
    
    if (user && user.is_active) {
      request.user = sanitizeUser(user)
      request.token = token
    }
    
  } catch (error) {
    // Ignore authentication errors for optional auth
    authMiddlewareLogger.debug('Optional auth failed, continuing without authentication', { 
      error: error.message 
    })
  }
}

// =============================================================================
// JWT UTILITY FUNCTIONS
// =============================================================================

/**
 * @brief Generate JWT access token
 * @param {object} user - User object
 * @param {string} expiresIn - Token expiration (default: 15m)
 * @returns {string} - JWT token
 */
export function generateAccessToken(user, expiresIn = '15m') {
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured')
  }
  
  return jwt.sign(
    { 
      userId: user.id,
      username: user.username,
      email: user.email,
      type: 'access'
    },
    jwtSecret,
    { expiresIn }
  )
}

/**
 * @brief Generate JWT refresh token
 * @param {object} user - User object
 * @param {string} expiresIn - Token expiration (default: 7d)
 * @returns {string} - JWT refresh token
 */
export function generateRefreshToken(user, expiresIn = '7d') {
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured')
  }
  
  return jwt.sign(
    { 
      userId: user.id,
      type: 'refresh'
    },
    jwtSecret,
    { expiresIn }
  )
}

/**
 * @brief Verify refresh token
 * @param {string} token - JWT refresh token
 * @returns {object} - Decoded token payload
 */
export function verifyRefreshToken(token) {
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured')
  }
  
  const decoded = jwt.verify(token, jwtSecret)
  
  if (decoded.type !== 'refresh') {
    throw new Error('Invalid token type')
  }
  
  return decoded
}
