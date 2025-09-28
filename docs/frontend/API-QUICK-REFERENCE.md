# 📡 ft_transcendence API Quick Reference

> **Swagger-style** API documentation for all frontend-backend communication

## 🏗️ Base Configuration

| Property | Value |
|----------|-------|
| **Base URL** | `/api` |
| **Content-Type** | `application/json` |
| **Auth Header** | `Authorization: Bearer <token>` |
| **Response Format** | `{ data: T, success: boolean, message?: string, timestamp: number, status: number }` |

---

## 🔐 Authentication API

### `POST /auth/login`
```typescript
Request:  { username: string, password: string, rememberMe?: boolean, twoFactorToken?: string }
Response: { success: boolean, user: User, token: string, refreshToken?: string, expiresAt?: number }
Errors:   400, 401, 429
```

### `POST /auth/register`
```typescript
Request:  { username: string, email: string, password: string, confirmPassword: string }
Response: { success: boolean, message: string }
Note:     User is NOT authenticated until email verification. No token returned.
Errors:   400, 409
```

### `POST /auth/logout`
```typescript
Headers:  Authorization: Bearer <token>
Request:  {}
Response: { message: string }
```

### `POST /auth/refresh`
```typescript
Request:  { refreshToken: string }
Response: { token: string, expiresAt: number }
```

### `POST /auth/forgot-password`
```typescript
Request:  { email: string }
Response: { success: boolean, message: string }
```

### `POST /auth/reset-password`
```typescript
Request:  { token: string, newPassword: string, confirmPassword: string }
Response: { success: boolean, message: string }
```

### `POST /auth/verify-email`
```typescript
Request:  { token: string }
Response: { success: boolean, message: string, user?: User, token?: string, refreshToken?: string }
Note:     On successful verification, user is authenticated and receives token
Errors:   400, 404
```

### `POST /auth/resend-verification`
```typescript
Request:  { email: string }
Response: { success: boolean, message: string }
```

### `POST /auth/set-user`
```typescript
Headers:  Authorization: Bearer <token>
Request:  { username: string }
Response: { available: boolean, message?: string }
Note:     Check if username is available for registration
```

---

## 🔐 OAuth 2.0 Authentication API

### `POST /auth/oauth/google/callback`
```typescript
Request:  { code: string, state: string }
Response: { success: boolean, user: User, token: string, refreshToken: string, isNewUser: boolean }
Errors:   400, 401, 409, 503
```

### `GET /auth/oauth/providers`
```typescript
Response: { providers: OAuthProvider[] }
```

### `POST /auth/oauth/link`
```typescript
Headers:  Authorization: Bearer <token>
Request:  { provider: 'google'|'github'|'discord', code: string, state: string }
Response: { user: User, message: string }
```

### `DELETE /auth/oauth/unlink/{provider}`
```typescript
Headers:  Authorization: Bearer <token>
Response: { user: User, message: string }
Errors:   400, 404
```

---

## 🔐 Two-Factor Authentication API

### `POST /auth/2fa/setup`
```typescript
Headers:  Authorization: Bearer <token>
Request:  { userId: string }
Response: { success: boolean, setupData: { secret: string, qrCodeUrl: string, backupCodes: string[], manualEntryKey: string } }
```

### `POST /auth/2fa/verify-setup`
```typescript
Headers:  Authorization: Bearer <token>
Request:  { userId: string, token: string, secret: string }
Response: { success: boolean, message: string }
```

### `POST /auth/2fa/verify`
```typescript
Request:  { userId: string, token?: string, backupCode?: string }
Response: { success: boolean, token?: string, message: string }
```

### `POST /auth/2fa/disable`
```typescript
Headers:  Authorization: Bearer <token>
Request:  { userId: string, password: string, token?: string }
Response: { success: boolean, message: string }
```

---

## 👤 User Management API

### `GET /users/me`
```typescript
Headers:  Authorization: Bearer <token>
Response: UserProfile
```

### `GET /users/{userId}`
```typescript
Response: PublicUserProfile
```

### `PUT /users/{userId}`
```typescript
Headers:  Authorization: Bearer <token>
Request:  { displayName?: string, email?: string, avatar?: string }
Response: { user: UserProfile, message: string }
```

### `GET /users/{userId}/games`
```typescript
Query:    ?page=1&limit=10
Response: { games: GameHistory[], total: number, page: number, limit: number }
```

### `GET /users/{userId}/stats`
```typescript
Response: UserStats
```

