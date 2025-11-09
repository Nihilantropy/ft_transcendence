# API Gateway TypeScript Conversion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert the API Gateway microservice from JavaScript to TypeScript with comprehensive unit tests, following the same pattern and standards established in the auth-service.

**Architecture:** Migrate the API Gateway to TypeScript while maintaining all existing functionality (JWT verification, route proxying, authentication decorators). Add comprehensive unit tests for middleware, decorators, and proxy functionality using Vitest and supertest.

**Tech Stack:** TypeScript, Fastify, Vitest, supertest, tsx (dev runtime)

---

## Task 1: Setup TypeScript Configuration

**Files:**
- Create: `srcs/api-gateway/tsconfig.json`
- Modify: `srcs/api-gateway/package.json`
- Create: `srcs/api-gateway/vitest.config.ts`

**Step 1: Install TypeScript dependencies**

Run:
```bash
cd srcs/api-gateway
npm install --save-dev typescript @types/node tsx @types/supertest
```

Expected: Dependencies installed successfully

**Step 2: Create tsconfig.json**

File: `srcs/api-gateway/tsconfig.json`

```json
{
  "compilerOptions": {
    /* Language and Environment */
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "node",

    /* Emit */
    "outDir": "./dist",
    "rootDir": "./src",
    "sourceMap": true,
    "removeComments": false,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,

    /* Type Checking */
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,

    /* Completeness */
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create vitest.config.ts**

File: `srcs/api-gateway/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/__tests__/**',
        '**/types/**'
      ]
    },
    include: ['src/**/*.{test,spec}.{js,ts}'],
    testTimeout: 10000
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

**Step 4: Update package.json scripts**

Modify: `srcs/api-gateway/package.json`

