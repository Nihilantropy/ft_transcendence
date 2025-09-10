/**
 * @brief Error handling services barrel export
 * 
 * @description Exports all error handling utilities and services.
 */

export { 
  ErrorHandler, 
  errorHandler, 
  ErrorUtils,
  HTTP_STATUS_CODES,
  ERROR_CATEGORIES
} from './ErrorHandler'

export type { 
  ErrorContext, 
  ErrorResponse 
} from './ErrorHandler'
