# OAuth Security Fixes - Quick Implementation Guide

**Priority**: 🔴 CRITICAL  
**Estimated Time**: 4-6 hours  
**Must Complete Before**: Production deployment

---

## Overview

This guide provides step-by-step instructions to fix the **critical security vulnerabilities** in the OAuth implementation. These fixes are **mandatory** before enabling OAuth in production.

---

## Fix 1: CSRF State Validation (2 hours)

### Problem
OAuth callback doesn't validate the `state` parameter, making the application vulnerable to CSRF attacks.

### Solution

#### Step 1: Create OAuth State Manager Service

Create `/srcs/backend/src/services/oauth-state.service.js`:

```javascript
/**
 * @file OAuth State Manager Service
 * @description Manages CSRF protection tokens for OAuth flows
 */

import crypto from 'crypto'
import { logger } from '../logger.js'

const stateLogger = logger.child({ module: 'services/oauth-state' })

/**
 * @brief OAuth state management for CSRF protection
 * @description In production, replace Map with Redis for multi-instance support
 */
class OAuthStateManager {
  constructor() {
    // TODO: Replace with Redis in production
    this.states = new Map()
    
    // Cleanup expired states every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000)
  }

  /**
   * @brief Create new OAuth state token
   * @param {number} userId - Optional user ID for authenticated flows
   * @return {string} Secure random state token
   */
  create(userId = null) {
    const state = crypto.randomBytes(32).toString('hex')
    
    this.states.set(state, {
      userId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
    })
    
    stateLogger.debug('Created OAuth state', { 
      state: state.substring(0, 8) + '...', 
      userId 
    })
    
    return state
  }

  /**
   * @brief Validate and consume OAuth state token (one-time use)
   * @param {string} state - State token from OAuth callback
   * @return {Object|null} State data or null if invalid
   */
  validate(state) {
    if (!state || typeof state !== 'string') {
      stateLogger.warn('Invalid state format')
      return null
    }
    
    const data = this.states.get(state)
    
    if (!data) {
      stateLogger.warn('State not found', { 
        state: state.substring(0, 8) + '...' 
      })
      return null
    }
    
    if (data.expiresAt < Date.now()) {
      stateLogger.warn('State expired', { 
        state: state.substring(0, 8) + '...',
        age: Math.floor((Date.now() - data.createdAt) / 1000) + 's'
      })
      this.states.delete(state)
      return null
    }
    
    // One-time use: delete immediately
    this.states.delete(state)
    
    stateLogger.debug('State validated and consumed', { 
      state: state.substring(0, 8) + '...',
      userId: data.userId
    })
    
    return data
  }

  /**
   * @brief Remove expired states
   */
  cleanup() {
    const now = Date.now()
    let cleaned = 0
    
    for (const [state, data] of this.states.entries()) {
      if (data.expiresAt < now) {
        this.states.delete(state)
        cleaned++
      }
    }
    
    if (cleaned > 0) {
      stateLogger.debug('Cleaned expired OAuth states', { count: cleaned })
    }
  }

  /**
   * @brief Get current state count (for monitoring)
   */
  getStateCount() {
    return this.states.size
  }
}

// Export singleton
export const oauthStateManager = new OAuthStateManager()
export default oauthStateManager
```

#### Step 2: Create OAuth Initiation Route

Create `/srcs/backend/src/routes/auth/oauth-initiate.js`:

