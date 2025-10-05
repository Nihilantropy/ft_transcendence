/**
 * @brief User service for ft_transcendence backend - Better-SQLite3 optimized
 * 
 * @description Provides clean, essential database interactions for user management:
 * - User creation and validation  
 * - Email and username checking
 * - Role assignment
 * - User stats initialization
 * - Synchronous database operations optimized for better-sqlite3
 */

import { logger } from '../logger.js'
import databaseConnection from '../database.js'
import { 
  hashPassword, 
  generateVerificationToken, 
  generateUniqueUsername,
} from '../utils/auth_utils.js'

// Create service-specific logger
const userServiceLogger = logger.child({ module: 'services/user' })

/**
 * @brief User service class with essential database operations
 */
export class UserService {
  
  /**
   * @brief Check if email already exists in database
   * 
   * @param {string} email - Email to check
   * @return {boolean} True if email exists
   */
  isEmailTaken(email) {
    try {
      return emailExists(email)
    } catch (error) {
      userServiceLogger.error('Failed to check email existence', { email, error: error.message })
      throw new Error('Database error while checking email')
    }
  }

  /**
   * @brief Check if username already exists in database
   * 
   * @param {string} username - Username to check
   * @return {boolean} True if username exists
   */
  isUsernameTaken(username) {
    try {
      return usernameExists(username)
    } catch (error) {
      userServiceLogger.error('Failed to check username existence', { username, error: error.message })
      throw new Error('Database error while checking username')
    }
  }

  /**
   * @brief Generate unique username from email
   * 
   * @param {string} email - Email to base username on
   * @return {string} Unique username
   */
  createUniqueUsername(email) {
    try {
      return generateUniqueUsername(email)
    } catch (error) {
      userServiceLogger.error('Failed to generate unique username', { email, error: error.message })
      throw new Error('Failed to generate username')
    }
  }