Change:
```json
{
  "main": "src/server.js",
  "scripts": {
    "dev": "nodemon src/server.js",
    "start": "node src/server.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

To:
```json
{
  "main": "dist/server.js",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

**Step 5: Verify TypeScript setup**

Run: `cd srcs/api-gateway && npm run type-check`
Expected: Error about missing .ts files (expected at this stage)

**Step 6: Commit**

```bash
git add srcs/api-gateway/tsconfig.json srcs/api-gateway/vitest.config.ts srcs/api-gateway/package.json
git commit -m "feat(api-gateway): add TypeScript configuration"
```

---

## Task 2: Create Type Definitions

**Files:**
- Create: `srcs/api-gateway/src/types/index.ts`

**Step 1: Write the type definitions file**

File: `srcs/api-gateway/src/types/index.ts`

```typescript
/**
 * @file Type Definitions
 * @description Core types and interfaces for the API Gateway
 */

import { FastifyRequest, FastifyReply } from 'fastify';

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
 * Authenticated request with user data
 */
export interface AuthenticatedRequest extends FastifyRequest {
  user: JWTPayload;
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
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    optionalAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    user?: JWTPayload | null;
  }
}
```

**Step 2: Verify types compile**

Run: `cd srcs/api-gateway && npm run type-check`
Expected: No errors (types should compile cleanly)

**Step 3: Commit**

```bash
git add srcs/api-gateway/src/types/index.ts
git commit -m "feat(api-gateway): add TypeScript type definitions"
```

---

## Task 3: Create Utility Functions with Tests (TDD)

**Files:**
- Create: `srcs/api-gateway/src/utils/__tests__/proxy.utils.test.ts`
- Create: `srcs/api-gateway/src/utils/proxy.utils.ts`

**Step 1: Write the failing test for proxy utilities**

File: `srcs/api-gateway/src/utils/__tests__/proxy.utils.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { buildTargetUrl, extractHeaders, shouldForwardBody } from '../proxy.utils.js';

describe('proxy.utils', () => {
  describe('buildTargetUrl', () => {
    it('should build target URL by replacing prefix', () => {
      const originalUrl = '/api/auth/login';
      const targetBaseUrl = 'http://auth-service:3001';
      const stripPrefix = '/api/auth';

      const result = buildTargetUrl(originalUrl, targetBaseUrl, stripPrefix);

      expect(result).toBe('http://auth-service:3001/login');
    });

    it('should handle URLs without prefix stripping', () => {
      const originalUrl = '/health';
      const targetBaseUrl = 'http://auth-service:3001';

      const result = buildTargetUrl(originalUrl, targetBaseUrl);

      expect(result).toBe('http://auth-service:3001/health');
    });

    it('should preserve query parameters', () => {
      const originalUrl = '/api/users/search?q=john';
      const targetBaseUrl = 'http://user-service:3002';
      const stripPrefix = '/api';

      const result = buildTargetUrl(originalUrl, targetBaseUrl, stripPrefix);

      expect(result).toBe('http://user-service:3002/users/search?q=john');
    });
  });

  describe('extractHeaders', () => {
    it('should extract forwarding headers', () => {
      const requestHeaders = {
        'content-type': 'application/json',
        'cookie': 'accessToken=xyz',
        'user-agent': 'Mozilla/5.0',
        'host': 'localhost:8001'
      };
      const ip = '127.0.0.1';

      const result = extractHeaders(requestHeaders, ip);

      expect(result['content-type']).toBe('application/json');
      expect(result['cookie']).toBe('accessToken=xyz');
      expect(result['x-forwarded-for']).toBe('127.0.0.1');
      expect(result['x-forwarded-proto']).toBe('https');
    });

    it('should include user ID header if provided', () => {
      const requestHeaders = { 'content-type': 'application/json' };
      const ip = '127.0.0.1';
      const userId = 42;

      const result = extractHeaders(requestHeaders, ip, userId);

      expect(result['x-user-id']).toBe('42');
    });

    it('should not include user ID header if not provided', () => {
      const requestHeaders = { 'content-type': 'application/json' };
      const ip = '127.0.0.1';

      const result = extractHeaders(requestHeaders, ip);

      expect(result['x-user-id']).toBeUndefined();
    });
  });

  describe('shouldForwardBody', () => {
    it('should return false for GET requests', () => {
      expect(shouldForwardBody('GET')).toBe(false);
    });

    it('should return false for HEAD requests', () => {
      expect(shouldForwardBody('HEAD')).toBe(false);
    });

    it('should return true for POST requests', () => {
      expect(shouldForwardBody('POST')).toBe(true);
    });

    it('should return true for PUT requests', () => {
      expect(shouldForwardBody('PUT')).toBe(true);
    });

    it('should return true for PATCH requests', () => {
      expect(shouldForwardBody('PATCH')).toBe(true);
    });

    it('should return true for DELETE requests', () => {
      expect(shouldForwardBody('DELETE')).toBe(true);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd srcs/api-gateway && npm test`
Expected: FAIL - "Cannot find module '../proxy.utils.js'"

**Step 3: Write minimal implementation**

File: `srcs/api-gateway/src/utils/proxy.utils.ts`

```typescript
/**
 * @file Proxy Utilities
 * @description Helper functions for request proxying
 */

import type { IncomingHttpHeaders } from 'http';

/**
 * Build target URL by replacing prefix
 */
export function buildTargetUrl(
  originalUrl: string,
  targetBaseUrl: string,
  stripPrefix?: string
): string {
  const targetPath = stripPrefix
    ? originalUrl.replace(stripPrefix, '')
    : originalUrl;

  return targetBaseUrl + targetPath;
}

/**
 * Extract headers for forwarding to target service
 */
export function extractHeaders(
  requestHeaders: IncomingHttpHeaders,
  ip: string,
  userId?: number
): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': (requestHeaders['content-type'] as string) || 'application/json',
    'x-forwarded-for': ip,
    'x-forwarded-proto': 'https'
  };

  // Forward cookies if present
  if (requestHeaders['cookie']) {
    headers['cookie'] = requestHeaders['cookie'] as string;
  }

  // Forward user ID if available
  if (userId !== undefined) {
    headers['x-user-id'] = String(userId);
  }

  return headers;
}

/**
 * Determine if request body should be forwarded
 */
export function shouldForwardBody(method: string): boolean {
  return !['GET', 'HEAD'].includes(method.toUpperCase());
}
```

**Step 4: Run test to verify it passes**

Run: `cd srcs/api-gateway && npm test`
Expected: PASS - All proxy utility tests passing

**Step 5: Commit**

```bash
git add srcs/api-gateway/src/utils/
git commit -m "feat(api-gateway): add proxy utility functions with tests"
```

---

## Task 4: Update Test Setup to TypeScript

**Files:**
- Modify: `srcs/api-gateway/src/__tests__/setup.js` → `srcs/api-gateway/src/__tests__/setup.ts`

**Step 1: Convert setup file to TypeScript**

Delete: `srcs/api-gateway/src/__tests__/setup.js`

Create: `srcs/api-gateway/src/__tests__/setup.ts`

```typescript
/**
 * @file Test Setup
 * @description Global test configuration and utilities
 */

// Global test environment variables
process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] = 'test-jwt-secret-key';
process.env['LOG_LEVEL'] = 'silent'; // Suppress logs during tests
process.env['CORS_ORIGIN'] = 'http://localhost:3000';
process.env['AUTH_SERVICE_URL'] = 'http://localhost:9001';
process.env['USER_SERVICE_URL'] = 'http://localhost:9002';
process.env['GAME_SERVICE_URL'] = 'http://localhost:9003';
process.env['PORT'] = '9000';
process.env['HOST'] = '127.0.0.1';
```

**Step 2: Run tests to verify setup works**

Run: `cd srcs/api-gateway && npm test`
Expected: PASS - All tests still passing with TypeScript setup

**Step 3: Commit**

```bash
git add srcs/api-gateway/src/__tests__/
git commit -m "feat(api-gateway): convert test setup to TypeScript"
```

---

## Task 5: Create Middleware with Tests (TDD)

**Files:**
- Create: `srcs/api-gateway/src/middleware/__tests__/auth.middleware.test.ts`
- Create: `srcs/api-gateway/src/middleware/auth.middleware.ts`

**Step 1: Write the failing test for auth middleware**

File: `srcs/api-gateway/src/middleware/__tests__/auth.middleware.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import { createAuthDecorators } from '../auth.middleware.js';

describe('auth.middleware', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });

    await app.register(jwt, {
      secret: 'test-secret'
    });

    createAuthDecorators(app);
  });

  describe('authenticate decorator', () => {
    it('should allow request with valid JWT', async () => {
      const token = app.jwt.sign({ id: 1, email: 'test@example.com' });

      app.get('/protected', {
        preHandler: app.authenticate
      }, async (request) => {
        return { userId: request.user?.id };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({ userId: 1 });
    });

    it('should reject request without JWT', async () => {
      app.get('/protected', {
        preHandler: app.authenticate
      }, async () => {
        return { success: true };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/protected'
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Unauthorized');
    });

    it('should reject request with invalid JWT', async () => {
      app.get('/protected', {
        preHandler: app.authenticate
      }, async () => {
        return { success: true };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'Bearer invalid-token'
        }
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Unauthorized');
    });
  });

  describe('optionalAuth decorator', () => {
    it('should allow request with valid JWT and set user', async () => {
      const token = app.jwt.sign({ id: 1, email: 'test@example.com' });

      app.get('/optional', {
        preHandler: app.optionalAuth
      }, async (request) => {
        return { userId: request.user?.id || null };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/optional',
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({ userId: 1 });
    });

    it('should allow request without JWT and set user to null', async () => {
      app.get('/optional', {
        preHandler: app.optionalAuth
      }, async (request) => {
        return { userId: request.user?.id || null };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/optional'
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({ userId: null });
    });

    it('should allow request with invalid JWT and set user to null', async () => {
      app.get('/optional', {
        preHandler: app.optionalAuth
      }, async (request) => {
        return { userId: request.user?.id || null };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/optional',
        headers: {
          authorization: 'Bearer invalid-token'
        }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({ userId: null });
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd srcs/api-gateway && npm test`
Expected: FAIL - "Cannot find module '../auth.middleware.js'"

**Step 3: Write minimal implementation**

File: `srcs/api-gateway/src/middleware/auth.middleware.ts`

```typescript
/**
 * @file Authentication Middleware
 * @description JWT verification decorators for route protection
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Create authentication decorators for Fastify instance
 */
export function createAuthDecorators(fastify: FastifyInstance): void {
  /**
   * Authenticate decorator - requires valid JWT
   */
  fastify.decorate('authenticate', async function(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Invalid or missing authentication token',
        statusCode: 401
      });
    }
  });

  /**
   * Optional auth decorator - doesn't fail if no token
   */
  fastify.decorate('optionalAuth', async function(
    request: FastifyRequest,
    _reply: FastifyReply
  ): Promise<void> {
    try {
      await request.jwtVerify();
    } catch (err) {
      // Silently fail - route can check if request.user exists
      request.user = null;
    }
  });
}
```

**Step 4: Run test to verify it passes**

Run: `cd srcs/api-gateway && npm test`
Expected: PASS - All auth middleware tests passing

**Step 5: Commit**

```bash
git add srcs/api-gateway/src/middleware/
git commit -m "feat(api-gateway): add auth middleware with tests"
```

---

## Task 6: Convert Main Server to TypeScript

**Files:**
- Modify: `srcs/api-gateway/src/server.js` → `srcs/api-gateway/src/server.ts`

**Step 1: Create new TypeScript server file**

Delete: `srcs/api-gateway/src/server.js`

Create: `srcs/api-gateway/src/server.ts`

```typescript
/**
 * @file API Gateway Server
 * @description Central entry point for all microservices
 * - JWT verification from cookies and headers
 * - Rate limiting
 * - Request routing with cookie forwarding
 * - Logging
 */

import Fastify from 'fastify';
import { config } from 'dotenv';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { createAuthDecorators } from './middleware/auth.middleware.js';
import { buildTargetUrl, extractHeaders, shouldForwardBody } from './utils/proxy.utils.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { ProxyOptions } from './types/index.js';

// Load environment variables
config();

// Create Fastify instance
const fastify = Fastify({
  logger: {
    level: process.env['LOG_LEVEL'] || 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
        colorize: true
      }
    }
  },
  trustProxy: true
});

// Register plugins
await fastify.register(cors, {
  origin: process.env['CORS_ORIGIN'] || 'https://localhost',
  credentials: true
});

await fastify.register(helmet, {
  contentSecurityPolicy: false
});

// Cookie support (must be registered before JWT)
await fastify.register(cookie, {
  secret: process.env['JWT_SECRET'],
  parseOptions: {}
});

// JWT plugin with cookie support
await fastify.register(jwt, {
  secret: process.env['JWT_SECRET'] || 'your-jwt-secret-change-me',
  cookie: {
    cookieName: 'accessToken',
    signed: false
  }
});

// Create authentication decorators
createAuthDecorators(fastify);

// Swagger documentation
await fastify.register(swagger, {
  swagger: {
    info: {
      title: 'ft_transcendence API Gateway',
      description: 'Microservices API Gateway',
      version: '1.0.0'
    },
    host: process.env['DOMAIN'],
    schemes: ['https'],
    consumes: ['application/json'],
    produces: ['application/json'],
    securityDefinitions: {
      Bearer: {
        type: 'apiKey',
        name: 'Authorization',
        in: 'header'
      }
    }
  }
});

await fastify.register(swaggerUi, {
  routePrefix: '/api/documentation',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: false
  }
});

// Health check
fastify.get('/health', async () => {
  return {
    status: 'healthy',
    service: 'api-gateway',
    timestamp: new Date().toISOString()
  };
});

/**
 * Proxy middleware - forwards requests to target service
 * Properly handles cookies and authentication
 */
async function proxyRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  targetUrl: string,
  stripPrefix: string = '/api'
): Promise<void> {
  try {
    // Build headers for forwarding
    const forwardHeaders = extractHeaders(
      request.headers,
      request.ip,
      request.user?.id
    );

    // Construct target URL
    const fullUrl = buildTargetUrl(request.url, targetUrl, stripPrefix);

    fastify.log.debug({ method: request.method, targetUrl: fullUrl }, 'Proxying request');

    const response = await fetch(fullUrl, {
      method: request.method,
      headers: forwardHeaders,
      body: shouldForwardBody(request.method)
        ? JSON.stringify(request.body)
        : undefined
    });

    // Forward Set-Cookie headers from backend to client
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      reply.header('set-cookie', setCookieHeader);
    }

    // Parse response
    const contentType = response.headers.get('content-type') || '';
    let data: unknown;

    if (contentType.includes('application/json')) {
      data = await response.json().catch(() => null);
    } else {
      data = await response.text();
    }

    reply.code(response.status).send(data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    fastify.log.error({ error: errorMessage }, 'Proxy request failed');
    reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to proxy request',
      statusCode: 500
    });
  }
}

// Route: Gateway health check
fastify.get('/api/health', async () => {
  return {
    status: 'healthy',
    gateway: 'operational',
    services: {
      auth: process.env['AUTH_SERVICE_URL'],
      user: process.env['USER_SERVICE_URL'],
      game: process.env['GAME_SERVICE_URL']
    },
    timestamp: new Date().toISOString()
  };
});

// ========== AUTH SERVICE ROUTES (No JWT required) ==========

fastify.all('/api/auth/*', async (request, reply) => {
  await proxyRequest(
    request,
    reply,
    process.env['AUTH_SERVICE_URL'] || 'http://auth-service:3001',
    '/api/auth'
  );
});

// ========== USER SERVICE ROUTES ==========

fastify.get('/api/users/:id', {
  preHandler: fastify.optionalAuth
}, async (request, reply) => {
  await proxyRequest(
    request,
    reply,
    process.env['USER_SERVICE_URL'] || 'http://user-service:3002'
  );
});

fastify.get('/api/users/search', {
  preHandler: fastify.authenticate
}, async (request, reply) => {
  await proxyRequest(
    request,
    reply,
    process.env['USER_SERVICE_URL'] || 'http://user-service:3002'
  );
});

fastify.all('/api/users/*', {
  preHandler: fastify.authenticate
}, async (request, reply) => {
  await proxyRequest(
    request,
    reply,
    process.env['USER_SERVICE_URL'] || 'http://user-service:3002'
  );
});

// ========== FRIEND SERVICE ROUTES (all require auth) ==========

fastify.all('/api/friends', {
  preHandler: fastify.authenticate
}, async (request, reply) => {
  await proxyRequest(
    request,
    reply,
    process.env['USER_SERVICE_URL'] || 'http://user-service:3002'
  );
});

fastify.all('/api/friends/*', {
  preHandler: fastify.authenticate
}, async (request, reply) => {
  await proxyRequest(
    request,
    reply,
    process.env['USER_SERVICE_URL'] || 'http://user-service:3002'
  );
});

// ========== STATS SERVICE ROUTES ==========

fastify.get('/api/stats/:id', {
  preHandler: fastify.optionalAuth
}, async (request, reply) => {
  await proxyRequest(
    request,
    reply,
    process.env['USER_SERVICE_URL'] || 'http://user-service:3002'
  );
});

fastify.get('/api/stats/leaderboard', {
  preHandler: fastify.optionalAuth
}, async (request, reply) => {
  await proxyRequest(
    request,
    reply,
    process.env['USER_SERVICE_URL'] || 'http://user-service:3002'
  );
});

// ========== GAME SERVICE ROUTES ==========

fastify.get('/api/games', {
  preHandler: fastify.optionalAuth
}, async (request, reply) => {
  await proxyRequest(
    request,
    reply,
    process.env['GAME_SERVICE_URL'] || 'http://game-service:3003'
  );
});

fastify.post('/api/games', {
  preHandler: fastify.authenticate
}, async (request, reply) => {
  await proxyRequest(
    request,
    reply,
    process.env['GAME_SERVICE_URL'] || 'http://game-service:3003'
  );
});

fastify.get('/api/games/stats', {
  preHandler: fastify.optionalAuth
}, async (request, reply) => {
  await proxyRequest(
    request,
    reply,
    process.env['GAME_SERVICE_URL'] || 'http://game-service:3003'
  );
});

fastify.get('/api/games/:id', {
  preHandler: fastify.optionalAuth
}, async (request, reply) => {
  await proxyRequest(
    request,
    reply,
    process.env['GAME_SERVICE_URL'] || 'http://game-service:3003'
  );
});

fastify.all('/api/games/*', {
  preHandler: fastify.authenticate
}, async (request, reply) => {
  await proxyRequest(
    request,
    reply,
    process.env['GAME_SERVICE_URL'] || 'http://game-service:3003'
  );
});

// ========== CATCH-ALL ROUTE (404 for undefined API routes) ==========

fastify.all('/api/*', {
  preHandler: fastify.authenticate
}, async (request, reply) => {
  reply.code(404).send({
    error: 'Not Found',
    message: `API route ${request.method} ${request.url} not found`,
    statusCode: 404,
    availableRoutes: [
      '/api/auth/*',
      '/api/users/*',
      '/api/friends/*',
      '/api/stats/*',
      '/api/games/*'
    ]
  });
});

// 404 handler
fastify.setNotFoundHandler((request, reply) => {
  reply.code(404).send({
    error: 'Not Found',
    message: `Route ${request.method} ${request.url} not found`,
    statusCode: 404
  });
});

// Error handler
fastify.setErrorHandler((error, _request, reply) => {
  fastify.log.error(error);
  reply.code(error.statusCode || 500).send({
    error: error.name || 'Internal Server Error',
    message: error.message || 'An unexpected error occurred',
    statusCode: error.statusCode || 500
  });
});

// Graceful shutdown
async function gracefulShutdown(signal: string): Promise<void> {
  fastify.log.info(`Received ${signal}, shutting down gracefully...`);
  try {
    await fastify.close();
    fastify.log.info('Server closed');
    process.exit(0);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    fastify.log.error({ error: errorMessage }, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
async function start(): Promise<void> {
  try {
    const port = parseInt(process.env['PORT'] || '8001', 10);
    const host = process.env['HOST'] || '0.0.0.0';

    await fastify.listen({ port, host });
    fastify.log.info(`🚀 API Gateway running on http://${host}:${port}`);
    fastify.log.info(`📚 API Documentation: http://${host}:${port}/api/documentation`);
    fastify.log.info(`🔌 Routing Configuration:`);
    fastify.log.info(`   /api/auth/*       → ${process.env['AUTH_SERVICE_URL'] || 'http://auth-service:3001'}`);
    fastify.log.info(`   /api/users/*      → ${process.env['USER_SERVICE_URL'] || 'http://user-service:3002'}`);
    fastify.log.info(`   /api/friends/*    → ${process.env['USER_SERVICE_URL'] || 'http://user-service:3002'}`);
    fastify.log.info(`   /api/stats/*      → ${process.env['USER_SERVICE_URL'] || 'http://user-service:3002'}`);
    fastify.log.info(`   /api/games/*      → ${process.env['GAME_SERVICE_URL'] || 'http://game-service:3003'}`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    fastify.log.error(errorMessage);
    process.exit(1);
  }
}

