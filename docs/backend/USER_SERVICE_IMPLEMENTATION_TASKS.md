# UserService Implementation Tasks

**Date:** October 8, 2025  
**Context:** Actionable checklist for implementing missing UserService methods

---

## 📋 **Quick Summary**

**Current State:**
- ✅ 18 methods already exist in UserService
- ❌ Auth routes directly use `databaseConnection` (should use UserService)
- ❌ Missing 15+ methods needed for profile updates and 2FA refactoring

**Goal:**
- Move ALL database logic from routes → UserService
- Routes should only handle HTTP concerns (status codes, response formatting)
- Enable individual field updates (username, displayName, avatar, etc.)

---

## 🎯 **Phase 1: Profile Update Methods (IMMEDIATE)**

### **Task 1.1: Add `updateUsername()` Method**

**Location:** `/srcs/backend/src/services/user.service.js`

```javascript
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
          display_name = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND is_active = 1
    `, [newUsername, newUsername, userId])
    
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
```

**Test:** After adding, verify with SQL:
```sql
-- Before: username = "user123"
UPDATE users SET username = 'newuser' WHERE id = 1;
-- After: username = "newuser", display_name = "newuser"
```

---

### **Task 1.2: Add `validateUsernameFormat()` Method**

```javascript
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
```

---

### **Task 1.3: Add `updateDisplayName()` Method**

```javascript
/**
 * @brief Update display name for authenticated user
 * @param {number} userId - User ID
 * @param {string} displayName - New display name
 * @return {Object} Updated user object
 * @throws {Error} If display name is invalid
 */
updateDisplayName(userId, displayName) {
  try {
    userServiceLogger.debug('Updating display name', { userId, displayName })
    
    // 1. Validate format
    const validation = this.validateDisplayNameFormat(displayName)
    if (!validation.isValid) {
      throw new Error(`Invalid display name: ${validation.message}`)
    }
    
    // 2. Update database
    const result = databaseConnection.run(`
      UPDATE users 
      SET display_name = ?, 
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND is_active = 1
    `, [displayName, userId])
    
    if (result.changes === 0) {
      throw new Error('User not found or update failed')
    }
    
    userServiceLogger.info('✅ Display name updated', { userId, displayName })
    
    // 3. Return updated user object
    return this.getUserById(userId)
    
  } catch (error) {
    userServiceLogger.error('❌ Failed to update display name', { 
      userId, 
      error: error.message 
    })
    throw error
  }
}
```

---

### **Task 1.4: Add `validateDisplayNameFormat()` Method**

```javascript
/**
 * @brief Validate display name format
 * @param {string} displayName - Display name to validate
 * @return {Object} { isValid: boolean, message: string }
 */
validateDisplayNameFormat(displayName) {
  const maxLength = 50
  
  if (!displayName || typeof displayName !== 'string') {
    return { isValid: false, message: 'Display name is required' }
  }
  
  const trimmed = displayName.trim()
  
  if (trimmed.length === 0) {
    return { isValid: false, message: 'Display name cannot be empty' }
  }
  
  if (trimmed.length > maxLength) {
    return { 
      isValid: false, 
      message: `Display name must be at most ${maxLength} characters` 
    }
  }
  
  return { isValid: true, message: 'Valid display name' }
}
```

---

### **Task 1.5: Add `updateAvatar()` Method**

```javascript
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
```

---

## 🔐 **Phase 2: 2FA Service Methods (HIGH PRIORITY)**

### **Task 2.1: Add `get2FAStatus()` Method**

```javascript
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
```

---

### **Task 2.2: Add `store2FASetupData()` Method**

```javascript
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
```

---

### **Task 2.3: Add `get2FASetupData()` Method**

```javascript
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
```

---

### **Task 2.4: Add `enable2FA()` Method**

```javascript
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
```

---

### **Task 2.5: Add `getUserWith2FAData()` Method**

```javascript
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
```

---

### **Task 2.6: Add `disable2FA()` Method**

```javascript
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
```

---

### **Task 2.7: Add `useBackupCode()` Method**

```javascript
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
```

---

## 👥 **Phase 3: Public Profile Methods (MEDIUM PRIORITY)**

### **Task 3.1: Add `getPublicProfile()` Method**

```javascript
/**
 * @brief Get public user profile (safe for public consumption)
 * @param {number} userId - User ID
 * @return {Object|null} Public user data (no sensitive fields)
 */
getPublicProfile(userId) {
  try {
    const user = databaseConnection.get(`
      SELECT id, username, display_name, avatar_url, is_online
      FROM users 
      WHERE id = ? AND is_active = 1
      LIMIT 1
    `, [userId])
    
    return user || null
    
  } catch (error) {
    userServiceLogger.error('Failed to get public profile', { 
      userId, 
      error: error.message 
    })
    throw error
  }
}
```

---

### **Task 3.2: Add `getCompleteProfile()` Method**

```javascript
/**
 * @brief Get complete user profile for authenticated user
 * @param {number} userId - User ID
 * @return {Object|null} Complete user data (includes email, 2FA status, etc.)
 */