```javascript
/**
 * @brief OAuth initiation route
 * @description Generates OAuth authorization URL with CSRF protection
 */

import { logger } from '../../logger.js'
import { oauthStateManager } from '../../services/oauth-state.service.js'

const oauthInitiateLogger = logger.child({ module: 'routes/auth/oauth-initiate' })

async function oauthInitiateRoute(fastify) {
  
  /**
   * @route GET /oauth/google/login
   * @description Initiate Google OAuth flow with CSRF protection
   */
  fastify.get('/oauth/google/login', async (request, reply) => {
    try {
      // Generate secure state token
      const state = oauthStateManager.create(request.user?.id)
      
      // Build Google OAuth URL
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      authUrl.searchParams.append('client_id', process.env.GOOGLE_CLIENT_ID)
      authUrl.searchParams.append('redirect_uri', process.env.GOOGLE_REDIRECT_URI)
      authUrl.searchParams.append('response_type', 'code')
      authUrl.searchParams.append('scope', 'openid email profile')
      authUrl.searchParams.append('state', state)
      authUrl.searchParams.append('access_type', 'offline')
      
      oauthInitiateLogger.info('🌐 Initiating Google OAuth flow')
      
      // Redirect to Google
      return reply.redirect(authUrl.toString())
      
    } catch (error) {
      oauthInitiateLogger.error('❌ OAuth initiation failed', { 
        error: error.message 
      })
      return reply.redirect('https://localhost/login?error=oauth_init_failed')
    }
  })
}

export default oauthInitiateRoute
```

#### Step 3: Update OAuth Callback to Validate State

Update `/srcs/backend/src/routes/auth/oauth-callback.js`:

```javascript
import { oauthStateManager } from '../../services/oauth-state.service.js'
import { setAuthCookies } from '../../utils/coockie.js' // Add this import

async function oauthCallbackRoute(fastify) {
  fastify.get('/oauth/google/callback', async (request, reply) => {
    try {
      const { code, state, error } = request.query

      oauthCallbackLogger.info('🌐 Google OAuth callback received')

      // ✅ FIX 1: Validate OAuth error
      if (error) {
        oauthCallbackLogger.warn('OAuth error from Google', { error })
        return reply.redirect(`https://localhost/login?error=oauth_${error}`)
      }

      // ✅ FIX 2: Validate required parameters
      if (!code || !state) {
        oauthCallbackLogger.warn('Missing OAuth parameters')
        return reply.redirect('https://localhost/login?error=oauth_invalid')
      }

      // ✅ FIX 3: CSRF Protection - Validate state
      const stateData = oauthStateManager.validate(state)
      if (!stateData) {
        oauthCallbackLogger.warn('❌ Invalid or expired OAuth state')
        return reply.redirect('https://localhost/login?error=oauth_invalid_state')
      }

      oauthCallbackLogger.debug('✅ OAuth state validated')

      // 1. Exchange code for tokens
      const tokenData = await exchangeCodeForTokens(code)
      
      // 2. Get user profile from Google
      const googleProfile = await getGoogleUserProfile(tokenData.access_token)
      
      // 3. Find or create user
      const { user, isNewUser } = await findOrCreateOAuthUser(googleProfile)
      
      // 4. Generate JWT tokens
      const { accessToken, refreshToken } = generateTokenPair(user)
      
      // ✅ FIX 4: Set authentication cookies
      setAuthCookies(reply, accessToken, refreshToken)
      
      // 5. Update user status
      userService.updateUserOnlineStatus(user.id, true)
      
      // 6. Redirect to frontend
      const redirectUrl = isNewUser 
        ? 'https://localhost/username-selection'
        : 'https://localhost/profile'
      
      oauthCallbackLogger.info('✅ OAuth login successful', { 
        userId: user.id, 
        isNewUser 
      })
      
      return reply.redirect(redirectUrl)
      
    } catch (error) {
      oauthCallbackLogger.error('❌ Google OAuth failed', { 
        error: error.message,
        stack: error.stack
      })
      return reply.redirect('https://localhost/login?error=oauth_failed')
    }
  })
}
```

#### Step 4: Register New Route

Update `/srcs/backend/src/routes/auth/index.js`:

```javascript
import oauthInitiateRoute from './oauth-initiate.js'

