/**
 * @brief Simple password reset request business logic
 * 
 * @description Pure function that handles password reset request to backend.
 * Uses Zod schemas for validation and validates server response.
 * 
 * @param email - User email address
 * @param endpoint - API endpoint for password reset request
 * 
 * @return Promise<SuccessResponse> - Validated password reset response
 */

import { validateData } from '../utils/validation'
import { 
  PasswordResetEmailSchema,
  SuccessResponseSchema,
  type SuccessResponse,
  type PasswordResetEmailRequest
} from './schemas/auth.schemas'
import { apiService } from '../api/BaseApiService'
import { catchErrorTyped } from '../error'

/**
 * @brief Execute password reset request with validation
 * 
 * @param email - User email address
 * @param endpoint - Password reset endpoint
 * 
 * @return Promise<SuccessResponse> - Validated response from backend
 */
export async function executeRequestPasswordReset(
  email: string,
  endpoint: string = '/auth/forgot-password'
): Promise<SuccessResponse> {
  // Validate input email with Zod
  const requestData: PasswordResetEmailRequest = { email }
  const validation = validateData(PasswordResetEmailSchema, requestData)
  if (!validation.success) {
    throw new Error(`Invalid email: ${validation.errors.join(', ')}`)
  }

  const validRequestData = validation.data

  // Make API request
  const [error, response] = await catchErrorTyped(
    apiService.post(endpoint, validRequestData)
  )

  if (error || !response) {
    throw new Error(error?.message || 'Failed to request password reset')
  }

  console.log('✅ Password reset request successful:', response)

  // Validate response with Zod
  const responseValidation = validateData(SuccessResponseSchema, response.data)
  if (!responseValidation.success) {
    throw new Error('Invalid server response format')
  }

  return responseValidation.data
}