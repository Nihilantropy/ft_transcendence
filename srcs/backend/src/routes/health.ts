/**
 * @brief Health check routes for monitoring
 */

import { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * @brief Basic health check endpoint
   * 
   * @return Health status and timestamp
   */
  fastify.get('/health', async (request, reply) => {
    return {
      status: 'healthy',
      timestamp: Date.now(),
      uptime: process.uptime(),
    };
  });

  /**
   * @brief Detailed health check with dependencies
   * 
   * @return Detailed health status including database
   */
  fastify.get('/health/detailed', async (request, reply) => {
    const checks = {
      server: 'healthy',
      database: 'healthy',
      memory: {
        used: process.memoryUsage().heapUsed / 1024 / 1024,
        total: process.memoryUsage().heapTotal / 1024 / 1024,
      },
    };

    // TODO: Add actual database health check
    // try {
    //   await db.query('SELECT 1');
    // } catch (error) {
    //   checks.database = 'unhealthy';
    // }

    const isHealthy = Object.values(checks).every(
      (value) => typeof value === 'object' || value === 'healthy'
    );

    return reply.status(isHealthy ? 200 : 503).send({
      status: isHealthy ? 'healthy' : 'unhealthy',
      checks,
      timestamp: Date.now(),
    });
  });
};