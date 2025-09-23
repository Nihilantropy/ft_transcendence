/**
 * @brief Authentication utility functions for ft_transcendence backend using better-sqlite3
 * 
 * @description This module contains all authentication-related utility functions optimized for better-sqlite3:
 * - Input validation (username, email, password)
 * - Password hashing and verification
 * - Token generation
 * - Database uniqueness checks
 * - Role management
 */

import bcrypt from 'bcrypt'
import crypto from 'crypto'
import databaseConnection from '../database.js'
import { logger } from '../logger.js'

// Create service-specific logger
const authUtilsServiceLogger = logger.child({ module: 'utils/auth_utils' })

// =============================================================================
// PASSWORD FUNCTIONS
// =============================================================================

/**
 * @brief Hash password using bcrypt
 * 
 * @param {string} password - Plain text password
 * @return {Promise<string>} - Hashed password
 */
export async function hashPassword(password) {
  const saltRounds = 12
  return await bcrypt.hash(password, saltRounds)
}

/**
 * @brief Verify password against hash
 * 
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @return {Promise<boolean>} - Password matches
 */
export async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash)
}

// =============================================================================
// TOKEN GENERATION FUNCTIONS
// =============================================================================

/**
 * @brief Generate secure email verification token
 * 
 * @return {string} - URL-safe verification token
 */
export function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * @brief Generate secure password reset token
 * 
 * @return {string} - URL-safe password reset token
 */
export function generatePasswordResetToken() {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * @brief Generate secure 2FA backup codes
 * 
 * @param {number} count - Number of backup codes to generate (default: 10)
 * @return {string[]} - Array of backup codes
 */
export function generateBackupCodes(count = 10) {
  const codes = []
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric codes
    const code = crypto.randomBytes(4).toString('hex').toUpperCase()
    codes.push(code)
  }
  return codes
}

/**
 * @brief Generate unique random username
 * 
 * @param {string} baseEmail - Email to use as base for username generation
 * @return {string} - Unique username
 */
export function generateUniqueUsername(baseEmail = null) {
  try {
    authUtilsServiceLogger.debug('Generating unique username for email:', baseEmail)
    
    // Extract base from email if provided
    let baseUsername = baseEmail ? baseEmail.split('@')[0] : 'user'
    
    // Clean base username (only alphanumeric and underscores)
    baseUsername = baseUsername.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()
    
    // Ensure it's within length limits
    if (baseUsername.length < 3) {
      baseUsername = 'user'
    } else if (baseUsername.length > 15) {
      baseUsername = baseUsername.substring(0, 15)
    }
    
    // Prepare statement for checking username existence
    const checkStmt = databaseConnection.prepare(
      'SELECT id FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1'
    )
    
    // Try base username first
    if (!checkStmt.get(baseUsername)) {
      authUtilsServiceLogger.debug('Base username available:', baseUsername)
      return baseUsername
    }
    
    // If base exists, try with random suffixes
    for (let i = 0; i < 100; i++) {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000) // 4-digit number
      const candidateUsername = `${baseUsername}_${randomSuffix}`
      
      if (!checkStmt.get(candidateUsername)) {
        authUtilsServiceLogger.debug('Generated unique username:', candidateUsername)
        return candidateUsername
      }
    }
    
    // Fallback: completely random username
    const randomUsername = `user_${crypto.randomBytes(4).toString('hex')}_${Date.now().toString().slice(-4)}`
    authUtilsServiceLogger.debug('Fallback random username:', randomUsername)
    
    return randomUsername
  } catch (error) {
    authUtilsServiceLogger.error('Error generating unique username:', error.message)
    throw error
  }
}

/**
 * @brief Get user by ID with basic info
 * 
 * @param {number} userId - User ID
 * @return {object|null} - User object or null if not found
 */
export function getUserById(userId) {
  try {
    userServiceLogger.debug('Getting user by ID:', userId)
    
    const user = databaseConnection.get(`
      SELECT id, username, email, display_name, avatar_url, 
            email_verified, is_active, is_online, last_seen,
            two_factor_enabled, created_at, updated_at
      FROM users 
      WHERE id = ? AND is_active = TRUE
      LIMIT 1
    `, [userId])
    
    userServiceLogger.debug('User found:', !!user)
    return user || null
  } catch (error) {
    userServiceLogger.error('Error getting user by ID:', error.message)
    throw error
  }
}