  /**
   * @brief Create new user with complete profile initialization according to user table schema
   * 
   * @param {Object} userData - User data object containing registration information
   * @param {string} userData.email - User email address (will be normalized to lowercase)
   * @param {string} userData.password - Plain text password (will be securely hashed)
   * @param {string} userData.username - Unique username for the user
   * @return {Promise<Object>} Created user object with id, username, email, verification status and token
   */
  async createUser({ email, password, username }) {
    try {
      // Hash password securely (only async operation)
      const hashedPassword = await hashPassword(password)
      
      // Generate verification token for email confirmation
      const verificationToken = generateVerificationToken()
      
      userServiceLogger.debug('Creating user with transaction', { username, email })
      
      // Execute synchronous transaction for data consistency
      const newUser = databaseConnection.transaction(() => {
        
        // 1. Insert user with complete schema-compliant initialization
        const insertResult = databaseConnection.run(`
          INSERT INTO users (
            -- Core Identity
            username, email,
            
            -- Authentication
            password_hash, email_verified, email_verification_token,
            
            -- Profile (display_name defaults to username)
            display_name, avatar_url,
            
            -- Status (user starts active but offline)
            is_active, is_online, last_seen,
            
            -- OAuth (initialized as NULL - set when OAuth is used)
            oauth_providers,
            
            -- Two-Factor Auth (disabled by default)
            two_factor_enabled, two_factor_secret, backup_codes,
            
            -- Timestamps
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
          // Core Identity
          username,
          email.toLowerCase(),
          
          // Authentication
          hashedPassword,
          0, // email_verified: false -> 0
          verificationToken,
          
          // Profile
          username, // display_name defaults to username
          null,     // avatar_url: NULL (will be set when user uploads avatar)
          
          // Status
          1, // is_active: true -> 1 (user starts active)
          0, // is_online: false -> 0 (user starts offline)
          null, // last_seen: NULL initially (updated on first login)
          
          // OAuth
          null, // oauth_providers: NULL (JSON array populated when OAuth used)
          
          // Two-Factor Auth
          0,    // two_factor_enabled: false -> 0
          null, // two_factor_secret: NULL
          null  // backup_codes: NULL
        ])
        
        const userId = insertResult.lastInsertRowid
        userServiceLogger.debug('User inserted with ID:', userId)
        
        // 2. Assign default 'user' role (synchronous)
        const userRoleId = this.getRoleId('user')
        if (userRoleId) {
          databaseConnection.run(`
            INSERT INTO user_roles (user_id, role_id, granted_at) 
            VALUES (?, ?, CURRENT_TIMESTAMP)
          `, [userId, userRoleId])
          
          userServiceLogger.debug('Default role assigned')
        }
        
        // 3. Create user_stats entry (synchronous)
        databaseConnection.run(`
          INSERT INTO user_stats (
            user_id, games_played, games_won, games_lost,
            total_score, ranking, updated_at
          ) VALUES (?, 0, 0, 0, 0, 1000, CURRENT_TIMESTAMP)
        `, [userId])
        
        userServiceLogger.debug('User stats created')
        
        // Return user data with schema-compliant structure
        return {
          id: userId,
          username,
          email: email.toLowerCase(),
          email_verified: false,
          verificationToken,
          display_name: username, // Include for frontend use
          is_active: true,
          is_online: false
        }
        
      }) // End of transaction
      
      userServiceLogger.info('✅ User created successfully', { 
        userId: newUser.id, 
        username: newUser.username, 
        email: newUser.email 
      })
      
      return newUser
      
    } catch (error) {
      userServiceLogger.error('❌ User creation failed', { 
        email, 
        username, 
        error: error.message 
      })
      
      throw new Error('Failed to create user')
    }
  }

  /**
   * @brief Get user by email
   * 
   * @param {string} email - User email
   * @return {Object|null} User object or null
   */
  getUserByEmail(email) {
    try {
      const user = databaseConnection.get(`
        SELECT id, username, email, password_hash, email_verified, 
               is_active, is_online, created_at, updated_at
        FROM users 
        WHERE LOWER(email) = LOWER(?) AND is_active = 1
        LIMIT 1
      `, [email])
      
      return user || null
      
    } catch (error) {
      userServiceLogger.error('Failed to get user by email', { email, error: error.message })
      throw new Error('Database error while retrieving user')
    }
  }

  /**
   * @brief Get user by ID
   * 
   * @param {number} userId - User ID
   * @return {Object|null} User object or null
   */
  getUserById(userId) {
    try {
      const user = databaseConnection.get(`
        SELECT id, username, email, email_verified, 
               is_active, is_online, created_at, updated_at
        FROM users 
        WHERE id = ? AND is_active = 1
        LIMIT 1
      `, [userId])
      
      return user || null
      
    } catch (error) {
      userServiceLogger.error('Failed to get user by ID', { userId, error: error.message })
      throw new Error('Database error while retrieving user')
    }
  }

  /**
   * @brief Get user by username
   * 
   * @param {string} username - Username
   * @return {Object|null} User object or null
   */
  getUserByUsername(username) {
    try {
      const user = databaseConnection.get(`
        SELECT id, username, email, password_hash, email_verified, 
               is_active, is_online, created_at, updated_at
        FROM users 
        WHERE LOWER(username) = LOWER(?) AND is_active = 1
        LIMIT 1
      `, [username])
      
      return user || null
      
    } catch (error) {
      userServiceLogger.error('Failed to get user by username', { username, error: error.message })
      throw new Error('Database error while retrieving user')
    }
  }

  /**
   * @brief Verify user's email address
   * 
   * @param {string} verificationToken - Email verification token
   * @return {object|null} - User object if verification successful, null otherwise
   */
  verifyUserEmail(verificationToken) {
    try {
      userServiceLogger.debug('Verifying user email with token')
      
      // Use transaction for atomic operation
      const result = databaseConnection.transaction(() => {
        // Find user by verification token
        const user = databaseConnection.get(`
          SELECT id, username, email, email_verified
          FROM users 
          WHERE email_verification_token = ? AND is_active = 1
          LIMIT 1
        `, [verificationToken])
        
        if (!user) {
          userServiceLogger.debug('No user found with verification token')
          return null
        }
        
        if (user.email_verified) {
          userServiceLogger.debug('Email already verified for user', { userId: user.id })
          return { ...user, email_verified: true }
        }
        
        // Update user to mark email as verified
        const updateResult = databaseConnection.run(`
          UPDATE users 
          SET email_verified = 1, 
              email_verification_token = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [user.id])
        
        userServiceLogger.debug('Email verification update, rows changed:', updateResult.changes)
        
        return { ...user, email_verified: true }
      })
      
      return result
    } catch (error) {
      userServiceLogger.error('Error verifying user email:', error.message)
      throw error
    }
  }

