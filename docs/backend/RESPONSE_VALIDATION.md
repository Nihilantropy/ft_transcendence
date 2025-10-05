# Response Validation with Fastify Schemas

## Overview

This document explains how we use Fastify's built-in response validation to ensure type safety and consistency across all API endpoints.

## 🎯 What is Response Validation?

Response validation ensures that data returned from your API **always matches the expected schema**. This prevents:

- ❌ Missing required fields
- ❌ Incorrect data types
- ❌ Extra fields leaking sensitive data
- ❌ Inconsistent API responses

## 🔧 Configuration

### Fastify Setup (`server.js`)

```javascript
const fastify = Fastify({
  logger: createLoggerConfig(environment, logLevel),
  
  // ✅ Enable response validation
  ajv: {
    customOptions: {
      removeAdditional: 'all',      // Remove properties not in schema
      coerceTypes: true,             // Convert types when possible
      useDefaults: true,             // Use default values from schema
      allErrors: false,              // Stop on first error (faster)
      validateFormats: true          // Validate email, uri, date formats
    },
    plugins: []
  }
})
```

### What Each Option Does

| Option | Description | Example |
|--------|-------------|---------|
| `removeAdditional: 'all'` | Strips properties not in schema | `{ id: 1, secret: "xyz" }` → `{ id: 1 }` |
| `coerceTypes: true` | Converts compatible types | `"123"` → `123` |
| `useDefaults: true` | Fills in default values | `{}` → `{ enabled: false }` |
| `allErrors: false` | Stops at first error | Faster validation |
| `validateFormats: true` | Checks email, date, etc. | Validates `format: 'email'` |

## 📋 Schema Definition

### Define Response Schemas (`auth.schema.js`)

```javascript
const schemas = [
  // Success response
  {
    $id: 'VerifyEmailResponse',
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      user: { $ref: 'User#' }
    },
    required: ['success', 'message', 'user']  // ✅ All required
  },
  
  // Error response
  {
    $id: 'ErrorResponse',
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      error: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          details: { type: 'string' }
        },
        required: ['code', 'details']
      }
    },
    required: ['success', 'message']
  }
]
```

### Map Schemas to Routes

```javascript
export const routeSchemas = {
  verifyEmail: {
    tags: ['auth'],
    operationId: 'verifyEmail',
    summary: 'Verify email address',
    querystring: { $ref: 'VerifyEmailQuery#' },
    response: {
      200: { $ref: 'VerifyEmailResponse#' },    // ✅ Success
      400: { $ref: 'ErrorResponse#' },          // ✅ Bad request
      500: { $ref: 'ErrorResponse#' }           // ✅ Server error
    }
  }
}
```

## 🎨 Usage in Routes

### Example: Email Verification Route

```javascript
async function verifyEmailRoute(fastify) {
  fastify.get('/verify-email', {
    schema: routeSchemas.verifyEmail  // ✅ Includes response validation
  }, async (request, reply) => {
    try {
      const { token } = request.query
      const verifiedUser = userService.verifyUserEmail(token)
      
      if (!verifiedUser) {
        reply.status(400)
        
        // ✅ Fastify validates this matches ErrorResponse schema
        return {
          success: false,
          message: 'Invalid token',
          error: {
            code: 'INVALID_TOKEN',
            details: 'Token is invalid or expired'
          }
        }
        // ⚠️ If you forget 'error.code', validation fails!
      }
      
      const { accessToken, refreshToken } = generateTokenPair(...)
      reply.setCookie('accessToken', accessToken, ACCESS_TOKEN_CONFIG)
      reply.setCookie('refreshToken', refreshToken, REFRESH_TOKEN_CONFIG)
      
      // ✅ Fastify validates this matches VerifyEmailResponse schema
      return {
        success: true,
        message: 'Email verified successfully',
        user: {
          id: verifiedUser.id,
          username: verifiedUser.username,
          email: verifiedUser.email,
          email_verified: true
        }
      }
      // ⚠️ If you forget 'user', validation fails!
      // ✅ If you add 'password', it's automatically removed!
      
    } catch (error) {
      reply.status(500)
      
      // ✅ Fastify validates this matches ErrorResponse schema
      return {
        success: false,
        message: 'Verification failed',
        error: {
          code: 'VERIFICATION_ERROR',
          details: error.message
        }
      }
    }
  })
}
```

## ⚠️ Error Handling

### Enhanced Error Handler (`error-handler.js`)

