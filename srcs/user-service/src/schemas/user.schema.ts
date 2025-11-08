/**
 * @file Validation Schemas
 * @description Fastify JSON Schema validation for all endpoints
 */

// Profile update schema
export const profileUpdateSchema = {
  body: {
    type: 'object',
    properties: {
      username: {
        type: 'string',
        minLength: 3,
        maxLength: 20,
        pattern: '^[a-zA-Z0-9_-]+$',
        description: 'Username (alphanumeric, underscore, hyphen only)'
      },
      avatar_base64: {
        type: 'string',
        description: 'Base64-encoded image data'
      }
    },
    additionalProperties: false
  }
};

// Avatar upload schema
export const avatarUploadSchema = {
  body: {
    type: 'object',
    required: ['avatar_base64'],
    properties: {
      avatar_base64: {
        type: 'string',
        minLength: 100,
        maxLength: 10485760, // 10MB base64 (~7.5MB image)
        description: 'Base64-encoded image (JPEG, PNG, GIF)'
      }
    },
    additionalProperties: false
  }
};

// Search query schema
export const searchQuerySchema = {
  querystring: {
    type: 'object',
    required: ['q'],
    properties: {
      q: {
        type: 'string',
        minLength: 1,
        maxLength: 50,
        description: 'Search query (username or email)'
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 100,
        default: 20,
        description: 'Maximum number of results'
      }
    }
  }
};

// User ID parameter schema
export const userIdParamSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'number',
        minimum: 1,
        description: 'User ID'
      }
    }
  }
};

// Friend request schema
export const friendRequestSchema = {
  body: {
    type: 'object',
    required: ['to_user_id'],
    properties: {
      to_user_id: {
        type: 'number',
        minimum: 1,
        description: 'User ID to send friend request to'
      },
      message: {
        type: 'string',
        maxLength: 200,
        description: 'Optional message with friend request'
      }
    },
    additionalProperties: false
  }
};

// Friend request ID parameter schema
export const friendRequestIdParamSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'number',
        minimum: 1,
        description: 'Friend request ID'
      }
    }
  }
};

// Friend request status query schema
export const friendRequestStatusSchema = {
  querystring: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['pending', 'accepted', 'declined'],
        description: 'Filter by friend request status'
      }
    }
  }
};

// Generic error response schema (for documentation)
export const errorResponseSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    message: { type: 'string' },
    statusCode: { type: 'number' }
  }
};

// User response schema (sanitized - no sensitive data)
export const userResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    username: { type: 'string' },
    email: { type: 'string' },
    avatar_base64: { type: 'string', nullable: true },
    is_active: { type: 'boolean' },
    is_online: { type: 'boolean' },
    last_seen: { type: 'string', nullable: true },
    created_at: { type: 'string' },
    updated_at: { type: 'string' }
  }
};

// Friend request response schema
export const friendRequestResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    from_user_id: { type: 'number' },
    to_user_id: { type: 'number' },
    message: { type: 'string', nullable: true },
    status: { type: 'string', enum: ['pending', 'accepted', 'declined'] },
    created_at: { type: 'string' },
    responded_at: { type: 'string', nullable: true }
  }
};

// User stats response schema
export const userStatsResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    user_id: { type: 'number' },
    games_played: { type: 'number' },
    games_won: { type: 'number' },
    games_lost: { type: 'number' },
    win_rate: { type: 'number' },
    total_score: { type: 'number' },
    current_streak: { type: 'number' },
    best_streak: { type: 'number' },
    ranking: { type: 'number' },
    tournaments_played: { type: 'number' },
    tournaments_won: { type: 'number' },
    average_game_duration: { type: 'number' },
    updated_at: { type: 'string' }
  }
};
