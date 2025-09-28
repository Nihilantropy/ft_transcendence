/**
 * @brief Secure cookie implementation for authentication routes
 * 
 * @description Shows how to implement HTTP-only cookie authentication:
 * - Set access token as HTTP-only cookie
 * - Return refresh token in response body
 * - Clear cookies on logout
 */

// =============================================================================
// COOKIE CONFIGURATION
// =============================================================================

const COOKIE_CONFIG = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', // HTTPS in production
  sameSite: 'strict',
  path: '/',
  domain: process.env.NODE_ENV === 'production' ? '.yourdomain.com' : undefined
}

export const ACCESS_TOKEN_CONFIG = {
  ...COOKIE_CONFIG,
  maxAge: 15 * 60 * 1000 // 15 minutes
}

export const REFRESH_TOKEN_CONFIG = {
  ...COOKIE_CONFIG,
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
}