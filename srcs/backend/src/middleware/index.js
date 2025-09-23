/**
 * @brief Middleware exports for ft_transcendence backend
 * 
 * @description Centralized exports for all middleware modules
 */

// Authentication middleware
export {
  requireAuth,
  requireEmailVerified,
  requireRole,
  optionalAuth,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  sanitizeUser
} from './authentication.js'

// Validation middleware
export {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  checkUsernameSchema,
  refreshTokenSchema,
  validatePasswordStrength,
  validationErrorHandler,
  rateLimitSchema
} from './validation.js'