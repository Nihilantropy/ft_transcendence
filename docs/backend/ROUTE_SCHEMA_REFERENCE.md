# Complete Route Schema Reference

**Quick reference for all available route schemas**

---

## Import Statement

```javascript
import { routeAuthSchemas, routeUserSchemas, routeOAuthSchemas } from '../../schemas/index.js'
```

---

## 🔐 routeAuthSchemas (10 routes)

### Authentication Routes

#### `routeAuthSchemas.register`
- **Route**: POST /auth/register
- **Body**: `RegisterRequest` (email, password, confirmPassword)
- **Response**: `RegisterResponse` (success, message, user)
- **Status Codes**: 201, 400, 500

#### `routeAuthSchemas.verifyEmail`
- **Route**: GET /auth/verify-email
- **Query**: `VerifyEmailQuery` (token)
- **Response**: `VerifyEmailResponse` (success, message, user)
- **Status Codes**: 200, 400, 500

#### `routeAuthSchemas.login`
- **Route**: POST /auth/login
- **Body**: `LoginRequest` (identifier, password, rememberMe, twoFactorToken)
- **Response**: `LoginResponse` (success, message, user, requiresTwoFactor, tempToken)
- **Status Codes**: 200, 400, 401, 500

#### `routeAuthSchemas.logout`
- **Route**: POST /auth/logout
- **Response**: `SuccessResponse` (success, message)
- **Status Codes**: 200, 500

#### `routeAuthSchemas.refresh`
- **Route**: POST /auth/refresh
- **Response**: `SuccessResponse` (success, message)
- **Status Codes**: 200, 401, 500

#### `routeAuthSchemas.resendVerification`
- **Route**: POST /auth/resend-verification
- **Body**: `ResendVerificationRequest` (email)
- **Response**: `ResendVerificationResponse` (success, message)
- **Status Codes**: 200, 400, 429, 500

### 2FA Routes

#### `routeAuthSchemas.setup2FA`
- **Route**: POST /auth/2fa/setup
- **Body**: `Setup2FARequest` (empty object)
- **Response**: `Setup2FAResponse` (success, message, setupData with secret/qrCode/backupCodes)
- **Status Codes**: 200, 400, 401, 500

#### `routeAuthSchemas.verify2FASetup`
- **Route**: POST /auth/2fa/verify-setup
- **Body**: `Verify2FASetupRequest` (token, secret)
- **Response**: `Verify2FASetupResponse` (success, message, user)
- **Status Codes**: 200, 400, 401, 500

#### `routeAuthSchemas.verify2FA`
- **Route**: POST /auth/2fa/verify
- **Body**: `Verify2FARequest` (tempToken, token OR backupCode)
- **Response**: `Verify2FAResponse` (success, message, user)
- **Status Codes**: 200, 400, 401, 500

#### `routeAuthSchemas.disable2FA`
- **Route**: POST /auth/2fa/disable
- **Body**: `Disable2FARequest` (password, token optional)
- **Response**: `Disable2FAResponse` (success, message, user)
- **Status Codes**: 200, 400, 401, 500

---

## 👤 routeUserSchemas (6 routes)

### Profile Routes

#### `routeUserSchemas.me`
- **Route**: GET /users/me
- **Auth**: Required
- **Response**: `CompleteProfileResponse` (success, user with all fields)
- **Status Codes**: 200, 401, 404, 500

#### `routeUserSchemas.publicProfile`
- **Route**: GET /users/:userId
- **Auth**: Optional
- **Params**: `GetPublicProfileParams` (userId)
- **Response**: `PublicProfileResponse` (success, user with public fields only)
- **Status Codes**: 200, 404, 500

#### `routeUserSchemas.search`
- **Route**: GET /users/search
- **Auth**: Optional
- **Query**: `SearchUsersQuery` (q, limit)
- **Response**: `SearchUsersResponse` (success, users array, count)
- **Status Codes**: 200, 400, 500

### Update Routes

#### `routeUserSchemas.updateUsername`
- **Route**: POST /users/set-username
- **Auth**: Required
- **Body**: `UpdateUsernameRequest` (username)
- **Response**: `UpdateUsernameResponse` (success, message, user)
- **Status Codes**: 200, 400, 401, 409, 500

#### `routeUserSchemas.updateAvatar`
- **Route**: POST /users/set-avatar
- **Auth**: Required
- **Body**: `UpdateAvatarRequest` (avatarUrl)
- **Response**: `UpdateAvatarResponse` (success, message, user)
- **Status Codes**: 200, 400, 401, 500

#### `routeUserSchemas.checkUsername`
- **Route**: GET /users/check-username
- **Auth**: Optional
- **Query**: `CheckUsernameQuery` (username)
- **Response**: `CheckUsernameResponse` (available, message)
- **Status Codes**: 200, 400, 500

---

## 🔗 routeOAuthSchemas (3 routes)

### OAuth Flow Routes

#### `routeOAuthSchemas.callback`
- **Route**: GET /oauth/google/callback
- **Auth**: None (public callback)
- **Query**: `OAuthCallbackQuery` (code, state, error, error_description)
- **Response**: Redirect (no typed response)
- **Rate Limit**: 5 requests per minute

#### `routeOAuthSchemas.link`
- **Route**: POST /oauth/link
- **Auth**: Required
- **Body**: `OAuthLinkRequest` (provider, code, state)
- **Response**: `OAuthLinkResponse` (success, message, user)
- **Status Codes**: 200, 400, 401, 409, 500

