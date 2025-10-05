/**
 * @brief Route manager for ft_transcendence backend
 * 
 * @description Centralized route registration with configurable base path
 */

import { logger } from '../logger.js'
import healthRoutes from './health.js'
import dbTestRoutes from './db-test.js'
import authRoutes from './auth/index.js'
import userRoutes from './users/index.js'

// Create route-specific logger
const routeLogger = logger.child({ module: 'routes' })

/**
 * @brief Register all application routes
 * @param {FastifyInstance} fastify - The Fastify instance
 */
export async function registerRoutes(fastify) {
  const apiBasePath = process.env.API_BASE_PATH || '/api'
  
  routeLogger.info(`🛣️ Registering routes with base path: ${apiBasePath}`)
  
  // Register routes with base path prefix
  await fastify.register(async function(fastify) {
    
    // =============================================================================
    // API ROUTES
    // =============================================================================
    
    // Health and status routes
    await fastify.register(healthRoutes)
    
    // Authentication routes
    await fastify.register(authRoutes, { prefix: '/auth' })
    routeLogger.info('🔐 Authentication routes registered')

    await fastify.register(userRoutes, { prefix: '/users' })
    routeLogger.info('🔐 Users routes registered')
    
    // Database testing routes (development only)
    if (process.env.NODE_ENV === 'development') {
      await fastify.register(dbTestRoutes)
      routeLogger.info('🧪 Database test routes registered (development mode)')
    }
    
  }, { prefix: apiBasePath })
  
  routeLogger.info('✅ All routes registered successfully')
  routeLogger.info(`📚 Documentation available at: ${apiBasePath}/documentation`)
}