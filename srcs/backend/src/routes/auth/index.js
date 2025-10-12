/**
 * @brief Authentication routes aggregator for ft_transcendence backend
 * 
 * @description Registers all auth-related routes with /auth prefix:
 * - Basic authentication (login, register, logout, refresh)
 * - Password management (forgot, reset)
 * - Email verification (verify, resend)
 * - Google OAuth 2.0 (initiate, callback with auto-linking)
 * - Two-Factor Authentication (setup, verify, disable)
 */

import { logger } from '../../logger.js'

// Basic authentication routes
import registerRoute from './register.js'
import loginRoute from './login.js'
import logoutRoute from './logout.js'
import refreshRoute from './refresh.js'

// Password management routes
import forgotPasswordRoute from './forgot-password.js'
import resetPasswordRoute from './reset-password.js'

// Email verification routes
import verifyEmailRoute from './verify-email.js'
import resendVerificationRoute from './resend-verification.js'

// OAuth 2.0 routes (Google only)
import oauthInitiateRoute from './oauth-initiate.js'
import oauthCallbackRoute from './oauth-callback.js'

// Two-Factor Authentication routes
import twoFactorSetupRoute from './2fa-setup.js'
import twoFactorVerifySetupRoute from './2fa-verify-setup.js'
import twoFactorVerifyRoute from './2fa-verify.js'
import twoFactorDisableRoute from './2fa-disable.js'

// Create route-specific logger
const authLogger = logger.child({ module: 'routes/auth' })

/**
 * @brief Register all authentication routes
 * @param {FastifyInstance} fastify - The Fastify instance
 * @param {Object} options - Route options
 */
async function authRoutes(fastify, options) {
  authLogger.info('🔐 Registering authentication routes...')
  
  // =============================================================================
  // BASIC AUTHENTICATION ROUTES
  // =============================================================================
  
  await fastify.register(registerRoute)
  authLogger.info('✅ Registration route registered')
  
  await fastify.register(loginRoute)
  authLogger.info('✅ Login route registered')
  
  await fastify.register(logoutRoute)
  authLogger.info('✅ Logout route registered')
  
  await fastify.register(refreshRoute)
  authLogger.info('✅ Refresh route registered')
  
  // =============================================================================
  // PASSWORD MANAGEMENT ROUTES
  // =============================================================================
  
  await fastify.register(forgotPasswordRoute)
  authLogger.info('✅ Forgot password route registered')
  
  await fastify.register(resetPasswordRoute)
  authLogger.info('✅ Reset password route registered')
  
  // =============================================================================
  // EMAIL VERIFICATION ROUTES
  // =============================================================================
  
  await fastify.register(verifyEmailRoute)
  authLogger.info('✅ Verify email route registered')
  
  await fastify.register(resendVerificationRoute)
  authLogger.info('✅ Resend verification route registered')
  
  // =============================================================================
  // OAUTH 2.0 ROUTES (Google only - auto-linking enabled)
  // =============================================================================
  
  await fastify.register(oauthInitiateRoute)
  authLogger.info('✅ Google OAuth initiate route registered')
  
  await fastify.register(oauthCallbackRoute)
  authLogger.info('✅ Google OAuth callback route registered')
  
  // =============================================================================
  // TWO-FACTOR AUTHENTICATION ROUTES
  // =============================================================================
  
  await fastify.register(twoFactorSetupRoute)
  authLogger.info('✅ 2FA setup route registered')
  
  await fastify.register(twoFactorVerifySetupRoute)
  authLogger.info('✅ 2FA verify setup route registered')
  
  await fastify.register(twoFactorVerifyRoute)
  authLogger.info('✅ 2FA verify route registered')
  
  await fastify.register(twoFactorDisableRoute)
  authLogger.info('✅ 2FA disable route registered')
  
  authLogger.info('✅ All authentication routes registered successfully')
}

export default authRoutes
