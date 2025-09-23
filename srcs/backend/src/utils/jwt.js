/**
 * @brief JWT utility functions with enhanced secret management
 * @description Centralized JWT operations with better error handling and secret validation
 */

import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { logger } from '../logger.js'

// Create JWT-specific logger
const jwtLogger = logger.child({ module: 'utils/jwt' })

// =============================================================================
// SECRET MANAGEMENT
// =============================================================================

/**
 * @brief Get and validate JWT secret from environment
 * @returns {string} - Validated JWT secret
 * @throws {Error} - If secret is missing or invalid
 */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET
  
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not configured')
  }
  
  // Validate secret strength (at least 32 characters for security)
  if (secret.length < 32) {
    jwtLogger.warn('⚠️ JWT_SECRET is shorter than recommended (32+ characters)')
  }
  
  return secret
}

/**
 * @brief Get and validate JWT refresh secret from environment
 * @returns {string} - Validated JWT refresh secret
 * @throws {Error} - If secret is missing or invalid
 */
function getJwtRefreshSecret() {
  const secret = process.env.JWT_REFRESH_SECRET
  
  if (!secret) {
    // Fallback to main JWT secret if refresh secret not provided
    jwtLogger.warn('JWT_REFRESH_SECRET not set, using JWT_SECRET for refresh tokens')
    return getJwtSecret()
  }
  
  return secret
}

/**
 * @brief Generate a cryptographically secure JWT secret
 * @param {number} length - Secret length in bytes (default: 64)
 * @returns {string} - Base64 encoded secret
 */
export function generateSecureJwtSecret(length = 64) {
  return crypto.randomBytes(length).toString('base64')
}

// =============================================================================
// TOKEN GENERATION
// =============================================================================

/**
 * @brief Generate JWT access token with enhanced options
 * @param {object} user - User object
 * @param {object} options - Token options
 * @returns {string} - JWT token
 */
export function generateAccessToken(user, options = {}) {
  try {
    const secret = getJwtSecret()
    const expiresIn = options.expiresIn || process.env.JWT_EXPIRES_IN || '15m'
    
    const payload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      type: 'access',
      // Add issued at timestamp
      iat: Math.floor(Date.now() / 1000)
    }
    
    // Add custom claims if provided
    if (options.claims) {
      Object.assign(payload, options.claims)
    }
    
    const token = jwt.sign(payload, secret, { 
      expiresIn,
      issuer: 'ft-transcendence',
      audience: 'ft-transcendence-users'
    })
    
    jwtLogger.debug('✅ Access token generated', { 
      userId: user.id, 
      expiresIn,
      claims: Object.keys(options.claims || {})
    })
    
    return token
    
  } catch (error) {
    jwtLogger.error('❌ Failed to generate access token', { 
      error: error.message,
      userId: user?.id 
    })
    throw new Error('Failed to generate authentication token')
  }
}

/**
 * @brief Generate JWT refresh token
 * @param {object} user - User object
 * @param {object} options - Token options
 * @returns {string} - JWT refresh token
 */
export function generateRefreshToken(user, options = {}) {
  try {
    const secret = getJwtRefreshSecret()
    const expiresIn = options.expiresIn || process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    
    const payload = {
      userId: user.id,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000)
    }
    
    const token = jwt.sign(payload, secret, { 
      expiresIn,
      issuer: 'ft-transcendence',
      audience: 'ft-transcendence-refresh'
    })
    
    jwtLogger.debug('✅ Refresh token generated', { 
      userId: user.id, 
      expiresIn 
    })
    
    return token
    
  } catch (error) {
    jwtLogger.error('❌ Failed to generate refresh token', { 
      error: error.message,
      userId: user?.id 
    })
    throw new Error('Failed to generate refresh token')
  }
}

// =============================================================================
// TOKEN VERIFICATION
// =============================================================================

/**
 * @brief Verify JWT access token
 * @param {string} token - JWT token to verify
 * @returns {object} - Decoded token payload
 */
export function verifyAccessToken(token) {
  try {
    const secret = getJwtSecret()
    
    const decoded = jwt.verify(token, secret, {
      issuer: 'ft-transcendence',
      audience: 'ft-transcendence-users'
    })
    
    if (decoded.type !== 'access') {
      throw new Error('Invalid token type: expected access token')
    }
    
    jwtLogger.debug('✅ Access token verified', { 
      userId: decoded.userId,
      username: decoded.username 
    })
    
    return decoded
    
  } catch (error) {
    jwtLogger.warn('❌ Access token verification failed', { 
      error: error.message,
      tokenType: error.name 
    })
    throw error
  }
}

/**
 * @brief Verify JWT refresh token
 * @param {string} token - JWT refresh token to verify
 * @returns {object} - Decoded token payload
 */
export function verifyRefreshToken(token) {
  try {
    const secret = getJwtRefreshSecret()
    
    const decoded = jwt.verify(token, secret, {
      issuer: 'ft-transcendence',
      audience: 'ft-transcendence-refresh'
    })
    
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type: expected refresh token')
    }
    
    jwtLogger.debug('✅ Refresh token verified', { 
      userId: decoded.userId 
    })
    
    return decoded
    
  } catch (error) {
    jwtLogger.warn('❌ Refresh token verification failed', { 
      error: error.message,
      tokenType: error.name 
    })
    throw error
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * @brief Generate token pair (access + refresh)
 * @param {object} user - User object
 * @param {object} options - Token options
 * @returns {object} - Token pair
 */
export function generateTokenPair(user, options = {}) {
  return {
    accessToken: generateAccessToken(user, options.access),
    refreshToken: generateRefreshToken(user, options.refresh),
    tokenType: 'Bearer',
    expiresIn: options.access?.expiresIn || process.env.JWT_EXPIRES_IN || '15m'
  }
}

/**
 * @brief Extract token from Authorization header
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} - Extracted token or null
 */
export function extractBearerToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  return authHeader.replace('Bearer ', '')
}

/**
 * @brief Check if JWT secret is properly configured
 * @returns {boolean} - True if configured properly
 */
export function isJwtConfigured() {
  try {
    getJwtSecret()
    return true
  } catch (error) {
    return false
  }
}