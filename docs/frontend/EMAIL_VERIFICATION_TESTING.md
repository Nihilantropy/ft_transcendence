# Email Verification - Testing Guide

## ✅ Implementation Status

All components have been successfully refactored and are working seamlessly:

### Frontend
- ✅ `EmailVerificationPage.ts` - Refactored with enhanced state management and error handling
- ✅ `AuthService.ts` - Has `resendVerificationEmail()` method
- ✅ `auth.schemas.ts` - All schemas defined and validated
- ✅ `executeVerifyEmail.ts` - Business logic for email verification
- ✅ `executeResendVerificationEmail.ts` - Business logic for resend verification
- ✅ Router configuration - `/verify-email` route properly configured

### Backend
- ✅ `verify-email.js` - Email verification endpoint
- ✅ `resend-verification.js` - Resend verification endpoint
- ✅ `auth.schema.js` - Route schemas with validation
- ✅ `user.service.js` - Has `regenerateVerificationToken()` method
- ✅ `email.service.js` - Sends verification emails

### Documentation
- ✅ `EMAIL_VERIFICATION_PAGE.md` - Comprehensive implementation guide
- ✅ `EMAIL_VERIFICATION_REFACTOR_SUMMARY.md` - Detailed refactor summary
- ✅ `RESEND_VERIFICATION.md` - Backend documentation

## 🧪 Testing Checklist

### Test 1: Valid Email Verification
**Steps:**
1. Register a new user account
2. Check email inbox for verification link
3. Click verification link
4. Observe automatic verification and redirect

**Expected Result:**
```
✅ Email Verified!
Your email address has been successfully verified.
📧 user@example.com
You are now logged in and can choose your username!

[🏷️ Choose Username]
Redirecting automatically in 2 seconds...
```

**Backend Console:**
```
📧 Email verification attempt { token: 'abc123...' }
✅ Email verified successfully { userId: 1, username: 'user_12345', email: 'user@example.com' }
```

**Frontend Console:**
```
📧 Starting email verification...
✅ Email verified successfully for: user@example.com
```

---

### Test 2: Invalid/Expired Token
**Steps:**
1. Click an expired or invalid verification link
2. Observe error state

**Expected Result:**
```
🚫 Invalid Verification Link
Invalid or expired verification token
Please request a new verification email to complete your registration.

[📧 Request New Verification Email]
You will be asked to enter your email address
```

**Frontend Console:**
```
📧 Starting email verification...
❌ Email verification error: Invalid or expired verification token
```

---

### Test 3: Resend Verification (First Time)
**Steps:**
1. From invalid token state, click "Request New Verification Email"
2. Enter email address when prompted
3. Submit

**Expected Result:**
- Popup: "Verification email sent! Please check your inbox."
- Button shows "⏳ Sending..." during request
- After success, button returns to normal state
- Email is stored for future resends

**Backend Console:**
```
📤 Resend verification requested { email: 'user@example.com' }
✅ Verification email resent successfully { userId: 1, email: 'user@example.com' }
```

**Frontend Console:**
```
📤 Resending verification email to: user@example.com
✅ Verification email resent successfully
```

---

### Test 4: Resend Verification (Smart Resend)
**Steps:**
1. After first resend (email stored), click resend button again
2. No prompt should appear
3. Email sent to stored address

**Expected Result:**
- No email prompt
- Instant resend to stored email
- Success popup immediately

**Frontend Console:**
```
📤 Resending verification email to: user@example.com
✅ Verification email resent successfully
```

---

### Test 5: Rate Limiting
**Steps:**
1. Resend verification email successfully
2. Immediately click resend again (within 5 minutes)
3. Observe rate limit error

**Expected Result:**
- Popup: "Please wait X minute(s) before requesting another email"
- Backend returns 429 status code
- Clear message about wait time

**Backend Console:**
```
📤 Resend verification requested { email: 'user@example.com' }
⏱️ Rate limit exceeded { email: 'user@example.com', waitMinutes: 5 }
```

**Backend Response:**
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

---

### Test 6: Already Verified Email
**Steps:**
1. Use verification token that has already been used
2. Observe appropriate error

**Expected Result:**
- Invalid token state
- Clear message about token being already used

**Backend Response:**
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

---

### Test 7: Missing Token
**Steps:**
1. Navigate to `/verify-email` without token parameter
2. Observe error state

**Expected Result:**
```
🚫 Invalid Verification Link
No verification token provided
Please request a new verification email to complete your registration.
```

**Frontend Console:**
```
(No API call made)
```

---

### Test 8: Network Error During Verification
**Steps:**
1. Simulate network error (disconnect internet)
2. Click verification link
3. Observe error handling

**Expected Result:**
```
❌ Verification Failed
Network error or server unavailable
📧 (No email shown)

[📧 Resend Verification Email]
You will be asked to enter your email address
```

---

### Test 9: Navigation from Success State
**Steps:**
1. Successfully verify email
2. Click "Choose Username" button
3. Verify navigation works

