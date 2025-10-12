/**
 * @file OAuth route schemas
 * @description Request/response validation for Google OAuth routes only
 */

import userSchemas from '../common/user.schema.js'
import responseSchemas from '../common/responses.schema.js'

// =============================================================================
// REQUEST/RESPONSE SCHEMAS (Google OAuth Only)
// =============================================================================

const schemas = [
  // Import common schemas first
  ...userSchemas,
  ...responseSchemas,

  /**
   * @schema OAuthCallbackQuery
   * @description Query parameters for Google OAuth callback
   */
  {
    $id: 'OAuthCallbackQuery',
    type: 'object',
    properties: {
      code: {
        type: 'string',
        minLength: 1,
        maxLength: 2000,
        description: 'Authorization code from Google'
      },
      state: {
        type: 'string',
        minLength: 1,
        maxLength: 500,
        description: 'CSRF protection state token'
      },
      error: {
        type: 'string',
        description: 'Error code from Google OAuth'
      },
      error_description: {
        type: 'string',
        description: 'Error description from Google OAuth'
      }
    },
    // Note: Don't require code/state to allow error responses from OAuth provider
    anyOf: [
      { required: ['code', 'state'] },
      { required: ['error'] }
    ]
  }
]

// =============================================================================
// COMPLETE ROUTE OAUTH SCHEMAS
// =============================================================================

export const routeOAuthSchemas = {
  // Google OAuth callback
  callback: {
    tags: ['oauth'],
    operationId: 'oauthCallback',
    summary: 'Google OAuth callback handler',
    description: 'Handle Google OAuth callback with code and state. Auto-links accounts with matching email.',
    querystring: { $ref: 'OAuthCallbackQuery#' },
    response: {
      // OAuth redirects don't have typed responses
    }
  }
}

export default schemas