#### `routeOAuthSchemas.unlink`
- **Route**: DELETE /oauth/unlink/:provider
- **Auth**: Required
- **Params**: `OAuthUnlinkParams` (provider)
- **Response**: `OAuthUnlinkResponse` (success, message, user)
- **Status Codes**: 200, 400, 401, 404, 500

---

## Usage Examples

### Example 1: Simple GET Route

```javascript
import { routeUserSchemas } from '../../schemas/index.js'

async function meRoute(fastify) {
  fastify.get('/me', {
    preHandler: requireAuth,
    schema: routeUserSchemas.me
  }, async (request, reply) => {
    const user = userService.getCompleteProfile(request.user.id)
    return { success: true, user: formatOwnProfile(user) }
  })
}
```

### Example 2: POST Route with Body

```javascript
import { routeAuthSchemas } from '../../schemas/index.js'

async function loginRoute(fastify) {
  fastify.post('/login', {
    schema: routeAuthSchemas.login
  }, async (request, reply) => {
    const { identifier, password } = request.body
    // Login logic...
  })
}
```

### Example 3: Route with Query Parameters

```javascript
import { routeUserSchemas } from '../../schemas/index.js'

async function searchRoute(fastify) {
  fastify.get('/search', {
    schema: routeUserSchemas.search
  }, async (request, reply) => {
    const { q, limit = 10 } = request.query
    const users = userService.searchUsersByUsername(q, limit)
    return { success: true, users, count: users.length }
  })
}
```

### Example 4: Route with Path Parameters

```javascript
import { routeUserSchemas } from '../../schemas/index.js'

async function publicProfileRoute(fastify) {
  fastify.get('/:userId', {
    schema: routeUserSchemas.publicProfile
  }, async (request, reply) => {
    const { userId } = request.params
    const user = userService.getPublicProfile(userId)
    return { success: true, user: formatPublicUser(user) }
  })
}
```

### Example 5: OAuth Route with Config

```javascript
import { routeOAuthSchemas } from '../../schemas/index.js'

async function oauthCallbackRoute(fastify) {
  fastify.get('/oauth/google/callback', {
    schema: routeOAuthSchemas.callback,
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    // OAuth callback logic...
  })
}
```

---

## Schema Metadata

All route schemas include:

- **tags**: Array for API grouping (e.g., ['auth'], ['users'], ['oauth'])
- **operationId**: Unique identifier for the operation
- **summary**: Short description (1 line)
- **description**: Detailed explanation
- **body/params/querystring**: Request schema references
- **response**: All possible HTTP status codes with schema references

---

## Response Codes by Category

### Success Codes
- **200**: OK - Request successful
- **201**: Created - Resource created successfully

### Client Error Codes
- **400**: Bad Request - Validation error
- **401**: Unauthorized - Authentication required or failed
- **404**: Not Found - Resource not found
- **409**: Conflict - Resource already exists (e.g., duplicate username)
- **429**: Too Many Requests - Rate limit exceeded

### Server Error Codes
- **500**: Internal Server Error - Server-side error

---

## Common Response Schemas

### SuccessResponse
```javascript
{
  success: boolean,
  message: string
}
```

### ErrorResponse
```javascript
{
  success: boolean,
  message: string,
  error?: {
    code: string,
    details: string
  }
}
```

### User Object (Complete)
```javascript
{
  id: number,
  username: string,
  email: string,
  emailVerified: boolean,
  displayName: string,
  avatar: string | null,
  twoFactorEnabled: boolean,
  isOnline: boolean,
  lastSeen: string | null,
  createdAt: string,
  updatedAt: string
}
```

### User Object (Public)
```javascript
{
  id: number,
  username: string,
  displayName: string,
  avatar: string | null,
  isOnline: boolean,
  createdAt: string
}
```

### User Object (Preview)
```javascript
{
  id: number,
  username: string,
  displayName: string,
  avatar: string | null,
  isOnline: boolean
}
```

---

## Quick Reference Table

| Category | Schema Name | Route | Method | Auth |
|----------|------------|-------|--------|------|
| **Auth** | register | /auth/register | POST | No |
| **Auth** | verifyEmail | /auth/verify-email | GET | No |
| **Auth** | login | /auth/login | POST | No |
| **Auth** | logout | /auth/logout | POST | Yes |
| **Auth** | refresh | /auth/refresh | POST | Cookie |
| **Auth** | setup2FA | /auth/2fa/setup | POST | Yes |
| **Auth** | verify2FASetup | /auth/2fa/verify-setup | POST | Yes |
| **Auth** | verify2FA | /auth/2fa/verify | POST | Temp |
| **Auth** | disable2FA | /auth/2fa/disable | POST | Yes |
| **Auth** | resendVerification | /auth/resend-verification | POST | No |
| **User** | me | /users/me | GET | Yes |
| **User** | publicProfile | /users/:userId | GET | Optional |
| **User** | search | /users/search | GET | Optional |
| **User** | updateUsername | /users/set-username | POST | Yes |
| **User** | updateAvatar | /users/set-avatar | POST | Yes |
| **User** | checkUsername | /users/check-username | GET | No |
| **OAuth** | callback | /oauth/google/callback | GET | No |
| **OAuth** | link | /oauth/link | POST | Yes |
| **OAuth** | unlink | /oauth/unlink/:provider | DELETE | Yes |

**Total Routes**: 19 (10 auth + 6 user + 3 oauth)

---

## Pattern Summary

```javascript
// Import
import { routeAuthSchemas, routeUserSchemas, routeOAuthSchemas } from '../../schemas/index.js'

// Use
fastify.METHOD('/route', {
  schema: route[Category]Schemas.[routeName]
}, handler)
```

**Simple. Consistent. Complete.**
