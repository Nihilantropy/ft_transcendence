/**
 * @file Logger configuration for User Service
 * @description Pino logger with pretty printing for development
 */

import pino from 'pino'

const isDevelopment = process.env.NODE_ENV !== 'production'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDevelopment ? {
    target: 'pino-pretty',
    options: {
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
      colorize: true,
      singleLine: false
    }
  } : undefined,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() }
    }
  },
  base: {
    service: 'user-service'
  }
})

export default logger
