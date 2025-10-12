/**
 * @file OAuth route schemas
 * @description Request/response validation for OAuth routes
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

  /**
   * @schema OAuthCallbackQuery
   * @description Query parameters for OAuth callback
   */
  {
    $id: 'OAuthCallbackQuery',
    type: 'object',
    properties: {
      code: {
        type: 'string',
        minLength: 1,
        maxLength: 2000,
        description: 'Authorization code from OAuth provider'
      },
      state: {
        type: 'string',
        minLength: 1,
        maxLength: 500,
        description: 'CSRF protection state token'
      },
      error: {
        type: 'string',
        description: 'Error code from OAuth provider'
      },
      error_description: {
        type: 'string',
        description: 'Error description from OAuth provider'
      }
    },
    // Note: Don't require code/state to allow error responses from OAuth provider
    anyOf: [
      { required: ['code', 'state'] },
      { required: ['error'] }
    ]
  },

  /**
   * @schema OAuthLinkRequest
   * @description Request body for linking OAuth account
   */
  {
    $id: 'OAuthLinkRequest',
    type: 'object',
    properties: {
      provider: {
        type: 'string',
        enum: ['google'],
        description: 'OAuth provider name'
      },
      code: {
        type: 'string',
        minLength: 1,
        maxLength: 2000,
        description: 'Authorization code'
      },
      state: {
        type: 'string',
        minLength: 1,
        maxLength: 500,
        description: 'CSRF token'
      }
    },
    required: ['provider', 'code', 'state']
  },

  /**
   * @schema OAuthLinkResponse
   * @description Response for OAuth account linking
   */
  {
    $id: 'OAuthLinkResponse',
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      user: { $ref: 'User#' }
    },
    required: ['success', 'message']
  },

  /**
   * @schema OAuthUnlinkParams
   * @description Path parameters for OAuth unlinking
   */
  {
    $id: 'OAuthUnlinkParams',
    type: 'object',
    properties: {
      provider: {
        type: 'string',
        enum: ['google'],
        description: 'OAuth provider to unlink'
      }
    },
    required: ['provider']
  },

  /**
   * @schema OAuthUnlinkResponse
   * @description Response for OAuth account unlinking
   */
  {
    $id: 'OAuthUnlinkResponse',
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      user: { $ref: 'User#' }
    },
    required: ['success', 'message']
  }
]

// =============================================================================
// COMPLETE ROUTE OAUTH SCHEMAS
// =============================================================================

export const routeOAuthSchemas = {
  // OAuth callback
  callback: {
    tags: ['oauth'],
    operationId: 'oauthCallback',
    summary: 'OAuth callback handler',
    description: 'Handle OAuth provider callback with code and state',
    querystring: { $ref: 'OAuthCallbackQuery#' },
    response: {
      // OAuth redirects don't have typed responses
    }
  },

  // OAuth link account
  link: {
    tags: ['oauth'],
    operationId: 'oauthLink',
    summary: 'Link OAuth account',
    description: 'Link OAuth provider account to existing user account',
    body: { $ref: 'OAuthLinkRequest#' },
    response: {
      200: { $ref: 'OAuthLinkResponse#' },
      400: { $ref: 'ErrorResponse#' },
      401: { $ref: 'ErrorResponse#' },
      409: { $ref: 'ErrorResponse#' },
      500: { $ref: 'ErrorResponse#' }
    }
  },

  // OAuth unlink account
  unlink: {
    tags: ['oauth'],
    operationId: 'oauthUnlink',
    summary: 'Unlink OAuth account',
    description: 'Unlink OAuth provider from user account',
    params: { $ref: 'OAuthUnlinkParams#' },
    response: {
      200: { $ref: 'OAuthUnlinkResponse#' },
      400: { $ref: 'ErrorResponse#' },
      401: { $ref: 'ErrorResponse#' },
      404: { $ref: 'ErrorResponse#' },
      500: { $ref: 'ErrorResponse#' }
    }
  }
}

export default schemas
