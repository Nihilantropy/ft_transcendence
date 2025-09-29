/**
 * @brief Simple login business logic
 * 
 * @description Pure function that handles login request to backend.
 * Uses Zod schemas for validation and makeRequest from BaseApiService.
 * 
 * @param credentials - Login request data
 * @param makeRequest - API request function from BaseApiService
 * 
 * @return Promise<LoginResponse> - Validated login response
 */

import { validateData } from '../utils/validation'
import { 
  LoginRequestSchema, 
  LoginResponseSchema,
  type LoginRequest,
  type LoginResponse
} from './schemas/auth.schemas'
import { apiService } from '../api/BaseApiService'
import { catchErrorTyped } from '../error'

/**
 * @brief Execute login request with validation
 * 
 * @param credentials - Raw login credentials
 * @param makeRequest - API request function (POST method)
 * 
 * @return Promise<LoginResponse> - Validated response from backend
 */
export async function executeLogin(
  credentials: LoginRequest,
  endpoint: string = '/auth/login'
): Promise<LoginResponse> {
  // Validate input with Zod
  const validation = validateData(LoginRequestSchema, credentials)
  if (!validation.success) {
    throw new Error(`Invalid credentials: ${validation.errors.join(', ')}`)
  }

  const validCredentials: LoginRequest = validation.data

  // Make API request
  const [error, response] = await catchErrorTyped(
    apiService.post(endpoint, validCredentials)
  )

  if (error || !response) {
    throw new Error(error?.message || 'Login failed')
  }

  console.log('✅ Login request successful:', response)
  console.log('🔒 Tokens received - Access:', response.data)

  // Validate response with Zod
  const responseValidation = validateData(LoginResponseSchema, response.data)
  if (!responseValidation.success) {
    throw new Error('Invalid server response format')
  }

  return responseValidation.data as LoginResponse
}