# Phase 4: Quick Reference

**3 New User Profile Update Routes**

---

## Routes Overview

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/users/check-username` | GET | Optional | Check username availability |
| `/users/set-username` | POST | Required | Update username |
| `/users/set-avatar` | POST | Required | Update avatar URL |

---

## 1. Check Username Availability

### Endpoint
```
GET /api/users/check-username?username=testuser
```

### Response
```json
{
  "available": true,
  "message": "Username is available"
}
```

### Use Case
- Username selection during registration
- Real-time validation on profile edit form
- Check before attempting update

---

## 2. Update Username

### Endpoint
```
POST /api/users/set-username
Content-Type: application/json
Cookie: accessToken=...
```

### Request
```json
{
  "username": "newusername"
}
```

### Response
```json
{
  "success": true,
  "message": "Username updated successfully",
  "user": {
    "id": 1,
    "username": "newusername",
    "email": "user@example.com",
    "displayName": "newusername",
    "avatar": null,
    "emailVerified": true,
    "twoFactorEnabled": false,
    "isOnline": true,
    "createdAt": "2025-10-08T10:00:00Z",
    "updatedAt": "2025-10-08T10:30:00Z"
  }
}
```

### Errors
- 400: Invalid format
- 401: Not authenticated
- 409: Username already taken

---

## 3. Update Avatar

### Endpoint
```
POST /api/users/set-avatar
Content-Type: application/json
Cookie: accessToken=...
```

### Request
```json
{
  "avatarUrl": "https://example.com/avatar.jpg"
}
```

### Remove Avatar
```json
{
  "avatarUrl": null
}
```

### Response
```json
{
  "success": true,
  "message": "Avatar updated successfully",
  "user": { /* complete profile */ }
}
```

---

## Testing

### cURL Examples

```bash
# Check username
curl "https://localhost/api/users/check-username?username=newuser" --insecure

# Update username
curl -X POST "https://localhost/api/users/set-username" \
  -H "Content-Type: application/json" \
  -H "Cookie: accessToken=YOUR_TOKEN" \
  -d '{"username":"newusername"}' \
  --insecure

# Set avatar
curl -X POST "https://localhost/api/users/set-avatar" \
  -H "Content-Type: application/json" \
  -H "Cookie: accessToken=YOUR_TOKEN" \
  -d '{"avatarUrl":"https://example.com/avatar.jpg"}' \
  --insecure

# Remove avatar
curl -X POST "https://localhost/api/users/set-avatar" \
  -H "Content-Type: application/json" \
  -H "Cookie: accessToken=YOUR_TOKEN" \
  -d '{"avatarUrl":null}' \
  --insecure
```

---

## Validation Rules

### Username
- ✅ Length: 3-20 characters
- ✅ Characters: a-z, A-Z, 0-9, underscore, hyphen
- ✅ Unique: Case-insensitive check
- ❌ Reserved: admin, root, system, api, etc.

### Avatar URL
- ✅ Valid URI format or null
- ✅ Max length: 500 characters
- ✅ HTTPS recommended (not enforced)

---

## Schema References

All routes use centralized schemas:

```javascript
import { routeUserSchemas } from '../../schemas/index.js'

// Check username
schema: routeUserSchemas.checkUsername

// Update username
schema: routeUserSchemas.updateUsername

// Update avatar
schema: routeUserSchemas.updateAvatar
```

---

## Service Methods

```javascript
import { userService } from '../../services/user.service.js'

// Validate format
userService.validateUsernameFormat(username)

// Check if taken
userService.isUsernameTaken(username)

// Update username
userService.updateUsername(userId, username)

// Update avatar
userService.updateAvatar(userId, avatarUrl)
```

---

## Files

- `/routes/users/check-username.js`
- `/routes/users/set-username.js`
- `/routes/users/set-avatar.js`
- `/routes/users/index.js` (updated)

---

## Status

✅ All routes implemented  
✅ All routes registered  
✅ 0 syntax errors  
✅ Pattern consistent with auth routes  
✅ Ready for testing
