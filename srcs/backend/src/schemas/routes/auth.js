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
        description: 'Username or email'
      },
      password: { 
        type: 'string',
        minLength: 8,
        maxLength: 128,
        description: 'User password'
      },
      rememberMe: { 
        type: 'boolean',
        description: 'Keep user logged in'
      },
      twoFactorToken: { 
        type: 'string',
        description: '2FA token (if enabled)'
      }
    },
    required: ['username', 'password']
  },

  // Login response schema
  {
    $id: 'LoginResponse',
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      user: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          username: { type: 'string' },
          email: { type: 'string' },
          is_online: { type: 'boolean' }
        }
      },
      tokens: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
          tokenType: { type: 'string' },
          expiresIn: { type: 'string' }
        }
      },
      requiresTwoFactor: { type: 'boolean' },
      tempToken: { type: 'string' }
    },
    required: ['success', 'message']
  },

  // Register request schema
  {
    $id: 'RegisterRequest',
    type: 'object',
    properties: {
      email: { 
        type: 'string',
        format: 'email',
        description: 'Valid email address'
      },
      password: { 
        type: 'string',
        minLength: 8,
        maxLength: 128,
        description: 'Strong password'
      }
    },
    required: ['email', 'password']
  },

  // Register response schema
  {
    $id: 'RegisterResponse',
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      data: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          username: { type: 'string' },
          email: { type: 'string' },
          email_verified: { type: 'boolean' }
        }
      }
    },
    required: ['success', 'message', 'data']
  },

  // Email verification request
  {
    $id: 'VerifyEmailRequest',
    type: 'object',
    properties: {
      token: { 
        type: 'string',
        minLength: 32,
        description: 'Email verification token'
      }
    },
    required: ['token']
  },

  // Email verification response
  {
    $id: 'VerifyEmailResponse',
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      user: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          username: { type: 'string' },
          email: { type: 'string' },
          email_verified: { type: 'boolean' }
        }
      },
      tokens: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' }
        }
      }
    },
    required: ['success', 'message', 'user', 'tokens']
  },

  // Token refresh request
  {
    $id: 'RefreshTokenRequest',
    type: 'object',
    properties: {
      refreshToken: { 
        type: 'string',
        description: 'Valid refresh token'
      }
    },
    required: ['refreshToken']
  }
]

// =============================================================================
// COMPLETE ROUTE SCHEMAS
// =============================================================================

export const routeSchemas = {
  // Register route
  register: {
    tags: ['auth'],
    operationId: 'registerUser',
    summary: 'User registration',
    description: 'Register new user account with auto-generated username',
    body: { $ref: 'RegisterRequest#' },
    response: {
      201: { $ref: 'RegisterResponse#' },
      400: { $ref: 'ValidationError#' },
      409: { $ref: 'ErrorResponse#' }
    }
  },

  // Email verification route
  verifyEmail: {
    tags: ['auth'],
    operationId: 'verifyEmail',
    summary: 'Verify email address',
    description: 'Verify user email and return authentication tokens',
    body: { $ref: 'VerifyEmailRequest#' },
    response: {
      200: { $ref: 'VerifyEmailResponse#' },
      400: { $ref: 'ErrorResponse#' }
    }
  },

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
      200: { $ref: 'SuccessResponse#' },
      401: { $ref: 'ErrorResponse#' },
      400: { $ref: 'ErrorResponse#' }
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