/**
 * @brief User routes aggregator for ft_transcendence backend
 *
 * @description Registers all user-related routes with /users prefix:
 * - Username management (set)
 */

import { logger } from '../../logger.js'

import setUsernameRoute from './set-user.js'


// Create route-specific logger
const userLogger = logger.child({ module: 'routes/users' })

/**
 * @brief Register all user routes
 * @param {FastifyInstance} fastify - The Fastify instance
 * @param {Object} options - Route options
 */
async function userRoutes(fastify, options) {
  userLogger.info('🔐 Registering user routes...')

  // =============================================================================
  // USERNAME MANAGEMENT ROUTES
  // =============================================================================
  
  await fastify.register(setUsernameRoute)
  userLogger.info('✅ Set username route registered')

}

export default userRoutes