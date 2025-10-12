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
  verifyPassword,
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
               two_factor_enabled, two_factor_secret, backup_codes,
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
        SELECT id, username, email, email_verified, avatar_url,
               two_factor_enabled, two_factor_secret, backup_codes,
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
               two_factor_enabled, two_factor_secret, backup_codes,
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
   * @brief Set password reset token for user
   * 
   * @param {string} email - User email
   * @param {string} resetToken - Password reset token
   * @return {Object|null} User object with username if found, null otherwise
   */
  setPasswordResetToken(email, resetToken) {
    try {
      userServiceLogger.debug('Setting password reset token for email:', email)
      
      // Token expires in 1 hour
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
      
      const user = databaseConnection.get(`
        SELECT id, username, email
        FROM users 
        WHERE LOWER(email) = LOWER(?) AND is_active = 1
        LIMIT 1
      `, [email])
      
      if (!user) {
        userServiceLogger.debug('No user found with email:', email)
        return null
      }
      
      databaseConnection.run(`
        UPDATE users 
        SET password_reset_token = ?,
            password_reset_expires = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [resetToken, expiresAt, user.id])
      
      userServiceLogger.debug('Password reset token set for user:', user.id)
      return user
      
    } catch (error) {
      userServiceLogger.error('Error setting password reset token:', error.message)
      throw error
    }
  }

  /**
   * @brief Reset user password with token
   * 
   * @param {string} resetToken - Password reset token
   * @param {string} newPassword - New password (plain text)
   * @return {Object|null} User object if reset successful, null otherwise
   */
  resetPasswordWithToken(resetToken, newPassword) {
    try {
      userServiceLogger.debug('Resetting password with token')
      
      const result = databaseConnection.transaction(() => {
        // Find user by reset token
        const user = databaseConnection.get(`
          SELECT id, username, email, password_reset_expires
          FROM users 
          WHERE password_reset_token = ? AND is_active = 1
          LIMIT 1
        `, [resetToken])
        
        if (!user) {
          userServiceLogger.debug('No user found with reset token')
          return null
        }
        
        // Check if token is expired
        const now = new Date().toISOString()
        if (user.password_reset_expires < now) {
          userServiceLogger.debug('Password reset token expired for user:', user.id)
          return null
        }
        
        // Hash new password
        const newPasswordHash = hashPassword(newPassword)
        
        // Update password and clear reset token
        databaseConnection.run(`
          UPDATE users 
          SET password_hash = ?,
              password_reset_token = NULL,
              password_reset_expires = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [newPasswordHash, user.id])
        
        userServiceLogger.info('Password reset successful for user:', user.id)
        return { id: user.id, username: user.username, email: user.email }
      })
      
      return result
      
    } catch (error) {
      userServiceLogger.error('Error resetting password:', error.message)
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
      // Also set email_verified = TRUE since OAuth providers verify emails
      databaseConnection.run(`
        UPDATE users 
        SET oauth_providers = ?, 
            email_verified = TRUE,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [JSON.stringify(oauthProviders), userId])
      
      userServiceLogger.debug('✅ OAuth data updated and email verified', { userId, provider })
      
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

  /***********************************/
  /* PROFILE UPDATE METHODS          */
  /***********************************/

  /**
   * @brief Validate username format (length, characters, etc.)
   * @param {string} username - Username to validate
   * @return {Object} { isValid: boolean, message: string }
   */
  validateUsernameFormat(username) {
    const minLength = 3
    const maxLength = 20
    const validPattern = /^[a-zA-Z0-9_-]+$/
    
    if (!username || typeof username !== 'string') {
      return { isValid: false, message: 'Username is required' }
    }
    
    if (username.length < minLength) {
      return { 
        isValid: false, 
        message: `Username must be at least ${minLength} characters` 
      }
    }
    
    if (username.length > maxLength) {
      return { 
        isValid: false, 
        message: `Username must be at most ${maxLength} characters` 
      }
    }
    
    if (!validPattern.test(username)) {
      return { 
        isValid: false, 
        message: 'Username can only contain letters, numbers, underscores and hyphens' 
      }
    }
    
    // Reserved usernames (optional security measure)
    const reserved = ['admin', 'root', 'system', 'api', 'null', 'undefined']
    if (reserved.includes(username.toLowerCase())) {
      return { 
        isValid: false, 
        message: 'This username is reserved' 
      }
    }
    
    return { isValid: true, message: 'Valid username' }
  }

  /**
   * @brief Update username for authenticated user
   * @param {number} userId - User ID
   * @param {string} newUsername - New username to set
   * @return {Object} Updated user object
   * @throws {Error} If username is invalid or already taken
   */
  updateUsername(userId, newUsername) {
    try {
      userServiceLogger.debug('Updating username', { userId, newUsername })
      
      // 1. Validate format
      const validation = this.validateUsernameFormat(newUsername)
      if (!validation.isValid) {
        throw new Error(`Invalid username format: ${validation.message}`)
      }
      
      // 2. Check availability (case-insensitive)
      if (this.isUsernameTaken(newUsername)) {
        throw new Error('Username is already taken')
      }
      
      // 3. Update database
      const result = databaseConnection.run(`
        UPDATE users 
        SET username = ?, 
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND is_active = 1
      `, [newUsername, userId])
      
      if (result.changes === 0) {
        throw new Error('User not found or update failed')
      }
      
      userServiceLogger.info('✅ Username updated successfully', { userId, newUsername })
      
      // 4. Return updated user object
      return this.getUserById(userId)
      
    } catch (error) {
      userServiceLogger.error('❌ Failed to update username', { 
        userId, 
        newUsername, 
        error: error.message 
      })
      throw error
    }
  }

  /**
   * @brief Update user avatar URL
   * @param {number} userId - User ID
   * @param {string} avatarUrl - New avatar URL (can be null to remove avatar)
   * @return {Object} Updated user object
   */
  updateAvatar(userId, avatarUrl) {
    try {
      userServiceLogger.debug('Updating avatar', { userId, hasAvatar: !!avatarUrl })
      
      // Update database (allow null to remove avatar)
      const result = databaseConnection.run(`
        UPDATE users 
        SET avatar_url = ?, 
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND is_active = 1
      `, [avatarUrl, userId])
      
      if (result.changes === 0) {
        throw new Error('User not found or update failed')
      }
      
      userServiceLogger.info('✅ Avatar updated', { userId })
      
      // Return updated user object
      return this.getUserById(userId)
      
    } catch (error) {
      userServiceLogger.error('❌ Failed to update avatar', { 
        userId, 
        error: error.message 
      })
      throw error
    }
  }

  /***********************************/
  /* 2FA MANAGEMENT METHODS          */
  /***********************************/

  /**
   * @brief Get 2FA status for user
   * @param {number} userId - User ID
   * @return {Object|null} { two_factor_enabled: boolean }
   */
  get2FAStatus(userId) {
    try {
      const result = databaseConnection.get(
        'SELECT two_factor_enabled FROM users WHERE id = ? AND is_active = 1',
        [userId]
      )
      return result || null
    } catch (error) {
      userServiceLogger.error('Failed to get 2FA status', { userId, error: error.message })
      throw error
    }
  }

  /**
   * @brief Store temporary 2FA setup data in _tmp columns
   * @param {number} userId - User ID
   * @param {string} secret - TOTP secret (base32)
   * @param {string[]} backupCodes - Array of backup codes
   * @return {boolean} Success status
   */
  store2FASetupData(userId, secret, backupCodes) {
    try {
      userServiceLogger.debug('Storing 2FA setup data', { userId })
      
      const result = databaseConnection.run(`
        UPDATE users 
        SET 
          two_factor_secret_tmp = ?,
          backup_codes_tmp = ?
        WHERE id = ? AND is_active = 1
      `, [secret, JSON.stringify(backupCodes), userId])
      
      return result.changes > 0
      
    } catch (error) {
      userServiceLogger.error('Failed to store 2FA setup data', { 
        userId, 
        error: error.message 
      })
      throw error
    }
  }

  /**
   * @brief Get temporary 2FA setup data for verification
   * @param {number} userId - User ID
   * @return {Object|null} { two_factor_secret_tmp, backup_codes_tmp, two_factor_enabled }
   */
  get2FASetupData(userId) {
    try {
      const result = databaseConnection.get(`
        SELECT two_factor_secret_tmp, backup_codes_tmp, two_factor_enabled 
        FROM users 
        WHERE id = ? AND is_active = 1
      `, [userId])
      
      return result || null
      
    } catch (error) {
      userServiceLogger.error('Failed to get 2FA setup data', { 
        userId, 
        error: error.message 
      })
      throw error
    }
  }

  /**
   * @brief Enable 2FA by moving _tmp data to permanent columns
   * @param {number} userId - User ID
   * @return {Object} Updated user object
   * @throws {Error} If no setup data in _tmp columns
   */
  enable2FA(userId) {
    try {
      userServiceLogger.debug('Enabling 2FA', { userId })
      
      // Verify _tmp data exists
      const setupData = this.get2FASetupData(userId)
      if (!setupData || !setupData.two_factor_secret_tmp) {
        throw new Error('No 2FA setup in progress')
      }
      
      // Move temporary data to permanent columns
      const result = databaseConnection.run(`
        UPDATE users 
        SET 
          two_factor_enabled = 1,
          two_factor_secret = two_factor_secret_tmp,
          backup_codes = backup_codes_tmp,
          two_factor_secret_tmp = NULL,
          backup_codes_tmp = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND is_active = 1
      `, [userId])
      
      if (result.changes === 0) {
        throw new Error('Failed to enable 2FA')
      }
      
      userServiceLogger.info('✅ 2FA enabled successfully', { userId })
      
      // Return updated user object
      return this.getUserById(userId)
      
    } catch (error) {
      userServiceLogger.error('❌ Failed to enable 2FA', { 
        userId, 
        error: error.message 
      })
      throw error
    }
  }

  /**
   * @brief Get user with complete 2FA data (secrets and backup codes)
   * @param {number} userId - User ID
   * @return {Object|null} User object with 2FA fields
   */
  getUserWith2FAData(userId) {
    try {
      const user = databaseConnection.get(`
        SELECT id, username, email, password_hash, email_verified,
               two_factor_enabled, two_factor_secret, backup_codes,
               is_active, is_online
        FROM users 
        WHERE id = ? AND is_active = 1
        LIMIT 1
      `, [userId])
      
      return user || null
      
    } catch (error) {
      userServiceLogger.error('Failed to get user with 2FA data', { 
        userId, 
        error: error.message 
      })
      throw error
    }
  }

  /**
   * @brief Disable 2FA and clear all 2FA data
   * @param {number} userId - User ID
   * @return {Object} Updated user object
   */
  disable2FA(userId) {
    try {
      userServiceLogger.debug('Disabling 2FA', { userId })
      
      const result = databaseConnection.run(`
        UPDATE users 
        SET 
          two_factor_enabled = 0,
          two_factor_secret = NULL,
          two_factor_secret_tmp = NULL,
          backup_codes = NULL,
          backup_codes_tmp = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND is_active = 1
      `, [userId])
      
      if (result.changes === 0) {
        throw new Error('User not found or 2FA disable failed')
      }
      
      userServiceLogger.info('✅ 2FA disabled successfully', { userId })
      
      // Return updated user object
      return this.getUserById(userId)
      
    } catch (error) {
      userServiceLogger.error('❌ Failed to disable 2FA', { 
        userId, 
        error: error.message 
      })
      throw error
    }
  }

  /**
   * @brief Use (remove) a backup code after successful verification
   * @param {number} userId - User ID
   * @param {string} backupCode - The backup code that was used
   * @return {boolean} Success status
   */
  useBackupCode(userId, backupCode) {
    try {
      userServiceLogger.debug('Using backup code', { userId })
      
      // Get current backup codes
      const user = this.getUserWith2FAData(userId)
      if (!user || !user.backup_codes) {
        throw new Error('No backup codes found for user')
      }
      
      // Parse and remove used code
      const backupCodes = JSON.parse(user.backup_codes)
      const updatedCodes = backupCodes.filter(
        code => code !== backupCode.toUpperCase()
      )
      
      // Update database
      const result = databaseConnection.run(`
        UPDATE users 
        SET backup_codes = ?, 
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND is_active = 1
      `, [JSON.stringify(updatedCodes), userId])
      
      const success = result.changes > 0
      
      if (success) {
        userServiceLogger.info('✅ Backup code used', { 
          userId, 
          remainingCodes: updatedCodes.length 
        })
      }
      
      return success
      
    } catch (error) {
      userServiceLogger.error('❌ Failed to use backup code', { 
        userId, 
        error: error.message 
      })
      throw error
    }
  }

  /***********************************/
  /* PUBLIC PROFILE METHODS          */
  /***********************************/

  /**
   * @brief Get public user profile (safe for public consumption)
   * @param {number} userId - User ID
   * @return {Object|null} Public user data (no sensitive fields)
   * 
   * @description Returns only non-sensitive user information suitable for public display:
   * - id, username, display_name, avatar_url, is_online
   * - Does NOT include: email, password, 2FA data, verification tokens
   */
  getPublicProfile(userId) {
    try {
      userServiceLogger.debug('Getting public profile', { userId })
      
      const user = databaseConnection.get(`
        SELECT id, username, display_name, avatar_url, is_online, created_at
        FROM users 
        WHERE id = ? AND is_active = 1
        LIMIT 1
      `, [userId])
      
      if (!user) {
        userServiceLogger.debug('User not found for public profile', { userId })
        return null
      }
      
      userServiceLogger.debug('✅ Public profile retrieved', { userId })
      return user
      
    } catch (error) {
      userServiceLogger.error('❌ Failed to get public profile', { 
        userId, 
        error: error.message 
      })
      throw error
    }
  }

  /**
   * @brief Get complete user profile for authenticated user
   * @param {number} userId - User ID
   * @return {Object|null} Complete user data (includes email, 2FA status, etc.)
   * 
   * @description Returns full user profile including private fields:
   * - All public fields (id, username, display_name, avatar_url, is_online)
   * - Private fields (email, email_verified, two_factor_enabled)
   * - Metadata (created_at, updated_at, last_seen)
   * - Does NOT include: passwords, secrets, tokens
   * 
   * @note Use this ONLY for authenticated users viewing their own profile
   */
  getCompleteProfile(userId) {
    try {
      userServiceLogger.debug('Getting complete profile', { userId })
      
      const user = databaseConnection.get(`
        SELECT 
          id, username, email, email_verified,
          display_name, avatar_url,
          two_factor_enabled, is_online, last_seen,
          created_at, updated_at
        FROM users 
        WHERE id = ? AND is_active = 1
        LIMIT 1
      `, [userId])
      
      if (!user) {
        userServiceLogger.debug('User not found for complete profile', { userId })
        return null
      }
      
      userServiceLogger.debug('✅ Complete profile retrieved', { userId })
      return user
      
    } catch (error) {
      userServiceLogger.error('❌ Failed to get complete profile', { 
        userId, 
        error: error.message 
      })
      throw error
    }
  }

  /**
   * @brief Search users by username (public profiles only)
   * @param {string} searchQuery - Search term (partial username match)
   * @param {number} limit - Maximum results to return (default: 10)
   * @return {Array<Object>} Array of public user profiles
   * 
   * @description Case-insensitive partial match on username
   * Returns public profile data only (no sensitive fields)
   */
  searchUsersByUsername(searchQuery, limit = 10) {
    try {
      userServiceLogger.debug('Searching users', { searchQuery, limit })
      
      if (!searchQuery || searchQuery.trim().length === 0) {
        return []
      }
      
      const users = databaseConnection.all(`
        SELECT id, username, display_name, avatar_url, is_online
        FROM users 
        WHERE LOWER(username) LIKE LOWER(?) AND is_active = 1
        ORDER BY username ASC
        LIMIT ?
      `, [`%${searchQuery}%`, limit])
      
      userServiceLogger.debug('✅ User search completed', { 
        query: searchQuery, 
        resultsCount: users.length 
      })
      
      return users
      
    } catch (error) {
      userServiceLogger.error('❌ User search failed', { 
        searchQuery, 
        error: error.message 
      })
      throw error
    }
  }

  /**
   * @brief Delete user account (soft delete)
   * @param {number} userId - User ID to delete
   * @param {string} password - User's password for verification
   * @return {boolean} True if deletion successful
   * 
   * @description Performs soft deletion by:
   * - Verifying password matches
   * - Setting is_active = 0 (soft delete)
   * - Clearing sensitive data (2FA secrets)
   * - Setting is_online = 0
   * 
   * @throws {Error} If user not found, password incorrect, or deletion fails
   */
  deleteUser(userId, password) {
    try {
      userServiceLogger.debug('Attempting to delete user account', { userId })
      
      // Get user with password for verification
      const user = databaseConnection.get(`
        SELECT id, username, password
        FROM users 
        WHERE id = ? AND is_active = 1
        LIMIT 1
      `, [userId])
      
      if (!user) {
        userServiceLogger.debug('User not found for deletion', { userId })
        throw new Error('User not found')
      }
      
      // Verify password
      const passwordMatches = verifyPassword(password, user.password)
      if (!passwordMatches) {
        userServiceLogger.debug('Password verification failed for deletion', { userId })
        throw new Error('Invalid password')
      }
      
      // Perform soft deletion
      const result = databaseConnection.run(`
        UPDATE users 
        SET 
          is_active = 0,
          is_online = 0,
          two_factor_secret = NULL,
          two_factor_backup_codes = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [userId])
      
      if (result.changes === 0) {
        userServiceLogger.error('Failed to delete user - no changes made', { userId })
        throw new Error('Failed to delete user account')
      }
      
      userServiceLogger.info('✅ User account deleted successfully', { 
        userId, 
        username: user.username 
      })
      
      return true
      
    } catch (error) {
      userServiceLogger.error('❌ Failed to delete user account', { 
        userId, 
        error: error.message 
      })
      throw error
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

