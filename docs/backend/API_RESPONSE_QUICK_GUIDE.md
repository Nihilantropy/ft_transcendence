# API Response Best Practices - Quick Summary

**TL;DR: Context matters. Different endpoints need different data.**

---

## 🎯 **The Golden Rule**

> **"Only return data that the client needs for that specific operation."**

---

## 📊 **Quick Decision Tree**

```
Is this an authentication operation? (login, register, 2FA, email verify)
├─ YES → Use formatAuthUser()
│         Return: id, username, email, emailVerified, avatar, isOnline, twoFactorEnabled
│
└─ NO → Is user viewing their own profile?
    ├─ YES → Use formatOwnProfile()
    │         Return: All above + createdAt, updatedAt, stats
    │
    └─ NO → Is this a public profile view?
        ├─ YES → Use formatPublicUser()
        │         Return: id, username, avatar, isOnline, createdAt
        │         ❌ NO email, NO twoFactorEnabled
        │
        └─ NO → Is this a list/search result?
            └─ YES → Use formatUserPreview()
                      Return: id, username, avatar, isOnline
```

---

## ⚡ **Quick Reference Table**

| Endpoint Type | Fields to Return | Formatter |
|---------------|------------------|-----------|
| **Login** | id, username, email, emailVerified, avatar, isOnline, twoFactorEnabled | `formatAuthUser()` |
| **Register** | Same as login | `formatAuthUser()` |
| **2FA Actions** | Same as login | `formatAuthUser()` |
| **Email Verify** | Same as login | `formatAuthUser()` |
| **Own Profile** | All above + createdAt, updatedAt, stats | `formatOwnProfile()` |
| **Public Profile** | id, username, avatar, isOnline, createdAt | `formatPublicUser()` |
| **Search/List** | id, username, avatar, isOnline | `formatUserPreview()` |
| **Settings Update** | Same as login (for state sync) | `formatAuthUser()` |

---

## ✅ **Do's**

- ✅ Use consistent field names (camelCase: `emailVerified`, `isOnline`)
- ✅ Use `null` for missing values (not `undefined`)
- ✅ Include `emailVerified` in auth responses (for UI banner)
- ✅ Include `avatar` in auth responses (for navbar display)
- ✅ Include `twoFactorEnabled` in auth responses (for settings badge)
- ✅ Use formatters for consistency
- ✅ Return full user object in settings updates (for state sync)

---

## ❌ **Don'ts**

- ❌ Never expose `password_hash`
- ❌ Never expose `two_factor_secret`
- ❌ Never expose `backup_codes` (except during 2FA setup)
- ❌ Don't include email in public profiles
- ❌ Don't include 2FA status in public profiles
- ❌ Don't hardcode `avatar: null` (use actual field)
- ❌ Don't use different field names in different endpoints
- ❌ Don't return all fields in every response

---

## 🔧 **Your Specific Fixes**

### **Fix 1: 2fa-verify-setup.js (Line 90-98)**

```javascript
// ❌ Before
user: {
  id: updatedUser.id,
  username: updatedUser.username,
  email: updatedUser.email,
  email_verified: updatedUser.email_verified,
  avatar: null,  // ⚠️ WRONG: Hardcoded null
  is_online: updatedUser.is_online,
  twoFactorEnabled: updatedUser.two_factor_enabled
}

// ✅ After (Option 1: Use formatter)
user: formatAuthUser(updatedUser)

// ✅ After (Option 2: Fix manually)
user: {
  id: updatedUser.id,
  username: updatedUser.username,
  email: updatedUser.email,
  emailVerified: !!updatedUser.email_verified,
  avatar: updatedUser.avatar_url || null,  // ✅ Use actual field
  isOnline: !!updatedUser.is_online,
  twoFactorEnabled: !!updatedUser.two_factor_enabled
}
```

### **Fix 2: 2fa-disable.js (Lines 67-75 & 123-131)**

