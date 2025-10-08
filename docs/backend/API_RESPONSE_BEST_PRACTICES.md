# API Response Best Practices - User Data

**Date:** October 8, 2025  
**Context:** Guidelines for returning user data in API responses

---

## 🎯 **Core Principle: Context-Specific Data**

> **"Only return data that is relevant to the specific operation and required by the client for that context."**

**Anti-Pattern:** ❌ Returning all user fields in every response  
**Best Practice:** ✅ Return only what's needed for each specific endpoint

---

## 📋 **Best Practices Summary**

### **1. Different Contexts Need Different Data**

| Context | Data Needed | Reasoning |
|---------|-------------|-----------|
| **Authentication** | Essential identity + session info | Client needs to display user and store session |
| **Profile View** | Complete public profile | User viewing their own profile |
| **Public Profile** | Safe public data only | Other users viewing profile |
| **Settings Update** | Confirmation of changes | Client just needs to know what changed |
| **Email Verification** | Minimal identity + verification status | Just confirm action success |

### **2. Security Through Minimal Exposure**

```javascript
// ❌ BAD: Exposing everything
{
  user: {
    id, username, email, email_verified,
    password_hash,              // 🔴 NEVER expose
    two_factor_secret,          // 🔴 NEVER expose
    backup_codes,               // 🔴 NEVER expose
    created_at, updated_at,     // ⚠️  Not needed in most contexts
    last_seen,                  // ⚠️  Privacy concern
    ip_address                  // 🔴 Privacy violation
  }
}

// ✅ GOOD: Context-appropriate
{
  user: {
    id,
    username,
    avatar,
    isOnline
  }
}
```

### **3. Consistency Across Similar Operations**

All authentication endpoints should return the same user shape:
```javascript
// Login, Register, 2FA Verify, OAuth Callback
{
  success: true,
  message: "...",
  user: {
    id,
    username,
    email,
    emailVerified,
    avatar,
    isOnline,
    twoFactorEnabled
  }
}
```

---

## 🔐 **Response Patterns by Endpoint Category**

### **Category 1: Authentication Endpoints**

**Endpoints:** `/login`, `/register`, `/2fa/verify`, `/oauth/callback`

**Purpose:** Establish user session, display user info in UI

**Required Fields:**
```javascript
{
  success: true,
  message: "Login successful",
  user: {
    id: 123,                        // ✅ For identifying user
    username: "john_doe",           // ✅ For display in UI
    email: "john@example.com",      // ✅ For email-related features
    emailVerified: true,            // ✅ For showing verification banner
    avatar: "https://...",          // ✅ For profile picture
    isOnline: true,                 // ✅ For online status indicator
    twoFactorEnabled: false         // ✅ For 2FA badge in settings
  }
}
```

**Why these fields?**
- `id` - Required for subsequent API calls
- `username` - Displayed in navbar, profile dropdown
- `email` - Shown in settings, needed for email features
- `emailVerified` - Show "Verify your email" banner if false
- `avatar` - Profile picture in UI
- `isOnline` - Status indicator
- `twoFactorEnabled` - Show 2FA badge in settings

