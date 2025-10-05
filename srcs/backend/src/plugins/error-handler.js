/**
 * @brief Custom error handler for schema-compliant responses
 * 
 * @description Handles all errors and bypasses response schema validation.
 * Uses reply.raw to avoid serialization issues.
 */
async function errorHandlerPlugin(fastify) {
  fastify.setErrorHandler(async (error, request, reply) => {
    
    // ✅ Handle response validation errors (schema mismatch)
    if (error.validation && error.validationContext === 'response') {
      fastify.log.error('❌ Response validation failed:', {
        url: request.url,
        method: request.method,
        statusCode: reply.statusCode,
        validation: error.validation,
        stack: error.stack
      })
      
      const errorResponse = process.env.NODE_ENV === 'development' 
        ? {
            success: false,
            message: 'Response validation failed - check server logs',
            error: {
              code: 'RESPONSE_VALIDATION_ERROR',
              details: JSON.stringify(error.validation, null, 2),
              hint: 'The server returned data that does not match the expected schema'
            }
          }
        : {
            success: false,
            message: 'Internal server error',
            error: {
              code: 'INTERNAL_ERROR',
              details: 'An unexpected error occurred'
            }
          }
      
      // Bypass schema validation by using raw response
      reply.type('application/json').code(500)
      return reply.send(JSON.stringify(errorResponse))
    }
    
    // ✅ Handle request validation errors (bad client input)
    if (error.validation && error.validationContext === 'body') {
      fastify.log.warn('⚠️ Request validation failed:', {
        url: request.url,
        method: request.method,
        validation: error.validation
      })
      
      const errorResponse = {
        success: false,
        message: 'Invalid request data',
        error: {
          code: 'VALIDATION_ERROR',
          details: error.message
        }
      }
      
      reply.type('application/json').code(400)
      return reply.send(JSON.stringify(errorResponse))
    }
    
    // Handle other validation contexts (query, params, headers)
    if (error.validation) {
      fastify.log.warn('⚠️ Validation failed:', {
        url: request.url,
        context: error.validationContext,
        validation: error.validation
      })
      
      const errorResponse = {
        success: false,
        message: `Invalid ${error.validationContext || 'request'}`,
        error: {
          code: 'VALIDATION_ERROR',
          details: error.message
        }
      }
      
      reply.type('application/json').code(400)
      return reply.send(JSON.stringify(errorResponse))
    }
    
    // ✅ Handle standard errors (including authentication errors from preHandler)
    fastify.log.error('❌ Error occurred:', {
      url: request.url,
      method: request.method,
      error: error.message,
      statusCode: error.statusCode || error.status,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
    
    // Set appropriate status code
    const statusCode = error.statusCode || error.status || 500
    
    // Schema-compliant error response format
    const errorResponse = {
      success: false,
      message: error.message || 'An error occurred',
      error: {
        code: error.code || 'UNKNOWN_ERROR',
        details: error.message || 'An unexpected error occurred'
      }
    }
    
    // ✅ CRITICAL: Bypass schema validation completely
    // Set content type and status code, then send raw JSON string
    reply.type('application/json').code(statusCode)
    return reply.send(JSON.stringify(errorResponse))
  })
}

export default errorHandlerPlugin