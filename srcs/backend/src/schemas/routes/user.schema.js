/**
 * @file User profile route schemas
 * @description Request/response validation for user profile endpoints
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
  
  // =============================================================================
  // PUBLIC PROFILE SCHEMAS
  // =============================================================================
  
  /**
   * @schema GetPublicProfileParams
   * @description Path parameters for GET /users/:userId
   */
  {
    $id: 'GetPublicProfileParams',
    type: 'object',
    properties: {
      userId: {
        type: 'integer',
        minimum: 1,
        description: 'User ID to retrieve public profile for'
      }
    },
    required: ['userId']
  },

  /**
   * @schema PublicProfileResponse
   * @description Response for public profile view
   */
  {
    $id: 'PublicProfileResponse',
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      user: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          username: { type: 'string' },
          avatar: { type: ['string', 'null'] },
          isOnline: { type: 'boolean' },
          createdAt: { type: ['string', 'null'] }
        },
        required: ['id', 'username']
      }
    },
    required: ['success', 'user']
  },

  /**
   * @schema CompleteProfileResponse
   * @description Response for authenticated user's own profile
   */
  {
    $id: 'CompleteProfileResponse',
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      user: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          username: { type: 'string' },
          email: { type: 'string', format: 'email' },
          emailVerified: { type: 'boolean' },
          avatar: { type: ['string', 'null'] },
          twoFactorEnabled: { type: 'boolean' },
          isOnline: { type: 'boolean' },
          lastSeen: { type: ['string', 'null'] },
          createdAt: { type: ['string', 'null'] },
          updatedAt: { type: ['string', 'null'] }
        },
        required: ['id', 'username', 'email']
      }
    },
    required: ['success', 'user']
  },

  // =============================================================================
  // USER SEARCH SCHEMAS
  // =============================================================================

  /**
   * @schema SearchUsersQuery
   * @description Query parameters for GET /users/search
   */
  {
    $id: 'SearchUsersQuery',
    type: 'object',
    properties: {
      q: {
        type: 'string',
        minLength: 1,
        maxLength: 50,
        description: 'Search query (username partial match)'
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 50,
        default: 10,
        description: 'Maximum number of results'
      }
    },
    required: ['q']
  },

  /**
   * @schema SearchUsersResponse
   * @description Response for user search
   */
  {
    $id: 'SearchUsersResponse',
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      users: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            username: { type: 'string' },
            avatar: { type: ['string', 'null'] },
            isOnline: { type: 'boolean' }
          },
          required: ['id', 'username']
        }
      },
      count: { type: 'integer' }
    },
    required: ['success', 'users', 'count']
  },

  // =============================================================================
  // USERNAME UPDATE SCHEMAS
  // =============================================================================

  /**
   * @schema UpdateUsernameRequest
   * @description Request body for POST /users/set-username
   */
  {
    $id: 'UpdateUsernameRequest',
    type: 'object',
    properties: {
      username: {
        type: 'string',
        minLength: 3,
        maxLength: 20,
        pattern: '^[a-zA-Z0-9_-]+$',
        description: 'New username (alphanumeric, underscores, hyphens only)'
      }
    },
    required: ['username']
  },

  /**
   * @schema UpdateUsernameResponse
   * @description Response for username update
   */
  {
    $id: 'UpdateUsernameResponse',
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      user: { $ref: 'User#' }
    },
    required: ['success', 'message', 'user']
  },

  // =============================================================================
  // AVATAR UPDATE SCHEMAS
  // =============================================================================

  /**
   * @schema UpdateAvatarRequest
   * @description Request body for POST /users/set-avatar
   */
  {
    $id: 'UpdateAvatarRequest',
    type: 'object',
    properties: {
      avatarBase64: {
        type: ['string', 'null'],
        maxLength: 1000000, // ~1MB base64 string limit
        description: 'Base64 encoded avatar image (null to remove avatar)'
      }
    },
    required: ['avatarBase64']
  },

  /**
   * @schema UpdateAvatarResponse
   * @description Response for avatar update
   */
  {
    $id: 'UpdateAvatarResponse',
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      user: { $ref: 'User#' }
    },
    required: ['success', 'message', 'user']
  },

  // =============================================================================
  // USERNAME CHECK SCHEMAS
  // =============================================================================

  /**
   * @schema CheckUsernameQuery
   * @description Query parameters for GET /users/check-username
   */
  {
    $id: 'CheckUsernameQuery',
    type: 'object',
    properties: {
      username: {
        type: 'string',
        minLength: 3,
        maxLength: 20,
        description: 'Username to check availability'
      }
    },
    required: ['username']
  },

  /**
   * @schema CheckUsernameResponse
   * @description Response for username availability check
   */
  {
    $id: 'CheckUsernameResponse',
    type: 'object',
    properties: {
      available: { type: 'boolean' },
      message: { type: 'string' }
    },
    required: ['available', 'message']
  },

  // =============================================================================
  // DELETE USER SCHEMAS
  // =============================================================================

  /**
   * @schema DeleteUserRequest
   * @description Request body for DELETE /users/me
   * - For password-based accounts: password is required
   * - For OAuth accounts: password is optional (not used)
   * - confirmation is always required
   */
  {
    $id: 'DeleteUserRequest',
    type: 'object',
    properties: {
      password: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        description: 'User password for security confirmation (required for password-based accounts, optional for OAuth accounts)'
      },
      confirmation: {
        type: 'string',
        enum: ['DELETE'],
        description: 'Must be exactly "DELETE" to confirm account deletion'
      }
    },
    required: ['confirmation']
  },

  /**
   * @schema DeleteUserResponse
   * @description Response for account deletion
   */
  {
    $id: 'DeleteUserResponse',
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' }
    },
    required: ['success', 'message']
  }
]

