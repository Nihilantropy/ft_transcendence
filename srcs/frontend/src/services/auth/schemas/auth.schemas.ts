/**
 * @brief Frontend authentication schemas aligned with backend
 * 
 * @description Zod schemas matching backend auth.js for consistent validation
 * Single source of truth for request/response data structures
 */

import { z } from 'zod'
import { PasswordUtils } from '../../utils'

// =============================================================================
// BASE USER SCHEMA
// =============================================================================

/**
 * @brief User entity schema matching backend user structure
 */
export const UserSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().email(),
  email_verified: z.boolean(),
  is_online: z.boolean().optional()
})

// =============================================================================
// REQUEST SCHEMAS
// =============================================================================

/**
 * @brief Login request schema with 2FA support
 */
export const LoginRequestSchema = z.object({
  identifier: z.string()
    .min(3, "Username or email must be at least 3 characters")
    .max(30, "Username or email too long"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password too long"),
  rememberMe: z.boolean().optional(),
  twoFactorToken: z.string().optional()
})

/**
 * @brief Register request schema (backend structure)
 */
export const RegisterRequestSchema = z.object({
  email: z.string()
    .email("Valid email required")
    .describe("Valid email address"),
  password: z.string()
    .refine(PasswordUtils.validatePassword, {
      message: "Password does not meet complexity requirements"
    }),
})

/**
 * @brief Frontend-only registration with confirmation
 */
export const RegisterFormSchema = RegisterRequestSchema.extend({
  confirmPassword: z.string().min(1, "Please confirm password")
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
})

/**
 * @brief Token refresh request schema
 */
export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string().describe("Refresh token to obtain new access token")
})

/**
 * @brief Email verification query schema
 */
export const VerifyEmailQuerySchema = z.object({
  token: z.string()
    .min(32, "Invalid verification token")
    .describe("Email verification token from query string")
})

/**
 * @brief 2FA setup request schema
 */
export const Setup2FARequestSchema = z.object({
  userId: z.number().positive('Valid user ID required')
})

/**
 * @brief 2FA setup verification request schema
 */
export const Verify2FASetupRequestSchema = z.object({
  userId: z.number().positive('Valid user ID required'),
  token: z.string().min(6, 'TOTP token must be at least 6 digits').max(6, 'TOTP token must be exactly 6 digits'),
  secret: z.string().min(16, 'Invalid secret key format')
})

/**
 * @brief 2FA verification request schema
 */
export const Verify2FARequestSchema = z.object({
  userId: z.number().positive('Valid user ID required'),
  token: z.string().length(6, 'TOTP token must be exactly 6 digits').optional(),
  backupCode: z.string().min(8, 'Invalid backup code format').optional()
}).refine(data => data.token || data.backupCode, {
  message: 'Either TOTP token or backup code must be provided',
  path: ['token']
})


// =============================================================================
// RESPONSE SCHEMAS
// =============================================================================

/**
 * @brief Login response schema matching backend
 */
export const LoginResponseSchema = z.object({
  success: z.boolean().nonoptional(),
  message: z.string().nonoptional(),
  user: UserSchema.nonoptional(),
  refreshToken: z.string()
    .describe("Refresh token for memory storage")
    .optional(),
  requiresTwoFactor: z.boolean().optional(),
  tempToken: z.string().optional()
})

/**
 * @brief Register response schema matching backend
 */
export const RegisterResponseSchema = z.object({
  success: z.boolean().nonoptional(),
  message: z.string().nonoptional(),
  user: UserSchema.nonoptional(),
  refreshToken: z.string()
    .describe("Refresh token for memory storage")
    .optional(),
})

/**
 * @brief Email verification response schema
 */
export const VerifyEmailResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  user: UserSchema,
  refreshToken: z.string().describe("Refresh token for memory storage")
})

/**
 * @brief Token refresh response schema
 */
export const RefreshResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  refreshToken: z.string()
    .describe("New refresh token (optional rotation)")
    .optional()
})

/**
 * @brief Password reset email request schema
 */
export const PasswordResetEmailSchema = z.object({
  email: z.string().email('Valid email required')
})

/**
 * @brief Resend verification email request schema
 */
export const ResendVerificationEmailSchema = z.object({
  email: z.string().email('Valid email required')
})

/**
 * @brief 2FA setup verification response schema
 */
export const Verify2FASetupResponseSchema = z.object({
  success: z.boolean(),
  message: z.string()
})

/**
 * @brief 2FA setup response schema
 */
export const Setup2FAResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  setupData: z.object({
    secret: z.string(),
    qrCode: z.string(),
    backupCodes: z.array(z.string())
  }).optional()
})

/**
 * @brief 2FA verification response schema
 */
export const Verify2FAResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  tokens: z.object({
    accessToken: z.string(),
    refreshToken: z.string().optional()
  }).optional()
})


/**
 * @brief Generic success response for logout, etc.
 */
export const SuccessResponseSchema = z.object({
  success: z.boolean(),
  message: z.string()
})

// =============================================================================
// ERROR RESPONSE SCHEMAS
// =============================================================================

/**
 * @brief Standard error response structure
 */
export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  error: z.object({
    code: z.string(),
    details: z.string()
  }).optional()
})

// =============================================================================
// EXPORTED TYPES
// =============================================================================

export type User = z.infer<typeof UserSchema>

// Request types
export type LoginRequest = z.infer<typeof LoginRequestSchema>
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>
export type RegisterForm = z.infer<typeof RegisterFormSchema>
export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>
export type VerifyEmailQuery = z.infer<typeof VerifyEmailQuerySchema>
export type ResendVerificationEmailRequest = z.infer<typeof ResendVerificationEmailSchema>
export type Setup2FARequest = z.infer<typeof Setup2FARequestSchema>
export type Verify2FASetupRequest = z.infer<typeof Verify2FASetupRequestSchema>
export type Verify2FARequest = z.infer<typeof Verify2FARequestSchema>

// Response types
export type LoginResponse = z.infer<typeof LoginResponseSchema>
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>
export type VerifyEmailResponse = z.infer<typeof VerifyEmailResponseSchema>
export type RefreshResponse = z.infer<typeof RefreshResponseSchema>
export type PasswordResetEmailRequest = z.infer<typeof PasswordResetEmailSchema>
export type SuccessResponse = z.infer<typeof SuccessResponseSchema>
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>
export type Setup2FAResponse = z.infer<typeof Setup2FAResponseSchema>
export type Verify2FASetupResponse = z.infer<typeof Verify2FASetupResponseSchema>
export type Verify2FAResponse = z.infer<typeof Verify2FAResponseSchema>

// =============================================================================
// SCHEMA VALIDATION UTILITIES
// =============================================================================

/**
 * @brief Validate API response safely
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @return Parsed data or null if invalid
 */
export function safeParseApiResponse<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T | null {
  const result = schema.safeParse(data)
  return result.success ? result.data : null
}

/**
 * @brief Type guard for error responses
 * @param response - API response to check
 * @return True if response is an error
 */
export function isErrorResponse(
  response: unknown
): response is ErrorResponse {
  return safeParseApiResponse(ErrorResponseSchema, response) !== null
}