/**
 * @brief Simple logout business logic
 * 
 * @description Pure function that handles logout request to backend.
 * Uses Zod schemas for response validation and proper error handling.
 * 
 * @param endpoint - API endpoint for logout
 * 
 * @return Promise<SuccessResponse> - Validated logout response
 */

import { validateData } from '../utils/validation'
import { 
  SuccessResponseSchema,
  type SuccessResponse
} from './schemas/auth.schemas'
import { apiService } from '../api/BaseApiService'
import { catchErrorTyped } from '../error'

/**
 * @brief Execute logout request with validation
 * 
 * @param endpoint - Logout endpoint
 * 
 * @return Promise<SuccessResponse> - Validated response from backend
 */
export async function executeLogout(
  endpoint: string = '/auth/logout'
): Promise<SuccessResponse> {
  // Make API request (logout typically sends empty body)
  const [error, response] = await catchErrorTyped(
    apiService.post(endpoint, {})
  )

  if (error || !response) {
    throw new Error(error?.message || 'Logout failed')
  }

  console.log('✅ Logout request successful:', response)

  // Validate response with Zod
  const responseValidation = validateData(SuccessResponseSchema, response.data)
  if (!responseValidation.success) {
    throw new Error('Invalid server response format')
  }

  return responseValidation.data
}