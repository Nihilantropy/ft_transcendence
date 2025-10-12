/**
 * @brief Forgot password business logic
 * 
 * @description Pure function that handles forgot password request to backend.
 * Uses Zod schemas for validation and validates server response.
 * This is the same as executeRequestPasswordReset but with clearer naming.
 * 
 * @param email - User email address
 * @param endpoint - API endpoint for forgot password
 * 
 * @return Promise<SuccessResponse> - Validated forgot password response
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
 * @brief Execute forgot password request with validation
 * 
 * @param email - User email address
 * @param endpoint - Forgot password endpoint (default: /auth/forgot-password)
 * 
 * @return Promise<SuccessResponse> - Validated response from backend
 * @throws Error if validation fails or request fails
 */
export async function executeForgotPassword(
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

  console.log('✅ Forgot password request successful:', response.data)

  // Validate response with Zod
  const responseValidation = validateData(SuccessResponseSchema, response.data)
  if (!responseValidation.success) {
    throw new Error('Invalid server response format')
  }

  return responseValidation.data
}
