/**
 * @brief Simple refresh token business logic
 * 
 * @description Pure function that handles refresh token request to backend.
 * Uses Zod schemas for validation and validates server response.
 * 
 * NOTE: refreshToken is now stored in httpOnly cookie and automatically sent by browser.
 * The refreshToken parameter is kept for backward compatibility but is ignored (empty string).
 * 
 * @param _refreshToken - Deprecated parameter (refresh token now in httpOnly cookie)
 * @param endpoint - API endpoint for token refresh
 * 
 * @return Promise<RefreshResponse> - Validated refresh response
 */

import { validateData } from '../utils/validation'
import { 
  RefreshResponseSchema,
  type RefreshResponse
} from './schemas/auth.schemas'
import { apiService } from '../api/BaseApiService'
import { catchErrorTyped } from '../error'

/**
 * @brief Execute token refresh request with validation
 * 
 * NOTE: The refreshToken parameter is deprecated. The actual refresh token
 * is stored in an httpOnly cookie and automatically sent by the browser
 * with the request. We keep this parameter for backward compatibility.
 * 
 * @param _refreshToken - Deprecated (pass empty string), token is in httpOnly cookie
 * @param endpoint - Token refresh endpoint
 * 
 * @return Promise<RefreshResponse> - Validated response from backend
 */
export async function executeRefreshToken(
  _refreshToken: string,
  endpoint: string = '/auth/refresh'
): Promise<RefreshResponse> {
  // NOTE: _refreshToken parameter is ignored - actual token is in httpOnly cookie
  // No need to validate empty request body
  
  // Make API request - browser automatically sends refreshToken cookie
  // No need to include refreshToken in request body
  const [error, response] = await catchErrorTyped(
    apiService.post(endpoint, {}) // Empty body - token is in cookie
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