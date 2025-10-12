# Password Reset - Quick Reference

## 🚀 API Endpoints

### Forgot Password
```
POST /api/auth/forgot-password
Rate Limit: 3 per 15 minutes

Request:
{
  "email": "user@example.com"
}

Response (200):
{
  "success": true,
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

### Reset Password
```
POST /api/auth/reset-password
Rate Limit: 5 per 15 minutes

Request:
{
  "token": "64_hex_char_token",
  "newPassword": "NewSecurePass123!",
  "confirmPassword": "NewSecurePass123!"
}

Response (200):
{
  "success": true,
  "message": "Password reset successful. You can now login with your new password."
}

Response (400 - Mismatch):
{
  "success": false,
  "message": "Passwords do not match"
}

Response (401 - Invalid Token):
{
  "success": false,
  "message": "Invalid or expired reset token"
}
```

---

## 🔧 User Service Methods

```javascript
// Set password reset token
const user = userService.setPasswordResetToken(email, resetToken)
// Returns: { id, username, email } or null

// Reset password with token
const user = userService.resetPasswordWithToken(resetToken, newPassword)
// Returns: { id, username, email } or null
```

---

## 📧 Email Service Method

```javascript
// Send password reset email
const sent = await emailService.sendPasswordResetEmail({
  email: 'user@example.com',
  username: 'john_doe',
  resetToken: 'abc123...def456'
})
// Returns: boolean
```

---

## 🔒 Security Features

- ✅ **Token expiration**: 1 hour
- ✅ **Secure generation**: crypto.randomBytes(32)
- ✅ **No enumeration**: Always returns success
- ✅ **Rate limiting**: Prevents brute force
- ✅ **Token cleanup**: Cleared after use
- ✅ **Password hashing**: bcrypt

---

## 🧪 Quick Test

```bash
# 1. Request reset
curl -X POST https://localhost/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# 2. Check console for token

# 3. Reset password
curl -X POST https://localhost/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_TOKEN_HERE",
    "newPassword": "NewPass123!",
    "confirmPassword": "NewPass123!"
  }'
```

---

## 📊 Database Fields

```sql
password_reset_token TEXT,        -- 64 hex chars
password_reset_expires DATETIME   -- ISO8601 timestamp
```

---

## 🎯 Frontend URLs

- Email link: `https://localhost/reset-password?token={token}`
- Forgot password page: `https://localhost/forgot-password`

---

## ⚡ Common Issues

### "Invalid or expired reset token"
- Token expired (>1 hour old)
- Token already used
- Token doesn't exist in database

### "Passwords do not match"
- newPassword !== confirmPassword

### Rate limit exceeded
- Too many requests in 15 minutes
- Wait before retrying