### `POST /users/{userId}/avatar`
```typescript
Headers:  Authorization: Bearer <token>, Content-Type: multipart/form-data
Request:  FormData { avatar: File }
Response: { avatarUrl: string, message: string }
```

---

## 👥 Friends Management API

### `POST /friends/requests`
```typescript
Headers:  Authorization: Bearer <token>
Request:  { userId: string, message?: string }
Response: { success: boolean, request: FriendRequest, message: string }
```

### `PUT /friends/requests/{requestId}`
```typescript
Headers:  Authorization: Bearer <token>
Request:  { action: 'accept' | 'decline' }
Response: { success: boolean, request: FriendRequest, message: string }
```

### `DELETE /friends/requests/{requestId}`
```typescript
Headers:  Authorization: Bearer <token>
Response: { success: boolean, message: string }
```

### `GET /friends`
```typescript
Headers:  Authorization: Bearer <token>
Query:    ?page=1&limit=20&filter=all|online|offline|recent
Response: { friends: Friend[], total: number, page: number, limit: number }
```

### `GET /friends/requests`
```typescript
Headers:  Authorization: Bearer <token>
Response: { incoming: FriendRequest[], outgoing: FriendRequest[], total: number }
```

### `DELETE /friends/{friendId}`
```typescript
Headers:  Authorization: Bearer <token>
Response: { success: boolean, message: string }
```

### `POST /friends/block`
```typescript
Headers:  Authorization: Bearer <token>
Request:  { userId: string, reason?: string }
Response: { success: boolean, message: string }
```

### `DELETE /friends/block/{userId}`
```typescript
Headers:  Authorization: Bearer <token>
Response: { success: boolean, message: string }
```

### `GET /friends/online`
```typescript
Headers:  Authorization: Bearer <token>
Response: { friends: Friend[], count: number }
```

### `GET /friends/status/{userId}`
```typescript
Headers:  Authorization: Bearer <token>
Response: { status: 'friends'|'pending'|'blocked'|'none', request?: FriendRequest }
```

### `GET /friends/activity`
```typescript
Headers:  Authorization: Bearer <token>
Query:    ?page=1&limit=20
Response: { activities: FriendActivity[], hasMore: boolean }
```

### `GET /users/search`
```typescript
Query:    ?query=username&page=1&limit=10&excludeFriends=true
Response: { users: FriendProfile[], total: number, page: number, limit: number }
```

---

## 🎮 Game Management API

### `POST /games`
```typescript
Headers:  Authorization: Bearer <token>
Request:  { type: 'classic'|'tournament'|'ai', settings?: GameSettings }
Response: GameSession
```

### `GET /games/available`
```typescript
Headers:  Authorization: Bearer <token>
Response: { games: GameSession[] }
```

### `POST /games/{gameId}/join`
```typescript
Headers:  Authorization: Bearer <token>
Response: { game: GameSession, message: string }
Errors:   404, 409
```

### `GET /games/{gameId}`
```typescript
Headers:  Authorization: Bearer <token>
Response: { game: GameSession }
```

### `POST /games/{gameId}/ready`
```typescript
Headers:  Authorization: Bearer <token>
Response: { message: string, allPlayersReady: boolean }
```

---

## 📊 Statistics API

### `GET /leaderboard`
```typescript
Query:    ?limit=10&offset=0
Response: { leaderboard: LeaderboardEntry[], total: number }
```

### `GET /stats/global`
```typescript
Response: { totalUsers: number, totalGames: number, averageGameDuration: number, mostActiveUser: string, popularGameMode: string }
```

---

## 📋 Data Types

### User
```typescript
interface User {
  id: string
  username: string
  email: string
  displayName?: string
  avatar?: string
  isOnline: boolean
  createdAt: Date
  lastSeen?: Date
  twoFactorAuth?: TwoFactorAuthStatus
  // OAuth-specific fields
  googleProfile?: GoogleProfile
  oauthProviders?: Array<'google' | 'github' | 'discord'>
}
```

### GoogleProfile
```typescript
interface GoogleProfile {
  googleId: string
  name: string
  email: string
  picture?: string
  verified_email?: boolean
}
```

### OAuthProvider
```typescript
interface OAuthProvider {
  name: 'google' | 'github' | 'discord'
  enabled: boolean
  clientId?: string
  scopes: string[]
  authUrl?: string
}
```