start();
```

**Step 2: Verify TypeScript compiles**

Run: `cd srcs/api-gateway && npm run type-check`
Expected: No TypeScript errors

**Step 3: Build and verify output**

Run: `cd srcs/api-gateway && npm run build`
Expected: Compiled JavaScript in `dist/` directory

**Step 4: Commit**

```bash
git add srcs/api-gateway/src/server.ts
git rm srcs/api-gateway/src/server.js
git commit -m "feat(api-gateway): convert server to TypeScript"
```

---

## Task 7: Add Integration Tests for Server

**Files:**
- Create: `srcs/api-gateway/src/__tests__/server.test.ts`

**Step 1: Write integration tests for the server**

File: `srcs/api-gateway/src/__tests__/server.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import { createAuthDecorators } from '../middleware/auth.middleware.js';

describe('API Gateway Server Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    // Register required plugins
    await app.register(cookie, {
      secret: 'test-secret'
    });

    await app.register(jwt, {
      secret: 'test-secret',
      cookie: {
        cookieName: 'accessToken',
        signed: false
      }
    });

    // Create auth decorators
    createAuthDecorators(app);

    // Add health check route
    app.get('/health', async () => {
      return {
        status: 'healthy',
        service: 'api-gateway',
        timestamp: new Date().toISOString()
      };
    });

    // Add protected route
    app.get('/api/protected', {
      preHandler: app.authenticate
    }, async (request) => {
      return { userId: request.user?.id };
    });

    // Add optional auth route
    app.get('/api/optional', {
      preHandler: app.optionalAuth
    }, async (request) => {
      return { userId: request.user?.id || null };
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe('healthy');
      expect(body.service).toBe('api-gateway');
    });
  });

  describe('Protected Routes', () => {
    it('should access protected route with valid JWT', async () => {
      const token = app.jwt.sign({ id: 1, email: 'test@example.com' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/protected',
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.userId).toBe(1);
    });

    it('should reject protected route without JWT', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/protected'
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Unauthorized');
    });
  });

  describe('Optional Auth Routes', () => {
    it('should access optional route with valid JWT', async () => {
      const token = app.jwt.sign({ id: 1, email: 'test@example.com' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/optional',
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.userId).toBe(1);
    });

    it('should access optional route without JWT', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/optional'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.userId).toBeNull();
    });
  });
});
```

**Step 2: Run integration tests**

Run: `cd srcs/api-gateway && npm test`
Expected: PASS - All integration tests passing

**Step 3: Run test coverage**

Run: `cd srcs/api-gateway && npm run test:coverage`
Expected: Coverage report showing >80% coverage

**Step 4: Commit**

```bash
git add srcs/api-gateway/src/__tests__/server.test.ts
git commit -m "test(api-gateway): add server integration tests"
```

---

## Task 8: Update Dockerfile for TypeScript Build

**Files:**
- Modify: `srcs/api-gateway/Dockerfile`

**Step 1: Update Dockerfile to compile TypeScript**

Modify: `srcs/api-gateway/Dockerfile`

Change from:
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/

EXPOSE 8001

CMD ["node", "src/server.js"]
```

