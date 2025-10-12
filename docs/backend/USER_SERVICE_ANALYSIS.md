# UserService Analysis & Route Architecture Guide

**Date:** October 8, 2025  
**Context:** Refactoring auth routes to use service layer instead of direct database access  
**Goal:** Separate concerns - routes handle HTTP logic, services handle database logic

---

## 📋 Current UserService Methods Inventory

### ✅ **Available Methods**

#### **1. User Lookup Methods**
```javascript
// Get user by different identifiers
getUserById(userId)              // Returns: User object | null
getUserByEmail(email)            // Returns: User object | null  
getUserByUsername(username)      // Returns: User object | null
```

#### **2. Validation Methods**
```javascript
// Check availability before creation
isEmailTaken(email)              // Returns: boolean
isUsernameTaken(username)        // Returns: boolean
```

#### **3. User Creation Methods**
```javascript
// Standard registration
createUser({ email, password, username })  // Returns: Promise<User>

// OAuth registration
createOAuthUser({ 
  email, username, googleId, 
  firstName, lastName, avatarUrl 
})                                         // Returns: Promise<User>

// Generate unique username from email
createUniqueUsername(email)                // Returns: string
```

#### **4. Authentication Methods**
```javascript
// Email verification
verifyUserEmail(verificationToken)         // Returns: User | null
setEmailVerified(userId)                   // Returns: boolean

// Token regeneration
regenerateVerificationToken(email)         // Returns: Object | null
```

#### **5. Status Management Methods**
```javascript
// Online/offline status
updateUserOnlineStatus(userId, isOnline)   // Returns: void
```

#### **6. OAuth Methods**
```javascript
// OAuth integration
findUserByGoogleId(googleId)               // Returns: User | null
updateUserOAuthData(userId, provider, providerId)  // Returns: void
```

#### **7. Role Management Methods**
```javascript
// Role assignment
getRoleId(roleName)                        // Returns: number | null
```

---

## 🚨 **Missing Methods (Need to Add)**

### **Critical for Username Selection Feature**

#### **1. Update Individual User Fields**
```javascript
/**
 * @brief Update username for authenticated user
 * @param {number} userId - User ID
 * @param {string} newUsername - New username to set
 * @return {Object} Updated user object
 */
updateUsername(userId, newUsername) {
  // 1. Validate username format
  // 2. Check if username is available
  // 3. Update database
  // 4. Return updated user object
}

/**
 * @brief Update user avatar URL
 * @param {number} userId - User ID
 * @param {string} avatarUrl - New avatar URL
 * @return {Object} Updated user object
 */
updateAvatar(userId, avatarUrl) {
  // Update avatar_url field
}

/**
 * @brief Update user email (requires re-verification)
 * @param {number} userId - User ID
 * @param {string} newEmail - New email address
 * @return {Object} { user, verificationToken }
 */
updateEmail(userId, newEmail) {
  // 1. Check email availability
  // 2. Set email_verified = 0
  // 3. Generate new verification token
  // 4. Update database
  // 5. Return user + token for email service
}
```

#### **2. Validation Utilities**
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
  
  if (username.length < minLength) {
    return { isValid: false, message: 'Username must be at least 3 characters' }
  }
  if (username.length > maxLength) {
    return { isValid: false, message: 'Username must be at most 20 characters' }
  }
  if (!validPattern.test(username)) {
    return { isValid: false, message: 'Username can only contain letters, numbers, underscores and hyphens' }
  }
  
  return { isValid: true, message: 'Valid username' }
}

/**
 * @brief Validate display name format
 * @param {string} displayName - Display name to validate
 * @return {Object} { isValid: boolean, message: string }
 */
validateDisplayNameFormat(displayName) {
  const maxLength = 50
  
  if (displayName.length > maxLength) {
    return { isValid: false, message: 'Display name must be at most 50 characters' }
  }
  
  return { isValid: true, message: 'Valid display name' }
}
```

#### **3. Profile Data Methods**
```javascript
/**
 * @brief Get public user profile (safe for public consumption)
 * @param {number} userId - User ID
 * @return {Object|null} Public user data (no sensitive fields)
 */
