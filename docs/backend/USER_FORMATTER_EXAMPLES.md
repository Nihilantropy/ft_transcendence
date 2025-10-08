# User Formatter Usage Examples

**Helper functions for consistent API responses**

---

## 📦 **Import**

```javascript
import { 
  formatAuthUser,
  formatPublicUser,
  formatOwnProfile,
  formatUserPreview,
  formatUserList
} from '../utils/user-formatters.js'
```

---

## 🔐 **Authentication Endpoints**

### **Login Route**

```javascript
// Before
return {
  success: true,
  message: 'Login successful',
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

// After (using formatter)
return {
  success: true,
  message: 'Login successful',
  user: formatAuthUser(user)
}
```

### **Register Route**

```javascript
// After user creation
return {
  success: true,
  message: 'Registration successful',
  user: formatAuthUser(newUser)
}
```

### **2FA Verify Setup Route**

```javascript
// After enabling 2FA
const updatedUser = userService.enable2FA(userId)

return {
  success: true,
  message: '2FA has been successfully enabled',
  user: formatAuthUser(updatedUser)  // ✅ Consistent formatting
}
```

### **2FA Disable Route**

```javascript
// After disabling 2FA
const result = userService.disable2FA(userId)

return {
  success: true,
  message: '2FA successfully disabled',
  user: formatAuthUser(result)  // ✅ Consistent formatting
}
```

---

## 👤 **Profile Endpoints**

### **Get Own Profile**

```javascript
fastify.get('/users/me', {
  preHandler: requireAuth
}, async (request, reply) => {
  const user = userService.getUserById(request.user.id)
  
  return {
    success: true,
    user: formatOwnProfile(user)  // ✅ Includes email, 2FA status
  }
})
```

### **Get Public Profile**

```javascript
fastify.get('/users/:userId', async (request, reply) => {
  const user = userService.getUserById(request.params.userId)
  
  if (!user) {
    reply.status(404)
    return { success: false, message: 'User not found' }
  }
  
  return {
    success: true,
    user: formatPublicUser(user)  // ✅ No email, no 2FA status
  }
})
```

---

## 🔍 **Search & List Endpoints**

### **Search Users**

```javascript
fastify.get('/users/search', async (request, reply) => {
  const { q } = request.query
  const users = userService.searchUsers(q)
  
  return {
    success: true,
    users: formatUserList(users, formatUserPreview),  // ✅ Minimal data
    count: users.length
  }
})
```

### **Get Friends List**

```javascript
fastify.get('/friends', {
  preHandler: requireAuth
}, async (request, reply) => {
  const friends = userService.getUserFriends(request.user.id)
  
  return {
    success: true,
    friends: formatUserList(friends, formatUserPreview)  // ✅ Consistent
  }
})
```

### **Get Leaderboard**

```javascript
fastify.get('/leaderboard', async (request, reply) => {
  const topPlayers = userService.getTopPlayers(10)
  
  // Custom formatter for leaderboard (includes stats)
  const formattedPlayers = topPlayers.map(player => ({
    ...formatUserPreview(player),
    stats: {
      wins: player.wins,
      losses: player.losses,
      winRate: player.win_rate
    }
  }))
  
  return {
    success: true,
    players: formattedPlayers
  }
})
```

---

## ⚙️ **Settings Update Endpoints**

### **Update Username**

```javascript
fastify.post('/users/set-username', {
  preHandler: requireAuth
}, async (request, reply) => {
  const { username } = request.body
  const updatedUser = userService.updateUsername(request.user.id, username)
  
  return {
    success: true,
    message: 'Username updated successfully',
    user: formatAuthUser(updatedUser)  // ✅ Full auth user for state sync
  }
})
```

### **Update Avatar**

```javascript
fastify.post('/users/set-avatar', {
  preHandler: requireAuth
}, async (request, reply) => {
  const { avatarUrl } = request.body
  const updatedUser = userService.updateAvatar(request.user.id, avatarUrl)
  
  return {
    success: true,
    message: 'Avatar updated successfully',
    user: formatAuthUser(updatedUser)  // ✅ Client updates cached state
  }
})
```

---

## 🎮 **Game/Chat Endpoints**

### **Get Game Opponent Info**

```javascript
fastify.get('/games/:gameId/opponent', {
  preHandler: requireAuth
}, async (request, reply) => {
  const game = gameService.getGame(request.params.gameId)
  const opponentId = game.player1_id === request.user.id 
    ? game.player2_id 
    : game.player1_id
  
  const opponent = userService.getUserById(opponentId)
  
  return {
    success: true,
    opponent: formatPublicUser(opponent)  // ✅ Public data only
  }
})
```

### **Get Chat Participants**

```javascript
fastify.get('/chat/:chatId/participants', {
  preHandler: requireAuth
}, async (request, reply) => {
  const participants = chatService.getChatParticipants(request.params.chatId)
  
  return {
    success: true,
    participants: formatUserList(participants, formatUserPreview)
  }
})
```

---

## 🛡️ **Defensive Formatting**

### **Using sanitizeUser as Fallback**