  /**
   * @brief Set user email as verified (alternative method)
   * 
   * @param {number} userId - User ID
   * @return {boolean} - Success status
   */
  setEmailVerified(userId) {
    try {
      userServiceLogger.debug('Setting email as verified for user:', userId)
      
      const result = databaseConnection.run(`
        UPDATE users 
        SET email_verified = 1, 
            email_verification_token = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND is_active = 1
      `, [userId])
      
      const success = result.changes > 0
      userServiceLogger.debug('Email verification update result:', { userId, success, changes: result.changes })
      
      return success
    } catch (error) {
      userServiceLogger.error('Error setting email as verified:', error.message)
      throw error
    }
  }

  /**
   * @brief Get role ID by name
   * 
   * @param {string} roleName - Role name (e.g., 'user')
   * @return {number|null} - Role ID or null if not found
   */
  getRoleId(roleName) {
    try {
      userServiceLogger.debug('Getting role ID for:', roleName)
      
      const result = databaseConnection.get(
        'SELECT id FROM roles WHERE name = ? LIMIT 1',
        [roleName]
      )
      
      const roleId = result?.id || null
      userServiceLogger.debug('Role ID result:', roleId)
      
      return roleId
    } catch (error) {
      userServiceLogger.error('Error getting role ID:', error.message)
      throw error
    }
  }

