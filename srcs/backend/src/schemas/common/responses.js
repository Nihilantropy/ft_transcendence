/**
 * @brief Common response schemas for ft_transcendence backend
 * 
 * @description Standard response formats used across all routes
 */

export default [
  // Success response schema
  {
    $id: 'SuccessResponse',
    type: 'object',
    properties: {
      success: { 
        type: 'boolean', 
        description: 'Operation success status',
        example: true
      },
      message: { 
        type: 'string', 
        description: 'Human-readable response message',
        example: 'Operation completed successfully'
      }
    },
    required: ['success', 'message']
  },

  // Error response schema
  {
    $id: 'ErrorResponse',
    type: 'object',
    properties: {
      success: { 
        type: 'boolean', 
        description: 'Operation success status (always false)',
        example: false
      },
      message: { 
        type: 'string', 
        description: 'Error description',
        example: 'Operation failed'
      },
      error: { 
        type: 'object',
        description: 'Detailed error information',
        properties: {
          code: { 
            type: 'string',
            example: 'VALIDATION_ERROR'
          },
          details: { 
            type: 'string',
            example: 'Invalid input provided'
          }
        }
      }
    },
    required: ['success', 'message']
  },

  // Validation error response schema
  {
    $id: 'ValidationError',
    type: 'object',
    properties: {
      success: { 
        type: 'boolean', 
        example: false
      },
      message: { 
        type: 'string',
        example: 'Validation failed'
      },
      error: {
        type: 'object',
        properties: {
          code: { 
            type: 'string',
            example: 'VALIDATION_ERROR'
          },
          details: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                message: { type: 'string' }
              }
            }
          }
        }
      }
    },
    required: ['success', 'message']
  }
]