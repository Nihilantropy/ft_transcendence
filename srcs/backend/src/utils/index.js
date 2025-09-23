/**
 * @brief Utils module exports for ft_transcendence backend
 * 
 * @description Central export point for all utility modules
 */

// Authentication utilities
export * from './auth_utils.js'

// Error handling utilities
export * from './errors.js'

// Export utilities as namespaces for easier importing
export * as AuthUtils from './auth_utils.js'
export { errorHandler, ErrorHandler } from './errors.js'