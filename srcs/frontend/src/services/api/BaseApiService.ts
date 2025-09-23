/**
 * @brief Base API Service for ft_transcendence
 * 
 * @description Simple HTTP client with linear error handling:
 * request → response → check status → create Error → throw
 */

// Use relative URL for API calls to avoid mixed content issues
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export interface ApiResponse<T> {
  data: T
  success: boolean
  status: number
  timestamp: number
}

export class ApiService {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  /**
   * @brief Make HTTP request with simple linear error handling
   */
  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`
    
    let response: Response
    
    try {
      // Make the fetch request
      response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })
    } catch (error) {
      // True network errors (no internet, CORS, DNS failure, etc.)
      console.error('❌ Network Error:', error)
      throw new Error('Network request failed')
    }

    // Parse response data safely
    let responseData: any
    try {
      const text = await response.text()
      responseData = text ? JSON.parse(text) : {}
    } catch {
      responseData = {}
    }
    
    // Handle HTTP errors (4xx, 5xx) 
    if (!response.ok) {
      const message = responseData?.error?.message || responseData?.message || response.statusText
      throw new Error(message)
    }
    
    // Success response
    return {
      data: responseData,
      success: true,
      status: response.status,
      timestamp: Date.now()
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

// Export singleton instance
export const apiService = new ApiService()
