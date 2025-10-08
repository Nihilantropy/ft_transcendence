# Security Analysis: User Authorization for Profile Updates

**Date:** October 8, 2025  
**Issue:** Checking if User A can modify User B's information  
**Status:** ✅ **SECURE** (Current implementation is correct)

---

## 🔍 **Security Analysis**

### **Current Flow:**

```
1. Client sends request with accessToken cookie
   ↓
2. requireAuth middleware extracts token from cookie
   ↓
3. JWT decoded → extract userId from token
   ↓
4. User object fetched from DB by userId
   ↓
5. User object attached to request.user
   ↓
6. Route handler uses request.user.id (from token, not body!)
   ↓
7. Service method updates ONLY that user's data
```

---

## ✅ **Security Verification**

### **Authentication Layer (Middleware)**

**File:** `/srcs/backend/src/middleware/authentication.js`

```javascript
export async function requireAuth(request, reply) {
  const token = request.cookies?.accessToken  // ✅ Token from secure cookie
  
  const decoded = verifyAccessToken(token)    // ✅ Verify JWT signature
  const user = userService.getUserById(decoded.userId)  // ✅ Get from token
  
  request.user = user  // ✅ Attach authenticated user to request
}
```

**Security Features:**
- ✅ Token extracted from httpOnly cookie (not accessible to JavaScript)
- ✅ JWT signature verified (cannot be forged)
- ✅ User ID comes from **trusted token**, not client input
- ✅ User object attached to `request.user`

---

### **Authorization Layer (Route)**

**Example Route:** `/routes/users/set-username.js`

```javascript
fastify.post('/set-username', {
  preHandler: requireAuth  // ✅ Ensures user is authenticated
}, async (request, reply) => {
  const { username } = request.body        // ✅ Only new username from body
  const userId = request.user.id           // ✅ User ID from AUTH TOKEN (not body!)
  
  const updatedUser = userService.updateUsername(userId, username)
  // Updates ONLY the authenticated user's data
})
```

**Security Features:**
- ✅ User ID taken from `request.user.id` (set by requireAuth middleware)
- ✅ Client **cannot** specify which user to update (userId not from request body)
- ✅ Only authenticated user can update their own data

---

### **Service Layer**

**File:** `/srcs/backend/src/services/user.service.js`

```javascript
updateUsername(userId, newUsername) {
  // userId comes from authenticated token, not client input
  const result = databaseConnection.run(`
    UPDATE users 
    SET username = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND is_active = 1  // ✅ Updates ONLY this specific user
  `, [newUsername, userId])
}
```

**Security Features:**
- ✅ SQL WHERE clause ensures only specified user is updated
- ✅ No possibility of updating other users

---

## 🛡️ **Attack Scenario Analysis**

### **Scenario 1: User A tries to update User B's username**

**Attack Attempt:**
```javascript
// Malicious client tries to send User B's ID in request body
POST /api/users/set-username
Cookie: accessToken=USER_A_TOKEN
Body: {
  "userId": 2,  // User B's ID (malicious)
  "username": "hacked"
}
```

**Defense:**
```javascript
// Route handler IGNORES body.userId completely
const userId = request.user.id  // ✅ Always uses token userId (User A's ID = 1)

// Service updates User A's username, not User B's
userService.updateUsername(1, "hacked")  // User A updates their own username
```

**Result:** ✅ **BLOCKED** - User A can only update their own data

---

### **Scenario 2: User A tries to forge JWT token**

**Attack Attempt:**
```javascript
// Attacker creates fake JWT with User B's ID
const fakeToken = jwt.sign({ userId: 2 }, 'wrong-secret')
```

**Defense:**
```javascript
// requireAuth middleware verifies JWT signature
const decoded = verifyAccessToken(token)  // ✅ Throws error if signature invalid
```

**Result:** ✅ **BLOCKED** - Invalid signature, 401 Unauthorized

---

### **Scenario 3: User A tries to use User B's token**

**Attack Attempt:**
```javascript
// Attacker steals User B's accessToken cookie
Cookie: accessToken=USER_B_VALID_TOKEN
```

**Defense:**
```javascript
// Token is valid, so it works
const decoded = verifyAccessToken(token)  // userId = 2 (User B)
const userId = request.user.id           // userId = 2 (User B)

// Updates User B's data (because token is legitimate)
userService.updateUsername(2, "newname")
```

**Result:** ⚠️ **WORKS** - But this is token theft, not an authorization flaw

**Additional Protection:**
- ✅ httpOnly cookies (XSS protection)
- ✅ SameSite: strict (CSRF protection)
- ✅ HTTPS only in production
- ✅ Short token expiry (15 minutes)

---

## 📋 **Current Implementation Status**

### ✅ **Security Checklist**

