# Email Verification Page - Implementation Guide

## Overview

The **EmailVerificationPage** is a frontend component that seamlessly integrates with the backend email verification and resend verification endpoints. It provides a clean, user-friendly interface for email verification with automatic token validation, comprehensive error handling, and resend functionality.

## Features

### ✅ Core Features

1. **Automatic Verification**
   - Extracts token from URL query parameters
   - Automatically verifies email on page load
   - Handles backend response with proper validation

2. **Smart Error Handling**
   - Distinguishes between expired/invalid tokens and temporary errors
   - Shows appropriate UI states for each error type
   - Provides clear, actionable error messages

3. **Resend Functionality**
   - Allows users to request new verification emails
   - Stores user email for one-click resend
   - Includes rate limiting protection via backend
   - Prevents multiple simultaneous requests

4. **Auto-Login Integration**
   - Backend sets httpOnly cookies after successful verification
   - Automatically redirects to username selection
   - No manual login required after verification

5. **Responsive UI States**
   - Loading state during verification
   - Success state with auto-redirect
   - Error state with resend option
   - Invalid token state with clear instructions

## Architecture

### Component State

```typescript
interface EmailVerificationPageState {
  status: 'loading' | 'success' | 'error' | 'invalid' | 'resending'
  isLoading: boolean
  errorMessage: string | null
  userEmail: string | null  // Stored for easy resend
}
```

### Backend Integration

#### 1. Email Verification Endpoint

**Endpoint**: `GET /auth/verify-email?token={token}`

**Flow**:
```
1. Component extracts token from URL
2. Calls authService.verifyEmail(token)
3. Backend validates token and updates user
4. Backend sets httpOnly cookies (accessToken, refreshToken)
5. Frontend receives success response with user data
6. Redirects to username selection
```

**Success Response**:
```json
{
  "success": true,
  "message": "Email verified successfully. You are now logged in.",
  "user": {
    "id": 1,
    "username": "user_12345",
    "email": "user@example.com",
    "email_verified": true
  }
}
```

**Error Response**:
```json
{
  "success": false,
  "message": "Invalid or expired verification token",
  "error": {
    "code": "INVALID_TOKEN",
    "details": "Verification token is invalid or has already been used"
  }
}
```

#### 2. Resend Verification Endpoint

**Endpoint**: `POST /auth/resend-verification`

**Request Body**:
```json
{
  "email": "user@example.com"
}
```

**Flow**:
```
1. User clicks "Resend Verification Email"
2. Component prompts for email (or uses stored email)
3. Calls authService.resendVerificationEmail(email)
4. Backend validates email and checks rate limits
5. Backend generates new token and sends email
6. Frontend shows success message
```

**Success Response**:
```json
{
  "success": true,
  "message": "Verification email sent. Please check your inbox."
}
```

**Rate Limit Response** (429):
```json
{
  "success": false,
  "message": "Please wait 5 minute(s) before requesting another email",
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "details": "Please wait 5 minute(s) before requesting another email"
  }
}
```

## UI States

### 1. Loading State
```
📧
Verifying Email...
Please wait while we verify your email address.
⏳ Processing verification...
```

### 2. Success State
```
✅
Email Verified!
Your email address has been successfully verified.
📧 user@example.com
You are now logged in and can choose your username!

[🏷️ Choose Username]
Redirecting automatically in 2 seconds...
[🏠 Go to Home]
```

### 3. Error State
```
❌
Verification Failed
{error message}
📧 user@example.com

[📧 Resend Verification Email]
Click to resend to your registered email
[🔐 Back to Login]
[🏠 Go to Home]
```

### 4. Invalid Token State
```
🚫
Invalid Verification Link
This verification link is invalid or has expired.
Please request a new verification email to complete your registration.

[📧 Request New Verification Email]
You will be asked to enter your email address
[📝 Register New Account]
[🔐 Back to Login]
```

### 5. Resending State
```
❌
Verification Failed
{previous error message}

[⏳ Sending...]  (disabled)
```

## Error Handling

### Error Classification

1. **Invalid/Expired Token**
   - Status: `invalid`
   - Triggers: Token not found, already used, expired
   - Action: Show resend option with explanation

2. **Temporary Errors**
   - Status: `error`
   - Triggers: Network issues, server errors
   - Action: Show retry option with error details

3. **Resend Errors**
   - Rate limiting: Show wait time from backend
   - Email not found: Generic success message (security)
   - Server errors: Show generic error message

### Error Messages

**Token Errors**:
- "No verification token provided"
- "Invalid or expired verification token"
- "Verification token is invalid or has already been used"

**Resend Errors**:
- "Please wait {X} minute(s) before requesting another email"
- "Failed to send verification email. Please try again later."
- "Email send failed - Unable to send verification email at this time"

## Security Features

### 1. Email Privacy
- Stored email never shown in error messages to unauthorized users
- Only shown after user explicitly provides it

### 2. Rate Limiting
- Backend enforces 5-minute cooldown between resend requests
- Prevents email spam and abuse
- Clear feedback to user about wait time

