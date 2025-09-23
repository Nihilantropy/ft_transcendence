# Route Structure Documentation

## Overview

The ft_transcendence backend uses a modular route structure with configurable base paths.

## Configuration

Routes are prefixed with `API_BASE_PATH` environment variable (default: `/api`).

## Current Routes

### Health Routes (`/src/routes/health.js`)

All routes are prefixed with the API base path:

#### `GET {API_BASE_PATH}/health`
- **Purpose**: Overall application health check
- **Response**: Application status, database connectivity, uptime, response time
- **Status Codes**: 
  - `200`: Healthy
  - `503`: Service unavailable (database issues)

#### `GET {API_BASE_PATH}/db/status`
- **Purpose**: Detailed database status and information
- **Response**: Database connection info, file paths, existence checks
- **Status Codes**:
  - `200`: Database accessible
  - `503`: Database error

#### `GET {API_BASE_PATH}/status`
- **Purpose**: General application status and system information
- **Response**: Service info, memory usage, Node.js version, platform details
- **Status Codes**: `200`: Always successful

## Example URLs

With default `API_BASE_PATH="/api"`:

- `http://localhost:8000/api/health`
- `http://localhost:8000/api/db/status`
- `http://localhost:8000/api/status`

## Adding New Routes

### 1. Create Route File

```javascript
// src/routes/my-routes.js
import { logger } from '../logger.js'

const routeLogger = logger.child({ module: 'my-routes' })

async function myRoutes(fastify, options) {
  routeLogger.info('📋 Registering my routes')
  
  fastify.get('/my-endpoint', async (request, reply) => {
    // Route logic here
    return { message: 'Hello from my route!' }
  })
  
  routeLogger.info('✅ My routes registered successfully')
}

export default myRoutes
```

### 2. Register in Route Manager

```javascript
// src/routes/index.js
import myRoutes from './my-routes.js'

// In registerRoutes function:
await fastify.register(myRoutes, { prefix: basePath })
```

## Route Organization Guidelines

1. **Group Related Routes**: Keep related endpoints in the same file
2. **Use Module Loggers**: Create route-specific loggers with `logger.child({ module: 'route-name' })`
3. **Consistent Error Handling**: Use structured error responses
4. **Document Endpoints**: Add JSDoc comments for each route
5. **Prefix Support**: Always use the route registration system for base path support

## Environment Variables

- `API_BASE_PATH`: Base path for all API routes (default: `/api`)
- `LOG_LEVEL`: Logging level for route operations
- `NODE_ENV`: Environment mode affecting logging format

## Testing Routes

Use the health endpoint to verify route registration:

```bash
curl http://localhost:8000/api/health
```

The response includes registered route information in development mode.