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
        description: 'Operation success status'
      },
      message: { 
        type: 'string', 
        description: 'Human-readable response message'
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
        description: 'Operation success status (always false)'
      },
      message: { 
        type: 'string', 
        description: 'Error description'
      },
      error: { 
        type: 'object',
        description: 'Detailed error information',
        properties: {
          code: { 
            type: 'string'
          },
          details: { 
            type: 'string'
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
        type: 'boolean'
      },
      message: { 
        type: 'string'
      },
      error: {
        type: 'object',
        properties: {
          code: { 
            type: 'string'
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