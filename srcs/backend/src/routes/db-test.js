/**
 * @brief Database testing routes using better-sqlite3 optimized queries
 * 
 * @description Enhanced database test endpoints with better performance using direct better-sqlite3 methods.
 * Maintains backward compatibility while leveraging better-sqlite3's synchronous advantages.
 */

import { databaseConnection } from '../database.js'
import { logger } from '../logger.js'

// Create route-specific logger
const routeLogger = logger.child({ module: 'db-test-routes' })

/**
 * @brief Register database testing routes
 * 
 * @param {FastifyInstance} fastify - Fastify instance
 */
export default async function dbTestRoutes(fastify) {
  // Test connection health
  fastify.get('/test/connection', async (request, reply) => {
    try {
      routeLogger.info('🧪 Testing database connection...')
      
      // Use the new testConnection method (maintains async interface)
      const result = await databaseConnection.testConnection()
      
      routeLogger.info('✅ Connection test successful')
      
      return {
        status: 'success',
        message: 'Database connection successful',
        data: result,
        info: databaseConnection.getDatabaseInfo(),
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      routeLogger.error('❌ Connection test failed', { error: error.message })
      
      reply.status(500)
      return {
        status: 'error',
        message: 'Database connection failed',
        error: error.message,
        timestamp: new Date().toISOString()
      }
    }
  })

  // Test query - get users (using new convenience method)
  fastify.get('/test/users', async (request, reply) => {
    try {
      routeLogger.info('🧪 Testing users query...')
      
      // Use the new all() convenience method - much simpler!
      const users = databaseConnection.all('SELECT id, username, email, created_at FROM users LIMIT 10')
      
      routeLogger.info('✅ Users query successful', { count: users.length })
      
      return {
        status: 'success',
        message: 'Users query successful',
        data: {
          users: users,
          count: users.length
        },
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      routeLogger.error('❌ Users query failed', { error: error.message })
      
      reply.status(500)
      return {
        status: 'error',
        message: 'Users query failed',
        error: error.message,
        timestamp: new Date().toISOString()
      }
    }
  })

  // Test query - get schema info (using new get() convenience method)
  fastify.get('/test/schema', async (request, reply) => {
    try {
      routeLogger.info('🧪 Testing database schema query...')
      
      // Use the new get() and all() convenience methods
      const schemaInfo = databaseConnection.get(
        'SELECT version, applied_at, description FROM schema_info ORDER BY version DESC LIMIT 1'
      )

      const tables = databaseConnection.all(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      ).map(row => row.name)
      
      routeLogger.info('✅ Schema query successful')
      
      return {
        status: 'success',
        message: 'Schema query successful',
        data: {
          schema_info: schemaInfo,
          tables: tables,
          table_count: tables.length,
          expected_tables: [
            'users', 'roles', 'user_roles', 'schema_info',
            'friend_requests', 'friendships', 'blocked_users',
            'games', 'user_stats', 'tournaments', 'tournament_participants'
          ]
        },
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      routeLogger.error('❌ Schema query failed', { error: error.message })
      
      reply.status(500)
      return {
        status: 'error',
        message: 'Schema query failed',
        error: error.message,
        timestamp: new Date().toISOString()
      }
    }
  })

  // Test prepared statements and transactions
  fastify.get('/test/performance', async (request, reply) => {
    try {
      routeLogger.info('🧪 Testing better-sqlite3 performance features...')
      
      const startTime = Date.now()
      
      // Test prepared statement (much faster with better-sqlite3)
      const userCountStmt = databaseConnection.prepare('SELECT COUNT(*) as count FROM users')
      const userCount = userCountStmt.get()
      
      // Test transaction
      const transactionResult = databaseConnection.transaction(() => {
        const roleCount = databaseConnection.get('SELECT COUNT(*) as count FROM roles')
        const gameCount = databaseConnection.get('SELECT COUNT(*) as count FROM games')
        return { roles: roleCount.count, games: gameCount.count }
      })
      
      const endTime = Date.now()
      const executionTime = endTime - startTime
      
      routeLogger.info('✅ Performance test successful', { executionTime })
      
      return {
        status: 'success',
        message: 'Performance test successful',
        data: {
          user_count: userCount.count,
          counts: transactionResult,
          execution_time_ms: executionTime,
          database_info: databaseConnection.getDatabaseInfo()
        },
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      routeLogger.error('❌ Performance test failed', { error: error.message })
      
      reply.status(500)
      return {
        status: 'error',
        message: 'Performance test failed',
        error: error.message,
        timestamp: new Date().toISOString()
      }
    }
  })

  // Test error handling
  fastify.get('/test/error', async (request, reply) => {
    try {
      routeLogger.info('🧪 Testing error handling...')
      
      // Intentionally cause an error
      databaseConnection.get('SELECT * FROM nonexistent_table')
      
    } catch (error) {
      routeLogger.info('✅ Error handling test successful - caught expected error')
      
      return {
        status: 'success',
        message: 'Error handling working correctly',
        caught_error: error.message,
        timestamp: new Date().toISOString()
      }
    }
  })
}