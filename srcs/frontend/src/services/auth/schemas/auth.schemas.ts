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
  avatar: z.string().optional(),
  is_online: z.boolean().optional(),
  twoFactorEnabled: z.boolean().default(false),
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
 * Backend expects both password and confirmPassword for validation
 */
export const RegisterRequestSchema = z.object({
  email: z.string()
    .email("Valid email required")
    .describe("Valid email address"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password too long")
    .refine((password) => {
      const validation = PasswordUtils.validatePassword(password)
      return validation.isValid
    }, {
      message: "Password does not meet complexity requirements"
    }),
  confirmPassword: z.string()
    .min(8, "Confirm password must be at least 8 characters")
    .max(128, "Confirm password too long")
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
})

/**
 * @brief Token refresh request schema
 */
export const RefreshTokenRequestSchema = z.object({

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
 * @brief 2FA setup initiation request
 * Used when user starts 2FA setup process
 */
export const Setup2FARequestSchema = z.object({
  // Usually no data needed for setup initiation, but keeping extensible
});


/**
 * @brief 2FA setup verification request
 * Used specifically for verifying the 2FA setup process
 */
export const Verify2FASetupRequestSchema = z.object({
  token: z.string().length(6).regex(/^\d{6}$/, "Must be 6 digits"),
  secret: z.string().min(1, "Secret is required"),
});

/**
 * @brief 2FA verification request for login
 * Used for verifying 2FA during login process
 */
export const Verify2FARequestSchema = z.object({
  tempToken: z.string().min(1, "Temporary token is required"),
  token: z.string().length(6).regex(/^\d{6}$/, "Must be 6 digits").optional(),
  backupCode: z.string().optional(),
}).refine(data => data.token || data.backupCode, {
  message: "Either TOTP token or backup code is required",
});

/**
 * @brief 2FA disable request schema
 * Used for disabling 2FA on user account
 */
export const Disable2FARequestSchema = z.object({
  password: z.string().min(1, "Password is required for 2FA disable"),
  token: z.string().length(6).regex(/^\d{6}$/, "Must be 6 digits").optional(),
});

/**
 * @brief 2FA status response
 * Current user's 2FA configuration status
 */
export const TwoFactorStatusSchema = z.object({
  enabled: z.boolean(),
  hasBackupCodes: z.boolean(),
});




// =============================================================================
// RESPONSE SCHEMAS
// =============================================================================

/**
 * @brief Login response schema matching backend
 * When 2FA is required: returns requiresTwoFactor=true + tempToken, NO user object
 * When 2FA not required: returns user object
 * Access token and refresh token are both set in httpOnly cookies by backend (not in response body)
 */
export const LoginResponseSchema = z.object({
  success: z.boolean().nonoptional(),
  message: z.string().nonoptional(),
  user: UserSchema.optional(), // Only present when 2FA not required
  requiresTwoFactor: z.boolean().optional(), // Only present when 2FA required
  tempToken: z.string().optional() // Only present when 2FA required
})

/**
 * @brief Register response schema matching backend
 * Access token and refresh token are set in httpOnly cookies (not in response body)
 */
export const RegisterResponseSchema = z.object({
  success: z.boolean().nonoptional(),
  message: z.string().nonoptional(),
  user: UserSchema.nonoptional()
})

/**
 * @brief Email verification response schema
 * Access token and refresh token are set in httpOnly cookies (not in response body)
 */
export const VerifyEmailResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  user: UserSchema
})

/**
 * @brief Token refresh response schema
 * New access token and refresh token (if rotated) are set in httpOnly cookies
 */
export const RefreshResponseSchema = z.object({
  success: z.boolean(),
  message: z.string()
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
 * @brief 2FA setup verification response schema
 */
export const Verify2FASetupResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  user: UserSchema
})

/**
 * @brief 2FA verification response schema for login
 * Access token and refresh token are set in httpOnly cookies by backend (not in response body)
 */
export const Verify2FAResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  user: UserSchema
})

/**
 * @brief 2FA disable response schema
 */
export const Disable2FAResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  user: UserSchema
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
export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>
export type VerifyEmailQuery = z.infer<typeof VerifyEmailQuerySchema>
export type ResendVerificationEmailRequest = z.infer<typeof ResendVerificationEmailSchema>
export type Setup2FARequest = z.infer<typeof Setup2FARequestSchema>
export type Verify2FASetupRequest = z.infer<typeof Verify2FASetupRequestSchema>
export type Verify2FARequest = z.infer<typeof Verify2FARequestSchema>
export type Disable2FARequest = z.infer<typeof Disable2FARequestSchema>

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
export type Disable2FAResponse = z.infer<typeof Disable2FAResponseSchema>


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