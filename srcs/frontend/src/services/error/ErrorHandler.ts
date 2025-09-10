/**
 * @brief Centralized Error Handler for ft_transcendence
 * 
 * @description Handles all application errors with proper user feedback.
 * Provides consistent error messaging and handles different error types.
 */

export interface ErrorContext {
  component?: string
  action?: string
  url?: string
  timestamp?: number
}

export interface ErrorResponse {
  code: number
  message: string
  userMessage: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  shouldRetry: boolean
  retryAfter?: number
}

/**
 * @brief HTTP Status Code mappings
 */
export const HTTP_STATUS_CODES = {
  // Success
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  
  // Client Errors
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  408: 'Request Timeout',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  
  // Server Errors
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
  507: 'Insufficient Storage',
  
  // Network Errors
  0: 'Network Error'
} as const

/**
 * @brief Error categories for better handling
 */
export const ERROR_CATEGORIES = {
  NETWORK: 'network',
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  VALIDATION: 'validation',
  SERVER: 'server',
  CLIENT: 'client',
  UNKNOWN: 'unknown'
} as const

/**
 * @brief Centralized Error Handler class
 */
export class ErrorHandler {
  private static instance: ErrorHandler
  private errorCallbacks: Set<(error: ErrorResponse, context?: ErrorContext) => void> = new Set()

