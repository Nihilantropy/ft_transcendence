/**
 * @brief Centralized error handling system for ft_transcendence backend
 * 
 * @description Provides a simple, essential error management system with:
 * - Custom error types for different scenarios
 * - Standardized error responses
 * - Integration with centralized logging
 * - HTTP status code mapping
 */

import { logger } from '../logger.js'

/**
 * @brief Base application error class
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    this.code = code
    this.details = details
    this.isOperational = true
    this.timestamp = new Date().toISOString()

    Error.captureStackTrace(this, this.constructor)
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp
    }
  }
}

/**
 * @brief Validation error (400 Bad Request)
 */
export class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', details)
  }
}

/**
 * @brief Authentication error (401 Unauthorized)
 */
export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', details = null) {
    super(message, 401, 'AUTHENTICATION_ERROR', details)
  }
}

/**
 * @brief Authorization error (403 Forbidden)
 */
export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions', details = null) {
    super(message, 403, 'AUTHORIZATION_ERROR', details)
  }
}

/**
 * @brief Resource not found error (404 Not Found)
 */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details = null) {
    super(message, 404, 'NOT_FOUND_ERROR', details)
  }
}

/**
 * @brief Conflict error (409 Conflict)
 */
export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details = null) {
    super(message, 409, 'CONFLICT_ERROR', details)
  }
}

/**
 * @brief Database error (500 Internal Server Error)
 */
export class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', details = null) {
    super(message, 500, 'DATABASE_ERROR', details)
  }
}

/**
 * @brief Rate limiting error (429 Too Many Requests)
 */
export class RateLimitError extends AppError {
  constructor(message = 'Too many requests', details = null) {
    super(message, 429, 'RATE_LIMIT_ERROR', details)
  }
}

/**
 * @brief External service error (502 Bad Gateway)
 */
export class ExternalServiceError extends AppError {
  constructor(message = 'External service unavailable', details = null) {
    super(message, 502, 'EXTERNAL_SERVICE_ERROR', details)
  }
}

/**
 * @brief Centralized error handler class
 */
export class ErrorHandler {
  constructor() {
    this.errorLogger = logger.child({ module: 'error-handler' })
  }

  /**
   * @brief Handle and log errors with appropriate level
   * @param {Error} error - The error to handle
   * @param {Object} context - Additional context for logging
   */
  logError(error, context = {}) {
    const errorData = {
      message: error.message,
      name: error.name,
      code: error.code || 'UNKNOWN_ERROR',
      statusCode: error.statusCode || 500,
      stack: error.stack,
      timestamp: error.timestamp || new Date().toISOString(),
      ...context
    }

    // Log at appropriate level based on error type
    if (error.statusCode >= 500) {
      this.errorLogger.error('❌ Server error occurred', errorData)
    } else if (error.statusCode >= 400) {
      this.errorLogger.warn('⚠️ Client error occurred', errorData)
    } else {
      this.errorLogger.info('ℹ️ Error handled', errorData)
    }
  }

  /**
   * @brief Create standardized error response
   * @param {Error} error - The error to format
   * @param {boolean} includeStack - Whether to include stack trace (development only)
   */
  formatErrorResponse(error, includeStack = false) {
    const response = {
      success: false,
      error: {
        message: error.message,
        code: error.code || 'UNKNOWN_ERROR',
        timestamp: error.timestamp || new Date().toISOString()
      }
    }

    // Include additional details if available
    if (error.details) {
      response.error.details = error.details
    }

    // Include stack trace in development mode
    if (includeStack && error.stack) {
      response.error.stack = error.stack
    }

    return response
  }

  /**
   * @brief Fastify error handler function
   * @param {Error} error - The error that occurred
   * @param {FastifyRequest} request - The Fastify request object
   * @param {FastifyReply} reply - The Fastify reply object
   */
  handleFastifyError(error, request, reply) {
    // Log the error with request context
    this.logError(error, {
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      ip: request.ip
    })

    // Determine status code
    const statusCode = error.statusCode || 500

    // Format response based on environment
    const isDevelopment = process.env.NODE_ENV === 'development'
    const response = this.formatErrorResponse(error, isDevelopment)

    reply.status(statusCode).send(response)
  }

  /**
   * @brief Create specific error types with factory methods
   */
  validation(message, details = null) {
    return new ValidationError(message, details)
  }

  authentication(message, details = null) {
    return new AuthenticationError(message, details)
  }

  authorization(message, details = null) {
    return new AuthorizationError(message, details)
  }

  notFound(message, details = null) {
    return new NotFoundError(message, details)
  }

  conflict(message, details = null) {
    return new ConflictError(message, details)
  }

  database(message, details = null) {
    return new DatabaseError(message, details)
  }

  rateLimit(message, details = null) {
    return new RateLimitError(message, details)
  }

  externalService(message, details = null) {
    return new ExternalServiceError(message, details)
  }

  /**
   * @brief Wrap async functions to handle errors
   * @param {Function} fn - The async function to wrap
   * @returns {Function} Wrapped function that catches errors
   */
  asyncHandler(fn) {
    return (request, reply) => {
      return Promise.resolve(fn(request, reply)).catch((error) => {
        this.handleFastifyError(error, request, reply)
      })
    }
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler()
