/**
 * @brief Health and status routes for ft_transcendence backend
 * 
 * @description Provides health check, database status, and general status endpoints.
 * All routes are automatically prefixed with API_BASE_PATH from environment.
 */

import { logger } from '../logger.js'
import databaseConnection from '../database.js'

// Create route-specific logger
const routeLogger = logger.child({ module: 'health-routes' })

/**
 * @brief Register health and status routes
 * 
 * @param {Object} fastify - Fastify instance
 * @param {Object} options - Route options
 * @return {Promise} Registration promise
 */
async function healthRoutes(fastify, options) {
  routeLogger.info('📋 Registering health and status routes')

  /**
   * @brief Health check endpoint
   * Tests overall application health including database connectivity
   */
  fastify.get('/health', async (request, reply) => {
    const startTime = Date.now()
    
    try {
      routeLogger.debug('🔍 Running health check')
      
      // Test database connection
      await databaseConnection.testConnection()
      const dbInfo = databaseConnection.getDatabaseInfo()
      
      const responseTime = Date.now() - startTime
      
      const healthResponse = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        service: 'ft_transcendence_backend',
        uptime: process.uptime(),
        responseTime: `${responseTime}ms`,
        database: {
          status: 'connected',
          path: dbInfo.path,
          exists: dbInfo.exists,
          test_query: 'ok'
        },
        environment: process.env.NODE_ENV || 'development'
      }
      
      routeLogger.debug('✅ Health check passed', { responseTime })
      return healthResponse
      
    } catch (error) {
      const responseTime = Date.now() - startTime
      
      routeLogger.error('❌ Health check failed', { 
        error: error.message, 
        responseTime 
      })
      
      return reply.status(503).send({
        status: 'error',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        service: 'ft_transcendence_backend',
        uptime: process.uptime(),
        responseTime: `${responseTime}ms`,
        database: {
          status: 'disconnected',
          error: error.message
        },
        environment: process.env.NODE_ENV || 'development'
      })
    }
  })

  /**
   * @brief Database status endpoint
   * Provides detailed database information and statistics
   */
  fastify.get('/db/status', async (request, reply) => {
    try {
      routeLogger.debug('🗄️ Checking database status')
      
      const db = databaseConnection.getDatabase()
      const dbInfo = databaseConnection.getDatabaseInfo()
      
      // Test database connectivity
      await databaseConnection.testConnection()
      
      const dbResponse = {
        database: {
          ...dbInfo,
          status: 'connected',
          lastCheck: new Date().toISOString()
        }
      }
      
      routeLogger.debug('✅ Database status check completed')
      return dbResponse
      
    } catch (error) {
      routeLogger.error('❌ Database status check failed', { error: error.message })
      
      return reply.status(503).send({
        database: {
          status: 'error',
          error: error.message,
          lastCheck: new Date().toISOString()
        }
      })
    }
  })

  /**
   * @brief General status endpoint
   * Provides basic application status and information
   */
  fastify.get('/status', async (request, reply) => {
    routeLogger.debug('📊 Getting application status')
    
    const statusResponse = {
      message: 'ft_transcendence backend is running',
      service: 'ft_transcendence_backend',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024)
      },
      node_version: process.version,
      platform: process.platform,
      arch: process.arch
    }
    
    routeLogger.debug('✅ Application status retrieved')
    return statusResponse
  })

  routeLogger.info('✅ Health and status routes registered successfully')
}

// Export as Fastify plugin
export default healthRoutes