```javascript
fastify.setErrorHandler(async (error, request, reply) => {
  
  // ✅ Handle response validation errors
  if (error.validation && error.validationContext === 'response') {
    fastify.log.error('❌ Response validation failed:', {
      url: request.url,
      statusCode: reply.statusCode,
      validation: error.validation
    })
    
    // Development: Show validation details
    if (process.env.NODE_ENV === 'development') {
      return {
        success: false,
        message: 'Response validation failed',
        error: {
          code: 'RESPONSE_VALIDATION_ERROR',
          details: JSON.stringify(error.validation, null, 2)
        }
      }
    }
    
    // Production: Generic error
    return {
      success: false,
      message: 'Internal server error',
      error: {
        code: 'INTERNAL_ERROR',
        details: 'An unexpected error occurred'
      }
    }
  }
  
  // ✅ Handle request validation errors
  if (error.validation && error.validationContext === 'body') {
    reply.status(400)
    return {
      success: false,
      message: 'Invalid request data',
      error: {
        code: 'VALIDATION_ERROR',
        details: error.message
      }
    }
  }
  
  // ... handle other errors
})
```

## 🔍 Validation Examples

### Example 1: Missing Required Field

```javascript
// ❌ WRONG: Missing 'user' field
return {
  success: true,
  message: 'Email verified'
  // user: missing!
}

// ✅ Fastify throws validation error:
// {
//   validation: [
//     { keyword: 'required', params: { missingProperty: 'user' } }
//   ]
// }
```

### Example 2: Extra Fields Removed

```javascript
// ⚠️ CAUTION: Extra field will be removed
return {
  success: true,
  message: 'Email verified',
  user: { id: 1, username: 'john' },
  internalData: 'secret'  // ❌ Not in schema, will be removed
}

// ✅ Client receives (internalData removed):
// {
//   success: true,
//   message: 'Email verified',
//   user: { id: 1, username: 'john' }
// }
```

### Example 3: Type Coercion

```javascript
// Schema expects: { id: number }

// ⚠️ Return string ID
return {
  success: true,
  user: { id: "123" }  // String
}

// ✅ Fastify converts to number (coerceTypes: true)
// Client receives:
// {
//   success: true,
//   user: { id: 123 }  // Number
// }
```

## 🧪 Testing Response Validation

### Test Case: Missing Required Field

```bash
# Make request
curl -X GET 'http://localhost:3000/api/auth/verify-email?token=abc123'

# If backend forgets a required field, you'll see (development):
{
  "success": false,
  "message": "Response validation failed",
  "error": {
    "code": "RESPONSE_VALIDATION_ERROR",
    "details": "[{\"keyword\":\"required\",\"dataPath\":\"\",\"params\":{\"missingProperty\":\"user\"}}]"
  }
}
```

### Check Server Logs

```
❌ Response validation failed: {
  url: '/api/auth/verify-email',
  method: 'GET',
  statusCode: 200,
  validation: [
    {
      keyword: 'required',
      dataPath: '',
      params: { missingProperty: 'user' }
    }
  ]
}
```

## 📊 Benefits

| Benefit | Description |
|---------|-------------|
| **Type Safety** | Ensures all responses match schema |
| **Security** | Prevents sensitive data leaks (removes extra fields) |
| **Consistency** | All endpoints return predictable structures |
| **Documentation** | Schemas serve as API documentation |
| **Performance** | Compiled schemas = fast validation |
| **Developer Experience** | Clear errors during development |

## 🎯 Best Practices

### ✅ DO

```javascript
// ✅ Define all possible status codes
response: {
  200: { $ref: 'SuccessResponse#' },
  400: { $ref: 'ErrorResponse#' },
  401: { $ref: 'ErrorResponse#' },
  500: { $ref: 'ErrorResponse#' }
}

// ✅ Use consistent error format
return {
  success: false,
  message: 'User-friendly message',
  error: {
    code: 'ERROR_CODE',
    details: 'Technical details'
  }
}

// ✅ Set status code explicitly
reply.status(400)
return { success: false, ... }
```

### ❌ DON'T

```javascript
// ❌ Missing status codes in schema
response: {
  200: { $ref: 'SuccessResponse#' }
  // Missing 400, 401, 500!
}

// ❌ Inconsistent error format
return {
  error: 'Something went wrong'  // Should be object
}

// ❌ Wrong status code for schema
reply.status(200)  // Status 200
return { success: false, ... }  // But error response!
```

## 🔧 Debugging Tips

### Enable Detailed Validation Errors

```javascript
// server.js
const fastify = Fastify({
  ajv: {
    customOptions: {
      allErrors: true  // Show ALL validation errors (slower but more detailed)
    }
  }
})
```

### Log Response Before Sending

```javascript
// In route handler
const responseData = {
  success: true,
  message: 'Email verified',
  user: verifiedUser
}

// Log before returning (helps debug validation)
fastify.log.debug('Response data:', responseData)

return responseData
```

## 📚 Resources

- [Fastify Validation Documentation](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/)
- [JSON Schema Reference](https://json-schema.org/understanding-json-schema/)
- [AJV Options](https://ajv.js.org/options.html)

---

**Status:** ✅ Implemented  
**Last Updated:** October 3, 2025
