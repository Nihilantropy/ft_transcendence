/**
 * @brief Schema registry for ft_transcendence backend
 * 
 * @description Central schema management with simple registration
 */

import commonResponses from './common/responses.js'
import authSchemas from './routes/auth.js'

/**
 * @brief Register all schemas with Fastify instance
 * @param {FastifyInstance} fastify - The Fastify instance
 */
export async function registerSchemas(fastify) {
  // Register common response schemas
  commonResponses.forEach(schema => {
    fastify.addSchema(schema)
  })
  
  // Register auth route schemas
  authSchemas.forEach(schema => {
    fastify.addSchema(schema)
  })
}

/**
 * @brief Get schema reference for route usage
 * @param {string} schemaId - Schema identifier
 * @return {object} - Schema reference object
 */
export function getSchemaRef(schemaId) {
  return { $ref: `#/components/schemas/${schemaId}` }
}