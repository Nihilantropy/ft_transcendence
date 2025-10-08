/**
 * @brief Authentication route schemas for ft_transcendence backend
 * 
 * @description Complete route schemas with centralized definitions
 */

import userSchemas from '../common/user.schema.js'
import responseSchemas from '../common/responses.schema.js'

// =============================================================================
// REQUEST/RESPONSE SCHEMAS
// =============================================================================

const schemas = [
  // Import common schemas first
  ...userSchemas,
  ...responseSchemas,

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
      user: { $ref: 'User#' }, // Only present when 2FA not required
      requiresTwoFactor: { type: 'boolean' }, // Only present when 2FA required
      tempToken: { type: 'string' } // Only present when 2FA required
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
      },
      confirmPassword: {
        type: 'string',
        minLength: 8,
        maxLength: 128,
        description: 'Confirm password'
      }
    },
    required: ['email', 'password', 'confirmPassword']
  },

  // Register response schema
  {
    $id: 'RegisterResponse',
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      user: { $ref: 'User#' },
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
    },
    required: ['success', 'message', 'user']
  },

  // 2FA Setup request schema
  {
    $id: 'Setup2FARequest',
    type: 'object',
    properties: {
      // Usually no data needed for setup initiation, but keeping extensible
    },
    required: []
  },

  // 2FA Setup response schema
  {
    $id: 'Setup2FAResponse',
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      setupData: {
        type: 'object',
        properties: {
          secret: { 
            type: 'string',
            description: 'Base32 encoded secret for TOTP'
          },
          qrCode: { 
            type: 'string',
            description: 'Base64 encoded QR code image'
          },
          backupCodes: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of backup codes for recovery'
          }
        },
        required: ['secret', 'qrCode', 'backupCodes']
      }
    },
    required: ['success', 'message']
  },

  // 2FA Verify Setup request schema
  {
    $id: 'Verify2FASetupRequest',
    type: 'object',
    properties: {
      token: { 
        type: 'string',
        pattern: '^\\d{6}$',
        description: '6-digit TOTP token'
      },
      secret: { 
        type: 'string',
        description: 'Base32 encoded secret from setup'
      }
    },
    required: ['token', 'secret']
  },

  // 2FA Verify Setup response schema
  {
    $id: 'Verify2FASetupResponse',
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      user: { $ref: 'User#' }
    },
    required: ['success', 'message', 'user']
  },

  // 2FA Verify request schema (for login)
  {
    $id: 'Verify2FARequest',
    type: 'object',
    properties: {
      tempToken: { 
        type: 'string',
        minLength: 1,
        description: 'Temporary token from initial login'
      },
      token: { 
        type: 'string',
        pattern: '^\\d{6}$',
        description: '6-digit TOTP token'
      },
      backupCode: { 
        type: 'string',
        description: 'Backup recovery code'
      }
    },
    required: ['tempToken'],
    anyOf: [
      { required: ['token'] },
      { required: ['backupCode'] }
    ]
  },

  // 2FA Verify response schema (for login)
  // Access token is set in httpOnly cookie, not in response body
  {
    $id: 'Verify2FAResponse',
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      user: { $ref: 'User#' },
    },
    required: ['success', 'message', 'user']
  },

  // 2FA Disable request schema
  {
    $id: 'Disable2FARequest',
    type: 'object',
    properties: {
      password: { 
        type: 'string',
        minLength: 1,
        description: 'User password for security confirmation'
      },
      token: { 
        type: 'string',
        pattern: '^\\d{6}$',
        description: 'Optional 2FA token for additional verification'
      }
    },
    required: ['password']
  },

  // 2FA Disable response schema
  {
    $id: 'Disable2FAResponse',
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      user: { $ref: 'User#' }
    },
    required: ['success', 'message', 'user']
  },

  // Resend verification email request schema
  {
    $id: 'ResendVerificationRequest',
    type: 'object',
    properties: {
      email: { 
        type: 'string',
        format: 'email',
        description: 'Email address to resend verification to'
      }
    },
    required: ['email']
  },

  // Resend verification email response schema
  {
    $id: 'ResendVerificationResponse',
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' }
    },
    required: ['success', 'message']
  }
]

