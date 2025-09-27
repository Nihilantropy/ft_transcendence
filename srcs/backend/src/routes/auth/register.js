/**
 * @brief User registration route for ft_transcendence backend
 * 
 * @description Clean registration using existing services
 */

import { logger } from '../../logger.js'
import { userService, emailService } from '../../services/index.js'
import { routeSchemas } from '../../schemas/routes/auth.js'

const registerLogger = logger.child({ module: 'routes/auth/register' })

/**
 * @brief Register user registration route
 * @param {FastifyInstance} fastify - The Fastify instance
 */
async function registerRoute(fastify, options) {
  
  fastify.post('/register', {
    schema: routeSchemas.register
  }, async (request, reply) => {
    try {
      const { email, password } = request.body
      
      registerLogger.info('Registration attempt', { email })
      
      // 1. Check email availability
      if (userService.isEmailTaken(email)) {
        reply.status(409)
        return {
          success: false,
          message: 'Email is already registered',
          error: {
            code: 'EMAIL_EXISTS',
            details: 'An account with this email already exists'
          }
        }
      }
      
      // 2. Generate unique username
      const username = userService.createUniqueUsername(email)
      
      // 3. Create user
      const newUser = await userService.createUser({ email, password, username })
      
      // 4. Send verification email
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
        emailSent
      })
      
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
      
    } catch (error) {
      registerLogger.error('❌ Registration failed', { error: error.message })
      reply.status(400)
      return {
        success: false,
        message: 'Registration failed',
        error: {
          code: 'REGISTRATION_ERROR',
          details: error.message
        }
      }
    }
  })
  
  registerLogger.info('✅ Register route registered successfully')
}

export default registerRoute