// In authRoutes function, add:
await fastify.register(oauthInitiateRoute)
authLogger.info('✅ OAuth initiate route registered')
```

#### Step 5: Export State Manager

Update `/srcs/backend/src/services/index.js`:

```javascript
export * from './user.service.js'
export * from './email.service.js'
export * from './oauth-state.service.js' // Add this line
```

---

## Fix 2: Environment Variable Validation (1 hour)

### Problem
Missing OAuth environment variables cause silent failures with unclear errors.

### Solution

#### Step 1: Create Configuration Validator

Create `/srcs/backend/src/config/oauth.config.js`:

```javascript
/**
 * @file OAuth Configuration
 * @description Validates and exports OAuth configuration
 */

import { logger } from '../logger.js'

const configLogger = logger.child({ module: 'config/oauth' })

/**
 * @brief Validate OAuth environment variables
 * @throws {Error} If required variables are missing
 */
export function validateOAuthConfig() {
  const required = {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI
  }

  const missing = Object.entries(required)
    .filter(([key, value]) => !value)
    .map(([key]) => key)

  if (missing.length > 0) {
    const errorMsg = 
      '❌ CRITICAL: Missing OAuth environment variables:\n' +
      missing.map(key => `  - ${key}`).join('\n') +
      '\n\nOAuth features will not work until these are set!'
    
    configLogger.error(errorMsg)
    throw new Error(errorMsg)
  }

  configLogger.info('✅ OAuth configuration validated', {
    clientId: process.env.GOOGLE_CLIENT_ID.substring(0, 20) + '...',
    redirectUri: process.env.GOOGLE_REDIRECT_URI
  })
}

/**
 * @brief Export validated OAuth configuration
 */
export const oauthConfig = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
    scopes: ['openid', 'email', 'profile']
  }
}

export default oauthConfig
```

#### Step 2: Validate on Startup

Update `/srcs/backend/src/server.js` (add near the top of the start function):

```javascript
import { validateOAuthConfig } from './config/oauth.config.js'

async function start() {
  try {
    // ... existing code ...
    
    // Validate OAuth configuration (after database connection)
    try {
      validateOAuthConfig()
    } catch (error) {
      logger.warn('OAuth configuration invalid - OAuth routes will be disabled')
      logger.warn(error.message)
      // Continue without OAuth (don't crash server)
    }
    
    // ... rest of startup code ...
  } catch (error) {
    // ... existing error handling ...
  }
}
```

#### Step 3: Use Config in Routes

Update `/srcs/backend/src/routes/auth/oauth-callback.js`:

```javascript
import { oauthConfig } from '../../config/oauth.config.js'

// Replace all process.env.GOOGLE_* with:
const tokenParams = {
  client_id: oauthConfig.google.clientId,
  client_secret: oauthConfig.google.clientSecret,
  code,
  grant_type: 'authorization_code',
  redirect_uri: oauthConfig.google.redirectUri
}
```

---

## Fix 3: Request Schema Validation (1 hour)

### Problem
No validation for OAuth callback parameters, allowing invalid data.

### Solution

#### Step 1: Create OAuth Schemas

Create `/srcs/backend/src/schemas/routes/oauth.schema.js`:

```javascript
/**
 * @file OAuth route schemas
 * @description Request/response validation for OAuth routes
 */

export const oauthCallbackSchema = {
  querystring: {
    type: 'object',
    required: ['code', 'state'],
    properties: {
      code: {
        type: 'string',
        minLength: 1,
        maxLength: 2000,
        description: 'Authorization code from OAuth provider'
      },
      state: {
        type: 'string',
        minLength: 64,
        maxLength: 64,
        pattern: '^[a-f0-9]{64}$',
        description: 'CSRF protection state token (hex)'
      },
      error: {
        type: 'string',
        description: 'Error code from OAuth provider'
      },
      error_description: {
        type: 'string',
        description: 'Error description from OAuth provider'
      }
    }
  }
}

export const oauthLinkSchema = {
  body: {
    type: 'object',
    required: ['provider', 'code', 'state'],
    properties: {
      provider: {
        type: 'string',
        enum: ['google'],
        description: 'OAuth provider name'
      },
      code: {
        type: 'string',
        minLength: 1,
        maxLength: 2000,
        description: 'Authorization code'
      },
      state: {
        type: 'string',
        minLength: 64,
        maxLength: 64,
        pattern: '^[a-f0-9]{64}$',
        description: 'CSRF token'
      }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        user: { $ref: 'User#' }
      }
    }
  }
}

