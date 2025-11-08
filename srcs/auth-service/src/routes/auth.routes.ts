/**
 * @file Auth Routes
 * @description Authentication endpoints (login, register, OAuth, 2FA)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type {
  RegisterBody,
  AuthenticatedRequest
} from '../types/index.js';
import {
  loginSchema,
  registerSchema,
  enable2FASchema,
  verify2FASchema
} from '../schemas/auth.schema.js';
import {
  hashPassword,
  verifyPassword,
  generate2FASecret,
  generate2FAQRCode,
  verify2FAToken,
  generateBackupCodes,
  hashBackupCodes,
  verifyBackupCode,
  isStrongPassword
} from '../utils/auth.utils.js';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import { DatabaseService } from '../services/database.service.js';

/**
 * Helper function to set authentication cookies securely
 */
function setAuthCookies(
  reply: FastifyReply,
  accessToken: string,
  refreshToken: string
): void {
  const isProduction = process.env['NODE_ENV'] === 'production';

  // Set access token cookie (httpOnly, secure in production)
  reply.setCookie('accessToken', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: 15 * 60 // 15 minutes in seconds
  });

  // Set refresh token cookie (httpOnly, secure in production)
  reply.setCookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 // 7 days in seconds
  });
}

/**
 * Helper function to clear authentication cookies
 */
function clearAuthCookies(reply: FastifyReply): void {
  reply.clearCookie('accessToken', { path: '/' });
  reply.clearCookie('refreshToken', { path: '/' });
}