// =============================================================================
// COMPLETE ROUTE USER SCHEMAS
// =============================================================================

export const routeUserSchemas = {
  // Get own profile
  me: {
    tags: ['users'],
    operationId: 'getOwnProfile',
    summary: 'Get authenticated user profile',
    description: 'Retrieve complete profile for authenticated user',
    response: {
      200: { $ref: 'CompleteProfileResponse#' },
      401: { $ref: 'ErrorResponse#' },
      404: { $ref: 'ErrorResponse#' },
      500: { $ref: 'ErrorResponse#' }
    }
  },

  // Get public profile
  publicProfile: {
    tags: ['users'],
    operationId: 'getPublicProfile',
    summary: 'Get user public profile',
    description: 'Retrieve public profile for any user by ID',
    params: { $ref: 'GetPublicProfileParams#' },
    response: {
      200: { $ref: 'PublicProfileResponse#' },
      404: { $ref: 'ErrorResponse#' },
      500: { $ref: 'ErrorResponse#' }
    }
  },

  // Search users
  search: {
    tags: ['users'],
    operationId: 'searchUsers',
    summary: 'Search users',
    description: 'Search users by username (partial match)',
    querystring: { $ref: 'SearchUsersQuery#' },
    response: {
      200: { $ref: 'SearchUsersResponse#' },
      400: { $ref: 'ErrorResponse#' },
      500: { $ref: 'ErrorResponse#' }
    }
  },

  // Update username
  updateUsername: {
    tags: ['users'],
    operationId: 'updateUsername',
    summary: 'Update username',
    description: 'Update username for authenticated user',
    body: { $ref: 'UpdateUsernameRequest#' },
    response: {
      200: { $ref: 'UpdateUsernameResponse#' },
      400: { $ref: 'ErrorResponse#' },
      401: { $ref: 'ErrorResponse#' },
      409: { $ref: 'ErrorResponse#' },
      500: { $ref: 'ErrorResponse#' }
    }
  },

  // Update avatar
  updateAvatar: {
    tags: ['users'],
    operationId: 'updateAvatar',
    summary: 'Update avatar',
    description: 'Update avatar (base64 encoded image) for authenticated user',
    body: { $ref: 'UpdateAvatarRequest#' },
    response: {
      200: { $ref: 'UpdateAvatarResponse#' },
      400: { $ref: 'ErrorResponse#' },
      401: { $ref: 'ErrorResponse#' },
      500: { $ref: 'ErrorResponse#' }
    }
  },

  // Check username availability
  checkUsername: {
    tags: ['users'],
    operationId: 'checkUsername',
    summary: 'Check username availability',
    description: 'Check if username is available and valid',
    querystring: { $ref: 'CheckUsernameQuery#' },
    response: {
      200: { $ref: 'CheckUsernameResponse#' },
      400: { $ref: 'ErrorResponse#' },
      500: { $ref: 'ErrorResponse#' }
    }
  },

  // Delete account
  deleteAccount: {
    tags: ['users'],
    operationId: 'deleteAccount',
    summary: 'Delete user account',
    description: 'Permanently delete user account',
    body: { $ref: 'DeleteUserRequest#' },
    response: {
      200: { $ref: 'DeleteUserResponse#' },
      400: { $ref: 'ErrorResponse#' },
      401: { $ref: 'ErrorResponse#' },
      403: { $ref: 'ErrorResponse#' },
      500: { $ref: 'ErrorResponse#' }
    }
  }
}

export default schemas