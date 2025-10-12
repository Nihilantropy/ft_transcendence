# OAuth Link/Unlink Implementation

## 📋 Overview

Complete implementation of OAuth account linking/unlinking with:
- ✅ Link OAuth provider to existing account
- ✅ Unlink OAuth provider from account
- ✅ Prevent linking same OAuth account to multiple users
- ✅ Prevent removing last login method
- ✅ CSRF protection with state tokens
- ✅ Rate limiting
- ✅ Authentication required

---

## 🔄 Flow Diagrams

### Link OAuth Account

```
User logged in → Settings/Profile
         ↓
Click "Link Google Account"
         ↓
Frontend: GET /api/auth/oauth/google/login (with auth cookie)
         ↓
Backend generates state token
         ↓
Redirect to Google OAuth
         ↓
User authorizes on Google
         ↓
Google redirects: /callback?code=...&state=...
         ↓
Frontend: POST /api/auth/oauth/link
         Body: { provider, code, state }
         ↓
Backend validates:
  - User is authenticated (JWT cookie)
  - State token is valid
  - OAuth account not already linked elsewhere
         ↓
Backend links account:
  - Exchange code for tokens
  - Get Google profile
  - Update oauth_providers JSON
         ↓
Return updated user data
```

### Unlink OAuth Account

```
User logged in → Settings/Profile
         ↓
Click "Unlink Google Account"
         ↓
Frontend: DELETE /api/auth/oauth/unlink/google
         ↓
Backend validates:
  - User is authenticated (JWT cookie)
  - Provider is currently linked
  - User has alternative login method
    (password OR other OAuth provider)
         ↓
Backend unlinks account:
  - Remove provider from oauth_providers JSON
  - Update database
         ↓
Return updated user data
```

---

## 📁 Files Modified

### 1. **User Service** (`/srcs/backend/src/services/user.service.js`)

Added 1 new method:

```javascript
/**
 * @brief Unlink OAuth provider from user account
 * @param {number} userId - User ID
 * @param {string} provider - OAuth provider name ('google')
 * @return {Object|null} Updated user or null if provider not linked
 * @throws {Error} If no alternative login method exists
 */
unlinkOAuthProvider(userId, provider)
```

**Features:**
- ✅ Checks if provider is linked
- ✅ Ensures user has alternative login (password or other OAuth)
- ✅ Removes provider from oauth_providers JSON
- ✅ Returns updated user object

### 2. **OAuth Link Route** (`/srcs/backend/src/routes/auth/oauth-link.js`)

Implemented 2 routes:

#### Link Route
```javascript
POST /api/auth/oauth/link
Authentication: Required (JWT cookie)
Rate Limit: 5 requests per 15 minutes

Body: {
  provider: 'google',
  code: 'oauth_authorization_code',
  state: 'csrf_token'
}

Response (200):
{
  success: true,
  message: "google account linked successfully",
  user: { ... }
}
```

#### Unlink Route
```javascript
DELETE /api/auth/oauth/unlink/:provider
Authentication: Required (JWT cookie)
Rate Limit: 10 requests per 15 minutes

Response (200):
{
  success: true,
  message: "google account unlinked successfully",
  user: { ... }
}
```

---

## 🔒 Security Features

### 1. **Authentication Required**
Both routes use `requireAuth` middleware:
```javascript
preHandler: requireAuth
```

### 2. **State Token Validation**
CSRF protection via state tokens:
```javascript
const stateData = oauthStateManager.validate(state)
if (!stateData) {
  return { success: false, message: 'Invalid or expired OAuth state token' }
}
```

### 3. **Prevent Duplicate Linking**
Check if OAuth account is already linked to another user:
```javascript
const existingUser = userService.findUserByGoogleId(providerProfile.id)
if (existingUser && existingUser.id !== userId) {
  return { success: false, message: 'OAuth account already linked to another user' }
}
```

