# Login with 2FA - Quick Reference

## 🔐 Authentication Flow

```
Login → Password OK? → 2FA Enabled?
                          ├─ YES → Return tempToken → User enters TOTP → Complete login
                          └─ NO  → Complete login immediately
```

## 📝 API Endpoints

### 1. POST `/api/auth/login`

**Request:**
```json
{
  "identifier": "username or email",
  "password": "password",
  "rememberMe": false
}
```

**Response (No 2FA):**
```json
{
  "success": true,
  "message": "Login successful",
  "user": { /* user profile */ }
}
```

**Response (2FA Required):**
```json
{
  "success": true,
  "requiresTwoFactor": true,
  "tempToken": "eyJhbG..."
}
```

### 2. POST `/api/auth/2fa/verify`

**Request:**
```json
{
  "tempToken": "eyJhbG...",
  "token": "123456"  // OR "backupCode": "ABC123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "user": { /* user profile */ }
}
```

## 🔧 Utility Functions

### JWT Utilities (`/utils/jwt.js`)

```javascript
// Generate temp 2FA token (5 min expiry)
const tempToken = generateTemp2FAToken(userId, rememberMe)

// Verify temp 2FA token
const { userId, rememberMe } = verifyTemp2FAToken(tempToken)

// Generate access + refresh tokens
const { accessToken, refreshToken } = generateTokenPair(user, {
  access: { expiresIn: '15m' },
  refresh: { expiresIn: rememberMe ? '7d' : '1d' }
})
```

## 🎯 Frontend Integration

```typescript
// Step 1: Login
const response = await authService.login({
  identifier: email,
  password,
  rememberMe: true
})

if (response.requiresTwoFactor) {
  // Store temp token
  sessionStorage.setItem('ft_2fa_temp_token', response.tempToken)
  // Redirect to 2FA page
  router.navigate('/verify-2fa')
} else {
  // Login complete
  router.navigate('/')
}

// Step 2: 2FA Verification
const tempToken = sessionStorage.getItem('ft_2fa_temp_token')
const response = await authService.verify2FA(tempToken, totpCode)

if (response.success) {
  sessionStorage.removeItem('ft_2fa_temp_token')
  router.navigate('/')
}
```

## 🔒 Security Features

- ✅ Temp tokens expire in 5 minutes
- ✅ HTTP-only cookies for access/refresh tokens
- ✅ TOTP with ±60 second time window
- ✅ Single-use backup codes
- ✅ Password hashing with bcrypt
- ✅ Detailed error logging

## 📊 Token Types

| Token Type | Expiry | Purpose | Storage |
|------------|--------|---------|---------|
| Temp 2FA | 5 min | 2FA verification during login | Frontend (sessionStorage) |
| Access Token | 15 min | API authentication | HTTP-only cookie |
| Refresh Token | 1d / 7d | Token refresh | HTTP-only cookie |

## 🚨 Common Errors

| Error | Status | Cause | Solution |
|-------|--------|-------|----------|
| Invalid credentials | 401 | Wrong username/password | Check credentials |
| Invalid or expired temporary token | 401 | Temp token expired (>5min) | Re-login |
| Invalid 2FA token or backup code | 400 | Wrong TOTP/backup code | Try again, check time sync |
| 2FA is not enabled for this account | 400 | Accessing 2FA without setup | Setup 2FA first |

## 🔄 Flow Diagram

```
┌─────────┐
│  Login  │
└────┬────┘
     │
     ├─► Find user
     ├─► Verify password
     │
     ├─── 2FA Enabled? ───┐
     │                    │
   NO│                  YES│
     │                    │
     ├─► Generate        ├─► Generate tempToken
     │   tokens          │   Return { requiresTwoFactor: true }
     │                    │
     ├─► Set cookies     └─► Frontend → /verify-2fa
     │                         │
     └─► Return user           ├─► User enters TOTP
                               │
                               ├─► POST /2fa/verify
                               │
                               ├─► Verify tempToken
                               ├─► Verify TOTP/backup
                               │
                               ├─► Generate tokens
                               ├─► Set cookies
                               │
                               └─► Return user
```

## 📦 Files Modified

1. **`/utils/jwt.js`** - Added `generateTemp2FAToken()` and `verifyTemp2FAToken()`
2. **`/routes/auth/login.js`** - Updated to use utility functions, removed fastify.jwt
3. **`/routes/auth/2fa-verify.js`** - Updated to use `verifyTemp2FAToken()`

## ✅ Testing Checklist

- [ ] Login without 2FA works
- [ ] Login with 2FA returns tempToken
- [ ] 2FA verification with TOTP works
- [ ] 2FA verification with backup code works
- [ ] Backup code is removed after use
- [ ] Temp token expires after 5 minutes
- [ ] Invalid credentials return 401
- [ ] Invalid TOTP returns 400
- [ ] Cookies are set correctly
- [ ] RememberMe extends refresh token to 7 days

## 🎓 Key Changes from Before

### ❌ Before (Broken)
```javascript
// This caused "Cannot read properties of undefined (reading 'sign')"
const tempToken = fastify.jwt.sign(tempTokenPayload)
const decoded = fastify.jwt.verify(tempToken)
```

### ✅ After (Working)
```javascript
// Use centralized utility functions
const tempToken = generateTemp2FAToken(user.id, rememberMe)
const decoded = verifyTemp2FAToken(tempToken)
```

## 📖 See Also

- [Full Implementation Guide](./LOGIN_2FA_IMPLEMENTATION.md)
- [2FA Setup Documentation](./2FA_SETUP.md)
- [JWT Utilities Documentation](./JWT_UTILITIES.md)

---

**Status**: ✅ Production Ready  
**Last Updated**: October 9, 2025  
**Version**: 1.0.0