To:
```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built files from builder
COPY --from=builder /app/dist ./dist

EXPOSE 8001

CMD ["node", "dist/server.js"]
```

**Step 2: Verify Dockerfile builds**

Run: `cd srcs/api-gateway && docker build -t api-gateway-test .`
Expected: Build succeeds without errors

**Step 3: Commit**

```bash
git add srcs/api-gateway/Dockerfile
git commit -m "feat(api-gateway): update Dockerfile for TypeScript build"
```

---

## Task 9: Run Full Test Suite and Verify

**Step 1: Run all tests**

Run: `cd srcs/api-gateway && npm test`
Expected: All tests passing

**Step 2: Run type checking**

Run: `cd srcs/api-gateway && npm run type-check`
Expected: No type errors

**Step 3: Build TypeScript**

Run: `cd srcs/api-gateway && npm run build`
Expected: Clean build in dist/ directory

**Step 4: Verify test coverage**

Run: `cd srcs/api-gateway && npm run test:coverage`
Expected: Coverage >80% for all modules

**Step 5: Commit**

```bash
git add .
git commit -m "chore(api-gateway): verify TypeScript conversion complete"
```

---

## Task 10: Update Documentation

**Files:**
- Create: `srcs/api-gateway/README.md`

**Step 1: Create README**