**Fields NOT needed:**
- ❌ `created_at` - Not relevant to login
- ❌ `updated_at` - Not relevant to login
- ❌ `last_seen` - Redundant (they're online now)
- ❌ `password_hash` - NEVER expose
- ❌ `two_factor_secret` - NEVER expose

---

### **Category 2: Profile Endpoints**

#### **A. Own Profile (GET `/users/me`)**

**Purpose:** User viewing their own complete profile

```javascript
{
  success: true,
  user: {
    id: 123,
    username: "john_doe",
    email: "john@example.com",      // ✅ Own email
    emailVerified: true,            // ✅ Verification status
    avatar: "https://...",
    isOnline: true,
    twoFactorEnabled: true,         // ✅ Security settings
    createdAt: "2025-01-15",        // ✅ Account age
    stats: {                         // ✅ Game statistics
      wins: 42,
      losses: 10,
      gamesPlayed: 52
    }
  }
}
```

#### **B. Public Profile (GET `/users/:userId`)**

**Purpose:** Other users viewing someone's profile

```javascript
{
  success: true,
  user: {
    id: 123,
    username: "john_doe",
    avatar: "https://...",
    isOnline: true,
    createdAt: "2025-01-15",        // ✅ Account age
    stats: {                         // ✅ Public statistics
      wins: 42,
      losses: 10,
      gamesPlayed: 52
    }
    // ❌ NO email
    // ❌ NO emailVerified
    // ❌ NO twoFactorEnabled
  }
}
```

**Why the difference?**
- Email is private information
- 2FA status is a security detail (shouldn't be public)
- Email verification status is irrelevant to other users

---

### **Category 3: Settings Update Endpoints**

**Endpoints:** `/users/set-username`, `/users/set-avatar`, `/2fa/enable`, `/2fa/disable`

**Purpose:** Confirm the specific change that was made

```javascript
// ✅ OPTION 1: Return updated user (same as auth endpoints)
{
  success: true,
  message: "Username updated successfully",
  user: {
    id: 123,
    username: "new_username",       // ✅ Updated field
    email: "john@example.com",
    emailVerified: true,
    avatar: "https://...",
    isOnline: true,
    twoFactorEnabled: false
  }
}

// ✅ OPTION 2: Return only what changed (more efficient)
{
  success: true,
  message: "Username updated successfully",
  updated: {
    username: "new_username"        // ✅ Only changed field
  }
}
```

**Recommendation:** Use **Option 1** for consistency with auth endpoints. The client expects a full user object to update its state.

---

### **Category 4: Email Verification**

**Endpoint:** `/auth/verify-email`

**Purpose:** Confirm email was verified

```javascript
{
  success: true,
  message: "Email verified successfully",
  user: {
    id: 123,
    username: "john_doe",
    email: "john@example.com",
    emailVerified: true,            // ✅ THIS is the important change
    avatar: "https://...",
    isOnline: true,
    twoFactorEnabled: false
  }
}
```

**Why full user object?**
- Client needs to update its cached user state
- Consistent with other auth operations
- Email verification is part of auth flow

---

## 🎨 **Response Standardization**

### **Standard Auth/Profile Response Shape**

Create a helper function for consistency:

```javascript
/**
 * @brief Format user for API response (authenticated context)
 * @param {Object} user - User from database
 * @return {Object} Formatted user object
 */
function formatAuthUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    emailVerified: !!user.email_verified,
    avatar: user.avatar_url || null,
    isOnline: !!user.is_online,
    twoFactorEnabled: !!user.two_factor_enabled
  }
}

/**
 * @brief Format user for public profile
 * @param {Object} user - User from database
 * @return {Object} Formatted public user object
 */
function formatPublicUser(user) {
  return {
    id: user.id,
    username: user.username,
    avatar: user.avatar_url || null,
    isOnline: !!user.is_online,
    createdAt: user.created_at
    // NO email, NO emailVerified, NO twoFactorEnabled
  }
}

/**
 * @brief Format user for search results / lists
 * @param {Object} user - User from database
 * @return {Object} Minimal user object
 */
function formatUserPreview(user) {
  return {
    id: user.id,
    username: user.username,
    avatar: user.avatar_url || null,
    isOnline: !!user.is_online
  }
}
```

---

## 📊 **Field-by-Field Analysis**

| Field | Auth Response | Own Profile | Public Profile | User List/Search | Settings Update | Reasoning |
|-------|--------------|-------------|----------------|------------------|-----------------|-----------|
| `id` | ✅ | ✅ | ✅ | ✅ | ✅ | Always needed for identification |
| `username` | ✅ | ✅ | ✅ | ✅ | ✅ | Primary display name |
| `email` | ✅ | ✅ | ❌ | ❌ | ✅ | Private information |
| `emailVerified` | ✅ | ✅ | ❌ | ❌ | ✅ | Needed for verification banner |
| `avatar` | ✅ | ✅ | ✅ | ✅ | ✅ | Always shown in UI |
| `isOnline` | ✅ | ✅ | ✅ | ✅ | ✅ | Status indicator |
| `twoFactorEnabled` | ✅ | ✅ | ❌ | ❌ | ✅ | Security badge in settings |
| `createdAt` | ❌ | ✅ | ✅ | ❌ | ❌ | Only for profiles |
| `updatedAt` | ❌ | ❌ | ❌ | ❌ | ❌ | Internal use only |
| `lastSeen` | ❌ | ❌ | ❌ | ❌ | ❌ | Privacy concern |
| `password_hash` | 🔴 NEVER | 🔴 NEVER | 🔴 NEVER | 🔴 NEVER | 🔴 NEVER | Security risk |
| `two_factor_secret` | 🔴 NEVER | 🔴 NEVER | 🔴 NEVER | 🔴 NEVER | 🔴 NEVER | Security risk |
| `backup_codes` | 🔴 NEVER | ⚠️  Only on setup | 🔴 NEVER | 🔴 NEVER | 🔴 NEVER | Security risk |

---

## 🚨 **Common Anti-Patterns**

### **Anti-Pattern 1: Over-Exposure**
```javascript
// ❌ BAD: Returning everything from database
return {
  user: user  // All fields including sensitive data
}
```

### **Anti-Pattern 2: Inconsistent Shapes**
```javascript
// ❌ BAD: Different field names in different endpoints
// Login returns:      { user: { username, isOnline } }
// Register returns:   { user: { userName, online } }
// Profile returns:    { user: { name, status } }
```

### **Anti-Pattern 3: Unnecessary Nesting**
```javascript
// ❌ BAD: Over-nested response
{
  success: true,
  data: {
    result: {
      user: {
        profile: {
          info: {
            username: "john"
          }
        }
      }
    }
  }
}

// ✅ GOOD: Flat, clear structure
{
  success: true,
  user: {
    username: "john"
  }
}
```

### **Anti-Pattern 4: Including Redundant Data**
```javascript
// ❌ BAD: Including data client already has
POST /users/set-username { username: "new_name" }

// Returns entire user object even though client only needs confirmation
// Client already knows: id, email, avatar, etc.

// ✅ BETTER: Return only what changed OR full object for consistency
// Option 1: { updated: { username: "new_name" } }
// Option 2: { user: { ...fullUserObject } }  // For state synchronization
```

---

## 🎯 **Specific Recommendations for Your API**

### **1. Authentication Endpoints**

**Current:** Already good! ✅

```javascript
// login.js, register.js, 2fa-verify.js
return {
  success: true,
  message: "Login successful",
  user: {
    id: user.id,
    username: user.username,
    email: user.email,
    emailVerified: user.email_verified || false,
    avatar: user.avatar_url || undefined,
    isOnline: true,
    twoFactorEnabled: user.two_factor_enabled || false
  }
}
```

**Issues to Fix:**
1. ⚠️ `avatar: null` inconsistency in 2fa-disable.js (should use `user.avatar_url`)
2. ⚠️ Mix of `undefined` vs `null` for missing avatar (pick one: `null` is better)

---

### **2. 2FA Endpoints - Field Analysis**

#### **2FA Setup (POST `/2fa/setup`)**

**Current:**
```javascript
{
  success: true,
  message: "Scan QR code...",
  setupData: {
    secret: "...",
    qrCode: "...",
    backupCodes: ["..."]
  }
}
```

**Analysis:** ✅ **Perfect!** No user object needed - this is setup data only.

---

#### **2FA Verify Setup (POST `/2fa/verify-setup`)**

**Current:**
```javascript
{
  success: true,
  message: "2FA enabled",
  user: {
    id, username, email, email_verified,
    avatar: null,  // ⚠️ Should be user.avatar_url
    is_online, twoFactorEnabled
  }
}
```

**Recommendation:** ✅ User object is appropriate here (this is like re-authentication)

**Fix needed:**
```javascript
avatar: user.avatar_url || null,  // Instead of hardcoded null
```

---

#### **2FA Disable (POST `/2fa/disable`)**

**Current:**
```javascript
{
  success: true,
  message: "2FA disabled",
  user: {
    id, username, email, email_verified,
    twoFactorEnabled: false,
    avatar: null,  // ⚠️ Should be user.avatar_url
    is_online
  }
}
```

**Analysis:** ✅ User object appropriate (security action = re-auth context)

**Fix needed:**
```javascript
avatar: result.avatar_url || null,  // Instead of hardcoded null
```

---

#### **2FA Verify (POST `/2fa/verify`)**

**Current:**
```javascript
{
  success: true,
  message: "Login successful",
  user: {
    id, username, email, email_verified,
    avatar, is_online, twoFactorEnabled
  }
}
```

**Analysis:** ✅ **Perfect!** This completes login, so full auth user object is correct.

---

### **3. Email Verification**

**Question:** *"Do we need to return `email_verified` in login?"*

**Answer:** ✅ **YES** - for these reasons:

1. **UI Banner:** Client shows "Please verify your email" banner if false
2. **Feature Gating:** Some features might require verified email
3. **User Awareness:** User needs to know their verification status
4. **State Management:** Client caches this in auth state

```javascript
// In login response
{
  user: {
    emailVerified: false  // ✅ Shows banner in UI
  }
}

// UI logic:
if (!user.emailVerified) {
  showBanner("Please verify your email")
}
```

---

### **4. Avatar URL**

**Question:** *"Do we need to return `avatar` in authentication?"*

**Answer:** ✅ **YES** - but it depends on your UI

**Reasons to include:**
- Displayed in navbar immediately after login
- Shown in profile dropdown
- Used in chat/game interfaces
- Part of user's identity

**If you don't have avatars yet:**
```javascript
avatar: null  // or omit the field entirely
```

**When you add avatars:**
```javascript
avatar: user.avatar_url || null
```

---

## 📐 **Implementation Checklist**

### **Immediate Fixes Needed:**

- [ ] **2fa-verify-setup.js line 96:** Change `avatar: null` → `avatar: updatedUser.avatar_url || null`
- [ ] **2fa-disable.js line 72 & 130:** Change `avatar: null` → `avatar: user.avatar_url || null` / `avatar: result.avatar_url || null`
- [ ] **Standardize null vs undefined:** Pick `null` for missing/empty values

### **Optional Improvements:**

- [ ] Create `formatAuthUser()` helper function
- [ ] Create `formatPublicUser()` helper function  
- [ ] Create `formatUserPreview()` helper function
- [ ] Document response schemas in OpenAPI/Swagger

---

## 🎓 **Industry Best Practices**

### **1. GraphQL Approach (Not using, but learn from it)**
GraphQL lets clients specify exactly what fields they want:
```graphql
query {
  user {
    id
    username
    avatar
  }
}
```

**REST Equivalent:** Use query parameters or separate endpoints
```
GET /users/me?fields=id,username,avatar
GET /users/me/minimal
GET /users/me/full
```

### **2. API Versioning**
```
GET /v1/users/me  → Returns minimal fields
GET /v2/users/me  → Returns more fields based on lessons learned
```

### **3. Response Envelope**
```javascript
{
  success: true,        // ✅ Good: Explicit success indicator
  message: "...",       // ✅ Good: Human-readable message
  user: { ... },        // ✅ Good: Data in named field
  meta: {               // ✅ Good: Metadata separate
    timestamp: "...",
    version: "1.0"
  }
}
```

---

## 📚 **References & Further Reading**

- **Microsoft REST API Guidelines:** Return only necessary data
- **Google JSON Style Guide:** Consistent field naming (camelCase)
- **Stripe API Design:** Minimal responses with expandable fields
- **GitHub API:** Different endpoints for different detail levels

---

## ✅ **Summary: Your Current API**

### **What's Good:**
✅ Consistent user object shape across auth endpoints  
✅ Not exposing sensitive data (passwords, secrets)  
✅ Including relevant fields for auth context  
✅ Clear success/message structure

### **What Needs Fixing:**
⚠️ Hardcoded `avatar: null` instead of using actual field  
⚠️ Inconsistent handling of missing avatar (null vs undefined)

### **What to Consider:**
💡 Add `formatAuthUser()` helper for consistency  
💡 Add `formatPublicUser()` for public profiles  
💡 Document response schemas clearly  
💡 Consider pagination for list endpoints

---

## 🎯 **Final Answer to Your Question**

> **"Do we need to always return all user object fields?"**

**NO** - Follow these rules:

1. **Authentication endpoints** → Return core identity + session info (id, username, email, emailVerified, avatar, isOnline, twoFactorEnabled)

2. **Profile endpoints** → 
   - Own profile: Full data including private fields
   - Public profile: Only public data (no email, no 2FA status)

3. **Settings updates** → Return updated user object (for state sync) OR just changed fields

4. **List/Search** → Minimal preview (id, username, avatar, isOnline)

**Key Principle:** Different contexts need different data. Don't over-expose, but provide enough for the client to function.

---

**Status:** Documentation complete  
**Action Required:** Fix 3 hardcoded `avatar: null` instances  
**Recommendation:** Implement formatter helper functions