### 3. Token Security
- Single-use tokens (verified tokens are invalidated)
- Expiration handled by backend
- Secure transmission via HTTPS query parameters

### 4. Auto-Login Security
- Uses httpOnly cookies (immune to XSS)
- Secure flag in production
- SameSite=strict to prevent CSRF

## User Experience

### Happy Path
```
1. User registers with email
2. Backend sends verification email
3. User clicks link in email
4. EmailVerificationPage loads with token
5. Automatic verification starts (loading animation)
6. Success message shows
7. Auto-redirect to username selection (2 seconds)
8. User chooses username and continues
```

### Error Recovery Path
```
1. User clicks expired verification link
2. Page shows "Invalid Verification Link" state
3. User clicks "Request New Verification Email"
4. Enters email address in prompt
5. Backend sends new email
6. Success message shows
7. User checks inbox for new email
8. User clicks new link and verifies successfully
```

### Smart Resend
```
1. User clicks verification link (token fails)
2. Page detects user email from failed verification
3. Stores email in component state
4. User clicks "Resend" button
5. No prompt needed - uses stored email
6. New email sent immediately
7. User experience is smooth and fast
```

## Backend Requirements

### Rate Limiting

Backend implements rate limiting in `userService.regenerateVerificationToken()`:

```javascript
const RATE_LIMIT_WINDOW = 5 * 60 * 1000 // 5 minutes

// Check if user recently received a verification email
const now = Date.now()
const lastSent = user.verification_email_last_sent 
  ? new Date(user.verification_email_last_sent).getTime() 
  : 0

const timeSinceLastEmail = now - lastSent
const waitTime = RATE_LIMIT_WINDOW - timeSinceLastEmail

if (timeSinceLastEmail < RATE_LIMIT_WINDOW) {
  return {
    rateLimited: true,
    waitMinutes: Math.ceil(waitTime / 60000),
    message: `Please wait ${Math.ceil(waitTime / 60000)} minute(s)`
  }
}
```

### Database Fields

Required fields in `users` table:
- `email_verified`: Boolean flag
- `verification_token`: Unique token for email verification
- `verification_email_last_sent`: Timestamp of last verification email

## Code Examples

### Using the Component

```typescript
import { EmailVerificationPage } from './pages/auth/EmailVerificationPage'

// In your router
router.addRoute('/verify-email', () => {
  const token = new URLSearchParams(window.location.search).get('token')
  return new EmailVerificationPage({ token })
})
```

### Manual Verification

```typescript
// Get reference to page
const page = new EmailVerificationPage({ token: 'abc123...' })

// Mount to container
const container = document.getElementById('app')
page.mount(container!)
```

### Testing Resend

```typescript
// Simulate resend
const email = 'test@example.com'
const response = await authService.resendVerificationEmail(email)

if (response.success) {
  console.log('Email sent:', response.message)
} else {
  console.error('Failed:', response.message)
}
```

## Testing Scenarios

### 1. Valid Token Verification
```
URL: /verify-email?token=valid_token_123
Expected: Success state → Auto-redirect to /username-selection
```

### 2. Invalid Token
```
URL: /verify-email?token=invalid_or_expired
Expected: Invalid state → Show resend option
```

### 3. Missing Token
```
URL: /verify-email
Expected: Invalid state → Show error about missing token
```

### 4. Resend with Stored Email
```
1. Failed verification (email stored)
2. Click "Resend" button
3. Expected: No prompt, email sent to stored address
```

### 5. Resend without Stored Email
```
1. Click "Resend" button
2. Expected: Prompt for email address
3. Enter email → Email sent
```

### 6. Rate Limiting
```
1. Resend email successfully
2. Immediately resend again
3. Expected: Error message with wait time
```

## Best Practices

### 1. State Management
- Always update `isLoading` to prevent duplicate requests
- Store `userEmail` for better UX on resend
- Use appropriate status for each scenario

### 2. Error Handling
- Parse error messages from backend
- Show actionable messages to users
- Log errors for debugging

### 3. User Feedback
- Show loading states during async operations
- Use popups for important notifications
- Provide clear next steps in error states

### 4. Security
- Never expose sensitive tokens in logs
- Use httpOnly cookies for authentication
- Validate all user input

## Troubleshooting

### Issue: Token not found in URL
**Solution**: Check router configuration passes token as prop

### Issue: Resend button not working
**Solution**: Check `authService.resendVerificationEmail()` implementation

### Issue: No auto-redirect after verification
**Solution**: Verify backend sets httpOnly cookies correctly

### Issue: Rate limit errors
**Solution**: Backend enforces 5-minute cooldown - wait and retry

### Issue: Email not stored for resend
**Solution**: Check `userEmail` is set in state after verification attempt

## Related Documentation

- [Backend Email Verification Route](../../docs/backend/RESEND_VERIFICATION.md)
- [Authentication Service](./AUTH_SERVICE.md)
- [Security Token Storage](../../docs/SECURITY_TOKEN_STORAGE.md)
- [Response Validation](../../docs/backend/RESPONSE_VALIDATION.md)