export const oauthUnlinkSchema = {
  params: {
    type: 'object',
    required: ['provider'],
    properties: {
      provider: {
        type: 'string',
        enum: ['google'],
        description: 'OAuth provider to unlink'
      }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        user: { $ref: 'User#' }
      }
    }
  }
}

export default {
  oauthCallbackSchema,
  oauthLinkSchema,
  oauthUnlinkSchema
}
```

#### Step 2: Apply Schemas to Routes

Update `/srcs/backend/src/routes/auth/oauth-callback.js`:

```javascript
import { oauthCallbackSchema } from '../../schemas/routes/oauth.schema.js'

async function oauthCallbackRoute(fastify) {
  fastify.get('/oauth/google/callback', {
    schema: oauthCallbackSchema
  }, async (request, reply) => {
    // Route handler code...
  })
}
```

---

## Fix 4: Set Authentication Cookies (1 hour)

### Problem
JWT tokens are generated but never set as cookies, leaving users unauthenticated.

### Solution

#### Step 1: Update Cookie Utility

Update `/srcs/backend/src/utils/coockie.js`:

```javascript
/**
 * @brief Set authentication cookies for user
 * @param {FastifyReply} reply - Fastify reply object
 * @param {string} accessToken - JWT access token
 * @param {string} refreshToken - JWT refresh token
 */
export function setAuthCookies(reply, accessToken, refreshToken) {
  // Access token cookie (15 minutes)
  reply.setCookie('accessToken', accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 15 * 60 // 15 minutes in seconds
  })

  // Refresh token cookie (7 days)
  reply.setCookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/api/auth/refresh',
    maxAge: 7 * 24 * 60 * 60 // 7 days in seconds
  })
}

/**
 * @brief Clear authentication cookies
 * @param {FastifyReply} reply - Fastify reply object
 */
export function clearAuthCookies(reply) {
  reply.clearCookie('accessToken', { path: '/' })
  reply.clearCookie('refreshToken', { path: '/api/auth/refresh' })
}
```

#### Step 2: Use in OAuth Callback

Already shown in Fix 1, Step 3:
```javascript
import { setAuthCookies } from '../../utils/coockie.js'

// After generating tokens:
setAuthCookies(reply, accessToken, refreshToken)
```

---

## Fix 5: Add Rate Limiting (1 hour)

### Problem
No rate limiting on OAuth endpoints allows abuse and DoS attacks.

### Solution

#### Step 1: Install Rate Limit Plugin

```bash
npm install @fastify/rate-limit
```

#### Step 2: Configure Rate Limiting

Update `/srcs/backend/src/server.js`:

```javascript
import rateLimit from '@fastify/rate-limit'

// In start() function, after other plugins:
await fastify.register(rateLimit, {
  global: false, // Apply per-route
  max: 100,
  timeWindow: '1 minute',
  errorResponseBuilder: () => ({
    success: false,
    message: 'Too many requests. Please try again later.',
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      details: 'Rate limit exceeded'
    }
  })
})

logger.info('✅ Rate limiting registered')
```

#### Step 3: Apply to OAuth Routes

Update `/srcs/backend/src/routes/auth/oauth-callback.js`:

```javascript
fastify.get('/oauth/google/callback', {
  schema: oauthCallbackSchema,
  config: {
    rateLimit: {
      max: 5, // 5 attempts
      timeWindow: '1 minute'
    }
  }
}, async (request, reply) => {
  // Handler code...
})
```

Update `/srcs/backend/src/routes/auth/oauth-initiate.js`:

```javascript
fastify.get('/oauth/google/login', {
  config: {
    rateLimit: {
      max: 10, // 10 initiations
      timeWindow: '1 minute'
    }
  }
}, async (request, reply) => {
  // Handler code...
})
```

---

## Testing the Fixes

### Manual Testing Checklist

#### Test 1: OAuth Login Flow
```bash
# 1. Initiate OAuth (should redirect to Google)
curl -v 'https://localhost/api/auth/oauth/google/login'

