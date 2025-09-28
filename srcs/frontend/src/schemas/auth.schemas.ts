import { z } from 'zod'

// Base schemas
export const UserSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().email(),
  email_verified: z.boolean().optional(),
  is_online: z.boolean().optional(),
  twoFactorAuth: z.object({
    enabled: z.boolean(),
    setupComplete: z.boolean(),
    backupCodesGenerated: z.boolean()
  }).optional()
})

export const ApiResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.any().optional()
})

// Auth-specific schemas
export const LoginCredentialsSchema = z.object({
  identifier: z.string().min(1, "Email or username required"),
  password: z.string().min(1, "Password required"),
  rememberMe: z.boolean().optional().default(false)
})

export const RegisterCredentialsSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm password")
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
})

export const AuthResponseSchema = ApiResponseSchema.extend({
  data: z.object({
    success: z.boolean(),
    message: z.string(),
    user: UserSchema.optional(),
    refreshToken: z.string().optional(),
    requiresTwoFactor: z.boolean().optional(),
    tempToken: z.string().optional()
  })
})

// Export types
export type User = z.infer<typeof UserSchema>
export type LoginCredentials = z.infer<typeof LoginCredentialsSchema>
export type RegisterCredentials = z.infer<typeof RegisterCredentialsSchema>
export type AuthResponse = z.infer<typeof AuthResponseSchema>