  /**
   * @brief Update user's online status
   * 
   * @param {number} userId - User ID
   * @param {boolean} isOnline - Online status
   * @return {void}
   */
  updateUserOnlineStatus(userId, isOnline) {
    try {
      userServiceLogger.debug('Updating user online status:', { userId, isOnline })
      
      const result = databaseConnection.run(`
        UPDATE users 
        SET is_online = ?, last_seen = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [isOnline ? 1 : 0, userId])
      
      userServiceLogger.debug('Updated user online status, rows changed:', result.changes)
    } catch (error) {
      userServiceLogger.error('Error updating user online status:', error.message)
      throw error
    }
  }

  /**
   * @brief Regenerate verification token for user
   * 
   * @param {string} email - User email
   * @return {Object|null} Object with user data and new token, or null if user not found/already verified
   */
  regenerateVerificationToken(email) {
    try {
      userServiceLogger.debug('Regenerating verification token for email:', email)
      
      // Find user by email
      const user = databaseConnection.get(`
        SELECT id, username, email, email_verified, updated_at
        FROM users 
        WHERE LOWER(email) = LOWER(?) AND is_active = 1
        LIMIT 1
      `, [email])
      
      if (!user) {
        userServiceLogger.debug('No user found with email:', email)
        return null
      }
      
      if (user.email_verified) {
        userServiceLogger.debug('Email already verified for user:', user.id)
        return { alreadyVerified: true, user }
      }
      
      // Check rate limiting: max 1 email per 5 minutes
      const lastUpdate = new Date(user.updated_at)
      const now = new Date()
      const minutesSinceLastUpdate = (now - lastUpdate) / (1000 * 60)
      
      if (minutesSinceLastUpdate < 5) {
        const waitMinutes = Math.ceil(5 - minutesSinceLastUpdate)
        userServiceLogger.debug('Rate limit hit for user:', user.id)
        return { 
          rateLimited: true, 
          waitMinutes,
          message: `Please wait ${waitMinutes} minute(s) before requesting another verification email`
        }
      }
      
      // Generate new verification token
      const newToken = generateVerificationToken()
      
      // Update user with new token
      const updateResult = databaseConnection.run(`
        UPDATE users 
        SET email_verification_token = ?, 
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [newToken, user.id])
      
      userServiceLogger.debug('Verification token regenerated, rows changed:', updateResult.changes)
      
      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        },
        verificationToken: newToken
      }
      
    } catch (error) {
      userServiceLogger.error('Error regenerating verification token:', error.message)
      throw error
    }
  }

  /***********************************/
  /* OAUTH USER MANAGEMENT METHODS   */
  /***********************************/

  /**
   * @brief Create OAuth user (no password required)
   */
  async createOAuthUser({ email, username, googleId, firstName, lastName, avatarUrl }) {
    try {
      const oauthProviders = JSON.stringify({
        google: {
          id: googleId,
          connected_at: new Date().toISOString()
        }
      })
      
      userServiceLogger.debug('Creating OAuth user', { username, email, provider: 'google' })
      
      const newUser = databaseConnection.transaction(() => {
        // Insert user
        const insertResult = databaseConnection.run(`
          INSERT INTO users (
            username, email, display_name, avatar_url, 
            email_verified, oauth_providers, is_active, is_online,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
          username,
          email.toLowerCase(),
          username,
          avatarUrl,
          1, // OAuth emails are pre-verified
          oauthProviders,
          1, // active
          0  // offline initially
        ])
        
        const userId = insertResult.lastInsertRowid
        
        // Assign default role
        const userRoleId = this.getRoleId('user')
        if (userRoleId) {
          databaseConnection.run(`
            INSERT INTO user_roles (user_id, role_id, granted_at) 
            VALUES (?, ?, CURRENT_TIMESTAMP)
          `, [userId, userRoleId])
        }
        
        // Create user stats
        databaseConnection.run(`
          INSERT INTO user_stats (
            user_id, games_played, games_won, games_lost,
            total_score, ranking, updated_at
          ) VALUES (?, 0, 0, 0, 0, 1000, CURRENT_TIMESTAMP)
        `, [userId])
        
        return {
          id: userId,
          username,
          email: email.toLowerCase(),
          email_verified: true,
          display_name: `${firstName} ${lastName}`.trim() || username,
          avatar_url: avatarUrl,
          is_active: true,
          is_online: false
        }
      })
      
      userServiceLogger.info('✅ OAuth user created', { userId: newUser.id, provider: 'google' })
      return newUser
      
    } catch (error) {
      userServiceLogger.error('❌ OAuth user creation failed', { error: error.message })
      throw new Error('Failed to create OAuth user')
    }
  }

  /**
   * @brief Update user's OAuth provider data
   */
  updateUserOAuthData(userId, provider, providerId) {
    try {
      // Get current OAuth providers
      const user = databaseConnection.get(
        'SELECT oauth_providers FROM users WHERE id = ?', 
        [userId]
      )
      
      let oauthProviders = {}
      if (user?.oauth_providers) {
        oauthProviders = JSON.parse(user.oauth_providers)
      }
      
      // Add/update provider data
      oauthProviders[provider] = {
        id: providerId,
        connected_at: new Date().toISOString()
      }
      
      // Update database
      databaseConnection.run(`
        UPDATE users 
        SET oauth_providers = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [JSON.stringify(oauthProviders), userId])
      
      userServiceLogger.debug('✅ OAuth data updated', { userId, provider })
      
    } catch (error) {
      userServiceLogger.error('❌ Failed to update OAuth data', { error: error.message })
      throw new Error('Failed to update OAuth data')
    }
  }

  /**
   * @brief Find user by Google OAuth ID from oauth_providers JSON field
   * 
   * @param {string} googleId - Google user identifier
   * @return {Object|null} User object or null if not found
   */
  findUserByGoogleId(googleId) {
    try {
      userServiceLogger.debug('Finding user by Google ID:', googleId)
      
      const user = databaseConnection.get(`
        SELECT id, username, email, display_name, avatar_url, 
              email_verified, oauth_providers, is_active, is_online,
              created_at, updated_at
        FROM users 
        WHERE JSON_EXTRACT(oauth_providers, '$.google.id') = ? 
          AND is_active = 1
        LIMIT 1
      `, [googleId])
      
      userServiceLogger.debug('User found by Google ID:', !!user)
      return user || null
      
    } catch (error) {
      userServiceLogger.error('Failed to find user by Google ID', { 
        googleId, 
        error: error.message 
      })
      throw new Error('Database error while finding user by Google ID')
    }
  }
}

export const userService = new UserService()
export default userService


// =============================================================================
// DATABASE UTILITY FUNCTIONS
// =============================================================================

/**
 * @brief Check if email exists in database (case-insensitive)
 * 
 * @param {string} email - Email to check
 * @return {boolean} - True if email exists
 */
function emailExists(email) {
  try {
    userServiceLogger.debug('Checking email existence:', email)
    
    const result = databaseConnection.get(
      'SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
      [email]
    )
    
    const exists = !!result
    userServiceLogger.debug('Email exists result:', exists)
    
    return exists
  } catch (error) {
    userServiceLogger.error('Error checking email existence:', error.message)
    throw error
  }
}

/**
 * @brief Check if username exists in database (case-insensitive)
 * 
 * @param {string} username - Username to check
 * @return {boolean} - True if username exists
 */
function usernameExists(username) {
  try {
    userServiceLogger.debug('Checking username existence:', username)
    
    const result = databaseConnection.get(
      'SELECT id FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1',
      [username]
    )
    
    const exists = !!result
    userServiceLogger.debug('Username exists result:', exists)
    
    return exists
  } catch (error) {
    userServiceLogger.error('Error checking username existence:', error.message)
    throw error
  }
}

