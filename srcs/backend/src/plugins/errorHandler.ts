/**
 * @brief Error handling plugin for Fastify application
 * 
 * @description Provides custom error classes and error handling middleware
 */

import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

/**
 * @brief Custom application error class
 * 
 * @param statusCode HTTP status code
 * @param message Error message
 * @param code Error code identifier
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(statusCode: number, message: string, code: string = 'INTERNAL_ERROR') {
    super(message);
    
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * @brief Error handler plugin for Fastify
 * 
 * @param fastify Fastify instance
 * @return Promise<void>
 */
export const errorHandler: FastifyPluginAsync = async (fastify) => {
  /**
   * @brief Global error handler
   * 
   * @param error Error object
   * @param request Fastify request
   * @param reply Fastify reply
   * @return Promise<void>
   */
  fastify.setErrorHandler(async (error: Error, request: FastifyRequest, reply: FastifyReply) => {
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Handle operational errors (AppError instances)
    if (error instanceof AppError) {
      await reply.status(error.statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          ...(isDevelopment && { stack: error.stack }),
        },
      });
      return;
    }

    // Handle Fastify validation errors
    if ('statusCode' in error && error.statusCode === 400 && error.message.includes('validation')) {
        await reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'The data you sent is not valid',
            // In development, show the technical details
            ...(isDevelopment && { details: error.message }),
          },
        });
        return;
      }

    // Handle unexpected errors
    fastify.log.error(error);
    await reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        ...(isDevelopment && { stack: error.stack }),
      },
    });
  });
};