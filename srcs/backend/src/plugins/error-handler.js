/**
 * @brief Custom error handler for schema-compliant responses
 */
async function errorHandlerPlugin(fastify) {
  fastify.setErrorHandler(async (error, request, reply) => {
    // Schema-compliant error response format
    const errorResponse = {
      success: false,
      message: error.message || 'An error occurred',
      error: {
        code: error.code || 'UNKNOWN_ERROR',
        details: error.message || 'An unexpected error occurred'
      }
    }

    // Set appropriate status code
    const statusCode = error.statusCode || error.status || 500
    reply.status(statusCode)
    
    return errorResponse
  })
}

export default errorHandlerPlugin