// =============================================================================
// COMPLETE ROUTE AUTH SCHEMAS
// =============================================================================

export const routeAuthSchemas = {
  // Register route
  register: {
    tags: ['auth'],
    operationId: 'registerUser',
    summary: 'User registration',
    description: 'Register new user account with auto-generated username',
    body: { $ref: 'RegisterRequest#' },
    response: {
      201: { $ref: 'RegisterResponse#' },
      400: { $ref: 'ErrorResponse#' },
      500: { $ref: 'ErrorResponse#' }
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
      200: { $ref: 'VerifyEmailResponse#' },
      400: { $ref: 'ErrorResponse#' },
      500: { $ref: 'ErrorResponse#' }
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
      400: { $ref: 'ErrorResponse#' },
      401: { $ref: 'ErrorResponse#' },
      500: { $ref: 'ErrorResponse#' }
    }
  },

  // Logout route
  logout: {
    tags: ['auth'],
    operationId: 'logoutUser',
    summary: 'User logout',
    description: 'Invalidate JWT token and cleanup user session',
    response: {
      200: { $ref: 'SuccessResponse#' },
      500: { $ref: 'ErrorResponse#' }
    }
  },

  // Token refresh route
  refresh: {
    tags: ['auth'],
    operationId: 'refreshToken',
    summary: 'Refresh access token',
    description: 'Generate new access token using refresh token',
    response: {
      200: { $ref: 'SuccessResponse#' },
      401: { $ref: 'ErrorResponse#' },
      500: { $ref: 'ErrorResponse#' }
    }
  },

  // 2FA Setup route
  setup2FA: {
    tags: ['auth', '2fa'],
    operationId: 'setup2FA',
    summary: 'Setup two-factor authentication',
    description: 'Initialize 2FA setup and return secret, QR code, and backup codes',
    body: { $ref: 'Setup2FARequest#' },
    response: {
      200: { $ref: 'Setup2FAResponse#' },
      400: { $ref: 'ErrorResponse#' },
      401: { $ref: 'ErrorResponse#' },
      500: { $ref: 'ErrorResponse#' }
    }
  },

  // 2FA Setup verification route
  verify2FASetup: {
    tags: ['auth', '2fa'],
    operationId: 'verify2FASetup',
    summary: 'Verify 2FA setup',
    description: 'Verify TOTP token to complete 2FA setup process',
    body: { $ref: 'Verify2FASetupRequest#' },
    response: {
      200: { $ref: 'Verify2FASetupResponse#' },
      400: { $ref: 'ErrorResponse#' },
      401: { $ref: 'ErrorResponse#' },
      500: { $ref: 'ErrorResponse#' }
    }
  },

  // 2FA Verification route (for login)
  verify2FA: {
    tags: ['auth', '2fa'],
    operationId: 'verify2FA',
    summary: 'Verify 2FA for login',
    description: 'Verify TOTP token or backup code during login process',
    body: { $ref: 'Verify2FARequest#' },
    response: {
      200: { $ref: 'Verify2FAResponse#' },
      400: { $ref: 'ErrorResponse#' },
      401: { $ref: 'ErrorResponse#' },
      500: { $ref: 'ErrorResponse#' }
    }
  },

  // 2FA Disable route
  disable2FA: {
    tags: ['auth', '2fa'],
    operationId: 'disable2FA',
    summary: 'Disable two-factor authentication',
    description: 'Disable 2FA for user account with password confirmation',
    body: { $ref: 'Disable2FARequest#' },
    response: {
      200: { $ref: 'Disable2FAResponse#' },
      400: { $ref: 'ErrorResponse#' },
      401: { $ref: 'ErrorResponse#' },
      500: { $ref: 'ErrorResponse#' }
    }
  },

  // Resend verification email route
  resendVerification: {
    tags: ['auth'],
    operationId: 'resendVerification',
    summary: 'Resend verification email',
    description: 'Resend email verification link to user (rate limited to 1 per 5 minutes)',
    body: { $ref: 'ResendVerificationRequest#' },
    response: {
      200: { $ref: 'ResendVerificationResponse#' },
      400: { $ref: 'ErrorResponse#' },
      429: { $ref: 'ErrorResponse#' },
      500: { $ref: 'ErrorResponse#' }
    }
  }
}

export default schemas