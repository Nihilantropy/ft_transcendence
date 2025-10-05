# Fastify preHandler Error Handling Guide

**Date:** October 5, 2025  
**Context:** Understanding how Fastify preHandler hooks work and proper error handling

## How Fastify preHandler Works

### Request Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                      REQUEST LIFECYCLE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Request arrives                                             │
│       ↓                                                         │
│  2. onRequest hooks                                             │
│       ↓                                                         │
│  3. preParsing hooks                                            │
│       ↓                                                         │
│  4. Parsing body/query/params                                   │
│       ↓                                                         │
│  5. preValidation hooks                                         │
│       ↓                                                         │
│  6. Schema validation                                           │
│       ↓                                                         │
│  7. preHandler hooks ← YOU ARE HERE (requireAuth)               │
│       ↓                                                         │
│  8. Route Handler (if preHandler succeeds)                      │
│       ↓                                                         │
│  9. preSerialization hooks                                      │
│       ↓                                                         │
│  10. Response sent                                              │
│                                                                 │
│  ❌ If error at ANY stage → Error Handler                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Error Handling in preHandler

### ✅ Correct Approach 1: Throw Error Object

**Best for:** Authentication, authorization, validation

```javascript
export async function requireAuth(request, reply) {
  const token = request.cookies?.accessToken
  
  if (!token) {
    // Throw error object with statusCode
    throw { 
      statusCode: 401, 
      message: 'Authentication required' 
    }
  }
  
  // If successful, just return (or return nothing)
  // Execution continues to route handler
  request.user = verifiedUser
}
```

**What happens:**
1. Error thrown → Execution stops immediately
2. Route handler is **NOT** executed
3. Fastify's error handler catches the error
4. Error handler sends response with statusCode and message

### ✅ Correct Approach 2: Send Response Directly

**Best for:** Complex responses, custom headers

```javascript
export async function requireAuth(request, reply) {
  const token = request.cookies?.accessToken
  
  if (!token) {
    // Send response and return the reply object
    return reply.status(401).send({
      success: false,
      message: 'Authentication required'
    })
  }
  
  request.user = verifiedUser
}
```

**What happens:**
1. Response sent → `reply.sent` flag set to true
2. Execution stops (return statement)
3. Route handler is **NOT** executed
4. No error handler needed (you already sent response)

### ❌ Wrong Approach: Set Status Without Throwing

**DON'T DO THIS:**

```javascript
export async function requireAuth(request, reply) {
  const token = request.cookies?.accessToken
  
  if (!token) {
    reply.status(401)  // ❌ Only sets status
    return { success: false, message: 'Auth required' }  // ❌ Returned object is ignored!
    // Route handler STILL executes! 🐛
  }
}
```

**Why it's wrong:**
- `reply.status(401)` only sets the status code
- Returning an object does NOT send a response
- The returned object is **ignored** by Fastify
- Route handler **continues to execute**
- Route handler might try to send its own response
- Results in "Reply already sent" errors or wrong responses

## Our Implementation

### authentication.js (preHandler)

```javascript
export async function requireAuth(request, reply) {
  const token = request.cookies?.accessToken
  
  if (!token) {
    // ✅ Throw error object - execution stops
    throw { statusCode: 401, message: 'Authentication required' }
  }

  try {
    const decoded = verifyAccessToken(token)
    const user = userService.getUserById(decoded.userId)
    
    if (!user || !user.is_active) {
      throw { statusCode: 401, message: 'User not found or inactive' }
    }
    
    // ✅ Success: Attach user and return (execution continues)
    request.user = user
    
  } catch (error) {
    if (error.statusCode) {
      throw error // Re-throw our custom errors
    }
    throw { statusCode: 401, message: 'Invalid or expired token' }
  }
}
```

### error-handler.js (catches errors)

```javascript
fastify.setErrorHandler(async (error, request, reply) => {
  // Log the error
  fastify.log.error('❌ Error occurred:', {
    url: request.url,
    error: error.message,
    statusCode: error.statusCode
  })
  
  // Set status code from error
  const statusCode = error.statusCode || error.status || 500
  reply.status(statusCode)
  
  // Return schema-compliant response
  return {
    success: false,
    message: error.message || 'An error occurred',
    error: {
      code: error.code || 'UNKNOWN_ERROR',
      details: error.message
    }
  }
})
```

## Complete Flow Example

### Scenario 1: Missing Token (Unauthorized)

```
1. Request arrives at POST /api/auth/2fa/setup
     ↓
2. Schema validation passes
     ↓
3. preHandler: requireAuth executes
     ↓
4. No token found in cookies
     ↓
5. throw { statusCode: 401, message: 'Authentication required' }
     ↓
6. Execution stops immediately
     ↓
7. Error handler catches error
     ↓
8. Response sent: 401 with { success: false, message: '...' }
     ↓
9. Route handler NEVER executes ✅
```

### Scenario 2: Valid Token (Success)

```
1. Request arrives at POST /api/auth/2fa/setup
     ↓
2. Schema validation passes
     ↓
3. preHandler: requireAuth executes
     ↓
4. Token found and verified
     ↓
5. request.user = verifiedUser
     ↓
6. requireAuth returns (no error)
     ↓
7. Route handler executes ✅
     ↓
8. Route handler generates QR code
     ↓
9. Response sent: 200 with { success: true, setupData: {...} }
```

## Key Takeaways

### ✅ DO:
- **Throw error objects** with `statusCode` and `message`
- **Let error handler** format the response
- **Return nothing** (or undefined) on success
- **Attach data** to request object (like `request.user`)

### ❌ DON'T:
- **Don't** set status without throwing/sending
- **Don't** return objects expecting them to be sent
- **Don't** manually call `reply.send()` AND throw error
- **Don't** assume returned values are automatically sent

## Why This Approach?

### Benefits:

1. **Centralized Error Handling**
   - All errors go through one error handler
   - Consistent error response format
   - Easy to add logging, monitoring

2. **Clear Flow Control**
   - Throwing stops execution clearly
   - No ambiguity about what happens next
   - Route handler only runs on success

3. **DRY (Don't Repeat Yourself)**
   - Error formatting in one place
   - Status codes handled consistently
   - No duplicate response building

4. **Maintainable**
   - Easy to change error format globally
   - Easy to add new middleware
   - Clear separation of concerns

## Testing Your Middleware

### Test Case 1: No Token
```bash
curl -X POST http://localhost:3000/api/auth/2fa/setup
# Expected: 401 Unauthorized
# { "success": false, "message": "Authentication required", ... }
```

### Test Case 2: Invalid Token
```bash
curl -X POST http://localhost:3000/api/auth/2fa/setup \
  -H "Cookie: accessToken=invalid_token"
# Expected: 401 Unauthorized
# { "success": false, "message": "Invalid or expired token", ... }
```

### Test Case 3: Valid Token
```bash
curl -X POST http://localhost:3000/api/auth/2fa/setup \
  -H "Cookie: accessToken=valid_jwt_token"
# Expected: 200 OK
# { "success": true, "setupData": { ... } }
```

---

**Status:** ✅ Implemented and documented
**Pattern:** Error throwing in preHandler → Error handler catches → Consistent responses
