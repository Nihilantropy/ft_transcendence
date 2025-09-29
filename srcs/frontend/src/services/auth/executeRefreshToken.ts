/**
 * @brief Simple refresh token business logic
 * 
 * @description Pure function that handles refresh token request to backend.
 * Uses Zod schemas for validation and validates server response.
 * 
 * @param refreshToken - Current refresh token
 * @param endpoint - API endpoint for token refresh
 * 
 * @return Promise<RefreshResponse> - Validated refresh response
 */

import { validateData } from '../utils/validation'
import { 
  RefreshTokenRequestSchema,
  RefreshResponseSchema,
  type RefreshTokenRequest,
  type RefreshResponse
} from './schemas/auth.schemas'
import { apiService } from '../api/BaseApiService'
import { catchErrorTyped } from '../error'

/**
 * @brief Execute token refresh request with validation
 * 
 * @param refreshToken - Current refresh token string
 * @param endpoint - Token refresh endpoint
 * 
 * @return Promise<RefreshResponse> - Validated response from backend
 */
export async function executeRefreshToken(
  refreshToken: string,
  endpoint: string = '/auth/refresh'
): Promise<RefreshResponse> {
  // Validate input with Zod
  const requestData: RefreshTokenRequest = { refreshToken }
  const validation = validateData(RefreshTokenRequestSchema, requestData)
  if (!validation.success) {
    throw new Error(`Invalid refresh token: ${validation.errors.join(', ')}`)
  }

  const validRequestData = validation.data

  // Make API request
  const [error, response] = await catchErrorTyped(
    apiService.post(endpoint, validRequestData)
  )

  if (error || !response) {
    throw new Error(error?.message || 'Token refresh failed')
  }

  console.log('✅ Token refresh request successful:', response)

  // Validate response with Zod
  const responseValidation = validateData(RefreshResponseSchema, response.data)
  if (!responseValidation.success) {
    throw new Error('Invalid server response format')
  }

  return responseValidation.data
}