/**
 * @brief Logger configuration for the application
 * 
 * @description Configures Pino logger for Fastify
 */

import { config } from '../config/config';

const isDevelopment = config.NODE_ENV === 'development';

export const logger = {
  level: config.LOG_LEVEL,
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  }),
};