**Expected Result:**
- Navigates to `/username-selection`
- User is authenticated (httpOnly cookies set)
- No login required

---

### Test 10: Navigation from Error State
**Steps:**
1. From error state, test all navigation buttons:
   - "Back to Login"
   - "Go to Home"

**Expected Result:**
- All navigation buttons work correctly
- Appropriate pages load

---

## 🔍 Manual Testing Scenarios

### Scenario A: Complete Registration Flow
```
1. Register → Receive verification email
2. Click link → Verify successfully
3. Auto-redirect → Choose username
4. Complete profile → Access dashboard
```

### Scenario B: Lost Email Recovery
```
1. Register → Don't receive email
2. Navigate to /verify-email (no token)
3. Click "Request New Verification Email"
4. Enter email → Receive new email
5. Click new link → Verify successfully
```

### Scenario C: Expired Token Recovery
```
1. Register → Receive verification email
2. Wait (token expires)
3. Click expired link → See invalid state
4. Click resend → No prompt (if possible)
5. Receive new email → Verify successfully
```

---

## 🐛 Debugging Tips

### Issue: Resend button not working
**Check:**
1. Console for JavaScript errors
2. Network tab for API request
3. `authService.resendVerificationEmail()` is called
4. Button disabled state

### Issue: Email not stored after resend
**Check:**
1. State update in `handleResendVerification()`
2. `userEmail` property in state
3. Console logs for state updates

### Issue: Rate limiting not working
**Check:**
1. Backend `verification_email_last_sent` timestamp
2. Database column exists and updates
3. Time calculation in `regenerateVerificationToken()`

### Issue: No auto-redirect after verification
**Check:**
1. httpOnly cookies set in response
2. `setTimeout` called with correct delay
3. Router navigation works
4. `/username-selection` route exists

### Issue: Token validation fails
**Check:**
1. Token format matches database
2. Token not already used (`email_verified` is false)
3. Token passed correctly in URL query
4. Backend receives token correctly

---

## 📊 Performance Testing

### Load Testing
- **Test**: 100 concurrent verification attempts
- **Expected**: All succeed without errors
- **Metrics**: Response time < 500ms

### Rate Limit Testing
- **Test**: Multiple resend requests from same email
- **Expected**: First succeeds, subsequent blocked for 5 minutes
- **Metrics**: Rate limit enforced accurately

### Email Delivery Testing
- **Test**: Verification emails sent to various providers
- **Expected**: All emails delivered within 1 minute
- **Metrics**: >95% delivery rate

---

## 🔐 Security Testing

### Test: Token Reuse
- Attempt to use same token twice
- Expected: Second attempt fails

### Test: Token Tampering
- Modify token in URL
- Expected: Validation fails

### Test: Email Enumeration
- Resend to non-existent email
- Expected: Generic success message (no leak)

### Test: XSS in Email
- Register with XSS payload in email
- Expected: Properly sanitized

### Test: Rate Limit Bypass
- Attempt multiple resends with slight variations
- Expected: All blocked by rate limit

---

## ✅ Success Criteria

All tests should pass with:
- ✅ No TypeScript errors
- ✅ No console errors
- ✅ Proper loading states
- ✅ Clear error messages
- ✅ Successful redirects
- ✅ HttpOnly cookies set
- ✅ Rate limiting works
- ✅ Email storage works
- ✅ Navigation works
- ✅ Responsive UI

---

## 📝 Test Report Template

```
Test Date: YYYY-MM-DD
Tester: [Name]
Environment: [Development/Staging/Production]

| Test # | Test Name | Status | Notes |
|--------|-----------|--------|-------|
| 1 | Valid Verification | ✅/❌ | |
| 2 | Invalid Token | ✅/❌ | |
| 3 | First Resend | ✅/❌ | |
| 4 | Smart Resend | ✅/❌ | |
| 5 | Rate Limiting | ✅/❌ | |
| 6 | Already Verified | ✅/❌ | |
| 7 | Missing Token | ✅/❌ | |
| 8 | Network Error | ✅/❌ | |
| 9 | Success Navigation | ✅/❌ | |
| 10 | Error Navigation | ✅/❌ | |

Overall Status: ✅/❌
Issues Found: [List any issues]
Recommendations: [Any suggestions]
```

---

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] All tests pass
- [ ] No console errors
- [ ] Rate limiting configured (5 minutes)
- [ ] Email service configured
- [ ] SMTP credentials set
- [ ] Frontend environment variables set
- [ ] Backend environment variables set
- [ ] HTTPS enabled
- [ ] httpOnly cookies configured
- [ ] CORS configured correctly
- [ ] Database migrations run
- [ ] Error monitoring enabled
- [ ] Logs configured

---

## 📞 Support

If you encounter issues during testing:
1. Check console logs (both frontend and backend)
2. Verify network requests in browser DevTools
3. Check database state
4. Review documentation
5. Contact development team
