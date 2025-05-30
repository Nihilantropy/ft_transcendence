/**
 * @brief Authentication routes with real database integration
 */

import { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';
import { db } from '../services/database';
import { AppError } from '../plugins/errorHandler';

interface LoginBody {
  username: string;
  password: string;
}

interface RegisterBody {
  username: string;
  email: string;
  password: string;
}

/**
 * @brief Generate JWT token for user
 * 
 * @param payload User payload for token
 * @return JWT token string
 */
const generateToken = (payload: { id: number; username: string }): string => {
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRATION });
};

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * @brief User registration endpoint
   */
  fastify.post<{ Body: RegisterBody }>('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['username', 'email', 'password'],
        properties: {
          username: { type: 'string', minLength: 3, maxLength: 50 },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
        },
      },
    },
  }, async (request, reply) => {
    const { username, email, password } = request.body;

    // Check if user exists
    const existingUser = await db.getUserByUsername(username);
    if (existingUser) {
      throw new AppError(409, 'Username already taken', 'USERNAME_EXISTS');
    }

    // Hash password and create user
    const passwordHash = await bcrypt.hash(password, config.BCRYPT_ROUNDS);
    const user = await db.createUser({
      username,
      email,
      password_hash: passwordHash,
      display_name: username,
    });

    const token = generateToken({ id: user.id, username: user.username });

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
      },
      token,
    };
  });

  /**
   * @brief User login endpoint
   */
  fastify.post<{ Body: LoginBody }>('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string' },
          password: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { username, password } = request.body;

    const user = await db.getUserByUsername(username);
    if (!user) {
      throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    // Update online status
    await db.updateUserOnlineStatus(user.id, true);

    const token = generateToken({ id: user.id, username: user.username });

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
      },
      token,
    };
  });

  /**
   * @brief Get current user info (protected route)
   */
  fastify.get('/me', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = await db.getUserById(request.user!.id);
    if (!user) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
    }

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
        isOnline: user.is_online,
      },
    };
  });
};