### UserProfile
```typescript
interface UserProfile extends User {
  stats: UserStats
  achievements: Achievement[]
  recentGames: GameHistory[]
  // Social features
  friends?: Friend[]
  friendRequests?: {
    incoming: FriendRequest[]
    outgoing: FriendRequest[]
  }
  friendsCount?: number
}
```

### UserStats
```typescript
interface UserStats {
  gamesPlayed: number
  gamesWon: number
  gamesLost: number
  winRate: number
  ranking: number
  totalScore: number
  currentStreak?: number
  bestStreak?: number
}
```

### Friend
```typescript
interface Friend {
  id: string
  userId: string
  friendId: string
  status: 'pending' | 'accepted' | 'blocked'
  createdAt: Date
  acceptedAt?: Date
  friend: FriendProfile
}
```

### FriendRequest
```typescript
interface FriendRequest {
  id: string
  fromUserId: string
  toUserId: string
  status: 'pending' | 'accepted' | 'declined'
  message?: string
  createdAt: Date
  respondedAt?: Date
  fromUser: FriendProfile
  toUser: FriendProfile
}
```

### FriendProfile
```typescript
interface FriendProfile {
  id: string
  username: string
  displayName?: string
  avatar?: string
  isOnline: boolean
  onlineStatus: 'online' | 'away' | 'busy' | 'offline'
  lastSeen?: Date
}
```

### GameSession
```typescript
interface GameSession {
  id: string
  type: 'classic' | 'tournament' | 'ai'
  status: 'waiting' | 'playing' | 'finished'
  players: GamePlayer[]
  settings: GameSettings
  createdAt: Date
  startedAt?: Date
  finishedAt?: Date
  score?: { player1: number, player2: number }
}
```

### GamePlayer
```typescript
interface GamePlayer {
  id: string
  username: string
  isReady: boolean
  isAI?: boolean
  score: number
}
```

### GameHistory
```typescript
interface GameHistory {
  id: string
  opponent: string
  result: 'win' | 'loss'
  score: string
  date: string
  duration?: number
  gameMode?: string
}
```

### TwoFactorAuthStatus
```typescript
interface TwoFactorAuthStatus {
  enabled: boolean
  setupComplete: boolean
  backupCodesGenerated: boolean
  lastUsed?: Date
}
```

---

## 🚨 Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict |
| `RATE_LIMIT` | 429 | Too many requests |
| `SERVER_ERROR` | 500 | Internal server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily down |

---

## 🔧 Frontend Service Implementations

### Error Handling Pattern
All service methods use the `catchErrorTyped` function for consistent error handling:

```typescript
// Service method pattern
async serviceMethod(): Promise<T> {
  const [error, response] = await catchErrorTyped(
    this.apiCall()
  )

  if (error) {
    console.error('❌ Service error:', error.message)
    throw new Error(error.message || 'Operation failed')
  }

  return response!.data
}
```

### AuthService Methods
- `login(credentials)` → `/auth/login`
- `register(credentials)` → `/auth/register`
- `logout()` → `/auth/logout`
- `refreshToken()` → `/auth/refresh`
- `forgotPassword(email)` → `/auth/forgot-password`
- `resetPassword(token, password)` → `/auth/reset-password`
- `verifyEmail(token)` → `/auth/verify-email`
- `resendEmailVerification(email)` → `/auth/resend-verification`
- `setup2FA()` → `/auth/2fa/setup`
- `verify2FASetup(token, secret)` → `/auth/2fa/verify-setup`
- `verify2FA(token, backupCode)` → `/auth/2fa/verify`
- `disable2FA(password, token)` → `/auth/2fa/disable`
- `startGoogleOAuth(returnTo)` → *Client-side Google redirect*
- `handleOAuthCallback(searchParams)` → `/auth/oauth/google/callback`
- `linkGoogleAccount()` → `/auth/oauth/link`
- `isOAuthAvailable()` → *Client-side configuration check*

### UserApiService Methods
- `getCurrentUser()` → `/users/me`
- `getUserProfile(userId)` → `/users/{userId}`
- `updateUserProfile(userId, updates)` → `PUT /users/{userId}`
- `getUserGameHistory(userId, page, limit)` → `/users/{userId}/games`
- `getUserStats(userId)` → `/users/{userId}/stats`
- `uploadAvatar(userId, file)` → `/users/{userId}/avatar`

