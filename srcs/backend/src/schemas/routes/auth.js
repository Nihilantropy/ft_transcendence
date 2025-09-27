/**
 * @brief Authentication route schemas for ft_transcendence backend
 * 
 * @description Request/response schemas for all auth endpoints
 */

export default [
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

  // Register request schema
  {
    $id: 'RegisterRequest',
    type: 'object',
    properties: {
      username: { 
        type: 'string',
        minLength: 3,
        maxLength: 30,
        pattern: '^[a-zA-Z0-9_-]+$',
        description: 'Username (alphanumeric, underscore, hyphen)',
        example: 'john_doe'
      },
      email: { 
        type: 'string',
        format: 'email',
        description: 'Valid email address',
        example: 'john@example.com'
      },
      password: { 
        type: 'string',
        minLength: 8,
        maxLength: 128,
        description: 'Strong password',
        example: 'SecurePassword123!'
      },
      confirmPassword: { 
        type: 'string',
        description: 'Password confirmation',
        example: 'SecurePassword123!'
      }
    },
    required: ['username', 'email', 'password', 'confirmPassword']
  },

  // Token refresh request schema
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
  },

  // Token refresh response schema
  {
    $id: 'RefreshTokenResponse',
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      accessToken: { 
        type: 'string',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      },
      tokenType: { type: 'string', example: 'Bearer' },
      expiresIn: { type: 'string', example: '15m' }
    },
    required: ['success', 'accessToken', 'tokenType', 'expiresIn']
  },

  // Username check request schema
  {
    $id: 'CheckUsernameRequest',
    type: 'object',
    properties: {
      username: { 
        type: 'string',
        minLength: 3,
        maxLength: 30,
        pattern: '^[a-zA-Z0-9_-]+$',
        example: 'john_doe'
      }
    },
    required: ['username']
  },

  // Username check response schema
  {
    $id: 'CheckUsernameResponse',
    type: 'object',
    properties: {
      available: { type: 'boolean', example: true },
      message: { type: 'string', example: 'Username is available' }
    },
    required: ['available', 'message']
  },

  // Forgot password request schema
  {
    $id: 'ForgotPasswordRequest',
    type: 'object',
    properties: {
      email: { 
        type: 'string',
        format: 'email',
        example: 'john@example.com'
      }
    },
    required: ['email']
  }
]