# 2. After Google authorization, callback should:
#    - Validate state ✅
#    - Set cookies ✅
#    - Redirect to frontend ✅

# 3. Verify cookies are set:
curl -v 'https://localhost/api/auth/oauth/google/callback?code=...&state=...'
# Look for: Set-Cookie: accessToken=...; HttpOnly; Secure; SameSite=Strict
```

#### Test 2: CSRF Protection
```bash
# 1. Try callback with invalid state (should fail)
curl 'https://localhost/api/auth/oauth/google/callback?code=valid&state=invalid'
# Expected: Redirect to /login?error=oauth_invalid_state

# 2. Try callback with expired state (should fail)
# Wait 6 minutes, then use old state
# Expected: Redirect to /login?error=oauth_invalid_state

# 3. Try reusing same state (should fail on second use)
# Expected: First use succeeds, second use fails
```

#### Test 3: Environment Variable Validation
```bash
# 1. Remove GOOGLE_CLIENT_ID from .env
# 2. Restart server
# Expected: Warning logged, OAuth routes disabled

# 3. Restore GOOGLE_CLIENT_ID
# Expected: ✅ OAuth configuration validated
```

#### Test 4: Rate Limiting
```bash
# 1. Make 10 requests in quick succession
for i in {1..10}; do
  curl 'https://localhost/api/auth/oauth/google/login'
done
# Expected: First 10 succeed, 11th returns rate limit error
```

#### Test 5: Request Validation
```bash
# 1. Try callback with missing code
curl 'https://localhost/api/auth/oauth/google/callback?state=abc123'
# Expected: 400 Bad Request - validation error

# 2. Try callback with invalid state format
curl 'https://localhost/api/auth/oauth/google/callback?code=abc&state=short'
# Expected: 400 Bad Request - validation error
```

---

## Deployment Checklist

### Before Deploying

- [ ] All 5 fixes implemented
- [ ] Environment variables set in production
  - [ ] `GOOGLE_CLIENT_ID`
  - [ ] `GOOGLE_CLIENT_SECRET`
  - [ ] `GOOGLE_REDIRECT_URI` (must match Google Console)
- [ ] Manual tests passed
- [ ] Rate limiting tested
- [ ] CSRF protection tested
- [ ] Cookies tested in browser
- [ ] Error handling tested

### Production Environment Variables

Add to `/srcs/backend/.env`:
```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=https://your-domain.com/api/auth/oauth/google/callback
```

### Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI:
   ```
   https://your-domain.com/api/auth/oauth/google/callback
   ```
4. Copy Client ID and Client Secret to `.env`

---

## Monitoring & Logging

### Key Metrics to Monitor

1. **OAuth State Cleanup**
   ```javascript
   // Check state count periodically
   logger.info('OAuth state count', { 
     count: oauthStateManager.getStateCount() 
   })
   ```

2. **Rate Limit Hits**
   - Track 429 responses
   - Alert if > 100/hour

3. **CSRF Validation Failures**
   - Track invalid state attempts
   - Alert if > 10/hour (potential attack)

4. **OAuth Errors**
   - Track Google error responses
   - Monitor callback failure rate

---

## Next Steps After Fixes

Once all 5 critical fixes are deployed:

1. **Implement OAuth Link/Unlink** (see Phase 2 in main analysis)
2. **Add Unit Tests** (see Phase 4)
3. **Complete API Documentation** (see Phase 5)
4. **Consider Additional Providers** (GitHub, Facebook)

---

## Need Help?

If you encounter issues during implementation:

1. Check logs for error messages
2. Verify environment variables are set
3. Test each fix independently
4. Review the OAuth flow diagram in main analysis
5. Check Google OAuth documentation