getCompleteProfile(userId) {
  try {
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
    
    return user || null
    
  } catch (error) {
    userServiceLogger.error('Failed to get complete profile', { 
      userId, 
      error: error.message 
    })
    throw error
  }
}
```

---

## 📝 **Implementation Checklist**

### **Phase 1: Profile Updates** ✅ Priority 1
- [x] Task 1.1: Add `updateUsername()` method
- [x] Task 1.2: Add `validateUsernameFormat()` method
- [x] Task 1.3: Add `updateDisplayName()` method // TODO display name is equal to username, do not implement unnecessary duplicated methods 
- [x] Task 1.4: Add `validateDisplayNameFormat()` method // SKIPPED - display_name not used separately
- [x] Task 1.5: Add `updateAvatar()` method
- [x] Test all Phase 1 methods with SQL queries
- [x] Update `getUserById()` to include `avatar_url` if missing

### **Phase 2: 2FA Methods** ✅ Priority 2
- [x] Task 2.1: Add `get2FAStatus()` method
- [x] Task 2.2: Add `store2FASetupData()` method
- [x] Task 2.3: Add `get2FASetupData()` method
- [x] Task 2.4: Add `enable2FA()` method
- [x] Task 2.5: Add `getUserWith2FAData()` method
- [x] Task 2.6: Add `disable2FA()` method
- [x] Task 2.7: Add `useBackupCode()` method
- [x] Refactor `2fa-setup.js` to use new methods
- [x] Refactor `2fa-verify-setup.js` to use new methods
- [x] Refactor `2fa-disable.js` to use new methods
- [x] Refactor `2fa-verify.js` to use new methods

### **Phase 3: Public Profiles** ✅ Priority 3
- [x] Task 3.1: Add `getPublicProfile()` method
- [x] Task 3.2: Add `getCompleteProfile()` method
- [x] Task 3.3: Add `searchUsersByUsername()` method (bonus)
- [x] Create route schemas for profile endpoints
- [x] Implement GET /users/me route (own profile)
- [x] Implement GET /users/:userId route (public profile)
- [x] Implement GET /users/search route (user search)
- [x] Update /routes/users/index.js to register all routes

### **Phase 4: Route Implementation** ✅ Priority 4
- [x] Create `/routes/users/check-username.js` route
- [x] Create `/routes/users/set-username.js` route
- [x] Create `/routes/users/set-avatar.js` route
- [x] Use schemas from `/schemas/routes/user.schema.js`
- [x] Register routes in `/routes/users/index.js`
- [x] Follow auth.schema.js pattern (routeUserSchemas)

### **Phase 5: Testing** ✅ Priority 5
- [ ] Test username validation (format, length, special chars)
- [ ] Test username uniqueness check
- [ ] Test username update (successful case)
- [ ] Test username update (duplicate case)
- [ ] Test all 2FA methods with real data
- [ ] Integration test: Full username selection flow
- [ ] Integration test: Full 2FA setup flow

---

## 🧪 **Testing Commands**

```bash
# Start backend
cd srcs/backend
npm start

# Test username availability
curl -X GET "https://localhost/api/users/check-username?username=testuser" \
  -H "Cookie: accessToken=YOUR_TOKEN" \
  --insecure

# Test username update
curl -X POST "https://localhost/api/users/set-username" \
  -H "Content-Type: application/json" \
  -H "Cookie: accessToken=YOUR_TOKEN" \
  -d '{"username":"newusername"}' \
  --insecure
```

---

## 📚 **Files to Modify**

1. **`/srcs/backend/src/services/user.service.js`**
   - Add all new methods from Phases 1-3

2. **`/srcs/backend/src/schemas/routes/user.schema.js`** (create if not exists)
   - Add request/response schemas for user update endpoints

3. **`/srcs/backend/src/routes/users/set-user.js`**
   - Implement using new UserService methods

4. **`/srcs/backend/src/routes/users/check-username.js`** (create)
   - Implement username availability check

5. **`/srcs/backend/src/routes/auth/2fa-*.js`** (all 4 files)
   - Refactor to use new UserService 2FA methods
   - Remove direct database access

---

## ⚠️ **Important Notes**

1. **Error Handling:** All service methods should throw descriptive errors that routes can catch and convert to HTTP errors

2. **Transaction Safety:** Complex operations (like `enable2FA`) should use transactions if they involve multiple queries

3. **Logging:** Add appropriate log statements for debugging and security auditing

4. **Validation:** Always validate input in service layer, not just in routes (defense in depth)

5. **Case Sensitivity:** Username checks should be case-insensitive but preserve original case in database

---

**Status:** Ready for implementation  
**Estimated Time:** 
- Phase 1: 2-3 hours
- Phase 2: 3-4 hours  
- Phase 3: 1-2 hours
- Phase 4: 2-3 hours
- Phase 5: 2-3 hours

**Total:** 10-15 hours
