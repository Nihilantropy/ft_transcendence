# Password Reset Implementation

## 📋 Overview

Complete implementation of forgot/reset password flow with:
- ✅ Secure token generation (32 bytes = 64 hex chars)
- ✅ Token expiration (1 hour)
- ✅ Email notifications
- ✅ Rate limiting
- ✅ Schema validation
- ✅ Security best practices (no email enumeration)

---

## 🔄 Flow Diagram

```
User Forgot Password
         ↓
POST /api/auth/forgot-password { email }
         ↓
Generate reset token (crypto.randomBytes)
         ↓
Store token + expiry in database
         ↓
Send email with reset link
         ↓
Return success (always, even if email not found)
         ↓
User clicks link in email
         ↓
Frontend: /reset-password?token=...
         ↓
POST /api/auth/reset-password { token, newPassword, confirmPassword }
         ↓
Validate token (exists + not expired)
         ↓
Validate passwords match
         ↓
Hash new password
         ↓
Update password & clear token
         ↓
Return success
         ↓
User can login with new password
```

---

## 📁 Files Modified

### 1. **Schemas** (`/srcs/backend/src/schemas/routes/auth.schema.js`)

Added 4 new schemas:

```javascript
// Request schemas
ForgotPasswordRequest: {
  email: string (format: email)
}

ResetPasswordRequest: {
  token: string (32-64 chars)
  newPassword: string (8-128 chars)
  confirmPassword: string (8-128 chars)
}

// Response schemas
ForgotPasswordResponse: {
  success: boolean
  message: string
}

ResetPasswordResponse: {
  success: boolean
  message: string
}
```

### 2. **User Service** (`/srcs/backend/src/services/user.service.js`)

Added 2 new methods:

```javascript
// Set password reset token for user
setPasswordResetToken(email, resetToken)
// Returns: User object { id, username, email } or null

// Reset password using token
resetPasswordWithToken(resetToken, newPassword)
// Returns: User object { id, username, email } or null
```

### 3. **Email Service** (`/srcs/backend/src/services/email.service.js`)

Added 1 new method:

```javascript
// Send password reset email
sendPasswordResetEmail({ email, username, resetToken })
// Returns: boolean (success)
```

### 4. **Routes**

#### `forgot-password.js`
```javascript
POST /api/auth/forgot-password
Rate limit: 3 requests per 15 minutes
Body: { email }
Response: { success, message }
```

#### `reset-password.js`
```javascript
POST /api/auth/reset-password
Rate limit: 5 requests per 15 minutes
Body: { token, newPassword, confirmPassword }
Response: { success, message }
```

---

## 🔒 Security Features

### 1. **No Email Enumeration**
Always return success, even if email doesn't exist:
```javascript
// Always same response
return {
  success: true,
  message: 'If an account with that email exists, a password reset link has been sent.'
}
```

### 2. **Token Expiration**
Tokens expire after 1 hour:
```javascript
const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
```

### 3. **Secure Token Generation**
Using crypto.randomBytes for cryptographic security:
```javascript
const resetToken = crypto.randomBytes(32).toString('hex') // 64 hex chars
```

### 4. **Token Cleanup**
Reset tokens are cleared after successful password reset:
```javascript
UPDATE users 
SET password_hash = ?,
    password_reset_token = NULL,
    password_reset_expires = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ?
```

### 5. **Rate Limiting**
- Forgot password: 3 requests per 15 minutes
- Reset password: 5 requests per 15 minutes

### 6. **Password Hashing**
New passwords are hashed using bcrypt before storage:
```javascript
const newPasswordHash = hashPassword(newPassword)
```

---

## 📊 Database Schema

The following columns in the `users` table are used:

```sql
password_reset_token TEXT,        -- 64 hex chars
password_reset_expires DATETIME   -- ISO8601 timestamp
```

Existing indexes:
```sql
CREATE INDEX idx_users_password_reset ON users(password_reset_token);
```

---

## 🧪 Testing Guide

### Test 1: Forgot Password (Existing User)

```bash
# Request password reset
curl -X POST https://localhost/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }'

# Response
{
  "success": true,
  "message": "If an account with that email exists, a password reset link has been sent."
}

# Check console logs for email with reset token
```

### Test 2: Forgot Password (Non-existent User)