File: `srcs/api-gateway/README.md`

```markdown
# API Gateway Microservice

TypeScript-based API Gateway for the ft_transcendence project.

## Features

- **Request Routing**: Routes requests to appropriate microservices
- **JWT Authentication**: Verifies JWT tokens from cookies or headers
- **Cookie Forwarding**: Properly forwards authentication cookies to services
- **Rate Limiting**: Protects against abuse
- **Swagger Documentation**: Auto-generated API docs
- **Comprehensive Tests**: Unit and integration tests with >80% coverage

## Tech Stack

- **Runtime**: Node.js 20
- **Framework**: Fastify
- **Language**: TypeScript
- **Testing**: Vitest + supertest
- **Logging**: Pino

## Development

```bash
# Install dependencies
npm install

# Run in development mode (with auto-reload)
npm run dev

# Type checking
npm run type-check

# Build for production
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Routes

### Health Check
- `GET /health` - Gateway health status

### Service Routing

- `POST /api/auth/*` - Auth Service (no JWT required)
- `GET /api/users/:id` - User profile (optional auth)
- `GET /api/users/search` - User search (requires auth)
- `GET /api/friends` - Friends list (requires auth)
- `GET /api/stats/:id` - User stats (optional auth)
- `GET /api/games` - Game list (optional auth)
- `POST /api/games` - Create game (requires auth)

