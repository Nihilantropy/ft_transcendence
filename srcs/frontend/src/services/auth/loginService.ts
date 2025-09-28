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

/**
 * @brief Execute login request with validation
 * 
 * @param credentials - Raw login credentials
 * @param makeRequest - API request function (POST method)
 * 
 * @return Promise<LoginResponse> - Validated response from backend
 */
export async function executeLogin(
  credentials: unknown,
): Promise<LoginResponse> {
  // Validate input with Zod
  const validation = validateData(LoginRequestSchema, credentials)
  if (!validation.success) {
    throw new Error(`Invalid credentials: ${validation.errors.join(', ')}`)
  }

  const validCredentials: LoginRequest = validation.data

  // Make API request
  const apiResponse = await apiService.post('/auth/login', validCredentials)

  // Validate response with Zod
  const responseValidation = validateData(LoginResponseSchema, apiResponse)
  if (!responseValidation.success) {
    throw new Error('Invalid server response format')
  }

  return responseValidation.data
}