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
 * @brief Check if OAuth is configured
 * @return {boolean} True if all OAuth env vars are set
 */
export function isOAuthConfigured() {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI
  )
}

/**
 * @brief Export validated OAuth configuration
 */
export const oauthConfig = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'https://localhost/api/auth/oauth/google/callback',
    scopes: ['openid', 'email', 'profile'],
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo'
  }
}

export default oauthConfig