getPublicProfile(userId) {
  // Return only: id, username, avatar_url, is_online
  // Exclude: email, password_hash, tokens, 2FA data, etc.
}

/**
 * @brief Get complete user profile for authenticated user
 * @param {number} userId - User ID
 * @return {Object|null} Complete user data
 */
getCompleteProfile(userId) {
  // Return full user object including email, 2FA status, etc.
  // Used when user requests their own profile
}
```

---

## 🏗️ **Proposed Architecture Pattern**

### **Route Layer** (Handles HTTP concerns)
```javascript
// Example: /routes/users/set-username.js
async function setUsernameRoute(fastify, options) {
  fastify.post('/set-username', {
    schema: routeSchemas.setUsername,
    preHandler: requireAuth
  }, async (request, reply) => {
    try {
      const { username } = request.body
      const userId = request.user.id
      
      // ✅ ROUTE RESPONSIBILITY: HTTP logic
      // - Extract request data
      // - Call service layer
      // - Format response
      // - Handle HTTP status codes
      
      const updatedUser = await userService.updateUsername(userId, username)
      
      return {
        success: true,
        message: 'Username updated successfully',
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          email: updatedUser.email,
          email_verified: updatedUser.email_verified,
          twoFactorEnabled: updatedUser.two_factor_enabled
        }
      }
      
    } catch (error) {
      // Map service errors to HTTP errors
      if (error.message.includes('already taken')) {
        reply.status(409)
        return {
          success: false,
          message: 'Username is already taken',
          error: { code: 'USERNAME_EXISTS' }
        }
      }
      
      if (error.message.includes('invalid format')) {
        reply.status(400)
        return {
          success: false,
          message: error.message,
          error: { code: 'INVALID_USERNAME' }
        }
      }
      
      reply.status(500)
      return {
        success: false,
        message: 'Failed to update username',
        error: { code: 'UPDATE_ERROR' }
      }
    }
  })
}
```

### **Service Layer** (Handles Database concerns)
```javascript
// Example: /services/user.service.js
async updateUsername(userId, newUsername) {
  try {
    // ✅ SERVICE RESPONSIBILITY: Business logic + Database
    // - Validate input format
    // - Check business rules (uniqueness)
    // - Execute database operations
    // - Return data objects (not HTTP responses)
    
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
      SET username = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND is_active = 1
    `, [newUsername, userId])
    
    if (result.changes === 0) {
      throw new Error('User not found or update failed')
    }
    
    // 4. Return updated user object
    return this.getUserById(userId)
    
  } catch (error) {
    userServiceLogger.error('Failed to update username', { 
      userId, 
      newUsername, 
      error: error.message 
    })
    throw error
  }
}
```

---

## 📝 **Schema Validation Pattern**

### **Individual Field Updates (Recommended)**

Instead of requiring the **entire User object**, routes should accept **individual fields**:

```javascript
// ❌ BAD: Requires entire user object
{
  body: {
    type: 'object',
    properties: {
      user: { $ref: 'User' }  // Full user object required
    }
  }
}

// ✅ GOOD: Only requires the field being updated
{
  body: {
    type: 'object',
    properties: {
      username: { 
        type: 'string',
        minLength: 3,
        maxLength: 20,
        pattern: '^[a-zA-Z0-9_-]+$'
      }
    },
    required: ['username']
  }
}
```

### **Example Schemas for User Updates**

```javascript
// schemas/routes/user.schema.js
export const userRouteSchemas = {
  
  // Update username
  setUsername: {
    body: {
      type: 'object',
      properties: {
        username: { 
          type: 'string',
          minLength: 3,
          maxLength: 20,
          pattern: '^[a-zA-Z0-9_-]+$',
          description: 'New username (letters, numbers, underscores, hyphens only)'
        }
      },
      required: ['username'],
      additionalProperties: false
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          user: { $ref: 'User' }
        }
      }
    }
  },
  
  // Update display name
  setDisplayName: {
    body: {
      type: 'object',
      properties: {
        displayName: { 
          type: 'string',
          maxLength: 50,
          description: 'User display name'
        }
      },
      required: ['displayName'],
      additionalProperties: false
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          user: { $ref: 'User' }
        }
      }
    }
  },
  
  // Update avatar
  setAvatar: {
    body: {
      type: 'object',
      properties: {
        avatarUrl: { 
          type: 'string',
          format: 'uri',
          description: 'URL to user avatar image'
        }
      },
      required: ['avatarUrl'],
      additionalProperties: false
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          user: { $ref: 'User' }
        }
      }
    }
  },
  
  // Check username availability
  checkUsername: {
    querystring: {
      type: 'object',
      properties: {
        username: { type: 'string' }
      },
      required: ['username']
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          available: { type: 'boolean' },
          message: { type: 'string' }
        }
      }
    }
  }
}
```

---

## 🔧 **Methods Needed for Auth Routes Refactoring**

### **Currently in Routes, Should Move to UserService:**

#### **1. 2FA Setup Methods**
```javascript
// From: 2fa-setup.js (line 26-29)
get2FAStatus(userId) {
  // Check if 2FA is enabled for user
  // Returns: { two_factor_enabled: boolean }
}

// From: 2fa-setup.js (line 61-66)
store2FASetupData(userId, secret, backupCodes) {
  // Store temporary 2FA setup data (_tmp columns)
  // Returns: boolean (success)
}
```

#### **2. 2FA Verification Methods**
```javascript
// From: 2fa-verify-setup.js (line 26-30)
get2FASetupData(userId) {
  // Get temporary 2FA setup data for verification
  // Returns: { two_factor_secret_tmp, backup_codes_tmp, two_factor_enabled }
}

// From: 2fa-verify-setup.js (line 86-96)
enable2FA(userId) {
  // Move _tmp data to permanent columns
  // Enable 2FA
  // Returns: User object
}
```

#### **3. 2FA Disable Methods**
```javascript
// From: 2fa-disable.js (line 31-39)
getUserWith2FAData(userId) {
  // Get complete user with 2FA fields
  // Returns: User with 2FA secrets and backup codes
}

// From: 2fa-disable.js (line 118-144)
disable2FA(userId) {
  // Clear 2FA secrets and disable 2FA
  // Returns: User object
}
```

#### **4. 2FA Login Methods**
```javascript
// From: 2fa-verify.js (line 73-76)
useBackupCode(userId, backupCode) {
  // Remove used backup code from user's backup codes
  // Returns: boolean (success)
}
```

---

## 📊 **Priority Implementation Order**

### **Phase 1: Basic Profile Updates (IMMEDIATE)**
1. ✅ `updateUsername(userId, newUsername)`
2. ✅ `updateDisplayName(userId, displayName)`
3. ✅ `updateAvatar(userId, avatarUrl)`
4. ✅ `validateUsernameFormat(username)`
5. ✅ `validateDisplayNameFormat(displayName)`

### **Phase 2: 2FA Service Methods (HIGH PRIORITY)**
6. ✅ `get2FAStatus(userId)`
7. ✅ `store2FASetupData(userId, secret, backupCodes)`
8. ✅ `get2FASetupData(userId)`
9. ✅ `enable2FA(userId)`
10. ✅ `disable2FA(userId)`
11. ✅ `getUserWith2FAData(userId)`
12. ✅ `useBackupCode(userId, backupCode)`

### **Phase 3: Public Profile Methods (MEDIUM PRIORITY)**
13. ✅ `getPublicProfile(userId)`
14. ✅ `getCompleteProfile(userId)`
15. ✅ `updateEmail(userId, newEmail)` (requires email re-verification)

### **Phase 4: Advanced Features (LOW PRIORITY)**
16. ⏳ `updatePassword(userId, oldPassword, newPassword)`
17. ⏳ `deactivateAccount(userId)`
18. ⏳ `deleteAccount(userId)` (soft delete)
19. ⏳ `getUserStats(userId)` (from user_stats table)

---

## 🎯 **Username Selection Use Case**

### **Frontend Flow**
```typescript
// 1. User arrives at username selection page
// 2. Frontend shows input field with validation

// Real-time availability check (debounced)
async function checkUsernameAvailability(username: string) {
  const response = await api.get(`/api/users/check-username?username=${username}`)
  return response.data.available
}

// Submit username
async function submitUsername(username: string) {
  const response = await api.post('/api/users/set-username', { username })
  if (response.success) {
    localStorage.setItem('ft_user', JSON.stringify(response.user))
    router.navigate('/profile')
  }
}
```

### **Backend Routes Required**

#### **1. Check Username Availability**
```javascript
// GET /api/users/check-username?username=newuser
fastify.get('/check-username', {
  schema: userRouteSchemas.checkUsername
}, async (request, reply) => {
  const { username } = request.query
  
  // Validate format
  const validation = userService.validateUsernameFormat(username)
  if (!validation.isValid) {
    return {
      success: false,
      available: false,
      message: validation.message
    }
  }
  
  // Check availability
  const available = !userService.isUsernameTaken(username)
  
  return {
    success: true,
    available,
    message: available ? 'Username is available' : 'Username is already taken'
  }
})
```

#### **2. Set Username**
```javascript
// POST /api/users/set-username
// Body: { username: "newuser" }
fastify.post('/set-username', {
  schema: userRouteSchemas.setUsername,
  preHandler: requireAuth
}, async (request, reply) => {
  const { username } = request.body
  const userId = request.user.id
  
  try {
    const updatedUser = await userService.updateUsername(userId, username)
    
    return {
      success: true,
      message: 'Username updated successfully',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        email_verified: updatedUser.email_verified,
        twoFactorEnabled: updatedUser.two_factor_enabled
      }
    }
  } catch (error) {
    // Error handling (see architecture pattern above)
  }
})
```

---

## ✅ **Benefits of Service Layer Architecture**

### **1. Separation of Concerns**
- Routes: HTTP/REST concerns (request/response, status codes)
- Services: Business logic & database operations
- Clear responsibilities, easier to maintain

### **2. Reusability**
- Service methods can be called from multiple routes
- Example: `isUsernameTaken()` used by both registration and username update

### **3. Testability**
- Services can be unit tested independently
- Routes can be integration tested with mocked services

### **4. Consistency**
- Centralized validation logic (one place to update rules)
- Consistent error handling across all routes

### **5. Security**
- Database access centralized in service layer
- Easier to audit and secure (single point of control)

### **6. Maintainability**
- Changing database structure only affects service layer
- Routes remain stable even if database changes

---

## 📌 **Next Steps**

1. **Implement Missing UserService Methods** (Phase 1 priority)
   - Add `updateUsername()`, `updateDisplayName()`, `updateAvatar()`
   - Add validation helpers: `validateUsernameFormat()`, `validateDisplayNameFormat()`

2. **Create User Route Schemas**
   - Add schemas to `schemas/routes/user.schema.js`
   - Define request/response schemas for each endpoint

3. **Refactor 2FA Routes**
   - Move database logic from routes to UserService methods
   - Keep only HTTP concerns in route handlers

4. **Implement set-username Route**
   - Use new UserService methods
   - Follow architecture pattern documented above

5. **Update User Schema**
   - Ensure `user.schema.js` includes all necessary fields

---

## 📚 **References**

- Current UserService: `/srcs/backend/src/services/user.service.js`
- Current Validation: `/srcs/backend/src/middleware/validation.js`
- Auth Utils: `/srcs/backend/src/utils/auth_utils.js`
- User Schema: `/srcs/backend/src/schemas/common/user.schema.js`
- Example Route: `/srcs/backend/src/routes/users/set-user.js` (needs implementation)

---

**Status:** Documentation complete - Ready for implementation  
**Author:** GitHub Copilot  
**Review Required:** Yes (validate method signatures and business logic)