```javascript
import { sanitizeUser } from '../utils/user-formatters.js'

// If you're unsure which formatter to use, sanitize at minimum
fastify.get('/users/debug/:userId', {
  preHandler: requireAuth
}, async (request, reply) => {
  const user = userService.getUserWith2FAData(request.params.userId)
  
  // This removes password_hash, secrets, backup_codes, etc.
  return {
    success: true,
    user: sanitizeUser(user)  // ✅ Safe, but not optimal
  }
})
```

---

## 📊 **Comparison: Before vs After**

### **Before (Manual Formatting)**

```javascript
// login.js
return {
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

// register.js
return {
  user: {
    id: user.id,
    username: user.username,
    email: user.email,
    email_verified: !!user.email_verified,  // ⚠️ Different field name
    avatar: user.avatar_url || null,        // ⚠️ Different default
    is_online: true,                        // ⚠️ Different field name
    twoFactorEnabled: user.two_factor_enabled || false
  }
}

// 2fa-disable.js
return {
  user: {
    id: result.id,
    username: result.username,
    email: result.email,
    email_verified: !!result.email_verified,
    twoFactorEnabled: false,
    avatar: null,  // ⚠️ Hardcoded null instead of actual value
    is_online: !!result.is_online
  }
}
```

**Issues:**
- ❌ Inconsistent field names (emailVerified vs email_verified)
- ❌ Inconsistent defaults (undefined vs null)
- ❌ Hardcoded null for avatar
- ❌ Manual boolean conversion scattered everywhere
- ❌ Easy to forget a field or add wrong field

---

### **After (Using Formatters)**

```javascript
// login.js
return {
  success: true,
  message: 'Login successful',
  user: formatAuthUser(user)
}

// register.js
return {
  success: true,
  message: 'Registration successful',
  user: formatAuthUser(newUser)
}

// 2fa-disable.js
return {
  success: true,
  message: '2FA successfully disabled',
  user: formatAuthUser(result)
}
```

**Benefits:**
- ✅ Consistent field names everywhere
- ✅ Consistent defaults everywhere
- ✅ Actual avatar value used (not hardcoded null)
- ✅ Boolean conversion in one place
- ✅ Can't forget fields
- ✅ Easy to update formatting globally

---

## 🔄 **Migration Guide**

### **Step 1: Import Formatter**

```javascript
import { formatAuthUser } from '../utils/user-formatters.js'
```

### **Step 2: Replace Manual Object Construction**

```diff
  return {
    success: true,
    message: 'Login successful',
-   user: {
-     id: user.id,
-     username: user.username,
-     email: user.email,
-     emailVerified: user.email_verified || false,
-     avatar: user.avatar_url || undefined,
-     isOnline: true,
-     twoFactorEnabled: user.two_factor_enabled || false
-   }
+   user: formatAuthUser(user)
  }
```

### **Step 3: Update Tests**

```javascript
// Update expected response shape
expect(response.body.user).toMatchObject({
  id: expect.any(Number),
  username: expect.any(String),
  email: expect.any(String),
  emailVerified: expect.any(Boolean),
  avatar: expect.toBeOneOf([String, null]),
  isOnline: expect.any(Boolean),
  twoFactorEnabled: expect.any(Boolean)
})
```

---

## ⚙️ **Custom Formatters**

### **Creating a Custom Formatter**

```javascript
// For admin panel - includes more details
export function formatAdminUser(user) {
  return {
    ...formatOwnProfile(user),
    lastSeen: user.last_seen,
    ipAddress: user.ip_address,  // Only for admin
    registrationIp: user.registration_ip,
    failedLoginAttempts: user.failed_login_attempts,
    accountStatus: user.is_active ? 'active' : 'banned'
  }
}
```

### **Extending Existing Formatters**

```javascript
// Add game stats to public profile
export function formatPublicUserWithStats(user) {
  return {
    ...formatPublicUser(user),
    stats: {
      wins: user.wins || 0,
      losses: user.losses || 0,
      gamesPlayed: user.games_played || 0,
      winRate: user.win_rate || 0
    }
  }
}
```

---

## ✅ **Best Practices**

1. **Always use formatters** - Never manually construct user objects
2. **Choose the right formatter** - Auth context = formatAuthUser, public = formatPublicUser
3. **Consistent imports** - Import formatters at top of file
4. **Don't over-customize** - Use standard formatters unless you have specific needs
5. **Document custom formatters** - Add JSDoc comments explaining when to use
6. **Test formatter output** - Unit test your formatters

---

## 📝 **Summary**

| Formatter | Use Case | Includes Email | Includes 2FA Status | Includes Stats |
|-----------|----------|----------------|---------------------|----------------|
| `formatAuthUser` | Login, Register, Settings | ✅ | ✅ | ❌ |
| `formatPublicUser` | Public profiles, Opponent info | ❌ | ❌ | ❌ |
| `formatOwnProfile` | Own profile view | ✅ | ✅ | ✅ |
| `formatUserPreview` | Lists, Search results | ❌ | ❌ | ❌ |

**Key Takeaway:** One formatter, one context, zero inconsistencies! 🎯
