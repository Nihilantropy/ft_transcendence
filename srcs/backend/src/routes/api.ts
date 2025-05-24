/**
 * @brief General API routes
 */

import { FastifyPluginAsync } from 'fastify';
import { config } from '../config/config';

export const apiRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * @brief API info endpoint
   * 
   * @return API information
   */
  fastify.get('/info', async (request, reply) => {
    return {
      app: 'ft_transcendence',
      version: '1.0.0',
      backend: 'Fastify/TypeScript',
      environment: config.NODE_ENV,
      message: 'Ready to implement game logic!',
    };
  });

  /**
   * @brief API version endpoint
   * 
   * @return API version info
   */
  fastify.get('/version', async (request, reply) => {
    return {
      api: 'v1',
      version: '1.0.0',
      supported: ['v1'],
    };
  });
};