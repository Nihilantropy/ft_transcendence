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

export const REFRESH_TOKEN_ROTATION_CONFIG = {
  ...REFRESH_TOKEN_CONFIG,
  maxAge: 1 * 24 * 60 * 60 * 1000 // 1 day for rotated tokens
}

// =============================================================================
// COOKIE HELPER FUNCTIONS
// =============================================================================

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
    secure: true, // Always true for production security
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