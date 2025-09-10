/**
 * @brief Base API Service for ft_transcendence
 * 
 * @description Handles HTTP communication with backend services.
 * Includes error handling, retries, and proper status code management.
 */

export interface ApiResponse<T> {
  data: T
  success: boolean
  message?: string
  timestamp: number
  status: number
}

export interface ApiError {
  code: string
  message: string
  status: number
  details?: unknown
}

export class ApiService {
  private baseUrl: string
  private timeout: number

  constructor(baseUrl: string = 'http://localhost:8000/api', timeout: number = 5000) {
    this.baseUrl = baseUrl
    this.timeout = timeout
  }

  /**
   * @brief Make HTTP request with proper error handling
   */
  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`
    
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })
      
      clearTimeout(timeoutId)
      
      const responseData = await response.json()
      
      if (!response.ok) {
        throw new ApiError(
          response.status === 500 ? 'SERVER_ERROR' : 'REQUEST_FAILED',
          responseData.message || `HTTP ${response.status}`,
          response.status,
          responseData
        )
      }
      
      return {
        data: responseData,
        success: true,
        status: response.status,
        timestamp: Date.now()
      }
      
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      
      // Network or timeout errors
      const errorMessage = (error as any)?.name === 'AbortError' 
        ? 'Request timeout' 
        : 'Network error - Backend service unavailable'
      
      throw new ApiError('NETWORK_ERROR', errorMessage, 0, error)
    }
  }

  /**
   * @brief GET request
   */
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { method: 'GET' })
  }

  /**
   * @brief POST request
   */
  async post<T>(endpoint: string, data: unknown): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  /**
   * @brief PUT request
   */
  async put<T>(endpoint: string, data: unknown): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  /**
   * @brief DELETE request
   */
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { method: 'DELETE' })
  }
}

export class ApiError extends Error {
  public code: string
  public status: number
  public details?: unknown

  constructor(
    code: string,
    message: string,
    status: number,
    details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
  }
}

// Singleton instance
export const apiService = new ApiService()
