/**
 * @brief Simple email verification business logic
 * 
 * @description Pure function that handles email verification request to backend.
 * Uses Zod schemas for validation and validates server response.
 * 
 * @param token - Email verification token from URL query
 * @param endpoint - API endpoint for email verification
 * 
 * @return Promise<VerifyEmailResponse> - Validated verification response
 */

import { validateData } from '../utils/validation'
import { 
  VerifyEmailQuerySchema,
  VerifyEmailResponseSchema,
  type VerifyEmailResponse
} from './schemas/auth.schemas'
import { apiService } from '../api/BaseApiService'
import { catchErrorTyped } from '../error'

/**
 * @brief Execute email verification request with validation
 * 
 * @param token - Raw verification token from query string
 * @param endpoint - Email verification endpoint
 * 
 * @return Promise<VerifyEmailResponse> - Validated response from backend
 */
export async function executeVerifyEmail(
  token: string,
  endpoint: string = '/auth/verify-email'
): Promise<VerifyEmailResponse> {
  // Validate input token with Zod
  const validation = validateData(VerifyEmailQuerySchema, { token })
  if (!validation.success) {
    throw new Error(`Invalid verification token: ${validation.errors.join(', ')}`)
  }

  const validToken = validation.data.token

  // Make API request with token as query parameter
  const [error, response] = await catchErrorTyped(
    apiService.get(`${endpoint}?token=${encodeURIComponent(validToken)}`)
  )

  if (error || !response) {
    throw new Error(error?.message || 'Email verification failed')
  }

  console.log('✅ Email verification request successful:', response)

  // Validate response with Zod
  const responseValidation = validateData(VerifyEmailResponseSchema, response.data)
  if (!responseValidation.success) {
    throw new Error('Invalid server response format')
  }

  return responseValidation.data
}