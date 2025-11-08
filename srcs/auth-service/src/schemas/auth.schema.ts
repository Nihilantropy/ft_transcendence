/**
 * @file Auth JSON Schemas
 * @description JSON Schema definitions for authentication routes (Fastify native validation)
 */

import { FastifySchema } from 'fastify';

// Login schema
export const loginSchema: FastifySchema = {
  body: {
    type: 'object',
    required: ['identifier', 'password'],
    properties: {
      identifier: {
        type: 'string',
        minLength: 3,
        maxLength: 255,
        description: 'Email address or username'
      },
      password: {
        type: 'string',
        minLength: 8,
        maxLength: 255
      },
      twoFactorCode: {
        type: 'string',
        pattern: '^[0-9]{6}$'
      }
    },
    additionalProperties: false
  },
  response: {
    200: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            username: { type: 'string' },
            email: { type: 'string' },
            display_name: { type: 'string' },
            avatar_url: { type: 'string' },
            status: { type: 'string', enum: ['online', 'offline', 'in_game'] },
            two_factor_enabled: { type: 'boolean' },
            email_verified: { type: 'boolean' }
          }
        },
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' }
      }
    },
    401: {
      type: 'object',
      properties: {
        error: { type: 'string' },
        message: { type: 'string' },
        statusCode: { type: 'number' }
      }
    }
  }
};

// Register schema
export const registerSchema: FastifySchema = {
  body: {
    type: 'object',
    required: ['username', 'email', 'password'],
    properties: {
      username: {
        type: 'string',
        minLength: 3,
        maxLength: 20,
        pattern: '^[a-zA-Z0-9_-]+$'
      },
      email: {
        type: 'string',
        format: 'email',
        minLength: 5,
        maxLength: 255
      },
      password: {
        type: 'string',
        minLength: 8,
        maxLength: 255
      }
    },
    additionalProperties: false
  },
  response: {
    201: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            username: { type: 'string' },
            email: { type: 'string' },
            email_verified: { type: 'boolean' }
          }
        },
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' }
      }
    },
    400: {
      type: 'object',
      properties: {
        error: { type: 'string' },
        message: { type: 'string' },
        statusCode: { type: 'number' }
      }
    },
    409: {
      type: 'object',
      properties: {
        error: { type: 'string' },
        message: { type: 'string' },
        statusCode: { type: 'number' }
      }
    }
  }
};

// Refresh token schema
export const refreshTokenSchema: FastifySchema = {
  body: {
    type: 'object',
    required: ['refreshToken'],
    properties: {
      refreshToken: { type: 'string' }
    },
    additionalProperties: false
  },
  response: {
    200: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' }
      }
    }
  }
};

// 2FA Enable schema
export const enable2FASchema: FastifySchema = {
  response: {
    200: {
      type: 'object',
      properties: {
        secret: { type: 'string' },
        qrCode: { type: 'string' },
        backupCodes: {
          type: 'array',
          items: { type: 'string' }
        }
      }
    }
  }
};

// 2FA Verify schema
export const verify2FASchema: FastifySchema = {
  body: {
    type: 'object',
    required: ['token'],
    properties: {
      token: {
        type: 'string',
        pattern: '^[0-9]{6}$'
      }
    },
    additionalProperties: false
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' }
      }
    }
  }
};

// OAuth callback schema
export const oauthCallbackSchema: FastifySchema = {
  querystring: {
    type: 'object',
    required: ['code', 'state'],
    properties: {
      code: { type: 'string' },
      state: { type: 'string' }
    }
  }
};