```javascript
// ❌ Before (appears twice in the file)
user: {
  id: user.id,
  username: user.username,
  email: user.email,
  email_verified: !!user.email_verified,
  twoFactorEnabled: false,
  avatar: null,  // ⚠️ WRONG: Hardcoded null
  is_online: !!user.is_online
}

// ✅ After (Option 1: Use formatter)
user: formatAuthUser(user)  // or formatAuthUser(result)

// ✅ After (Option 2: Fix manually)
user: {
  id: user.id,
  username: user.username,
  email: user.email,
  emailVerified: !!user.email_verified,
  avatar: user.avatar_url || null,  // ✅ Use actual field
  isOnline: !!user.is_online,
  twoFactorEnabled: !!user.two_factor_enabled
}
```

---

## 🛠️ **Implementation Steps**

### **Step 1: Add Formatter Import**

```javascript
import { formatAuthUser } from '../utils/user-formatters.js'
```

### **Step 2: Replace Manual Object Construction**

```javascript
// Replace this:
return {
  success: true,
  user: { /* 10 lines of manual field mapping */ }
}

// With this:
return {
  success: true,
  user: formatAuthUser(user)
}
```

### **Step 3: Test**

```bash
# Test login endpoint
curl -X POST https://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"testuser","password":"password"}' \
  --insecure

# Verify response includes:
# - id, username, email, emailVerified, avatar, isOnline, twoFactorEnabled
# - avatar should be null OR a URL (never hardcoded null when user has avatar)
```

---

## 📐 **Why These Specific Fields?**

### **Authentication Response Fields**

| Field | Why Include? |
|-------|--------------|
| `id` | Required for all API calls |
| `username` | Displayed in navbar |
| `email` | Shown in settings, needed for email features |
| `emailVerified` | Show "Verify email" banner if false |
| `avatar` | Profile picture in navbar |
| `isOnline` | Status indicator |
| `twoFactorEnabled` | Show 2FA badge in settings |

### **Public Profile Fields**

| Field | Why Include? | Why Exclude? |
|-------|--------------|--------------|
| `id` | Need to reference user | |
| `username` | Primary identifier | |
| `avatar` | Profile display | |
| `isOnline` | Status display | |
| `createdAt` | Account age | |
| `email` | | ❌ Privacy concern |
| `emailVerified` | | ❌ Irrelevant to others |
| `twoFactorEnabled` | | ❌ Security information |

---

## 🎓 **Learn From Industry**

### **Stripe API**
```javascript
// Minimal by default, expand on demand
GET /v1/customers/cus_123?expand[]=subscriptions
```

### **GitHub API**
```javascript
// Different endpoints for different detail levels
GET /users/:username           // Public data
GET /user                      // Authenticated user (more data)
GET /user/emails               // Separate endpoint for emails
```

### **Your API** (Recommended)
```javascript
GET /users/:userId             // Public data (formatPublicUser)
GET /users/me                  // Own profile (formatOwnProfile)
POST /auth/login               // Auth data (formatAuthUser)
GET /users/search              // Minimal data (formatUserPreview)
```

---

## 📝 **Testing Checklist**

- [ ] Login response includes all 7 auth fields
- [ ] Register response matches login format
- [ ] 2FA responses use actual avatar (not hardcoded null)
- [ ] Public profile excludes email
- [ ] Search results are minimal (preview format)
- [ ] Settings updates return full user (for state sync)
- [ ] No responses include password_hash
- [ ] No responses include two_factor_secret
- [ ] Field names are consistent (camelCase)
- [ ] Null vs undefined is consistent

---

## 🎯 **Answer to Your Question**

> **"Do we need to always return the full user object?"**

**NO!** Here's when to include each field:

| Field | Login | Register | 2FA | Email Verify | Own Profile | Public Profile | Search |
|-------|-------|----------|-----|--------------|-------------|----------------|--------|
| id | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| username | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| email | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| emailVerified | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| avatar | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| isOnline | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| twoFactorEnabled | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| createdAt | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| updatedAt | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| stats | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |

**Key Insight:** Auth operations need the same fields, public views need less, own profile needs more.

---

## 🚀 **Next Steps**

1. **Immediate:** Fix 3 hardcoded `avatar: null` instances
2. **Short-term:** Add formatter imports to all routes
3. **Medium-term:** Replace manual object construction with formatters
4. **Long-term:** Document API schemas in OpenAPI/Swagger

---

**Status:** Best practices documented  
**Action Required:** Apply formatters to existing routes  
**Priority:** Medium (works now, but inconsistent)