  /**
   * @brief Get singleton instance
   */
  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler()
    }
    return ErrorHandler.instance
  }

  /**
   * @brief Handle any error and return structured response
   */
  public handleError(error: unknown, context?: ErrorContext): ErrorResponse {
    const errorResponse = this.categorizeError(error, context)
    
    // Log error for debugging
    console.error('🚨 Error handled:', {
      error: errorResponse,
      context,
      originalError: error,
      timestamp: new Date().toISOString()
    })
    
    // Notify registered callbacks
    this.notifyCallbacks(errorResponse, context)
    
    return errorResponse
  }

  /**
   * @brief Categorize error and create appropriate response
   */
  private categorizeError(error: unknown, context?: ErrorContext): ErrorResponse {
    // Network/Fetch errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return this.createNetworkError()
    }
    
    // HTTP Response errors
    if (error && typeof error === 'object' && 'status' in error) {
      return this.createHttpError(error as any, context)
    }
    
    // API Response errors
    if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
      return this.createApiError(error as any)
    }
    
    // JavaScript errors
    if (error instanceof Error) {
      return this.createJavaScriptError(error)
    }
    
    // Unknown errors
    return this.createUnknownError(error)
  }

  /**
   * @brief Create network error response
   */
  private createNetworkError(): ErrorResponse {
    return {
      code: 0,
      message: 'Network connection failed',
      userMessage: '🌐 Unable to connect to the server. Please check your internet connection and try again.',
      severity: 'high',
      shouldRetry: true,
      retryAfter: 3000
    }
  }

  /**
   * @brief Create HTTP error response
   */
  private createHttpError(error: { status: number; statusText?: string; message?: string }, _context?: ErrorContext): ErrorResponse {
    const status = error.status ?? 500  // Use nullish coalescing to handle 0 properly
    
    // Handle network errors (status 0) as special case
    if (status === 0) {
      return this.createNetworkError()
    }
    
    const statusText = HTTP_STATUS_CODES[status as keyof typeof HTTP_STATUS_CODES] || 'Unknown Error'
    
    switch (status) {
      case 400:
        return {
          code: 400,
          message: error.message || 'Invalid request data',
          userMessage: '❌ Invalid request. Please check your input and try again.',
          severity: 'medium',
          shouldRetry: false
        }
      
      case 401:
        return {
          code: 401,
          message: error.message || 'Authentication required',
          userMessage: '🔐 Authentication required. Please log in to continue.',
          severity: 'medium',
          shouldRetry: false
        }
      
      case 403:
        return {
          code: 403,
          message: error.message || 'Access forbidden',
          userMessage: '🚫 Access denied. You don\'t have permission to perform this action.',
          severity: 'medium',
          shouldRetry: false
        }
      
      case 404:
        return {
          code: 404,
          message: error.message || 'Resource not found',
          userMessage: '🔍 The requested resource was not found. It may have been moved or deleted.',
          severity: 'low',
          shouldRetry: false
        }
      
      case 408:
        return {
          code: 408,
          message: error.message || 'Request timeout',
          userMessage: '⏱️ Request timed out. The server took too long to respond.',
          severity: 'medium',
          shouldRetry: true,
          retryAfter: 2000
        }
      
      case 409:
        return {
          code: 409,
          message: error.message || 'Conflict detected',
          userMessage: '⚠️ Conflict detected. The resource you\'re trying to modify has been changed.',
          severity: 'medium',
          shouldRetry: false
        }
      
      case 422:
        return {
          code: 422,
          message: error.message || 'Validation failed',
          userMessage: '📝 Validation failed. Please check your input and try again.',
          severity: 'low',
          shouldRetry: false
        }
      
      case 429:
        return {
          code: 429,
          message: error.message || 'Too many requests',
          userMessage: '🚦 Too many requests. Please wait a moment before trying again.',
          severity: 'medium',
          shouldRetry: true,
          retryAfter: 5000
        }
      
      case 500:
        return {
          code: 500,
          message: error.message || 'Internal server error',
          userMessage: '💥 Server error. Our team has been notified and is working on a fix.',
          severity: 'high',
          shouldRetry: true,
          retryAfter: 5000
        }
      
      case 502:
        return {
          code: 502,
          message: error.message || 'Bad gateway',
          userMessage: '🌐 Service temporarily unavailable. Please try again in a few moments.',
          severity: 'high',
          shouldRetry: true,
          retryAfter: 10000
        }
      
      case 503:
        return {
          code: 503,
          message: error.message || 'Service unavailable',
          userMessage: '🔧 Service temporarily unavailable for maintenance. Please try again later.',
          severity: 'high',
          shouldRetry: true,
          retryAfter: 30000
        }
      
      case 504:
        return {
          code: 504,
          message: error.message || 'Gateway timeout',
          userMessage: '⏰ Gateway timeout. The server took too long to respond.',
          severity: 'high',
          shouldRetry: true,
          retryAfter: 10000
        }
      
      default:
        return {
          code: status,
          message: error.message || statusText,
          userMessage: `⚠️ ${statusText}. ${error.message || 'Please try again or contact support if the problem persists.'}`,
          severity: status >= 500 ? 'high' : 'medium',
          shouldRetry: status >= 500,
          retryAfter: status >= 500 ? 5000 : undefined
        }
    }
  }

  /**
   * @brief Create API error response
   */
  private createApiError(error: { code: number; message: string }): ErrorResponse {
    return {
      code: error.code,
      message: error.message,
      userMessage: `❌ ${error.message}`,
      severity: 'medium',
      shouldRetry: false
    }
  }

  /**
   * @brief Create JavaScript error response
   */
  private createJavaScriptError(error: Error): ErrorResponse {
    return {
      code: -1,
      message: error.message,
      userMessage: '⚠️ An unexpected error occurred. Please refresh the page and try again.',
      severity: 'medium',
      shouldRetry: true,
      retryAfter: 1000
    }
  }

  /**
   * @brief Create unknown error response
   */
  private createUnknownError(error: unknown): ErrorResponse {
    return {
      code: -1,
      message: String(error),
      userMessage: '🤷 An unexpected error occurred. Please try again or contact support.',
      severity: 'medium',
      shouldRetry: true,
      retryAfter: 2000
    }
  }

  /**
   * @brief Add error callback listener
   */
  public addErrorListener(callback: (error: ErrorResponse, context?: ErrorContext) => void): void {
    this.errorCallbacks.add(callback)
  }

  /**
   * @brief Remove error callback listener
   */
  public removeErrorListener(callback: (error: ErrorResponse, context?: ErrorContext) => void): void {
    this.errorCallbacks.delete(callback)
  }

  /**
   * @brief Notify all registered callbacks
   */
  private notifyCallbacks(error: ErrorResponse, context?: ErrorContext): void {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error, context)
      } catch (callbackError) {
        console.error('Error in error callback:', callbackError)
      }
    })
  }

  /**
   * @brief Check if error should trigger retry
   */
  public shouldRetry(error: ErrorResponse): boolean {
    return error.shouldRetry && error.code !== 401 && error.code !== 403
  }

  /**
   * @brief Get retry delay for error
   */
  public getRetryDelay(error: ErrorResponse): number {
    return error.retryAfter || 3000
  }

  /**
   * @brief Format error for display
   */
  public formatError(error: ErrorResponse, includeCode = false): string {
    if (includeCode && error.code > 0) {
      return `[${error.code}] ${error.userMessage}`
    }
    return error.userMessage
  }

  /**
   * @brief Get error severity icon
   */
  public getSeverityIcon(severity: ErrorResponse['severity']): string {
    switch (severity) {
      case 'low':
        return '💡'
      case 'medium':
        return '⚠️'
      case 'high':
        return '🚨'
      case 'critical':
        return '💥'
      default:
        return '❓'
    }
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance()

/**
 * @brief Utility functions for common error scenarios
 */
export const ErrorUtils = {
  /**
   * @brief Handle fetch errors specifically
   */
  handleFetchError: (error: unknown, url?: string): ErrorResponse => {
    const context: ErrorContext = {
      component: 'FetchAPI',
      action: 'HTTP Request',
      url,
      timestamp: Date.now()
    }
    
    return errorHandler.handleError(error, context)
  },

  /**
   * @brief Handle authentication errors
   */
  handleAuthError: (error: unknown): ErrorResponse => {
    const context: ErrorContext = {
      component: 'AuthService',
      action: 'Authentication',
      timestamp: Date.now()
    }
    
    return errorHandler.handleError(error, context)
  },

  /**
   * @brief Create user-friendly error message
   */
  createUserMessage: (error: ErrorResponse): string => {
    const icon = errorHandler.getSeverityIcon(error.severity)
    return `${icon} ${error.userMessage}`
  },

  /**
   * @brief Check if error indicates backend unavailability
   */
  isBackendUnavailable: (error: ErrorResponse): boolean => {
    return [0, 500, 502, 503, 504].includes(error.code)
  }
}
