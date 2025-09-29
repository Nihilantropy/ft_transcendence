/**
 * @brief Authentication route schemas for ft_transcendence backend
 * 
 * @description Complete route schemas with centralized definitions
 */

// TODO add a UserSchema import from user.schemas.ts

// =============================================================================
// REQUEST/RESPONSE SCHEMAS
// =============================================================================

const schemas = [

  // Login request schema
  {
    $id: 'LoginRequest',
    type: 'object',
    properties: {
      identifier: { 
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
    required: ['identifier', 'password']
  },

  // Login response schema
  {
    $id: 'LoginResponse',
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      user: { $ref: 'User#' },
      refreshToken: { 
        type: 'string',
        description: 'Refresh token for memory storage'
      },
      requiresTwoFactor: { type: 'boolean' },
      tempToken: { type: 'string' }
    },
    required: ['success', 'message', 'user']
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
      user: { $ref: 'User#' },
      refreshToken: { 
        type: 'string',
        description: 'Refresh token for memory storage'
      },
    },

    required: ['success', 'message', 'user']
  },

    // Email verification request - Query parameter
    {
    $id: 'VerifyEmailQuery',
    type: 'object',
    properties: {
        token: { 
        type: 'string',
        minLength: 32,
        description: 'Email verification token from query string'
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
      user: { $ref: 'User#' },
      refreshToken: { 
        type: 'string',
        description: 'Refresh token for memory storage (optional)'
      }
    },
    required: ['success', 'message', 'user']
  },

  {
    $id: 'RefreshTokenRequest',
    type: 'object',
    properties: {
      refreshToken: { 
        type: 'string',
        description: 'Refresh token to obtain new access token'
      }
    },
    required: ['refreshToken'] // TODO check if token is required in body or can be taken from cookie
  },

  // Token refresh request
  {
    $id: 'RefreshResponse',
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      refreshToken: { 
        type: 'string',
        description: 'New refresh token (optional rotation)'
      }
    },
    required: ['success', 'message']
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
      201: { $ref: 'RegisterResponse#' }
    }
  },

  // Email verification route
  verifyEmail: {
    tags: ['auth'],
    operationId: 'verifyEmail',
    summary: 'Verify email address',
    description: 'Verify user email and return authentication tokens',
    querystring: { $ref: 'VerifyEmailQuery#' },
    response: {
      200: { $ref: 'VerifyEmailResponse#' }
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
      200: { $ref: 'LoginResponse#' }
    }
  },

  // Logout route
  logout: {
    tags: ['auth'],
    operationId: 'logoutUser',
    summary: 'User logout',
    description: 'Invalidate JWT token and cleanup user session',
    response: {
      200: { $ref: 'SuccessResponse#' }
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
      200: { $ref: 'LoginResponse#' }
    }
  }
}

export default schemas