/**
 * @file User schemas for frontend validation
 * @description Zod schemas for user profile operations
 */

import { z } from 'zod'

// =============================================================================
// USER OBJECT SCHEMAS
// =============================================================================

/**
 * @brief Base user schema with core properties
 * Backend uses camelCase for formatted responses (formatAuthUser)
 */
export const UserSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().email(),
  emailVerified: z.boolean().optional(),
  avatar: z.string().nullable().optional(),
  isOnline: z.boolean().optional(),
  twoFactorEnabled: z.boolean().default(false),
})

/**
 * @brief Public user profile (limited information)
 */
export const PublicUserSchema = z.object({
  id: z.number(),
  username: z.string(),
  avatar: z.string().nullable().optional(),
  isOnline: z.boolean().optional(),
  createdAt: z.string().nullable().optional(),
})

/**
 * @brief Complete user profile (own profile)
 */
export const CompleteUserSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().email(),
  emailVerified: z.boolean(),
  avatar: z.string().nullable().optional(),
  twoFactorEnabled: z.boolean(),
  isOnline: z.boolean().optional(),
  lastSeen: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
})

/**
 * @brief User preview for search results
 */
export const UserPreviewSchema = z.object({
  id: z.number(),
  username: z.string(),
  avatar: z.string().nullable().optional(),
  isOnline: z.boolean().optional(),
})

// =============================================================================
// REQUEST SCHEMAS
// =============================================================================

/**
 * @brief Username update request
 */
export const UpdateUsernameRequestSchema = z.object({
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must not exceed 20 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, and hyphens")
})

/**
 * @brief Avatar upload validation (client-side File object)
 * @description Validates image file before upload to /users/upload-avatar
 */
export const AvatarFileSchema = z.instanceof(File)
  .refine((file) => file.size <= 5 * 1024 * 1024, {
    message: "File size must be less than 5MB"
  })
  .refine((file) => file.type.startsWith('image/'), {
    message: "File must be an image (JPEG, PNG, GIF, or WebP)"
  })
  .refine((file) => ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type), {
    message: "Only JPEG, PNG, GIF, and WebP images are supported"
  })

/**
 * @brief Delete user account request
 * @description Password is optional - required for password-based accounts, not needed for OAuth accounts
 */
export const DeleteUserRequestSchema = z.object({
  password: z.string().optional(),
  confirmation: z.literal("DELETE")
})

/**
 * @brief Username availability check query
 */
export const CheckUsernameQuerySchema = z.object({
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must not exceed 20 characters")
})

/**
 * @brief User search query
 */
export const SearchUsersQuerySchema = z.object({
  q: z.string()
    .min(1, "Search query is required")
    .max(50, "Search query too long"),
  limit: z.number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .optional()
})

// =============================================================================
// RESPONSE SCHEMAS
// =============================================================================

/**
 * @brief Complete profile response (GET /users/me)
 */
export const CompleteProfileResponseSchema = z.object({
  success: z.boolean(),
  user: CompleteUserSchema
})

/**
 * @brief Public profile response (GET /users/:userId)
 */
export const PublicProfileResponseSchema = z.object({
  success: z.boolean(),
  user: PublicUserSchema,
  message: z.string().optional(),
  redirectTo: z.string().optional()
})

/**
 * @brief Search users response (GET /users/search)
 */
export const SearchUsersResponseSchema = z.object({
  success: z.boolean(),
  users: z.array(UserPreviewSchema),
  count: z.number()
})

/**
 * @brief Username availability check response
 */
export const CheckUsernameResponseSchema = z.object({
  available: z.boolean().optional(),
  message: z.string()
})

/**
 * @brief Username update response
 */
export const UpdateUsernameResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  user: CompleteUserSchema
})

/**
 * @brief Avatar update response
 */
export const UpdateAvatarResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  user: CompleteUserSchema
})

/**
 * @brief Delete user response
 */
export const DeleteUserResponseSchema = z.object({
  success: z.boolean(),
  message: z.string()
})

/**
 * @brief Error response schema
 */
export const UserErrorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  error: z.object({
    code: z.string(),
    details: z.string()
  }).optional()
})

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type User = z.infer<typeof UserSchema>
export type PublicUser = z.infer<typeof PublicUserSchema>
export type CompleteUser = z.infer<typeof CompleteUserSchema>
export type UserPreview = z.infer<typeof UserPreviewSchema>

export type UpdateUsernameRequest = z.infer<typeof UpdateUsernameRequestSchema>
export type AvatarFile = z.infer<typeof AvatarFileSchema>
export type DeleteUserRequest = z.infer<typeof DeleteUserRequestSchema>
export type CheckUsernameQuery = z.infer<typeof CheckUsernameQuerySchema>
export type SearchUsersQuery = z.infer<typeof SearchUsersQuerySchema>

export type CompleteProfileResponse = z.infer<typeof CompleteProfileResponseSchema>
export type PublicProfileResponse = z.infer<typeof PublicProfileResponseSchema>
export type SearchUsersResponse = z.infer<typeof SearchUsersResponseSchema>
export type CheckUsernameResponse = z.infer<typeof CheckUsernameResponseSchema>
export type UpdateUsernameResponse = z.infer<typeof UpdateUsernameResponseSchema>
export type UpdateAvatarResponse = z.infer<typeof UpdateAvatarResponseSchema>
export type DeleteUserResponse = z.infer<typeof DeleteUserResponseSchema>
export type UserErrorResponse = z.infer<typeof UserErrorResponseSchema>