### FriendsService Methods
- `sendFriendRequest(request)` → `/friends/requests`
- `respondToFriendRequest(requestId, action)` → `PUT /friends/requests/{requestId}`
- `cancelFriendRequest(requestId)` → `DELETE /friends/requests/{requestId}`
- `getFriends(page, limit, filter)` → `/friends`
- `getFriendRequests()` → `/friends/requests`
- `removeFriend(friendId)` → `DELETE /friends/{friendId}`
- `blockUser(request)` → `/friends/block`
- `unblockUser(userId)` → `DELETE /friends/block/{userId}`
- `getOnlineFriends()` → `/friends/online`
- `getFriendshipStatus(userId)` → `/friends/status/{userId}`
- `searchUsers(request)` → `/users/search`
- `getFriendsActivity(page, limit)` → `/friends/activity`

### GameService Methods (Future)
- `createGame(request)` → `/games`
- `getAvailableGames()` → `/games/available`
- `joinGame(gameId)` → `/games/{gameId}/join`
- `getGameSession(gameId)` → `/games/{gameId}`
- `markReady(gameId)` → `/games/{gameId}/ready`

---

## 📖 Usage Examples

### Authentication Flow
```typescript
// Traditional login with error handling
try {
  const auth = await authService.login({ username: 'user', password: 'pass' })
  console.log('✅ Login successful:', auth.user)
} catch (error) {
  const message = error instanceof Error ? error.message : 'Login failed'
  showPopup(message)
}

// OAuth login (Google)
if (authService.isOAuthAvailable()) {
  try {
    // Redirects to Google OAuth consent screen
    await authService.startGoogleOAuth('/')
    
    // After redirect back to /auth/oauth/callback
    // Handled automatically by OAuthCallbackPage
    const result = await authService.handleOAuthCallback(urlParams)
    if (result.success) {
      console.log('OAuth login successful:', result.user)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OAuth failed'
    showPopup(`Google OAuth failed: ${message}`)
  }
}

// 2FA if enabled
if (auth.user?.twoFactorAuth?.enabled && !auth.token) {
  try {
    await authService.verify2FA('123456')
  } catch (error) {
    showPopup('Invalid 2FA code')
  }
}

// Get profile with error handling
try {
  const profile = await userApiService.getCurrentUser()
} catch (error) {
  showPopup('Failed to load profile')
}
```

### Game Flow
```typescript
// Create game with error handling
try {
  const game = await gameService.createGame({ type: 'classic' })
  console.log('✅ Game created:', game.id)
} catch (error) {
  showPopup('Failed to create game')
}

// Join game
try {
  await gameService.joinGame(gameId)
  console.log('✅ Joined game successfully')
} catch (error) {
  showPopup('Failed to join game')
}

// Mark ready
try {
  await gameService.markReady(gameId)
} catch (error) {
  showPopup('Failed to mark ready')
}
```

### Friends Flow
```typescript
// Search for users with error handling
try {
  const users = await friendsService.searchUsers({ query: 'username' })
  console.log('Found users:', users.length)
} catch (error) {
  showPopup('Search failed')
}

// Send friend request
try {
  await friendsService.sendFriendRequest({ userId: 'user123', message: 'Hi!' })
  showPopup('Friend request sent!')
} catch (error) {
  showPopup('Failed to send friend request')
}

// Get friend requests
try {
  const requests = await friendsService.getFriendRequests()
} catch (error) {
  showPopup('Failed to load friend requests')
}

// Accept request
try {
  await friendsService.respondToFriendRequest({ requestId: 'req123', action: 'accept' })
  showPopup('Friend request accepted!')
} catch (error) {
  showPopup('Failed to accept friend request')
}

// Get friends list
try {
  const friends = await friendsService.getFriends(1, 20, 'online')
} catch (error) {
  showPopup('Failed to load friends')
}
```

---

## 🏷️ Status

| Service | Status | Endpoints |
|---------|--------|-----------|
| **Auth** | ✅ Complete | 12 endpoints |
| **OAuth** | ✅ Complete | 4 endpoints |
| **User** | ✅ Complete | 6 endpoints |
| **2FA** | ✅ Complete | 4 endpoints |
| **Friends** | ✅ Complete | 12 endpoints |
| **Game** | ⏳ Future | 5 endpoints |
| **Stats** | ⏳ Future | 2 endpoints |

**Current State**: All endpoints return development mock responses  
**Backend Integration**: Ready for implementation

---

*Generated from frontend service code analysis - Updated: September 21, 2025*

**Recent Updates:**
- ✅ Migrated to `catchErrorTyped` error handling system
- ✅ Removed legacy `ErrorUtils` dependencies  
- ✅ Consistent error handling across all services
- ✅ Type-safe error management with tuple pattern