/**
 * @brief Simple registration business logic
 * 
 * @description Pure function that handles registration request to backend.
 * Uses Zod schemas for validation, transforms RegisterForm to RegisterRequest,
 * and validates server response.
 * 
 * @param credentials - Registration form data (includes confirmPassword)
 * @param endpoint - API endpoint for registration
 * 
 * @return Promise<RegisterResponse> - Validated registration response
 */

import { validateData } from '../utils/validation'
import { 
  RegisterRequestSchema,
  RegisterResponseSchema,
  type RegisterRequest,
  type RegisterResponse
} from './schemas/auth.schema'
import { apiService } from '../api/BaseApiService'
import { catchErrorTyped } from '../error'

/**
 * @brief Execute registration request with validation
 * 
 * @param credentials - Raw registration form data
 * @param endpoint - Registration endpoint
 * 
 * @return Promise<RegisterResponse> - Validated response from backend
 */
export async function executeRegister(
  credentials: RegisterRequest,
  endpoint: string = '/auth/register'
): Promise<RegisterResponse> {
  // Validate input with Zod (includes confirmPassword validation)
  const validation = validateData(RegisterRequestSchema, credentials)
  if (!validation.success) {
    throw new Error(`Invalid registration data: ${validation.errors.join(', ')}`)
  }

  const validCredentials: RegisterRequest = validation.data

  // Transform to backend request format (remove confirmPassword)
  const registerRequest: RegisterRequest = {
    username: validCredentials.username,
    email: validCredentials.email,
    password: validCredentials.password,
    confirmPassword: validCredentials.confirmPassword
  }

  // Make API request
  const [error, response] = await catchErrorTyped(
    apiService.post(endpoint, registerRequest)
  )

  if (error || !response) {
    throw new Error(error?.message || 'Registration failed')
  }

  console.log('✅ Registration request successful:', response)

  // Validate response with Zod
  const responseValidation = validateData(RegisterResponseSchema, response.data)
  if (!responseValidation.success) {
    throw new Error('Invalid server response format')
  }

  return responseValidation.data
}