/**
 * @brief Simple 2FA disable business logic
 * 
 * @description Pure function that handles 2FA disable request to backend.
 * Uses Zod schemas for validation and validates server response.
 * 
 * @param password - User's current password for confirmation
 * @param token - Optional 2FA token for additional security
 * @param endpoint - API endpoint for 2FA disable
 * 
 * @return Promise<Disable2FAResponse> - Validated 2FA disable response
 */

import { validateData } from '../utils/validation'
import { apiService } from '../api/BaseApiService'
import { catchErrorTyped } from '../error'
import { 
  Disable2FARequestSchema,
  Disable2FAResponseSchema,
  type Disable2FARequest,
  type Disable2FAResponse
} from './schemas/auth.schema'

/**
 * @brief Execute 2FA disable request with validation
 * 
 * @param password - User's current password for security confirmation
 * @param token - Optional 2FA token for additional verification
 * @param endpoint - 2FA disable endpoint
 * 
 * @return Promise<Disable2FAResponse> - Validated response from backend
 */
export async function executeDisable2FA(
  password: string,
  token?: string,
  endpoint: string = '/auth/2fa/disable'
): Promise<Disable2FAResponse> {

  // Prepare request data
  const requestData: Disable2FARequest = {
    password,
    ...(token && { token })
  }

  // Validate input with Zod
  const validation = validateData(Disable2FARequestSchema, requestData)
  if (!validation.success) {
    throw new Error(`Invalid disable 2FA request: ${validation.errors.join(', ')}`)
  }

  const validRequestData = validation.data

  // Make API request
  const [error, response] = await catchErrorTyped(
    apiService.post(endpoint, validRequestData)
  )

  if (error || !response) {
    throw new Error(error?.message || '2FA disable failed')
  }

  console.log('✅ 2FA disable request successful:', response)

  // Validate response with Zod
  const responseValidation = validateData(Disable2FAResponseSchema, response.data)
  if (!responseValidation.success) {
    throw new Error('Invalid server response format')
  }

  return responseValidation.data
}