### 4. **Prevent Lockout**
Ensure user always has a way to login:
```javascript
const hasPassword = !!user.password_hash
const otherProviders = Object.keys(oauthProviders).filter(p => p !== provider)

if (!hasPassword && otherProviders.length === 0) {
  throw new Error('Cannot unlink the only login method. Please set a password first.')
}
```

### 5. **Rate Limiting**
- Link: 5 requests per 15 minutes
- Unlink: 10 requests per 15 minutes

---

## 📊 Database Structure

### oauth_providers Column (JSON)

```json
{
  "google": {
    "id": "google_user_id_12345",
    "connected_at": "2025-10-12T10:30:00.000Z"
  }
}
```

**Multiple providers example:**
```json
{
  "google": {
    "id": "google_12345",
    "connected_at": "2025-10-12T10:30:00.000Z"
  },
  "github": {
    "id": "github_67890",
    "connected_at": "2025-10-15T14:20:00.000Z"
  }
}
```

---

## 🧪 Testing Guide

### Test 1: Link OAuth Account (Success)

```bash
# 1. Login first
curl -X POST https://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier": "user@example.com", "password": "password123"}' \
  -c cookies.txt

# 2. Initiate OAuth (get state token from console)
curl https://localhost/api/auth/oauth/google/login \
  -b cookies.txt

# 3. After Google auth, link account
curl -X POST https://localhost/api/auth/oauth/link \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "provider": "google",
    "code": "oauth_code_from_google",
    "state": "state_token_from_step_2"
  }'

# Response
{
  "success": true,
  "message": "google account linked successfully",
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "user@example.com",
    ...
  }
}
```

### Test 2: Link Already Linked Account (409 Conflict)

```bash
# Try to link same Google account to different user
curl -X POST https://localhost/api/auth/oauth/link \
  -H "Content-Type: application/json" \
  -b different_user_cookies.txt \
  -d '{
    "provider": "google",
    "code": "oauth_code",
    "state": "state_token"
  }'

# Response (409)
{
  "success": false,
  "message": "This OAuth account is already linked to another user"
}
```

### Test 3: Unlink OAuth Account (Success)

```bash
# Unlink Google account
curl -X DELETE https://localhost/api/auth/oauth/unlink/google \
  -b cookies.txt

# Response (200)
{
  "success": true,
  "message": "google account unlinked successfully",
  "user": {
    "id": 1,
    "username": "johndoe",
    ...
  }
}
```

### Test 4: Unlink Last Login Method (400 Error)

```bash
# User with only OAuth, no password
curl -X DELETE https://localhost/api/auth/oauth/unlink/google \
  -b cookies.txt

# Response (400)
{
  "success": false,
  "message": "Cannot unlink the only login method. Please set a password first."
}
```

### Test 5: Unlink Non-linked Provider (404)

```bash
# Try to unlink provider that's not linked
curl -X DELETE https://localhost/api/auth/oauth/unlink/google \
  -b cookies.txt

# Response (404)
{
  "success": false,
  "message": "google account is not linked to your account"
}
```

### Test 6: Without Authentication (401)

```bash
# Try to link without being logged in
curl -X POST https://localhost/api/auth/oauth/link \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "google",
    "code": "oauth_code",
    "state": "state_token"
  }'

# Response (401)
{
  "success": false,
  "message": "Authentication required",
  "error": {
    "code": "NO_TOKEN",
    "details": "Authentication required"
  }
}
```

---

## 🔍 Error Handling

### Link Route Errors

| Status | Message | Cause |
|--------|---------|-------|
| 200 | Success | OAuth account linked successfully |
| 400 | Invalid state token | State token missing, invalid, or expired |
| 401 | Authentication required | User not logged in |
| 409 | Already linked | OAuth account linked to another user |
| 429 | Too Many Requests | Rate limit exceeded (5 per 15min) |
| 500 | Failed to link | Server error during linking |

### Unlink Route Errors

| Status | Message | Cause |
|--------|---------|-------|
| 200 | Success | OAuth account unlinked successfully |
| 400 | No alternative login | Attempting to remove only login method |
| 401 | Authentication required | User not logged in |
| 404 | Not linked | Provider is not linked to account |
| 429 | Too Many Requests | Rate limit exceeded (10 per 15min) |
| 500 | Failed to unlink | Server error during unlinking |

