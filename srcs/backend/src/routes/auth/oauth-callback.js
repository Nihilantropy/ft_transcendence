import { logger } from '../../logger.js'
import { generateTokenPair } from '../../utils/jwt.js'
import userService from '../../services/user.service.js'

const oauthCallbackLogger = logger.child({ module: 'routes/auth/oauth-callback' })

async function oauthCallbackRoute(fastify, options) {
  fastify.get('/oauth/google/callback', async (request, reply) => {
    try {
      const { code, state, error } = request.query

      oauthCallbackLogger.info('🌐 Google OAuth callback received')

      if (error) throw new Error(`OAuth error: ${error}`)
      if (!code || !state) throw new Error('Missing authorization code or state')

      // 1. Exchange code for tokens
      const tokenData = await exchangeCodeForTokens(code)
      
      // 2. Get user profile from Google
      const googleProfile = await getGoogleUserProfile(tokenData.access_token)
      
      // 3. Find or create user using existing service
      const { user, isNewUser } = await findOrCreateOAuthUser(googleProfile)
      
      // 4. Generate JWT tokens
      const { accessToken, refreshToken } = generateTokenPair(user)
      
      // 5. Update user status to online
      userService.updateUserOnlineStatus(user.id, true)
      
      // 6. Redirect to appropriate frontend route
      const redirectUrl = isNewUser 
        ? `https://localhost/username-selection?token=${accessToken}&refresh=${refreshToken}`
        : `https://localhost/profile?token=${accessToken}&refresh=${refreshToken}`
      
      reply.redirect(redirectUrl)
      
    } catch (error) {
      oauthCallbackLogger.error('❌ Google OAuth failed', { error: error.message })
      reply.redirect(`https://localhost/login?error=${encodeURIComponent(error.message)}`)
    }
  })
}

/**
 * @brief Exchange authorization code for Google tokens
 */
async function exchangeCodeForTokens(code) {
  oauthCallbackLogger.info('🔄 Exchanging code for tokens', { 
    clientId: process.env.GOOGLE_CLIENT_ID ? 'SET' : 'MISSING',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'MISSING',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'https://localhost/api/auth/oauth/google/callback'
  })
  oauthCallbackLogger.debug('Sent code', { code: code.substring(0, 8) + '...' })

  const tokenParams = {
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
    code,
    grant_type: 'authorization_code',
    redirect_uri: process.env.GOOGLE_REDIRECT_URI || 'https://localhost/api/auth/oauth/google/callback'
  }
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(tokenParams)
  })

  if (!response.ok) {
    oauthCallbackLogger.error('🌐 Google OAuth tokens exchange failed', { 
      status: response.status, 
      body: await response.text(),
      sentParams: Object.keys(tokenParams)
    })
    throw new Error('Failed to exchange code for tokens')
  }
  return await response.json()
}

/**
 * @brief Get user profile from Google API
 */
async function getGoogleUserProfile(accessToken) {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  })

  if (!response.ok) {
    throw new Error('Failed to fetch user profile')
  }

  return await response.json()
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
    userService.updateUserOAuthData(user.id, 'google', googleProfile.id)
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