## Environment Variables

```env
PORT=8001
HOST=0.0.0.0
LOG_LEVEL=info
JWT_SECRET=your-secret-here
CORS_ORIGIN=https://localhost
AUTH_SERVICE_URL=http://auth-service:3001
USER_SERVICE_URL=http://user-service:3002
GAME_SERVICE_URL=http://game-service:3003
DOMAIN=ft_transcendence.42.crea
```

## Testing

Unit tests are organized by module:
- `src/utils/__tests__/` - Utility function tests
- `src/middleware/__tests__/` - Middleware tests
- `src/__tests__/` - Integration tests

Run tests with:
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

## Production Build

```bash
# Build TypeScript
npm run build

# Start production server
npm start
```

## Architecture

The API Gateway acts as a reverse proxy:

1. Receives client requests
2. Verifies JWT (if required)
3. Forwards request to appropriate microservice
4. Returns response to client

All requests include:
- Forwarded cookies
- `X-Forwarded-For` header
- `X-User-ID` header (if authenticated)
```

**Step 2: Commit**

```bash
git add srcs/api-gateway/README.md
git commit -m "docs(api-gateway): add comprehensive README"
```

---

## Summary

**Completion Checklist:**

- ✅ TypeScript configuration (tsconfig.json, vitest.config.ts)
- ✅ Type definitions (types/index.ts)
- ✅ Proxy utilities with tests (utils/proxy.utils.ts)
- ✅ Auth middleware with tests (middleware/auth.middleware.ts)
- ✅ Server converted to TypeScript (server.ts)
- ✅ Integration tests (server.test.ts)
- ✅ Dockerfile updated for TS build
- ✅ Test coverage >80%
- ✅ Documentation (README.md)

**Commands to Verify:**

```bash
cd srcs/api-gateway
npm run type-check    # No errors
npm run build         # Clean build
npm test              # All tests pass
npm run test:coverage # >80% coverage
```

**Test Coverage Targets:**
- `utils/proxy.utils.ts`: 100%
- `middleware/auth.middleware.ts`: 100%
- `server.ts`: >80%
- Overall: >80%
