/**
 * @brief User registration route for ft_transcendence backend - Better-SQLite3 optimized
 * 
 * @description Handles user registration with:
 * - Email and password validation
 * - Automatic unique username generation
 * - Centralized error handling via error handler plugin
 * - Clean service-based database interactions
 */

import { logger } from '../../logger.js'
import { registerSchema, validatePasswordStrength } from '../../middleware/validation.js'
import { userService, emailService } from '../../services/index.js'

// Create route-specific logger
const registerLogger = logger.child({ module: 'routes/auth/register' })

/**
 * @brief Register user registration route with centralized error handling
 * 
 * @param {FastifyInstance} fastify - The Fastify instance
 */
async function registerRoute(fastify, options) {
  
  /**
   * @route POST /register
   * @description Register new user account with auto-generated username
   */
  fastify.post('/register', {
    schema: registerSchema,
    handler: fastify.errors.asyncHandler(async (request, reply) => {
      const { email, password } = request.body
      
      registerLogger.info('Registration attempt', { email })
      
      // 1. Validate password strength
      const passwordValidation = validatePasswordStrength(password)
      if (!passwordValidation.isValid) {
        throw fastify.errors.validation('Password does not meet security requirements', {
          field: 'password',
          reason: passwordValidation.message,
          score: passwordValidation.score
        })
      }
      
      // 2. Check email uniqueness (now synchronous!)
      const isEmailTaken = userService.isEmailTaken(email) // No await!
      if (isEmailTaken) {
        throw fastify.errors.conflict('Email is already registered', {
          field: 'email',
          value: email
        })
      }
      
      // 3. Generate unique username automatically (now synchronous!)
      const username = userService.createUniqueUsername(email) // No await!
      registerLogger.info('Generated unique username', { email, username })
      
      // 4. Create user with service (still async due to password hashing)
      const newUser = await userService.createUser({
        email,
        password,
        username
      })
      
      // 5. Send verification email
      const emailSent = await emailService.sendVerificationEmail({
        email: newUser.email,
        username: newUser.username,
        verificationToken: newUser.verificationToken
      })
      
      if (!emailSent) {
        registerLogger.warn('Failed to send verification email', { 
          userId: newUser.id, 
          email: newUser.email 
        })
      }
      
      registerLogger.info('User registered successfully', { 
        userId: newUser.id, 
        username: newUser.username, 
        email: newUser.email,
        passwordScore: passwordValidation.score,
        emailSent
      })
      
      // 6. Return success response (remove sensitive data)
      reply.status(201)
      return {
        success: true,
        message: 'User registered successfully. Please check your email to verify your account.',
        data: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          email_verified: newUser.email_verified
        }
      }
    })
  })
}

export default registerRoute