---

## 🎯 Frontend Integration

### Link OAuth Account

```typescript
// Frontend flow for linking
class OAuthLinkService {
  async initiateLink() {
    // 1. Open OAuth popup or redirect
    window.location.href = '/api/auth/oauth/google/login'
  }

  async completeLink(code: string, state: string) {
    // 2. Called from OAuth callback
    const response = await fetch('/api/auth/oauth/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Important: include cookies
      body: JSON.stringify({
        provider: 'google',
        code,
        state
      })
    })

    const data = await response.json()
    
    if (data.success) {
      // Update user state
      authStore.setUser(data.user)
      showMessage('Google account linked successfully!')
    } else {
      showError(data.message)
    }
  }
}
```

### Unlink OAuth Account

```typescript
async function unlinkGoogle() {
  const confirmed = confirm(
    'Are you sure you want to unlink your Google account?'
  )
  
  if (!confirmed) return

  const response = await fetch('/api/auth/oauth/unlink/google', {
    method: 'DELETE',
    credentials: 'include'
  })

  const data = await response.json()
  
  if (data.success) {
    authStore.setUser(data.user)
    showMessage('Google account unlinked successfully!')
  } else {
    showError(data.message)
  }
}
```

---

## 📱 User Interface Examples

### Settings Page - Connected Accounts

```html
<div class="connected-accounts">
  <h3>Connected Accounts</h3>
  
  <!-- Google Account -->
  <div class="account-item">
    <img src="/icons/google.svg" alt="Google">
    <span>Google</span>
    
    <!-- If linked -->
    <button onclick="unlinkGoogle()" class="btn-danger">
      Unlink
    </button>
    
    <!-- If not linked -->
    <button onclick="linkGoogle()" class="btn-primary">
      Connect
    </button>
  </div>
  
  <!-- Warning if trying to unlink last method -->
  <div class="warning" v-if="isLastLoginMethod">
    ⚠️ This is your only login method. Please set a password before unlinking.
  </div>
</div>
```

---

## 🔄 User Scenarios

### Scenario 1: Traditional User Adds OAuth
```
User registered with: email + password
User links: Google account
Result: Can login with BOTH password and Google
```

### Scenario 2: OAuth User Adds Password
```
User registered with: Google OAuth (no password)
User sets: Password via profile settings
Result: Can login with BOTH Google and password
```

### Scenario 3: Multiple OAuth Providers
```
User has: Google + GitHub OAuth
User unlinks: Google
Result: Can still login with GitHub
```

### Scenario 4: Attempted Lockout (Prevented)
```
User has: Only Google OAuth (no password)
User tries: Unlink Google
Result: Error - "Cannot unlink the only login method"
```

---

## ✅ Implementation Checklist

- [x] User service unlink method
- [x] OAuth link route with authentication
- [x] OAuth unlink route with authentication
- [x] State token validation
- [x] Duplicate linking prevention
- [x] Alternative login method check
- [x] Rate limiting (5/15min link, 10/15min unlink)
- [x] Error handling
- [x] Logging
- [x] Schema validation
- [x] Security best practices
- [x] Documentation

---

## 🚀 Next Steps (Optional Enhancements)

1. **Email Notifications**: Notify user when OAuth accounts are linked/unlinked
2. **Audit Log**: Track OAuth linking/unlinking events
3. **Multiple Providers**: Add support for GitHub, Microsoft, etc.
4. **Last Used**: Track when each OAuth provider was last used
5. **Primary Provider**: Allow user to set preferred login method
6. **Profile Sync**: Sync avatar/display name from OAuth provider

---

## 📝 Notes

- OAuth linking requires user to be authenticated (logged in)
- User must always have at least one login method (password OR OAuth)
- OAuth accounts cannot be linked to multiple users
- State tokens expire after 5 minutes for security
- Rate limiting prevents abuse
- All OAuth provider data stored in `oauth_providers` JSON column
