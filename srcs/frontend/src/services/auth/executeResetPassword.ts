/**
 * @brief Reset password business logic
 * 
 * @description Pure function that handles password reset with token.
 * Uses Zod schemas for validation and validates server response.
 * 
 * @param token - Password reset token from email
 * @param newPassword - New password
 * @param confirmPassword - Password confirmation
 * @param endpoint - API endpoint for reset password
 * 
 * @return Promise<ResetPasswordResponse> - Validated reset password response
 */

import { validateData } from '../utils/validation'
import { 
  ResetPasswordRequestSchema,
  ResetPasswordResponseSchema,
  type ResetPasswordRequest,
  type ResetPasswordResponse
} from './schemas/auth.schemas'
import { apiService } from '../api/BaseApiService'
import { catchErrorTyped } from '../error'

/**
 * @brief Execute password reset with validation
 * 
 * @param token - Password reset token from email
 * @param newPassword - New password
 * @param confirmPassword - Password confirmation
 * @param endpoint - Reset password endpoint (default: /auth/reset-password)
 * 
 * @return Promise<ResetPasswordResponse> - Validated response from backend
 * @throws Error if validation fails or request fails
 */
export async function executeResetPassword(
  token: string,
  newPassword: string,
  confirmPassword: string,
  endpoint: string = '/auth/reset-password'
): Promise<ResetPasswordResponse> {
  // Validate input with Zod
  const requestData: ResetPasswordRequest = { 
    token, 
    newPassword, 
    confirmPassword 
  }
  
  const validation = validateData(ResetPasswordRequestSchema, requestData)
  
  if (!validation.success) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`)
  }

  const validRequestData = validation.data

  // Make API request
  const [error, response] = await catchErrorTyped(
    apiService.post(endpoint, validRequestData)
  )

  if (error || !response) {
    throw new Error(error?.message || 'Failed to reset password')
  }

  console.log('✅ Password reset successful:', response.data)

  // Validate response with Zod
  const responseValidation = validateData(ResetPasswordResponseSchema, response.data)
  if (!responseValidation.success) {
    throw new Error('Invalid server response format')
  }

  return responseValidation.data
}
