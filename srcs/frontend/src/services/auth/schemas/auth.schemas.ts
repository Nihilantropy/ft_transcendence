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

// Response types
export type LoginResponse = z.infer<typeof LoginResponseSchema>
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>
export type VerifyEmailResponse = z.infer<typeof VerifyEmailResponseSchema>
export type RefreshResponse = z.infer<typeof RefreshResponseSchema>
export type SuccessResponse = z.infer<typeof SuccessResponseSchema>
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>

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