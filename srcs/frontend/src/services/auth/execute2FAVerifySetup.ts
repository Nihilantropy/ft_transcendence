/**
 * @brief Simple 2FA setup verification business logic
 * 
 * @description Pure function that handles 2FA setup verification request to backend.
 * Uses Zod schemas for validation and validates server response.
 * 
 * @param token - TOTP token from authenticator app
 * @param secret - Secret key generated during setup
 * @param endpoint - API endpoint for 2FA setup verification
 * 
 * @return Promise<Verify2FASetupResponse> - Validated verification response
 */

import { validateData } from '../utils/validation'
import { apiService } from '../api/BaseApiService'
import { catchErrorTyped } from '../error'
import { 
  Verify2FASetupRequestSchema,
  Verify2FASetupResponseSchema,
  type Verify2FASetupRequest,
  type Verify2FASetupResponse
} from './schemas/auth.schemas'

/**
 * @brief Execute 2FA setup verification request with validation
 * 
 * @param token - TOTP token from authenticator app
 * @param secret - Secret key generated during setup
 * @param endpoint - 2FA setup verification endpoint
 * 
 * @return Promise<Verify2FASetupResponse> - Validated response from backend
 */
export async function executeVerify2FASetup(
  token: string,
  secret: string,
  endpoint: string = '/auth/2fa/verify-setup'
): Promise<Verify2FASetupResponse> {
  // Validate input with Zod
  const requestData: Verify2FASetupRequest = { token, secret }
  const validation = validateData(Verify2FASetupRequestSchema, requestData)
  if (!validation.success) {
    throw new Error(`Invalid 2FA verification data: ${validation.errors.join(', ')}`)
  }

  const validRequestData = validation.data

  // Make API request
  const [error, response] = await catchErrorTyped(
    apiService.post(endpoint, validRequestData)
  )

  if (error || !response) {
    throw new Error(error?.message || '2FA setup verification failed')
  }

  console.log('✅ 2FA setup verification request successful:', response)

  // Validate response with Zod
  const responseValidation = validateData(Verify2FASetupResponseSchema, response.data)
  if (!responseValidation.success) {
    throw new Error('Invalid server response format')
  }

  return responseValidation.data
}