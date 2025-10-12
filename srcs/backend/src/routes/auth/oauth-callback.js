import { logger } from '../../logger.js'
import { generateTokenPair } from '../../utils/jwt.js'
import { formatAuthUser } from '../../utils/user-formatters.js'
import { setAuthCookies } from '../../utils/coockie.js'
import userService from '../../services/user.service.js'
import { oauthStateManager } from '../../services/oauth-state.service.js'
import { oauthConfig } from '../../config/oauth.config.js'
import { routeOAuthSchemas } from '../../schemas/index.js'

const oauthCallbackLogger = logger.child({ module: 'routes/auth/oauth-callback' })

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
    try {
      const { code, state, error } = request.query

      oauthCallbackLogger.info('🌐 Google OAuth callback received')

      // ✅ FIX 1: Handle OAuth errors from provider
      if (error) {
        oauthCallbackLogger.warn('OAuth error from Google', { error })
        return reply.redirect(`https://localhost/login?error=oauth_${error}`)
      }

      // ✅ FIX 2: Validate required parameters
      if (!code || !state) {
        oauthCallbackLogger.warn('Missing OAuth parameters', { hasCode: !!code, hasState: !!state })
        return reply.redirect('https://localhost/login?error=oauth_invalid')
      }

      // ✅ FIX 3: CSRF Protection - Validate state token
      const stateData = oauthStateManager.validate(state)
      if (!stateData) {
        oauthCallbackLogger.warn('❌ Invalid or expired OAuth state')
        return reply.redirect('https://localhost/login?error=oauth_invalid_state')
      }

      oauthCallbackLogger.debug('✅ OAuth state validated', { userId: stateData.userId })

      // 1. Exchange code for tokens
      const tokenData = await exchangeCodeForTokens(code)
      
      // 2. Get user profile from Google
      const googleProfile = await getGoogleUserProfile(tokenData.access_token)
      
      // 3. Find or create user using existing service
      const { user, isNewUser } = await findOrCreateOAuthUser(googleProfile)
      
      // 4. Generate JWT tokens
      const { accessToken, refreshToken } = generateTokenPair(user)
      
      // ✅ FIX 4: Set authentication cookies
      setAuthCookies(reply, accessToken, refreshToken)
      
      // 5. Update user status to online
      userService.updateUserOnlineStatus(user.id, true)
      
      // 6. Redirect to appropriate frontend route
      const redirectUrl = isNewUser 
        ? `https://localhost/username-selection`
        : `https://localhost/profile`
      
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

/**
 * @brief Exchange authorization code for Google tokens
 */
async function exchangeCodeForTokens(code) {
  oauthCallbackLogger.info('🔄 Exchanging code for tokens')
  oauthCallbackLogger.debug('Authorization code received', { 
    code: code.substring(0, 8) + '...' 
  })

  const tokenParams = {
    client_id: oauthConfig.google.clientId,
    client_secret: oauthConfig.google.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: oauthConfig.google.redirectUri
  }
  
  const response = await fetch(oauthConfig.google.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(tokenParams)
  })

  if (!response.ok) {
    const errorBody = await response.text()
    oauthCallbackLogger.error('🌐 Google OAuth token exchange failed', { 
      status: response.status,
      statusText: response.statusText,
      error: errorBody
    })
    throw new Error(`Failed to exchange code for tokens: ${response.statusText}`)
  }
  
  const tokens = await response.json()
  oauthCallbackLogger.debug('✅ Tokens received', {
    hasAccessToken: !!tokens.access_token,
    hasRefreshToken: !!tokens.refresh_token,
    expiresIn: tokens.expires_in
  })
  
  return tokens
}

/**
 * @brief Get user profile from Google API
 */
async function getGoogleUserProfile(accessToken) {
  oauthCallbackLogger.debug('Fetching user profile from Google')
  
  const response = await fetch(oauthConfig.google.userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })

  if (!response.ok) {
    const errorBody = await response.text()
    oauthCallbackLogger.error('Failed to fetch user profile', { 
      status: response.status,
      error: errorBody
    })
    throw new Error(`Failed to fetch user profile: ${response.statusText}`)
  }

  const profile = await response.json()
  oauthCallbackLogger.debug('✅ User profile received', {
    id: profile.id,
    email: profile.email,
    verified: profile.verified_email
  })
  
  return profile
}

async function findOrCreateOAuthUser(googleProfile) {
  // First check by OAuth provider ID
  let user = userService.findUserByGoogleId(googleProfile.id)
  
  if (user) {
    oauthCallbackLogger.info('✅ Existing OAuth user found', { userId: user.id })
    return { user, isNewUser: false }
  }
  
  // Check by email
  user = userService.getUserByEmail(googleProfile.email)
  
  if (user) {
    // Link Google account to existing user
    oauthCallbackLogger.info('🔗 Linking Google account to existing user', { 
      userId: user.id,
      email: googleProfile.email 
    })
    userService.linkGoogleAccount(user.id, googleProfile.id)
    return { user, isNewUser: false }
  }

  // Create new OAuth user
  const username = userService.createUniqueUsername(googleProfile.email)
  
  user = await userService.createOAuthUser({
    email: googleProfile.email,
    username,
    googleId: googleProfile.id,
    firstName: googleProfile.given_name,
    lastName: googleProfile.family_name,
    avatarUrl: googleProfile.picture
  })

  return { user, isNewUser: true }
}

export default oauthCallbackRoute