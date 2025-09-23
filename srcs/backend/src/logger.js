/**
 * @brief Centralized logging service for ft_transcendence backend
 * 
 * @description Provides a consistent logging interface across all modules.
 * Uses Fastify's pino logger with pino-pretty for development.
 * Supports LOG_LEVEL environment variable and modular usage.
 */

import pino from 'pino'

/**
 * @brief Create logger configuration based on environment
 * 
 * @param {string} environment - Current environment (development/production)
 * @param {string} logLevel - Log level from environment variable
 * @return {Object} Pino logger configuration
 */
function createLoggerConfig(environment = 'development', logLevel = 'info') {
  const isDevelopment = environment === 'development'
  
  const config = {
    level: logLevel,
    // Add timestamp and basic formatting
    timestamp: pino.stdTimeFunctions.isoTime,
  }

  // Add pino-pretty for development
  if (isDevelopment) {
    config.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss.l',
        ignore: 'pid,hostname,service',
        singleLine: false,
        levelFirst: true,
        messageFormat: '{service} - {msg}'
      }
    }
  }

  return config
}

/**
 * @brief Centralized logger instance
 */
class Logger {
  constructor() {
    this.pinoLogger = null
    this.fallbackLogger = this.createFallbackLogger()
  }

  /**
   * @brief Initialize logger with environment configuration
   */
  initialize(environment, logLevel) {
    const config = createLoggerConfig(environment, logLevel)
    this.pinoLogger = pino(config)
    
    this.info('🚀 Centralized logger initialized', {
      environment,
      logLevel,
      transport: environment === 'development' ? 'pino-pretty' : 'json'
    })
  }

  /**
   * @brief Set Fastify logger instance (for consistency)
   */
  setFastifyLogger(fastifyLogger) {
    this.pinoLogger = fastifyLogger
  }

  /**
   * @brief Create fallback console logger for early initialization
   */
  createFallbackLogger() {
    return {
      info: (msg, ...args) => console.log(`[INFO] ${msg}`, ...args),
      error: (msg, ...args) => console.error(`[ERROR] ${msg}`, ...args),
      warn: (msg, ...args) => console.warn(`[WARN] ${msg}`, ...args),
      debug: (msg, ...args) => console.debug(`[DEBUG] ${msg}`, ...args),
      trace: (msg, ...args) => console.trace(`[TRACE] ${msg}`, ...args)
    }
  }

  /**
   * @brief Get active logger (pino or fallback)
   */
  getLogger() {
    return this.pinoLogger || this.fallbackLogger
  }

  // Logging methods
  info(message, meta = {}) {
    this.getLogger().info(meta, message)
  }

  error(message, meta = {}) {
    this.getLogger().error(meta, message)
  }

  warn(message, meta = {}) {
    this.getLogger().warn(meta, message)
  }

  debug(message, meta = {}) {
    this.getLogger().debug(meta, message)
  }

  trace(message, meta = {}) {
    this.getLogger().trace(meta, message)
  }

  /**
   * @brief Create child logger with additional context
   */
  child(bindings) {
    const activeLogger = this.getLogger()
    if (activeLogger.child) {
      return new ChildLogger(activeLogger.child(bindings))
    }
    return this // Fallback returns self
  }
}

/**
 * @brief Child logger wrapper for module-specific logging
 */
class ChildLogger {
  constructor(pinoChild) {
    this.logger = pinoChild
  }

  info(message, meta = {}) {
    this.logger.info(meta, message)
  }

  error(message, meta = {}) {
    this.logger.error(meta, message)
  }

  warn(message, meta = {}) {
    this.logger.warn(meta, message)
  }

  debug(message, meta = {}) {
    this.logger.debug(meta, message)
  }

  trace(message, meta = {}) {
    this.logger.trace(meta, message)
  }

  child(bindings) {
    return new ChildLogger(this.logger.child(bindings))
  }
}

// Export singleton instance
export const logger = new Logger()

// Export factory function for Fastify integration
export { createLoggerConfig }

export default logger