# OAuth Link/Unlink - Quick Reference

## 🚀 API Endpoints

### Link OAuth Account
```
POST /api/auth/oauth/link
Authentication: Required (JWT cookie)
Rate Limit: 5 per 15 minutes

Request:
{
  "provider": "google",
  "code": "oauth_authorization_code",
  "state": "csrf_token"
}

Response (200):
{
  "success": true,
  "message": "google account linked successfully",
  "user": { ... }
}

Response (409 - Already Linked):
{
  "success": false,
  "message": "This OAuth account is already linked to another user"
}
```

### Unlink OAuth Account
```
DELETE /api/auth/oauth/unlink/:provider
Authentication: Required (JWT cookie)
Rate Limit: 10 per 15 minutes

Response (200):
{
  "success": true,
  "message": "google account unlinked successfully",
  "user": { ... }
}

Response (400 - No Alternative):
{
  "success": false,
  "message": "Cannot unlink the only login method. Please set a password first."
}

Response (404 - Not Linked):
{
  "success": false,
  "message": "google account is not linked to your account"
}
```

---

## 🔧 User Service Method

```javascript
// Unlink OAuth provider
const user = userService.unlinkOAuthProvider(userId, provider)
// Returns: Updated user object or null
// Throws: Error if no alternative login method
```

---

## 🔒 Security Features

- ✅ **Authentication required**: Must be logged in
- ✅ **State validation**: CSRF protection
- ✅ **No duplicate linking**: One OAuth account per user
- ✅ **Lockout prevention**: Must have alternative login method
- ✅ **Rate limiting**: 5/15min (link), 10/15min (unlink)

---

## 🧪 Quick Test

```bash
# 1. Login first
curl -X POST https://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier": "user@example.com", "password": "pass"}' \
  -c cookies.txt

# 2. Link Google account (after OAuth flow)
curl -X POST https://localhost/api/auth/oauth/link \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"provider": "google", "code": "...", "state": "..."}'

# 3. Unlink Google account
curl -X DELETE https://localhost/api/auth/oauth/unlink/google \
  -b cookies.txt
```

---

## 📊 Database Structure

```json
oauth_providers: {
  "google": {
    "id": "google_user_id",
    "connected_at": "2025-10-12T10:30:00.000Z"
  }
}
```

---

## 🎯 Frontend Usage

```typescript
// Link
await fetch('/api/auth/oauth/link', {
  method: 'POST',
  credentials: 'include',
  body: JSON.stringify({ provider: 'google', code, state })
})

// Unlink
await fetch('/api/auth/oauth/unlink/google', {
  method: 'DELETE',
  credentials: 'include'
})
```

---

## ⚡ Common Issues

### "This OAuth account is already linked to another user"
- OAuth account is already in use
- Each OAuth account can only link to one user

### "Cannot unlink the only login method"
- User has no password and only one OAuth
- Set a password first before unlinking

### "Authentication required"
- User not logged in
- JWT cookie missing or invalid

### "google account is not linked to your account"
- Trying to unlink non-existent link
- Check account settings first
