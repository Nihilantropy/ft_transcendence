/**
 * @brief Fastify error handler plugin for ft_transcendence backend
 * 
 * @description Registers centralized error handling with Fastify:
 * - Custom error handler for all unhandled errors
 * - Error response formatting
 * - Request context logging
 * - Development vs production error details
 */

import fp from 'fastify-plugin'
import { errorHandler } from '../utils/errors.js'
import { logger } from '../logger.js'

/**
 * @brief Fastify error handler plugin
 * @param {FastifyInstance} fastify - The Fastify instance
 * @param {Object} options - Plugin options
 */
async function errorHandlerPlugin(fastify, options = {}) {
  const pluginLogger = logger.child({ module: 'error-handler-plugin' })
  
  // Register custom error handler
  fastify.setErrorHandler((error, request, reply) => {
    errorHandler.handleFastifyError(error, request, reply)
  })

  // Add not found handler
  fastify.setNotFoundHandler((request, reply) => {
    const notFoundError = errorHandler.notFound(
      `Route ${request.method} ${request.url} not found`,
      { method: request.method, url: request.url }
    )
    
    errorHandler.handleFastifyError(notFoundError, request, reply)
  })

  // Add error decorator to fastify instance for easy access
  fastify.decorate('errors', {
    validation: (message, details) => errorHandler.validation(message, details),
    authentication: (message, details) => errorHandler.authentication(message, details),
    authorization: (message, details) => errorHandler.authorization(message, details),
    notFound: (message, details) => errorHandler.notFound(message, details),
    conflict: (message, details) => errorHandler.conflict(message, details),
    database: (message, details) => errorHandler.database(message, details),
    rateLimit: (message, details) => errorHandler.rateLimit(message, details),
    externalService: (message, details) => errorHandler.externalService(message, details),
    asyncHandler: (fn) => errorHandler.asyncHandler(fn)
  })

  pluginLogger.info('✅ Error handler plugin registered successfully')
}

// Export as Fastify plugin
export default fp(errorHandlerPlugin, {
  name: 'error-handler',
  fastify: '>=4.0.0'
})