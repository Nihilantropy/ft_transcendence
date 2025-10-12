# Frontend Password Reset Implementation

## 📋 Overview

Complete frontend implementation for forgot/reset password flow with:
- ✅ Zod schema validation for requests/responses
- ✅ Business logic separation (execute functions)
- ✅ Type-safe API calls
- ✅ Error handling
- ✅ Backend alignment

---

## 🔄 Flow Diagram

```
User Forgot Password
         ↓
Enter email on /forgot-password page
         ↓
Frontend validates email (Zod)
         ↓
POST /api/auth/forgot-password { email }
         ↓
Backend sends email with reset link
         ↓
Frontend shows success message
         ↓
User clicks link in email
         ↓
Frontend: /reset-password?token=...
         ↓
User enters new password
         ↓
Frontend validates passwords (Zod)
  - Match check
  - Complexity check (uppercase, lowercase, number)
         ↓
POST /api/auth/reset-password { token, newPassword, confirmPassword }
         ↓
Backend validates token & updates password
         ↓
Frontend redirects to /login
         ↓
User logs in with new password
```

---

## 📁 Files Created/Modified

### 1. **Schemas** (`auth.schemas.ts`)

Added 3 new schemas:

```typescript
// Request schema for forgot password
PasswordResetEmailSchema: {
  email: string (email format)
}

// Request schema for reset password
ResetPasswordRequestSchema: {
  token: string (32-64 chars)
  newPassword: string (8-128 chars, complexity rules)
  confirmPassword: string (must match newPassword)
}

// Response schema for reset password
ResetPasswordResponseSchema: {
  success: boolean
  message: string
}
```

**Password Complexity Rules:**
- Minimum 8 characters
- Maximum 128 characters
- Must contain uppercase letter
- Must contain lowercase letter
- Must contain number

### 2. **Business Logic Files**

#### `executeForgotPassword.ts`
```typescript
/**
 * @brief Execute forgot password request
 * @param email - User email
 * @param endpoint - API endpoint (default: /auth/forgot-password)
 * @return Promise<SuccessResponse>
 */
export async function executeForgotPassword(
  email: string,
  endpoint?: string
): Promise<SuccessResponse>
```

**Features:**
- ✅ Validates email with Zod
- ✅ Makes POST request to backend
- ✅ Validates response format
- ✅ Returns typed response

#### `executeResetPassword.ts`
```typescript
/**
 * @brief Execute password reset with token
 * @param token - Reset token from email
 * @param newPassword - New password
 * @param confirmPassword - Password confirmation
 * @param endpoint - API endpoint (default: /auth/reset-password)
 * @return Promise<ResetPasswordResponse>
 */
export async function executeResetPassword(
  token: string,
  newPassword: string,
  confirmPassword: string,
  endpoint?: string
): Promise<ResetPasswordResponse>
```

**Features:**
- ✅ Validates all inputs with Zod
- ✅ Checks passwords match
- ✅ Validates password complexity
- ✅ Makes POST request to backend
- ✅ Validates response format
- ✅ Returns typed response

### 3. **AuthService Methods**

#### `forgotPassword()`
```typescript
/**
 * @brief Request password reset
 * @param email - User email address
 * @return Promise<{ success: boolean; message: string }>
 */
public async forgotPassword(email: string): Promise<{ 
  success: boolean; 
  message: string 
}>
```

#### `resetPassword()`
```typescript
/**
 * @brief Reset password with token
 * @param token - Password reset token from email
 * @param newPassword - New password
 * @param confirmPassword - Password confirmation
 * @return Promise<{ success: boolean; message: string }>
 */
public async resetPassword(
  token: string,
  newPassword: string,
  confirmPassword: string
): Promise<{ success: boolean; message: string }>
```

#### `requestPasswordReset()` (Deprecated)
```typescript
/**
 * @brief Backward compatibility alias for forgotPassword
 * @deprecated Use forgotPassword() instead
 */
public async requestPasswordReset(email: string): Promise<{ 
  success: boolean; 
  message: string 
}>
```

---

## 🔒 Validation

### Frontend Validation (Zod)

**Email Validation:**
```typescript
z.string().email('Valid email required')
```

**Token Validation:**
```typescript
z.string()
  .min(32, "Invalid reset token")
  .max(64, "Invalid reset token")
```

**Password Validation:**
```typescript
z.string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password too long")
  .refine((password) => {
    const hasUpperCase = /[A-Z]/.test(password)
    const hasLowerCase = /[a-z]/.test(password)
    const hasNumber = /\d/.test(password)
    return hasUpperCase && hasLowerCase && hasNumber
  }, {
    message: "Password must contain uppercase, lowercase, and number"
  })
```

**Password Match Validation:**
```typescript
.refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
})
```

---

## 🧪 Usage Examples

### Forgot Password Page

```typescript
import { authService } from '@/services/auth/AuthService'
import { showPopup } from '@/utils/popup'

async function handleForgotPassword(event: Event) {
  event.preventDefault()
  
  const emailInput = document.querySelector('#email') as HTMLInputElement
  const email = emailInput.value.trim()
  
  try {
    const result = await authService.forgotPassword(email)
    
    if (result.success) {
      showPopup('✅ ' + result.message, 'success')
      // Optionally redirect to login
      router.navigate('/login')
    }
  } catch (error) {
    const message = error instanceof Error 
      ? error.message 
      : 'Failed to request password reset'
    showPopup('❌ ' + message, 'error')
  }
}
```

