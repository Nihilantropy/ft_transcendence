/**
 * @brief Authentication route schemas for ft_transcendence backend
 * 
 * @description Complete route schemas with centralized definitions
 */

// =============================================================================
// SHARED COMPONENTS
// =============================================================================

const authHeaders = {
  $id: 'AuthHeaders',
  type: 'object',
  properties: {
    authorization: {
      type: 'string',
      description: 'Bearer JWT token',
      pattern: '^Bearer .+$'
    }
  },
  required: ['authorization']
}

const authSecurity = [{ bearerAuth: [] }]

// =============================================================================
// REQUEST/RESPONSE SCHEMAS
// =============================================================================

const schemas = [
  // Auth headers
  authHeaders,

  // Login request schema
  {
    $id: 'LoginRequest',
    type: 'object',
    properties: {
      username: { 
        type: 'string',
        minLength: 3,
        maxLength: 30,
        description: 'Username or email',
        example: 'john_doe'
      },
      password: { 
        type: 'string',
        minLength: 8,
        maxLength: 128,
        description: 'User password',
        example: 'SecurePassword123!'
      },
      rememberMe: { 
        type: 'boolean',
        description: 'Keep user logged in',
        example: false
      },
      twoFactorToken: { 
        type: 'string',
        description: '2FA token (if enabled)',
        example: '123456'
      }
    },
    required: ['username', 'password']
  },

  // Login response schema
  {
    $id: 'LoginResponse',
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string', example: 'Login successful' },
      user: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          username: { type: 'string', example: 'john_doe' },
          email: { type: 'string', example: 'john@example.com' },
          is_online: { type: 'boolean', example: true }
        }
      },
      tokens: {
        type: 'object',
        properties: {
          accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          tokenType: { type: 'string', example: 'Bearer' },
          expiresIn: { type: 'string', example: '15m' }
        }
      },
      requiresTwoFactor: { type: 'boolean', example: false },
      tempToken: { type: 'string', example: 'temp-2fa-token' }
    },
    required: ['success', 'message']
  },

  // Token refresh request
  {
    $id: 'RefreshTokenRequest',
    type: 'object',
    properties: {
      refreshToken: { 
        type: 'string',
        description: 'Valid refresh token',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      }
    },
    required: ['refreshToken']
  }
]

// =============================================================================
// COMPLETE ROUTE SCHEMAS
// =============================================================================

export const routeSchemas = {
  // Login route
  login: {
    tags: ['auth'],
    operationId: 'loginUser',
    summary: 'User login',
    description: 'Authenticate user with username/email and password',
    body: { $ref: 'LoginRequest#' },
    response: {
      200: { $ref: 'LoginResponse#' },
      401: { $ref: 'ErrorResponse#' },
      400: { $ref: 'ValidationError#' }
    }
  },

  // Logout route
  logout: {
    tags: ['auth'],
    operationId: 'logoutUser',
    summary: 'User logout',
    description: 'Invalidate JWT token and cleanup user session',
    security: authSecurity,
    headers: { $ref: 'AuthHeaders#' },
    response: {
      200: { $ref: 'LoginResponse#' },
      401: { $ref: 'ErrorResponse#' },
      400: { $ref: 'ErrorResponse#' }
    }
  },

  register: {
    tags: ['auth'],
    operationId: 'registerUser',
    summary: 'User registration',
    description: 'Register a new user account',
    body: { $ref: 'RegisterRequest#' },
    response: {
      201: { $ref: 'RegisterResponse#' },
      409: { $ref: 'ErrorResponse#' },
      400: { $ref: 'ValidationError#' }
    }
  },

  // Email verification route
  verifyEmail: {
    tags: ['auth'],
    operationId: 'verifyEmail',
    summary: 'Verify user email',
    description: 'Verify user email using the provided token',
    querystring: {
      type: 'object',
      properties: {
        token: { 
          type: 'string',
          description: 'Email verification token',
          example: 'verification-token-123'
        }
      },
      required: ['token']
    },
    response: {
      200: { $ref: 'GenericResponse#' },
      400: { $ref: 'ErrorResponse#' },
      404: { $ref: 'ErrorResponse#' }
    }
  },

  // Token refresh route
  refresh: {
    tags: ['auth'],
    operationId: 'refreshToken',
    summary: 'Refresh access token',
    description: 'Generate new access token using refresh token',
    body: { $ref: 'RefreshTokenRequest#' },
    response: {
      200: { $ref: 'LoginResponse#' },
      401: { $ref: 'ErrorResponse#' },
      400: { $ref: 'ValidationError#' }
    }
  }
}

export default schemas