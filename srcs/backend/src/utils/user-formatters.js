/**
 * @file User Response Formatters
 * @brief Helper functions to format user data for API responses
 * @description Provides consistent user object formatting across all endpoints
 */

/**
 * @brief Format user for authentication responses (login, register, 2FA)
 * @param {Object} user - User object from database
 * @return {Object} Formatted user object with auth-relevant fields
 * 
 * @description Used in:
 * - POST /auth/login
 * - POST /auth/register
 * - POST /auth/2fa/verify
 * - POST /auth/2fa/verify-setup
 * - POST /auth/2fa/disable
 * - POST /auth/verify-email
 * - POST /auth/oauth/callback
 */
export function formatAuthUser(user) {
  if (!user) return null
  
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    emailVerified: !!user.email_verified,
    avatar: user.avatar_base64 || null,
    isOnline: !!user.is_online,
    twoFactorEnabled: !!user.two_factor_enabled
  }
}

/**
 * @brief Format user for public profile view
 * @param {Object} user - User object from database
 * @return {Object} Public user data (no sensitive fields)
 * 
 * @description Used in:
 * - GET /users/:userId (viewing other users)
 * - GET /users/search
 * - Friend lists
 * - Game opponent info
 * 
 * @note Does NOT include:
 * - email (privacy)
 * - emailVerified (irrelevant to others)
 * - twoFactorEnabled (security concern)
 */
export function formatPublicUser(user) {
  if (!user) return null
  
  return {
    id: user.id,
    username: user.username,
    avatar: user.avatar_base64 || null,
    isOnline: !!user.is_online,
    createdAt: user.created_at || null
  }
}

/**
 * @brief Format user for own profile view
 * @param {Object} user - User object from database
 * @return {Object} Complete user data including private fields
 * 
 * @description Used in:
 * - GET /users/me
 * - GET /users/profile/complete
 * - POST /users/set-username
 * - POST /users/upload-avatar
 * 
 * @note Includes sensitive fields like email and 2FA status
 * because user is viewing their own profile
 */
export function formatOwnProfile(user) {
  if (!user) return null
  
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    emailVerified: !!user.email_verified,
    avatar: user.avatar_base64 || null,
    isOnline: !!user.is_online,
    twoFactorEnabled: !!user.two_factor_enabled,
    lastSeen: user.last_seen || null,
    createdAt: user.created_at || null,
    updatedAt: user.updated_at || null
  }
}

/**
 * @brief Format user for list/search results (minimal data)
 * @param {Object} user - User object from database
 * @return {Object} Minimal user preview
 * 
 * @description Used in:
 * - GET /users/search?q=...
 * - Friend suggestions
 * - User lists
 * - Leaderboards (with stats)
 * 
 * @note Only includes essential display fields
 */
export function formatUserPreview(user) {
  if (!user) return null
  
  return {
    id: user.id,
    username: user.username,
    avatar: user.avatar_base64 || null,
    isOnline: !!user.is_online
  }
}

/**
 * @brief Format multiple users for list responses
 * @param {Array<Object>} users - Array of user objects
 * @param {Function} formatter - Formatter function to use (default: formatUserPreview)
 * @return {Array<Object>} Array of formatted user objects
 * 
 * @example
 * const users = await userService.searchUsers('john')
 * const formatted = formatUserList(users, formatUserPreview)
 */
export function formatUserList(users, formatter = formatUserPreview) {
  if (!Array.isArray(users)) return []
  return users.map(user => formatter(user)).filter(u => u !== null)
}

/**
 * @brief Format user for settings update responses
 * @param {Object} user - Updated user object from database
 * @return {Object} Formatted user object (same as auth response)
 * 
 * @description Used in:
 * - POST /users/set-username
 * - POST /users/set-avatar
 * - POST /users/update-profile
 * 
 * @note Returns same format as formatAuthUser for consistency
 * This allows frontend to update cached auth state
 */
export function formatSettingsUpdateUser(user) {
  // Use same format as auth responses for consistency
  return formatAuthUser(user)
}

/**
 * @brief Sanitize user object by removing sensitive fields
 * @param {Object} user - User object (potentially with sensitive data)
 * @return {Object} User object without sensitive fields
 * 
 * @description Defensive function to ensure sensitive data is never exposed
 * Use this as a last resort if you're unsure which formatter to use
 * 
 * @note Removes:
 * - password_hash
 * - two_factor_secret
 * - two_factor_secret_tmp
 * - backup_codes
 * - backup_codes_tmp
 * - refresh_token
 */
export function sanitizeUser(user) {
  if (!user) return null
  
  const { 
    password_hash, 
    two_factor_secret, 
    two_factor_secret_tmp,
    backup_codes,
    backup_codes_tmp,
    refresh_token,
    ...safeUser 
  } = user
  
  return safeUser
}

/**
 * @brief Check if a field should be included based on context
 * @param {string} field - Field name
 * @param {string} context - Context (auth, public, own, preview)
 * @return {boolean} Whether field should be included
 * 
 * @description Helper for custom formatters
 */
export function shouldIncludeField(field, context) {
  const fieldRules = {
    id: ['auth', 'public', 'own', 'preview'],
    username: ['auth', 'public', 'own', 'preview'],
    email: ['auth', 'own'],
    emailVerified: ['auth', 'own'],
    avatar: ['auth', 'public', 'own', 'preview'],
    isOnline: ['auth', 'public', 'own', 'preview'],
    twoFactorEnabled: ['auth', 'own'],
    createdAt: ['public', 'own'],
    updatedAt: ['own'],
    lastSeen: [],  // Never include (privacy)
    password_hash: [],  // Never include (security)
    two_factor_secret: [],  // Never include (security)
    backup_codes: []  // Never include (security)
  }
  
  return fieldRules[field]?.includes(context) || false
}

// Export all formatters
export default {
  formatAuthUser,
  formatPublicUser,
  formatOwnProfile,
  formatUserPreview,
  formatUserList,
  formatSettingsUpdateUser,
  sanitizeUser,
  shouldIncludeField
}