### Reset Password Page

```typescript
import { authService } from '@/services/auth/AuthService'
import { showPopup } from '@/utils/popup'

async function handleResetPassword(event: Event) {
  event.preventDefault()
  
  // Get token from URL
  const params = new URLSearchParams(window.location.search)
  const token = params.get('token')
  
  if (!token) {
    showPopup('❌ Invalid reset link', 'error')
    return
  }
  
  const newPasswordInput = document.querySelector('#newPassword') as HTMLInputElement
  const confirmPasswordInput = document.querySelector('#confirmPassword') as HTMLInputElement
  
  const newPassword = newPasswordInput.value
  const confirmPassword = confirmPasswordInput.value
  
  try {
    const result = await authService.resetPassword(token, newPassword, confirmPassword)
    
    if (result.success) {
      showPopup('✅ ' + result.message, 'success')
      // Redirect to login
      setTimeout(() => {
        router.navigate('/login')
      }, 2000)
    }
  } catch (error) {
    const message = error instanceof Error 
      ? error.message 
      : 'Failed to reset password'
    showPopup('❌ ' + message, 'error')
  }
}
```

---

## 🔍 Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| Invalid email | Email format incorrect | Check email format |
| Validation failed | Password too short/weak | Use stronger password |
| Passwords don't match | Mismatch in confirmation | Re-enter passwords |
| Invalid reset token | Token expired/invalid | Request new reset |
| Failed to request reset | Network/server error | Try again later |

### Error Examples

**Frontend Validation Errors:**
```typescript
// Email validation
"Invalid email: Valid email required"

// Password too short
"Validation failed: Password must be at least 8 characters"

// Password complexity
"Validation failed: Password must contain uppercase, lowercase, and number"

// Passwords don't match
"Validation failed: Passwords don't match"

// Invalid token
"Validation failed: Invalid reset token"
```

**Backend Errors:**
```typescript
// Token expired
"Invalid or expired reset token"

// Network error
"Failed to reset password"
```

---

## 📊 Backend Alignment

### Request/Response Compatibility

✅ **Frontend matches backend perfectly:**

| Backend Schema | Frontend Schema | Status |
|----------------|-----------------|--------|
| `ForgotPasswordRequest` | `PasswordResetEmailSchema` | ✅ Aligned |
| `ForgotPasswordResponse` | `SuccessResponseSchema` | ✅ Aligned |
| `ResetPasswordRequest` | `ResetPasswordRequestSchema` | ✅ Aligned |
| `ResetPasswordResponse` | `ResetPasswordResponseSchema` | ✅ Aligned |

### Backend Endpoints

```typescript
POST /api/auth/forgot-password
Body: { email: string }
Response: { success: boolean, message: string }

POST /api/auth/reset-password
Body: { token: string, newPassword: string, confirmPassword: string }
Response: { success: boolean, message: string }
```

---

## ✅ Validation Checklist

### Forgot Password
- [x] Email format validation (Zod)
- [x] API endpoint correct (`/auth/forgot-password`)
- [x] Request schema matches backend
- [x] Response schema matches backend
- [x] Error handling implemented
- [x] Success message shown
- [x] Type safety (TypeScript)

### Reset Password
- [x] Token validation (length 32-64)
- [x] Password strength validation
- [x] Password match validation
- [x] API endpoint correct (`/auth/reset-password`)
- [x] Request schema matches backend
- [x] Response schema matches backend
- [x] Error handling implemented
- [x] Success message shown
- [x] Redirect to login after success
- [x] Type safety (TypeScript)

### Code Quality
- [x] Separation of concerns (execute functions)
- [x] Reusable business logic
- [x] Proper error handling
- [x] Console logging for debugging
- [x] TypeScript types exported
- [x] JSDoc documentation
- [x] Backward compatibility (requestPasswordReset alias)

---

## 🚀 Testing

### Manual Test: Forgot Password

1. Navigate to `/forgot-password`
2. Enter registered email
3. Submit form
4. Check console for logs
5. Verify success message
6. Check backend logs for email sent

### Manual Test: Reset Password

1. Get reset token from backend console logs
2. Navigate to `/reset-password?token=YOUR_TOKEN`
3. Enter new password (must meet complexity rules)
4. Enter matching confirmation
5. Submit form
6. Verify success message
7. Verify redirect to login
8. Try logging in with new password

### Edge Cases to Test

- ✅ Invalid email format
- ✅ Password too short (< 8 chars)
- ✅ Password without uppercase
- ✅ Password without lowercase
- ✅ Password without number
- ✅ Passwords don't match
- ✅ Expired/invalid token
- ✅ Network error handling

---

## 📝 Notes

- All validation happens on both frontend (UX) and backend (security)
- Passwords are hashed on backend before storage
- Reset tokens expire after 1 hour
- Email service works in console mode for development
- Frontend schemas use Zod for runtime validation
- Backend schemas use Fastify/JSON Schema for validation
- Type safety ensures frontend/backend compatibility
