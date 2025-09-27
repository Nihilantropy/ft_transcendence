/**
 * @brief Swagger/OpenAPI documentation plugin for ft_transcendence backend
 * 
 * @description Configures OpenAPI 3.0.3 specification generation with:
 * - API metadata and info
 * - Server configuration
 * - Custom component schema naming
 * - Development-friendly Swagger UI
 * - Nginx proxy compatibility
 */

import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'
import fp from 'fastify-plugin'
import { logger } from '../logger.js'

// Create plugin-specific logger
const swaggerLogger = logger.child({ module: 'plugins/swagger' })

const API_BASE_PATH = process.env.API_BASE_PATH || '/api'

/**
 * @brief Register Swagger documentation plugin
 * @param {FastifyInstance} fastify - The Fastify instance
 */
async function swaggerPlugin(fastify) {
  // Register @fastify/swagger for OpenAPI spec generation
  await fastify.register(fastifySwagger, {
    openapi: {
      // OpenAPI version specification
      openapi: '3.0.3',
      
      // API information
      info: {
        title: 'ft_transcendence API',
        description: 'Backend API for ft_transcendence - A real-time multiplayer Pong game platform with user management, matchmaking, and tournament features.',
        version: '1.0.0',
        contact: {
          name: 'ft_transcendence Team',
          email: 'dev@ft-transcendence.local'
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT'
        }
      },
      
      // Server configuration
      servers: [
        {
          url: `https://localhost${API_BASE_PATH}`,
          description: 'Production server (via nginx proxy)'
        },
        {
          url: (process.env.BACKEND_URL || 'http://localhost:8000') + API_BASE_PATH,
          description: 'Development server (direct backend access)'
        }
      ],
      
      // Global tags for route grouping
      tags: [
        {
          name: 'health',
          description: 'Health check and status endpoints'
        },
        {
          name: 'auth',
          description: 'Authentication and user management endpoints'
        },
        {
          name: 'game',
          description: 'Game-related endpoints (planned)'
        },
        {
          name: 'tournament',
          description: 'Tournament management endpoints (planned)'
        }
      ],
      
      // Global components (security schemes, etc.)
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT token for authenticated requests'
          }
        }
      }
    },
    
    // Custom reference resolver for better component naming
    refResolver: {
      buildLocalReference(json, baseUri, fragment, i) {
        // Use $id field from schema if available, otherwise fallback to default
        return json.$id || `def-${i}`
      }
    }
  })
  
  // Register Swagger UI (available in both development and production for this project)
  await fastify.register(fastifySwaggerUi, {
    routePrefix: process.env.API_BASE_PATH + '/documentation',
    uiConfig: {
      docExpansion: 'list',  // Show endpoints collapsed by default
      deepLinking: true,     // Enable direct linking to operations
      defaultModelsExpandDepth: 2,  // Show model details
      defaultModelExpandDepth: 2
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
    transformSpecification: (swaggerObject, request, reply) => {
      // Custom transformation if needed
      return swaggerObject
    }
  })
  
  swaggerLogger.info(`📚 Swagger UI available at ${API_BASE_PATH}/documentation`)
  swaggerLogger.info(`📄 OpenAPI spec available at ${API_BASE_PATH}/documentation/json`)
  swaggerLogger.info(`🌐 Nginx proxy access: https://localhost${API_BASE_PATH}/documentation`)
  swaggerLogger.info('✅ Swagger plugin registered successfully')
}

// Export as Fastify plugin
export default fp(swaggerPlugin)