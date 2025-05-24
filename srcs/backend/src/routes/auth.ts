/**
 * @brief Authentication routes
 */

import { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';
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

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * @brief User registration endpoint
   * 
   * @param request - Contains user registration data
   * @return User data and JWT token
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

    // Hash password
    const passwordHash = await bcrypt.hash(password, config.BCRYPT_ROUNDS);

    // TODO: Save user to database
    const user = {
      id: 1,
      username,
      email,
      passwordHash,
    };

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, username: user.username },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRATION }
    );

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      token,
    };
  });

  /**
   * @brief User login endpoint
   * 
   * @param request - Contains login credentials
   * @return User data and JWT token
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

    // TODO: Get user from database
    const user = {
      id: 1,
      username: 'testuser',
      passwordHash: await bcrypt.hash('password123', config.BCRYPT_ROUNDS),
    };

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, username: user.username },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRATION }
    );

    return {
      user: {
        id: user.id,
        username: user.username,
      },
      token,
    };
  });

  /**
   * @brief Token validation endpoint
   * 
   * @return Current user data
   */
  fastify.get('/me', async (request, reply) => {
    // TODO: Implement JWT middleware and get current user
    return {
      user: {
        id: 1,
        username: 'testuser',
      },
    };
  });
};