/**
 * @file Type Definitions
 * @description Core types and interfaces for the API Gateway
 */

/**
 * JWT Payload decoded from access tokens
 */
export interface JWTPayload {
  id: number;
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * Service configuration for routing
 */
export interface ServiceConfig {
  url: string;
  name: string;
}

/**
 * Route configuration
 */
export interface RouteConfig {
  path: string;
  service: ServiceConfig;
  requireAuth: boolean;
  stripPrefix?: string;
}

/**
 * Proxy request options
 */
export interface ProxyOptions {
  targetUrl: string;
  stripPrefix?: string;
  forwardCookies?: boolean;
  forwardUserId?: boolean;
}

/**
 * Environment variables
 */
export interface EnvConfig {
  PORT: string;
  HOST: string;
  LOG_LEVEL: string;
  JWT_SECRET: string;
  CORS_ORIGIN: string;
  AUTH_SERVICE_URL: string;
  USER_SERVICE_URL: string;
  GAME_SERVICE_URL: string;
  RATE_LIMIT_MAX: string;
  RATE_LIMIT_WINDOW: string;
  DOMAIN: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => Promise<void>;
    optionalAuth: (request: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JWTPayload;
    user: JWTPayload | null;
  }
}
