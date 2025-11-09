/**
 * @file OAuth Routes
 * @description Google OAuth 2.0 authentication endpoints
 */

import { FastifyInstance } from 'fastify';
import { DatabaseService } from '../services/database.service.js';
import { setAuthCookies } from '../utils/auth.utils.js';

export async function oauthRoutes(
  fastify: FastifyInstance,
  db: DatabaseService
): Promise<void> {

  /**
   * GET /oauth/google/login
   * @description Initiate Google OAuth flow
   */
  fastify.get('/oauth/google/login', async (_request, reply) => {
    const clientId = process.env['GOOGLE_CLIENT_ID'];
    const redirectUri = process.env['GOOGLE_REDIRECT_URI'] ||
      'https://ft_transcendence.42.crea/api/auth/oauth/google/callback';

    if (!clientId) {
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Google OAuth not configured',
        statusCode: 500
      });
    }

    // Build Google OAuth URL
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', 'openid email profile');
    authUrl.searchParams.append('access_type', 'offline');
    authUrl.searchParams.append('prompt', 'consent');

    // Generate and store state for CSRF protection
    const state = Math.random().toString(36).substring(7);
    db.saveOAuthState(state);

    authUrl.searchParams.append('state', state);

    // Redirect to Google
    return reply.redirect(authUrl.toString());
  });

  /**
   * GET /oauth/google/callback
   * @description Handle Google OAuth callback
   */
  fastify.get('/oauth/google/callback', async (request, reply) => {
    const { code, state, error } = request.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    // Handle OAuth error
    if (error) {
      fastify.log.error({ error }, 'OAuth error from Google');
      return reply.redirect(
        `https://${process.env['DOMAIN'] || 'ft_transcendence.42.crea'}/login?error=oauth_failed`
      );
    }

    if (!code) {
      return reply.code(400).send({
        error: 'BadRequest',
        message: 'Authorization code missing',
        statusCode: 400
      });
    }

    // Validate state for CSRF protection
    if (!state || !db.validateOAuthState(state)) {
      fastify.log.error({ state }, 'Invalid OAuth state');
      return reply.redirect(
        `https://${process.env['DOMAIN'] || 'ft_transcendence.42.crea'}/login?error=invalid_state`
      );
    }

    // Delete used state
    db.deleteOAuthState(state);

    try {
      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env['GOOGLE_CLIENT_ID'] || '',
          client_secret: process.env['GOOGLE_CLIENT_SECRET'] || '',
          redirect_uri: process.env['GOOGLE_REDIRECT_URI'] ||
            'https://ft_transcendence.42.crea/api/auth/oauth/google/callback',
          grant_type: 'authorization_code'
        })
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to exchange code for tokens');
      }

      const tokens = await tokenResponse.json() as {
        access_token: string;
        id_token: string;
      };

      // Get user info from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });

      if (!userInfoResponse.ok) {
        throw new Error('Failed to fetch user info from Google');
      }

      const googleUser = await userInfoResponse.json() as {
        id: string;
        email: string;
        name?: string;
        picture?: string;
      };

      // Find or create user in database
      let user = db.findUserByGoogleId(googleUser.id);
      let isNewUser = false;

      if (!user) {
        // Check if email already exists
        user = db.findUserByEmail(googleUser.email);

        if (user) {
          // Link Google account to existing user
          db.updateUser(user.id, {
            google_id: googleUser.id
          });
          isNewUser = false;
        } else {
          // Create new user
          const username = googleUser.email.split('@')[0] + '_' + Math.random().toString(36).substring(7);
          user = db.createUser({
            username,
            email: googleUser.email,
            google_id: googleUser.id
          });
          isNewUser = true;
        }
      }

      // Generate JWT tokens
      const accessToken = fastify.jwt.sign(
        { id: user.id, username: user.username, email: user.email },
        { expiresIn: process.env['JWT_EXPIRES_IN'] || '15m' }
      );

      const refreshToken = fastify.jwt.sign(
        { id: user.id, type: 'refresh' },
        { expiresIn: process.env['JWT_REFRESH_EXPIRES_IN'] || '7d' }
      );

      // Set secure httpOnly cookies
      setAuthCookies(reply, accessToken, refreshToken);

      // Redirect to frontend with newUser flag
      const frontendUrl = `https://${process.env['DOMAIN'] || 'ft_transcendence.42.crea'}/oauth/callback?newUser=${isNewUser}`;
      return reply.redirect(frontendUrl);

    } catch (error) {
      fastify.log.error({ error }, 'OAuth callback error');
      const frontendUrl = `https://${process.env['DOMAIN'] || 'ft_transcendence.42.crea'}/login?error=oauth_failed`;
      return reply.redirect(frontendUrl);
    }
  });
}
