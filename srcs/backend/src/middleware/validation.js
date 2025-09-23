/**
 * @brief Validation middleware for ft_transcendence backend
 * 
 * @description Fastify schemas and validation middleware for:
 * - Input validation
 * - Data sanitization
 * - Error formatting
 */

// =============================================================================
// FASTIFY SCHEMAS FOR INPUT VALIDATION
// =============================================================================

/**
 * @brief User registration schema with custom validation
 */
export const registerSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
        maxLength: 254,
        description: 'User email address'
      },
      password: {
        type: 'string',
        minLength: 8,
        maxLength: 128,
        description: 'User password (min 8 characters)'
      }
    },
    additionalProperties: false
  }
}

/**
 * @brief Custom password strength validation for registration
 * @param {string} password - Password to validate
 * @returns {object} - {isValid: boolean, message: string, score: number}
 */
export function validatePasswordStrength(password) {
  const requirements = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  }
  
  const score = Object.values(requirements).filter(Boolean).length
  
  if (score < 3) {
    return { 
      isValid: false, 
      message: 'Password must contain at least 3 of: uppercase letter, lowercase letter, number, special character',
      score
    }
  }
  
  // Check for common weak passwords
  const commonPasswords = ['password', '12345678', 'qwerty123', 'admin123']
  if (commonPasswords.includes(password.toLowerCase())) {
    return { isValid: false, message: 'This password is too common', score }
  }
  
  return { isValid: true, message: 'Password is strong', score }
}

/**
 * @brief User login schema
 */
export const loginSchema = {
  body: {
    type: 'object',
    required: ['username', 'password'],
    properties: {
      username: {
        type: 'string',
        minLength: 3,
        maxLength: 254, // Can be email or username
        description: 'Username or email address'
      },
      password: {
        type: 'string',
        minLength: 1,
        maxLength: 128,
        description: 'User password'
      },
      rememberMe: {
        type: 'boolean',
        default: false,
        description: 'Keep user logged in'
      },
      twoFactorToken: {
        type: 'string',
        minLength: 6,
        maxLength: 6,
        pattern: '^[0-9]{6}$',
        description: '6-digit 2FA token'
      }
    },
    additionalProperties: false
  }
}

/**
 * @brief Email verification schema
 */
export const verifyEmailSchema = {
  body: {
    type: 'object',
    required: ['token'],
    properties: {
      token: {
        type: 'string',
        minLength: 32,
        maxLength: 128,
        description: 'Email verification token'
      }
    },
    additionalProperties: false
  }
}

/**
 * @brief Password reset request schema
 */
export const forgotPasswordSchema = {
  body: {
    type: 'object',
    required: ['email'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
        maxLength: 254,
        description: 'User email address'
      }
    },
    additionalProperties: false
  }
}

/**
 * @brief Password reset schema
 */
export const resetPasswordSchema = {
  body: {
    type: 'object',
    required: ['token', 'newPassword', 'confirmPassword'],
    properties: {
      token: {
        type: 'string',
        minLength: 32,
        maxLength: 128,
        description: 'Password reset token'
      },
      newPassword: {
        type: 'string',
        minLength: 8,
        maxLength: 128,
        description: 'New password'
      },
      confirmPassword: {
        type: 'string',
        minLength: 8,
        maxLength: 128,
        description: 'New password confirmation'
      }
    },
    additionalProperties: false
  }
}

/**
 * @brief Username check schema
 */
export const checkUsernameSchema = {
  body: {
    type: 'object',
    required: ['username'],
    properties: {
      username: {
        type: 'string',
        minLength: 3,
        maxLength: 20,
        pattern: '^[a-zA-Z0-9_-]+$',
        description: 'Username to check'
      }
    },
    additionalProperties: false
  }
}

/**
 * @brief Refresh token schema
 */
export const refreshTokenSchema = {
  body: {
    type: 'object',
    required: ['refreshToken'],
    properties: {
      refreshToken: {
        type: 'string',
        minLength: 1,
        description: 'JWT refresh token'
      }
    },
    additionalProperties: false
  }
}

// =============================================================================
// VALIDATION MIDDLEWARE FUNCTIONS
// =============================================================================

/**
 * @brief Generic validation error handler
 */
export function validationErrorHandler(error, request, reply) {
  if (error.validation) {
    const errors = error.validation.map(err => ({
      field: err.instancePath.replace('/', ''),
      message: err.message,
      value: err.data
    }))
    
    reply.status(400).send({
      success: false,
      message: 'Validation error',
      errors
    })
    return
  }
  
  throw error
}

/**
 * @brief Rate limiting validation
 */
export const rateLimitSchema = {
  max: 100, // Maximum requests
  timeWindow: '15 minutes',
  errorResponseBuilder: (request, context) => {
    return {
      success: false,
      message: `Rate limit exceeded. Try again in ${Math.round(context.ttl / 1000)} seconds.`,
      retryAfter: Math.round(context.ttl / 1000)
    }
  }
}