```bash
curl -X POST https://localhost/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nonexistent@example.com"
  }'

# Same response (security feature)
{
  "success": true,
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

### Test 3: Reset Password (Valid Token)

```bash
curl -X POST https://localhost/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "abc123...def456",
    "newPassword": "NewSecurePass123!",
    "confirmPassword": "NewSecurePass123!"
  }'

# Response
{
  "success": true,
  "message": "Password reset successful. You can now login with your new password."
}
```

### Test 4: Reset Password (Invalid Token)

```bash
curl -X POST https://localhost/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "invalid_token",
    "newPassword": "NewPass123!",
    "confirmPassword": "NewPass123!"
  }'

# Response (401)
{
  "success": false,
  "message": "Invalid or expired reset token"
}
```

### Test 5: Reset Password (Password Mismatch)

```bash
curl -X POST https://localhost/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "abc123...def456",
    "newPassword": "NewPass123!",
    "confirmPassword": "DifferentPass456!"
  }'

# Response (400)
{
  "success": false,
  "message": "Passwords do not match"
}
```

### Test 6: Rate Limiting

```bash
# Make 4 requests in quick succession
for i in {1..4}; do
  curl -X POST https://localhost/api/auth/forgot-password \
    -H "Content-Type: application/json" \
    -d '{"email": "test@example.com"}'
done

# 4th request should return 429 Too Many Requests
```

---

## 🔍 Error Handling

### Forgot Password Errors

| Status | Message | Cause |
|--------|---------|-------|
| 200 | Success message | Always returned (security) |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Error processing request | Database/email service error |

### Reset Password Errors

| Status | Message | Cause |
|--------|---------|-------|
| 200 | Password reset successful | Success |
| 400 | Passwords do not match | Password confirmation failed |
| 401 | Invalid or expired reset token | Token not found or expired |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Error resetting password | Database error |

---

## 📧 Email Templates

### Password Reset Email

**Subject:** Reset your ft_transcendence password

**Body:**
```html
<h2>Password Reset Request</h2>
<p>Hello <strong>{username}</strong>,</p>
<p>We received a request to reset your password. Click the button below to proceed:</p>
<a href="https://localhost/reset-password?token={resetToken}">Reset Password</a>
<p><small>Link expires in 1 hour. If you didn't request this, please ignore this email.</small></p>
```

---

## 🎯 Frontend Integration

### Forgot Password Page

```typescript
// POST to backend
const response = await fetch('/api/auth/forgot-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com' })
})

// Always shows success message
showMessage('If an account exists, a password reset link has been sent.')
```

### Reset Password Page

```typescript
// Get token from URL
const params = new URLSearchParams(window.location.search)
const token = params.get('token')

// POST to backend
const response = await fetch('/api/auth/reset-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token,
    newPassword: 'NewSecurePass123!',
    confirmPassword: 'NewSecurePass123!'
  })
})

if (response.ok) {
  // Redirect to login
  router.navigate('/login')
  showMessage('Password reset successful! You can now login.')
}
```

---

## ✅ Implementation Checklist

- [x] Schema validation (ForgotPasswordRequest, ResetPasswordRequest)
- [x] User service methods (setPasswordResetToken, resetPasswordWithToken)
- [x] Email service method (sendPasswordResetEmail)
- [x] Forgot password route implementation
- [x] Reset password route implementation
- [x] Rate limiting (3 per 15min, 5 per 15min)
- [x] Token expiration (1 hour)
- [x] Secure token generation (crypto.randomBytes)
- [x] Password validation (match check)
- [x] Error handling
- [x] Logging
- [x] Security best practices (no enumeration)
- [x] Database token cleanup

---

## 🚀 Next Steps (Optional Enhancements)

1. **Email Confirmation**: Send confirmation email after successful password reset
2. **Password Strength Validation**: Add stronger password requirements
3. **Login History**: Track password reset events in user history
4. **Security Alerts**: Notify user via email when password is changed
5. **Token Blacklist**: Implement token blacklist for additional security
6. **Multi-language Support**: Translate email templates

---

## 📝 Notes

- Email service supports both SMTP and console mode (for development)
- Tokens are stored in plain text (consider hashing for additional security)
- OAuth users (without passwords) can still use forgot password to set initial password
- Rate limiting prevents brute force attacks on token validation
- Always returns success to prevent email enumeration attacks
