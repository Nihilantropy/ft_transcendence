/**
 * @brief Schema registry for ft_transcendence backend
 * 
 * @description Central schema management with simple registration
 */

import commonResponses from './common/responses.schema.js'
import authSchemas, { routeAuthSchemas } from './routes/auth.schema.js'
import userSchemas, { routeUserSchemas } from './routes/user.schema.js'
import oauthSchemas, { routeOAuthSchemas } from './routes/oauth.schema.js'

/**
 * @brief Register all schemas with Fastify instance
 * @param {FastifyInstance} fastify - The Fastify instance
 */
export async function registerSchemas(fastify) {
  // Helper to safely add schema
  const safeAddSchema = (schema) => {
    try {
      fastify.addSchema(schema)
    } catch (error) {
      if (error.code !== 'FST_ERR_SCH_ALREADY_PRESENT') {
        throw error
      }
      // Schema already exists, skip silently
    }
  }

  // Register common response schemas
  commonResponses.forEach(safeAddSchema)
  
  // Register auth route schemas
  authSchemas.forEach(safeAddSchema)
  
  // Register user route schemas
  userSchemas.forEach(safeAddSchema)
  
  // Register oauth route schemas
  oauthSchemas.forEach(safeAddSchema)
}

/**
 * @brief Export route schemas for direct use
 */
export { routeAuthSchemas, routeUserSchemas, routeOAuthSchemas }

/**
 * @brief Get schema reference for route usage
 * @param {string} schemaId - Schema identifier
 * @return {object} - Schema reference object
 */
export function getSchemaRef(schemaId) {
  return { $ref: `#/components/schemas/${schemaId}` }
}