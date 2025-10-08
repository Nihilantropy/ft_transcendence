/**
 * @file User search route - /users/search
 * @description Route for searching users by username
 */

import { logger } from '../../logger.js'
import { optionalAuth } from '../../middleware/authentication.js'
import { userService } from '../../services/user.service.js'
import { formatUserPreview } from '../../utils/user-formatters.js'
import { routeUserSchemas } from '../../schemas/index.js'

const searchLogger = logger.child({ module: 'routes/users/search' })

/**
 * @brief Register /users/search route
 * @param {FastifyInstance} fastify - Fastify instance
 */
async function searchUsersRoute(fastify) {
  
  /**
   * @route GET /users/search
   * @description Search users by username (partial match)
   * @authentication Optional
   * @query q - Search query (required)
   * @query limit - Max results (optional, default 10, max 50)
   */
  fastify.get('/search', {
    preHandler: optionalAuth,
    schema: routeUserSchemas.search
  }, async (request, reply) => {
    try {
      const { q: searchQuery, limit = 10 } = request.query
      const searcherId = request.user?.id
      
      searchLogger.debug('Searching users', { searchQuery, limit, searcherId })
      
      // Validate search query
      if (!searchQuery || searchQuery.trim().length === 0) {
        return reply.code(400).send({
          success: false,
          message: 'Search query is required'
        })
      }
      
      // Search users using service
      const users = userService.searchUsersByUsername(searchQuery, limit)
      
      // Format results using formatter
      const formattedUsers = users.map(user => formatUserPreview(user))
      
      searchLogger.debug('✅ User search completed', { 
        searchQuery, 
        resultsCount: formattedUsers.length 
      })
      
      return reply.code(200).send({
        success: true,
        users: formattedUsers,
        count: formattedUsers.length
      })
      
    } catch (error) {
      searchLogger.error('❌ User search failed', {
        searchQuery: request.query.q,
        error: error.message
      })
      
      return reply.code(500).send({
        success: false,
        message: 'Failed to search users'
      })
    }
  })
}

export default searchUsersRoute
