/**
 * @brief Simple 2FA verification business logic for login
 * 
 * @description Pure function that handles 2FA verification during login.
 * Uses tempToken from initial login instead of userId for security.
 * 
 * @param tempToken - Temporary token from initial login step
 * @param token - TOTP token from authenticator app (optional)
 * @param backupCode - Backup code (optional)
 * @param endpoint - API endpoint for 2FA verification
 * 
 * @return Promise<Verify2FAResponse> - Validated verification response
 */

import { validateData } from '../utils/validation'
import { apiService } from '../api/BaseApiService'
import { catchErrorTyped } from '../error'
import { 
  Verify2FARequestSchema,
  Verify2FAResponseSchema,
  type Verify2FARequest,
  type Verify2FAResponse
} from './schemas/auth.schemas'

/**
 * @brief Execute 2FA verification request with validation
 * 
 * @param tempToken - Temporary token from initial login step
 * @param token - TOTP token from authenticator app (optional)
 * @param backupCode - Backup code (optional)
 * @param endpoint - 2FA verification endpoint
 * 
 * @return Promise<Verify2FAResponse> - Validated response from backend
 */
export async function executeVerify2FA(
  tempToken: string,
  token?: string,
  backupCode?: string,
  endpoint: string = '/auth/2fa/verify'
): Promise<Verify2FAResponse> {
  // Validate input with Zod
  const requestData: Verify2FARequest = { tempToken, token, backupCode }
  const validation = validateData(Verify2FARequestSchema, requestData)
  if (!validation.success) {
    throw new Error(`Invalid 2FA verification data: ${validation.errors.join(', ')}`)
  }

  const validRequestData = validation.data

  // Make API request
  const [error, response] = await catchErrorTyped(
    apiService.post(endpoint, validRequestData)
  )

  if (error || !response) {
    throw new Error(error?.message || '2FA verification failed')
  }

  console.log('✅ 2FA verification request successful:', response)

  // Validate response with Zod
  const responseValidation = validateData(Verify2FAResponseSchema, response.data)
  if (!responseValidation.success) {
    throw new Error('Invalid server response format')
  }

  return responseValidation.data
}