export async function authRoutes(
  fastify: FastifyInstance,
  db: DatabaseService
): Promise<void> {
  /**
   * POST /login
   * @description User login with email/username and password, with optional 2FA
   * @body {string} identifier - Email address or username
   * @body {string} password - User password
   * @body {string} [twoFactorCode] - Optional 2FA verification code
   */
  fastify.post<{ Body: { identifier: string; password: string; twoFactorCode?: string } }>(
    '/login',
    {
      schema: loginSchema,
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '15 minutes'
        }
      }
    },
    async (request, reply) => {
      const { identifier, password, twoFactorCode } = request.body;

      // Find user by email or username
      const user = db.findUserByIdentifier(identifier);
      if (!user || !user.password_hash) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Invalid credentials',
          statusCode: 401
        });
      }

      // Verify password
      const validPassword = await verifyPassword(password, user.password_hash);
      if (!validPassword) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Invalid credentials',
          statusCode: 401
        });
      }

      // Check 2FA if enabled
      if (user.two_factor_enabled && user.two_factor_secret) {
        if (!twoFactorCode) {
          return reply.code(401).send({
            error: 'TwoFactorRequired',
            message: '2FA code or backup code required',
            statusCode: 401
          });
        }

        // Try regular 2FA token first
        let valid2FA = verify2FAToken(twoFactorCode, user.two_factor_secret);

        // If regular token fails, try backup code
        if (!valid2FA && user.backup_codes) {
          const backupCodeHashes = JSON.parse(user.backup_codes as string) as string[];

          // Check if the provided code matches any backup code
          let backupCodeValid = false;
          for (const hash of backupCodeHashes) {
            if (await verifyBackupCode(twoFactorCode, hash)) {
              // Use the backup code (removes it from database)
              db.useBackupCode(user.id, hash);
              backupCodeValid = true;
              break;
            }
          }

          valid2FA = backupCodeValid;
        }

        if (!valid2FA) {
          return reply.code(401).send({
            error: 'Unauthorized',
            message: 'Invalid 2FA code or backup code',
            statusCode: 401
          });
        }
      }

      // Generate tokens
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

      // Remove sensitive data
      const { password_hash, two_factor_secret, ...userResponse } = user;

      // Return user data only (tokens are in cookies)
      return reply.code(200).send({
        success: true,
        user: userResponse
      });
    }
  );

  /**
   * POST /register
   * @description User registration
   */
  fastify.post<{ Body: RegisterBody }>(
    '/register',
    {
      schema: registerSchema,
      config: {
        rateLimit: {
          max: 3,
          timeWindow: '1 hour'
        }
      }
    },
    async (request, reply) => {
      const { username, email, password } = request.body;

      // Check if user exists
      const existingUser = db.findUserByEmail(email);
      if (existingUser) {
        return reply.code(409).send({
          error: 'Conflict',
          message: 'User already exists',
          statusCode: 409
        });
      }

      // Validate password strength
      const passwordCheck = isStrongPassword(password);
      if (!passwordCheck.valid) {
        return reply.code(400).send({
          error: 'BadRequest',
          message: passwordCheck.errors.join(', '),
          statusCode: 400
        });
      }

      // Hash password
      const password_hash = await hashPassword(password);

      // Create user
      const user = db.createUser({ username, email, password_hash });

      // Generate tokens
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

      const { password_hash: _, two_factor_secret: __, ...userResponse } = user;

      // Return user data only (tokens are in cookies)
      return reply.code(201).send({
        success: true,
        user: userResponse
      });
    }
  );

  /**
   * POST /refresh
   * @description Refresh access token using refresh token from cookie
   */
  fastify.post(
    '/refresh',
    async (request, reply) => {
      // Get refresh token from cookie
      const refreshToken = request.cookies['refreshToken'];

      if (!refreshToken) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Refresh token not found',
          statusCode: 401
        });
      }

      try {
        // Verify refresh token
        const payload = fastify.jwt.verify(refreshToken) as { id: number; type: string };

        if (payload.type !== 'refresh') {
          throw new Error('Invalid token type');
        }

        // Get user
        const user = db.findUserById(payload.id);
        if (!user) {
          throw new Error('User not found');
        }

        // Generate new tokens
        const newAccessToken = fastify.jwt.sign(
          { id: user.id, username: user.username, email: user.email },
          { expiresIn: process.env['JWT_EXPIRES_IN'] || '15m' }
        );

        const newRefreshToken = fastify.jwt.sign(
          { id: user.id, type: 'refresh' },
          { expiresIn: process.env['JWT_REFRESH_EXPIRES_IN'] || '7d' }
        );

        // Set new cookies
        setAuthCookies(reply, newAccessToken, newRefreshToken);

        return reply.code(200).send({
          success: true,
          message: 'Tokens refreshed successfully'
        });
      } catch (error) {
        // Clear invalid cookies
        clearAuthCookies(reply);

        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Invalid refresh token',
          statusCode: 401
        });
      }
    }
  );

  /**
   * POST /2fa/enable
   * @description Enable 2FA for authenticated user
   */
  fastify.post(
    '/2fa/enable',
    {
      schema: enable2FASchema,
      preHandler: authenticateJWT
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { user } = request as AuthenticatedRequest;

      // Generate secret
      const { secret, otpauth_url } = generate2FASecret(user.email);

      // Generate QR code
      const qrCode = await generate2FAQRCode(otpauth_url);

      // Generate backup codes (plain text to show user)
      const backupCodes = generateBackupCodes();

      // Hash backup codes for storage
      const hashedBackupCodes = await hashBackupCodes(backupCodes);

      // Save secret and hashed backup codes temporarily (will be confirmed on verification)
      db.updateUser(user.id, {
        two_factor_secret_tmp: secret
      });
      db.saveTempBackupCodes(user.id, JSON.stringify(hashedBackupCodes));

      return reply.code(200).send({
        qrCode,
        backupCodes  // Only show plain backup codes once
        // Note: We don't send the secret for security
      });
    }
  );

  /**
   * POST /2fa/verify
   * @description Verify and activate 2FA
   */
  fastify.post<{ Body: { token: string } }>(
    '/2fa/verify',
    {
      schema: verify2FASchema,
      preHandler: authenticateJWT
    },
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { token } = request.body;

      // Get user from database
      const dbUser = db.findUserById(user.id);
      if (!dbUser || !dbUser.two_factor_secret_tmp || !dbUser.backup_codes_tmp) {
        return reply.code(400).send({
          error: 'BadRequest',
          message: '2FA not set up. Please call /2fa/enable first.',
          statusCode: 400
        });
      }

      // Verify token with temporary secret
      const valid = verify2FAToken(token, dbUser.two_factor_secret_tmp as string);
      if (!valid) {
        return reply.code(400).send({
          error: 'BadRequest',
          message: 'Invalid 2FA token',
          statusCode: 400
        });
      }

      // Enable 2FA with permanent secret and backup codes
      db.enable2FA(
        user.id,
        dbUser.two_factor_secret_tmp as string,
        dbUser.backup_codes_tmp as string
      );

      return reply.code(200).send({
        success: true,
        message: '2FA enabled successfully'
      });
    }
  );

  /**
   * POST /2fa/disable
   * @description Disable 2FA for authenticated user
   */
  fastify.post(
    '/2fa/disable',
    { preHandler: authenticateJWT },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { user } = request as AuthenticatedRequest;

      db.disable2FA(user.id);

      return reply.code(200).send({
        success: true,
        message: '2FA disabled successfully'
      });
    }
  );

  /**
   * GET /me
   * @description Get current authenticated user
   */
  fastify.get(
    '/me',
    { preHandler: authenticateJWT },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { user } = request as AuthenticatedRequest;

      const dbUser = db.findUserById(user.id);
      if (!dbUser) {
        return reply.code(404).send({
          error: 'NotFound',
          message: 'User not found',
          statusCode: 404
        });
      }

      const { password_hash, two_factor_secret, ...userResponse } = dbUser;

      return reply.code(200).send(userResponse);
    }
  );

  /**
   * POST /logout
   * @description Logout (clear authentication cookies)
   */
  fastify.post(
    '/logout',
    { preHandler: authenticateJWT },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      // Clear authentication cookies
      clearAuthCookies(reply);

      return reply.code(200).send({
        success: true,
        message: 'Logged out successfully'
      });
    }
  );
}
