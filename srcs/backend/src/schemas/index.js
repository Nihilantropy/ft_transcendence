/**
 * @brief Main OpenAPI schema registry for ft_transcendence backend
 * 
 * @description Assembles all schemas into complete OpenAPI specification:
 * - Imports modular schema files
 * - Provides helper functions for route definitions
 * - Exports complete OpenAPI 3.0 spec
 * 
 * @return Complete OpenAPI specification and utilities
 */

import { requestSchemas } from './requests.js'
import { responseSchemas } from './responses.js'
import { errorSchemas, errorResponses } from './errors.js'
import { securitySchemes, securityConfigs } from './security.js'

// =============================================================================
// COMPLETE OPENAPI 3.0 SPECIFICATION
// =============================================================================

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'ft_transcendence API',
    description: 'Backend API for the ft_transcendence project',
    version: '1.0.0',
    contact: {
      name: 'ft_transcendence Team'
    }
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development server'
    }
  ],
  components: {
    schemas: {
      ...requestSchemas,
      ...responseSchemas,
      ...errorSchemas
    },
    responses: {
      ...errorResponses
    },
    securitySchemes
  },
  tags: [
    { 
      name: 'Authentication', 
      description: 'User authentication and registration endpoints' 
    },
    { 
      name: 'User Management', 
      description: 'User profile and account management' 
    }
  ]
}

// =============================================================================
// HELPER FUNCTIONS FOR ROUTE DEFINITIONS
// =============================================================================

/**
 * @brief Create standardized route schema with automatic error responses
 * @param {object} options - Route configuration
 * @param {string} options.summary - Route summary for documentation
 * @param {string} options.description - Detailed route description
 * @param {string[]} options.tags - Route tags for organization
 * @param {string} options.body - Request body schema name
 * @param {string} options.querystring - Query parameters schema name
 * @param {string} options.params - URL parameters schema name
 * @param {object} options.response - Custom response schemas by status code
 * @param {object[]} options.security - Security requirements
 * @return {object} Complete Fastify route schema
 */
export function createRouteSchema({
  summary,
  description,
  tags = [],
  body,
  querystring,
  params,
  response = {},
  security = []
}) {
  const schema = {
    summary,
    ...(description && { description }),
    tags,
    ...(body && { 
      body: { $ref: `#/components/schemas/${body}` } 
    }),
    ...(querystring && { 
      querystring: { $ref: `#/components/schemas/${querystring}` } 
    }),
    ...(params && { 
      params: { $ref: `#/components/schemas/${params}` } 
    }),
    response: {
      // Always include standard error responses
      400: { $ref: '#/components/responses/ValidationError' },
      500: { $ref: '#/components/responses/InternalServerError' },
      // Add custom success responses
      ...Object.entries(response).reduce((acc, [status, schemaName]) => {
        acc[status] = {
          description: 'Success',
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${schemaName}` }
            }
          }
        }
        return acc
      }, {})
    },
    ...(security.length > 0 && { security })
  }

  return schema
}

/**
 * @brief Add authentication error responses to protected routes
 * @param {object} baseResponse - Base response configuration
 * @return {object} Response configuration with auth errors
 */
export function withAuthErrors(baseResponse = {}) {
  return {
    ...baseResponse,
    401: { $ref: '#/components/responses/AuthenticationError' }
  }
}

/**
 * @brief Add conflict error response for creation endpoints
 * @param {object} baseResponse - Base response configuration
 * @return {object} Response configuration with conflict error
 */
export function withConflictError(baseResponse = {}) {
  return {
    ...baseResponse,
    409: { $ref: '#/components/responses/ConflictError' }
  }
}

// =============================================================================
// COMMON SCHEMAS EXPORT - Prevents import hell in route files
// =============================================================================

export const schemas = {
  // Request schemas
  requests: {
    userRegistration: 'UserRegistrationRequest',
    userLogin: 'UserLoginRequest',
    emailVerification: 'EmailVerificationRequest',
    refreshToken: 'RefreshTokenRequest'
  },
  
  // Response schemas
  responses: {
    userCreated: 'UserCreatedResponse',
    loginSuccess: 'LoginSuccessResponse',
    emailVerification: 'EmailVerificationResponse',
    standardSuccess: 'StandardSuccessResponse'
  },
  
  // Security configurations
  security: securityConfigs
}