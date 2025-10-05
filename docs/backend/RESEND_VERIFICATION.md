# Resend Email Verification

## Overview
The resend verification endpoint allows users to request a new email verification link if they didn't receive the original or if it expired.

## Implementation Details

### Rate Limiting
- **Limit**: 1 email per 5 minutes per email address
- **Tracking**: Uses `updated_at` timestamp in the `users` table
- **Response**: HTTP 429 (Too Many Requests) with wait time in minutes

### Security Features
1. **Generic Responses**: Returns generic success message even if email doesn't exist (prevents email enumeration)
2. **Rate Limiting**: Prevents email spam and abuse
3. **Already Verified Check**: Returns clear error if email is already verified
4. **Token Regeneration**: Generates new secure token for each request

### Flow Diagram
```
User Request → Validate Email
                ↓
            Find User
                ↓
        ┌───────┴───────┐
        │               │
    Not Found      Already Verified
        │               │
    Generic Msg    Return Error
        ↓               ↓
        ×               ×
        
        Check Rate Limit
                ↓
        ┌───────┴───────┐
        │               │
    Rate Limited    Available
        │               │
    Return 429      Generate Token
        ↓               ↓
        ×           Update DB
                        ↓
                    Send Email
                        ↓
                    Return Success
```

## API Reference

### Endpoint
```
POST /api/auth/resend-verification
```

### Request Body
```json
{
  "email": "user@example.com"
}
```

### Response Examples

#### Success (200 OK)
```json
{
  "success": true,
  "message": "Verification email sent. Please check your inbox."
}
```

#### Already Verified (400 Bad Request)
```json
{
  "success": false,
  "message": "Email is already verified. Please log in.",
  "error": {
    "code": "ALREADY_VERIFIED",
    "details": "This email address has already been verified"
  }
}
```

#### Rate Limited (429 Too Many Requests)
```json
{
  "success": false,
  "message": "Please wait 3 minute(s) before requesting another verification email",
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "details": "Please wait 3 minute(s) before requesting another email"
  }
}
```

#### User Not Found (400 Bad Request)
```json
{
  "success": false,
  "message": "If this email is registered, a verification link will be sent.",
  "error": {
    "code": "USER_NOT_FOUND",
    "details": "No user found with this email address"
  }
}
```

#### Email Send Failed (500 Internal Server Error)
```json
{
  "success": false,
  "message": "Failed to send verification email. Please try again later.",
  "error": {
    "code": "EMAIL_SEND_FAILED",
    "details": "Unable to send verification email at this time"
  }
}
```

## Database Changes

### UserService New Method
```javascript
regenerateVerificationToken(email)
```

**Returns:**
- `null` - User not found
- `{ alreadyVerified: true, user }` - Email already verified
- `{ rateLimited: true, waitMinutes, message }` - Rate limit exceeded
- `{ success: true, user, verificationToken }` - Token regenerated successfully

### Database Operations
1. **Query user by email** - Check if user exists
2. **Check email_verified status** - Validate if already verified
3. **Check updated_at timestamp** - Rate limiting validation
4. **Update verification token** - Set new token and update timestamp

## Usage Examples

### Frontend Integration
```typescript
// AuthService.ts
async resendVerificationEmail(email: string): Promise<void> {
  const response = await this.apiService.post('/auth/resend-verification', {
    email
  });
  
  if (!response.success) {
    throw new Error(response.message);
  }
}
```

### Testing with cURL
```bash
# Successful request
curl -X POST https://localhost/api/auth/resend-verification \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'

# Rate limited (if sent within 5 minutes)
curl -X POST https://localhost/api/auth/resend-verification \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

## Error Handling

### Client-Side Handling
```typescript
try {
  await authService.resendVerificationEmail(email);
  showSuccess('Verification email sent!');
} catch (error) {
  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    showError(error.message); // Show wait time
  } else if (error.code === 'ALREADY_VERIFIED') {
    router.navigate('/login');
  } else {
    showError('Failed to send email. Please try again.');
  }
}
```

### Server-Side Logging
All operations are logged with:
- Email address (sanitized)
- User ID (if found)
- Operation outcome
- Error details (if failed)

## Security Considerations

### Email Enumeration Prevention
- Generic responses for non-existent emails
- Same message format for all failure cases
- Consistent response times (no timing attacks)

### Rate Limiting
- Prevents email spam
- Protects against DoS attacks
- Uses server-side timestamp validation

### Token Security
- Cryptographically secure random tokens
- 32+ character length
- Stored in database, never exposed in logs

## Testing Checklist

- [ ] Valid email receives verification email
- [ ] Invalid email returns generic message
- [ ] Already verified email returns error
- [ ] Rate limiting works (< 5 minutes)
- [ ] Rate limiting resets after 5 minutes
- [ ] Email sending failure handled gracefully
- [ ] Logs contain no sensitive data
- [ ] Response times are consistent
- [ ] Schema validation works correctly
- [ ] Database transactions are atomic

## Related Files

- **Route**: `/srcs/backend/src/routes/auth/resend-verification.js`
- **Service**: `/srcs/backend/src/services/user.service.js` (regenerateVerificationToken method)
- **Schema**: `/srcs/backend/src/schemas/routes/auth.schema.js` (resendVerification schema)
- **Email Service**: `/srcs/backend/src/services/email.service.js`

## Future Enhancements

1. **Persistent Rate Limiting**: Use Redis for distributed rate limiting
2. **Progressive Delays**: Increase wait time with each request
3. **Admin Override**: Allow admins to bypass rate limits
4. **Email Queue**: Queue emails for better reliability
5. **Analytics**: Track verification completion rates
