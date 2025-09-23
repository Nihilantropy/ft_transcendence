# Centralized Error Handling System

## Overview

The ft_transcendence backend implements a centralized error handling system that provides:

- **Standardized error responses** across all endpoints
- **Proper HTTP status codes** for different error types
- **Integrated logging** with request context
- **Development vs production** error details
- **Type-safe error handling** with custom error classes

## Architecture

### Core Components

1. **`utils/errors.js`** - Core error classes and ErrorHandler
2. **`plugins/error-handler.js`** - Fastify plugin for error handling
3. **Logger integration** - Centralized logging with proper levels

### Error Types

| Error Class | Status Code | Use Case |
|-------------|-------------|----------|
| `ValidationError` | 400 | Invalid input data, schema validation failures |
| `AuthenticationError` | 401 | Missing or invalid credentials |
| `AuthorizationError` | 403 | Insufficient permissions |
| `NotFoundError` | 404 | Resource not found |
| `ConflictError` | 409 | Resource conflicts (duplicate username, etc.) |
| `RateLimitError` | 429 | Too many requests |
| `DatabaseError` | 500 | Database operation failures |
| `ExternalServiceError` | 502 | Third-party service failures |

## Usage Examples

### In Route Handlers

```javascript
// Using the asyncHandler wrapper (recommended)
fastify.post('/example', {
  handler: fastify.errors.asyncHandler(async (request, reply) => {
    // Validation error
    if (!request.body.email) {
      throw fastify.errors.validation('Email is required')
    }
    
    // Authentication error
    if (!user) {
      throw fastify.errors.authentication('Invalid credentials')
    }
    
    // Database error with details
    try {
      await database.createUser(userData)
    } catch (dbError) {
      throw fastify.errors.database('Failed to create user', {
        operation: 'createUser',
        details: dbError.message
      })
    }
    
    return { success: true }
  })
})
```

### Manual Error Handling

```javascript
fastify.post('/example', async (request, reply) => {
  try {
    // Your route logic here
  } catch (error) {
    // Let the centralized handler deal with it
    throw error
  }
})
```

### Direct Error Creation

```javascript
import { ValidationError, AuthenticationError } from '../utils/errors.js'

// Create and throw specific errors
throw new ValidationError('Invalid email format', { 
  field: 'email', 
  value: request.body.email 
})

throw new AuthenticationError('Session expired')
```

## Error Response Format

### Standard Response Structure

```json
{
  "success": false,
  "error": {
    "message": "User-friendly error message",
    "code": "ERROR_CODE",
    "timestamp": "2025-09-18T10:30:00.000Z",
    "details": {
      "field": "email",
      "reason": "Invalid format"
    }
  }
}
```

### Development vs Production

- **Development**: Includes stack traces and detailed error information
- **Production**: Sanitized error messages, no stack traces

## Logging

### Error Logging Levels

- **500+ errors**: `error` level with full stack trace
- **400-499 errors**: `warn` level with request context
- **Other errors**: `info` level

### Request Context

All errors are logged with:
- HTTP method and URL
- User agent and IP address
- Request timestamp
- Error stack trace (in development)

## Configuration

### Environment Variables

```bash
NODE_ENV=development  # Controls error detail level
LOG_LEVEL=info       # Controls logging verbosity
```

### Fastify Integration

The error handler is automatically registered as a Fastify plugin in `server.js`:

```javascript
import errorHandlerPlugin from './plugins/error-handler.js'

// Register centralized error handler
await fastify.register(errorHandlerPlugin)
```

## Best Practices

### 1. Use Specific Error Types

```javascript
// ❌ Generic error
throw new Error('Something went wrong')

// ✅ Specific error type
throw fastify.errors.validation('Email format is invalid')
```

### 2. Include Helpful Details

```javascript
// ❌ Vague error
throw fastify.errors.conflict('Conflict occurred')

// ✅ Detailed error
throw fastify.errors.conflict('Username already exists', {
  username: request.body.username,
  suggestion: 'Try adding numbers or special characters'
})
```

### 3. Use AsyncHandler for Route Protection

```javascript
// ❌ Manual try-catch in every route
fastify.post('/route', async (request, reply) => {
  try {
    // logic
  } catch (error) {
    // handle error
  }
})

// ✅ Using asyncHandler wrapper
fastify.post('/route', {
  handler: fastify.errors.asyncHandler(async (request, reply) => {
    // logic - errors automatically handled
  })
})
```

### 4. Chain Error Context

```javascript
try {
  await externalAPI.call()
} catch (apiError) {
  throw fastify.errors.externalService(
    'Failed to process payment',
    { 
      provider: 'stripe',
      originalError: apiError.message 
    }
  )
}
```

## Testing Error Handlers

### Unit Tests

```javascript
import { ValidationError, errorHandler } from '../utils/errors.js'

test('should format validation error correctly', () => {
  const error = new ValidationError('Invalid email', { field: 'email' })
  const response = errorHandler.formatErrorResponse(error)
  
  expect(response.success).toBe(false)
  expect(response.error.code).toBe('VALIDATION_ERROR')
  expect(response.error.details.field).toBe('email')
})
```

### Integration Tests

```javascript
test('should handle authentication error in route', async () => {
  const response = await fastify.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { username: 'invalid', password: 'wrong' }
  })
  
  expect(response.statusCode).toBe(401)
  expect(response.json().error.code).toBe('AUTHENTICATION_ERROR')
})
```

## Error Monitoring

All errors are automatically logged with structured data for monitoring:

```json
{
  "level": "error",
  "timestamp": "2025-09-18T10:30:00.000Z",
  "module": "error-handler",
  "message": "❌ Server error occurred",
  "error": {
    "name": "DatabaseError",
    "message": "Connection timeout",
    "code": "DATABASE_ERROR",
    "statusCode": 500
  },
  "context": {
    "method": "POST",
    "url": "/auth/register",
    "userAgent": "Mozilla/5.0...",
    "ip": "127.0.0.1"
  }
}
```

This enables easy integration with monitoring tools like:
- **ELK Stack** (Elasticsearch, Logstash, Kibana)
- **Prometheus + Grafana**
- **Application monitoring services**