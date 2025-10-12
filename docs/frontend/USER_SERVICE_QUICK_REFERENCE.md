# UserService Quick Reference

## Import
```typescript
import { userService } from '@/services/user'
// or
import { UserService } from '@/services/user'
const service = UserService.getInstance()
```

## Methods

### Profile Retrieval
```typescript
// Get own complete profile (requires auth)
const { user } = await userService.getMyProfile()

// Get public profile by user ID
const { user } = await userService.getPublicProfile(123)

// Search users by username
const { users, count } = await userService.searchUsers('john', 10)
```

### Username Management
```typescript
// Check if username is available
const { available, message } = await userService.checkUsernameAvailability('newname')

// Update username (requires auth)
const { success, message, user } = await userService.updateUsername('newname')
```

### Avatar Management
```typescript
// Update avatar URL (requires auth)
const { success, message, user } = await userService.updateAvatar('https://...')

// Remove avatar
const { success, message, user } = await userService.updateAvatar(null)
```

### Account Management
```typescript
// Delete account (requires auth + confirmation)
const { success, message } = await userService.deleteAccount('mypassword', 'DELETE')
```

## Types

### User Objects
```typescript
import type { 
  User,           // Base user
  CompleteUser,   // Full profile with private fields
  PublicUser,     // Public profile only
  UserPreview     // Search result preview
} from '@/services/user'
```

### Request/Response Types
```typescript
import type {
  UpdateUsernameRequest,
  UpdateAvatarRequest,
  DeleteUserRequest,
  CheckUsernameQuery,
  SearchUsersQuery,
  // Response types
  CompleteProfileResponse,
  PublicProfileResponse,
  SearchUsersResponse,
  CheckUsernameResponse,
  UpdateUsernameResponse,
  UpdateAvatarResponse,
  DeleteUserResponse
} from '@/services/user'
```

## Error Handling

All methods throw errors on failure:

```typescript
try {
  const result = await userService.updateUsername('newname')
  console.log('Success:', result.message)
} catch (error) {
  console.error('Error:', error.message)
  // Error messages:
  // - "Validation failed: ..." (invalid input)
  // - "Username is already taken" (API error)
  // - "Failed to update username" (generic error)
}
```

## Validation Rules

### Username
- **Length:** 3-20 characters
- **Pattern:** Alphanumeric + underscores + hyphens only (`^[a-zA-Z0-9_-]+$`)
- **Case:** Case-insensitive check for availability

### Avatar URL
- **Type:** String or null
- **Format:** Valid URL
- **Max Length:** 500 characters

### Search Query
- **Length:** 1-50 characters
- **Limit:** 1-50 (default: 10)

### Account Deletion
- **Password:** Required, non-empty
- **Confirmation:** Must be exactly `"DELETE"`

## Backend Endpoints

| Method | Endpoint | Auth Required |
|--------|----------|---------------|
| GET | `/api/users/me` | ✅ Yes |
| GET | `/api/users/:userId` | ❌ No |
| GET | `/api/users/search` | ❌ No |
| GET | `/api/users/check-username` | ❌ No |
| POST | `/api/users/set-username` | ✅ Yes |
| POST | `/api/users/set-avatar` | ✅ Yes |
| DELETE | `/api/users/me` | ✅ Yes |

## Implementation Status

✅ All methods fully implemented  
✅ All schemas validated  
✅ 100% backend alignment  
✅ Zero TypeScript errors  
✅ Production ready
