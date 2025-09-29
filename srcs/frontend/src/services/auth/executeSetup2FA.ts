/**
 * @brief Simple 2FA setup business logic
 * 
 * @description Pure function that handles 2FA setup request to backend.
 * Uses Zod schemas for validation and validates server response.
 * 
 * @param userId - Current user ID
 * @param endpoint - API endpoint for 2FA setup
 * 
 * @return Promise<Setup2FAResponse> - Validated 2FA setup response
 */

import { validateData } from '../utils/validation'
import { apiService } from '../api/BaseApiService'
import { catchErrorTyped } from '../error'
import { 
  Setup2FARequestSchema,
  Setup2FAResponseSchema,
  type Setup2FARequest,
  type Setup2FAResponse
} from './schemas/auth.schemas'

/**
 * @brief Execute 2FA setup request with validation
 * 
 * @param userId - Current user ID
 * @param endpoint - 2FA setup endpoint
 * 
 * @return Promise<Setup2FAResponse> - Validated response from backend
 */
export async function executeSetup2FA(
  userId: number,
  endpoint: string = '/auth/2fa/setup'
): Promise<Setup2FAResponse> {
  // Validate input with Zod
  const requestData: Setup2FARequest = { userId }
  const validation = validateData(Setup2FARequestSchema, requestData)
  if (!validation.success) {
    throw new Error(`Invalid user ID: ${validation.errors.join(', ')}`)
  }

  const validRequestData = validation.data

  // Make API request
  const [error, response] = await catchErrorTyped(
    apiService.post(endpoint, validRequestData)
  )

  if (error || !response) {
    throw new Error(error?.message || '2FA setup failed')
  }

  console.log('✅ 2FA setup request successful:', response)

  // Validate response with Zod
  const responseValidation = validateData(Setup2FAResponseSchema, response.data)
  if (!responseValidation.success) {
    throw new Error('Invalid server response format')
  }

  return responseValidation.data
}