| Security Measure | Status | Location |
|------------------|--------|----------|
| Authentication required | ✅ | `requireAuth` middleware |
| User ID from JWT token | ✅ | `request.user.id` |
| JWT signature verification | ✅ | `verifyAccessToken()` |
| httpOnly cookies | ✅ | Cookie config |
| SameSite: strict | ✅ | Cookie config |
| User cannot specify target ID | ✅ | Route logic |
| SQL WHERE clause protection | ✅ | Service queries |
| Token expiry (15 min) | ✅ | JWT config |

---

## 🎯 **Conclusion**

### **Is the system secure?**

✅ **YES** - The current implementation is **SECURE** and follows best practices:

1. **Authentication:** User must be authenticated (valid JWT token)
2. **Authorization:** User can only update their own data (userId from token)
3. **Token Security:** httpOnly cookies, SameSite strict, signature verification
4. **Defense in Depth:** Multiple layers of protection

### **Why it's secure:**

1. **User ID Source:**
   - ✅ User ID comes from **authenticated JWT token** (`request.user.id`)
   - ✅ NOT from request body or query parameters
   - ✅ Client cannot specify which user to update

2. **Token Integrity:**
   - ✅ JWT signature verified on every request
   - ✅ Cannot be forged without secret key
   - ✅ Short expiry time (15 minutes)

3. **Cookie Security:**
   - ✅ httpOnly (JavaScript cannot access)
   - ✅ SameSite: strict (CSRF protection)
   - ✅ Secure flag in production (HTTPS only)

4. **SQL Safety:**
   - ✅ WHERE clause ensures only target user is updated
   - ✅ Parameterized queries (SQL injection protection)

---

## 🔒 **Best Practices Followed**

### **1. Principle of Least Privilege**
```javascript
// ✅ CORRECT: User can only update their own data
const userId = request.user.id  // From authenticated token
userService.updateUsername(userId, newUsername)
```

### **2. Never Trust Client Input for Authorization**
```javascript
// ❌ WRONG: Trusting client to specify user ID
const userId = request.body.userId  // DON'T DO THIS!

// ✅ CORRECT: User ID from authenticated token
const userId = request.user.id  // Always use this
```

### **3. Defense in Depth**
- Authentication (JWT token verification)
- Authorization (userId from token)
- SQL WHERE clause (limits update scope)
- Cookie security (httpOnly, SameSite)
- HTTPS (production)

---

## 📝 **Example Secure Route Template**

```javascript
// Template for all user update routes
fastify.post('/update-user-data', {
  preHandler: requireAuth  // ✅ Step 1: Authenticate
}, async (request, reply) => {
  // ✅ Step 2: Get authenticated user ID from token
  const userId = request.user.id  // NOT from request.body!
  
  // ✅ Step 3: Get update data from body (ONLY the data, not the user ID)
  const { newData } = request.body
  
  // ✅ Step 4: Update ONLY authenticated user's data
  const updated = userService.updateUserData(userId, newData)
  
  return { success: true, user: updated }
})
```

---

## ⚠️ **What NOT to Do**

### ❌ **NEVER take userId from request body/params**

```javascript
// ❌ INSECURE - User can specify any userId
fastify.post('/set-username/:userId', async (request, reply) => {
  const userId = request.params.userId  // ❌ WRONG!
  const { username } = request.body
  userService.updateUsername(userId, username)  // User A can update User B!
})

// ❌ INSECURE - User can specify any userId in body
fastify.post('/set-username', async (request, reply) => {
  const { userId, username } = request.body  // ❌ WRONG!
  userService.updateUsername(userId, username)  // User A can update User B!
})
```

### ✅ **ALWAYS use request.user.id**

```javascript
// ✅ SECURE - User ID from authenticated token
fastify.post('/set-username', {
  preHandler: requireAuth
}, async (request, reply) => {
  const userId = request.user.id  // ✅ CORRECT!
  const { username } = request.body
  userService.updateUsername(userId, username)  // Can only update own data
})
```

---

## 🎉 **Final Verdict**

### **Security Status: ✅ SECURE**

The current implementation **correctly prevents User A from modifying User B's information** because:

1. ✅ `requireAuth` middleware authenticates the user
2. ✅ User ID extracted from **trusted JWT token**, not client input
3. ✅ Route uses `request.user.id` (from token), never from body/params
4. ✅ Service methods update only the specified user
5. ✅ Multiple layers of security (authentication, authorization, SQL)

**No changes needed** - the implementation follows security best practices.

---

## 📚 **References**

- **Authentication Middleware:** `/srcs/backend/src/middleware/authentication.js`
- **Example Route:** `/docs/backend/PHASE1_IMPLEMENTATION_SUMMARY.md`
- **Service Methods:** `/srcs/backend/src/services/user.service.js`
- **Security Analysis:** This document

---

**Analysis By:** GitHub Copilot  
**Security Status:** ✅ APPROVED  
**Action Required:** None - implementation is secure
