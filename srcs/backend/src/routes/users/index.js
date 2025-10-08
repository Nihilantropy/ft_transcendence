/**
 * @brief User routes aggregator for ft_transcendence backend
 *
 * @description Registers all user-related routes with /users prefix:
 * - Profile viewing (me, public profiles)
 * - User search
 * - Username management
 * - Avatar management
 * - Account deletion
 */

import { logger } from '../../logger.js'

// Profile routes
import meRoute from './me.js'
import publicProfileRoute from './public-profile.js'
import searchUsersRoute from './search.js'

// Profile update routes
import checkUsernameRoute from './check-username.js'
import setUsernameRoute from './set-username.js'
import setAvatarRoute from './set-avatar.js'

// Account management routes
import deleteUserRoute from './delete-user.js'

// Create route-specific logger
const userLogger = logger.child({ module: 'routes/users' })

/**
 * @brief Register all user routes
 * @param {FastifyInstance} fastify - The Fastify instance
 * @param {Object} options - Route options
 */
async function userRoutes(fastify, options) {
  userLogger.info('� Registering user routes...')

  // =============================================================================
  // PROFILE ROUTES
  // =============================================================================
  
  await fastify.register(meRoute)
  userLogger.info('✅ /users/me route registered')
  
  await fastify.register(searchUsersRoute)
  userLogger.info('✅ /users/search route registered')
  
  await fastify.register(publicProfileRoute)
  userLogger.info('✅ /users/:userId route registered')

  // =============================================================================
  // PROFILE UPDATE ROUTES
  // =============================================================================
  
  await fastify.register(checkUsernameRoute)
  userLogger.info('✅ /users/check-username route registered')
  
  await fastify.register(setUsernameRoute)
  userLogger.info('✅ /users/set-username route registered')
  
  await fastify.register(setAvatarRoute)
  userLogger.info('✅ /users/set-avatar route registered')

  // =============================================================================
  // ACCOUNT MANAGEMENT ROUTES
  // =============================================================================
  
  await fastify.register(deleteUserRoute)
  userLogger.info('✅ Delete user route registered')

  userLogger.info('✅ All user routes registered successfully')
}

export default userRoutes
