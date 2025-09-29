/**
 * @brief Simple resend verification email business logic
 * 
 * @description Pure function that handles resend verification email request to backend.
 * Uses Zod schemas for validation and validates server response.
 * 
 * @param email - User email address
 * @param endpoint - API endpoint for resend verification email
 * 
 * @return Promise<SuccessResponse> - Validated resend verification response
 */

import { z } from 'zod'
import { validateData } from '../utils/validation'
import { 
  SuccessResponseSchema,
  ResendVerificationEmailSchema,
  type ResendVerificationEmailRequest,
  type SuccessResponse
} from './schemas/auth.schemas'
import { apiService } from '../api/BaseApiService'
import { catchErrorTyped } from '../error'

/**
 * @brief Execute resend verification email request with validation
 * 
 * @param email - User email address
 * @param endpoint - Resend verification endpoint
 * 
 * @return Promise<SuccessResponse> - Validated response from backend
 */
export async function executeResendVerificationEmail(
  email: string,
  endpoint: string = '/auth/resend-verification'
): Promise<SuccessResponse> {
  // Validate input email with Zod
  const requestData: ResendVerificationEmailRequest = { email }
  const validation = validateData(ResendVerificationEmailSchema, requestData)
  if (!validation.success) {
    throw new Error(`Invalid email: ${validation.errors.join(', ')}`)
  }

  const validRequestData = validation.data

  // Make API request
  const [error, response] = await catchErrorTyped(
    apiService.post(endpoint, validRequestData)
  )

  if (error || !response) {
    throw new Error(error?.message || 'Failed to resend verification email')
  }

  console.log('✅ Resend verification email request successful:', response)

  // Validate response with Zod
  const responseValidation = validateData(SuccessResponseSchema, response.data)
  if (!responseValidation.success) {
    throw new Error('Invalid server response format')
  }

  return responseValidation.data
}