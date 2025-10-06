# Two-Factor Authentication (2FA) Setup Flow

## Overview

This document explains the complete 2FA setup flow implemented in ft_transcendence, following industry-standard security practices.

## Why Verification is Critical

**Security Principle:** Never enable 2FA until you've verified the user can successfully generate valid TOTP codes.

**Why?**
- User might scan wrong QR code
- Authenticator app might not be working correctly
- User might not understand how to use the app
- **If you enable 2FA without verification, user gets locked out of their account!**

## Complete 2FA Setup Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 1: Setup Initiation                                            │
├──────────────────────────────────────────────────────────────────────┤
│ User: Navigates to /setup-2fa                                        │
│ Frontend: TwoFactorSetupPage.mount() → initiate2FASetup()           │
│ API Call: POST /auth/2fa/setup                                       │
│                                                                      │
│ Backend Processing:                                                  │
│   1. Generate secret (base32 encoded)                                │
│   2. Create QR code (otpauth:// URL encoded as base64 PNG)          │
│   3. Generate 8 backup codes                                         │
│   4. Store in database:                                              │
│      - two_factor_secret = generated_secret                          │
│      - two_factor_backup_codes = JSON array                          │
│      - two_factor_enabled = FALSE  ← Not enabled yet!               │
│                                                                      │
│ Response: { secret, qrCode, backupCodes }                            │
└──────────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 2: User Scans QR Code                                          │
├──────────────────────────────────────────────────────────────────────┤
│ Frontend: Display QR code + secret (for manual entry)                │
│ User Action:                                                          │
│   1. Opens authenticator app (Google Auth, Authy, etc.)             │
│   2. Scans QR code OR enters secret manually                         │
│   3. App adds entry: "ft_transcendence (user@email.com)"            │
│   4. App starts generating 6-digit codes every 30 seconds            │
│                                                                      │
│ Frontend: Show "I've Scanned - Verify Now" button                    │
└──────────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 3: Verification (CRITICAL!)                                    │
├──────────────────────────────────────────────────────────────────────┤
│ Frontend: Show verification form                                     │
│ User: Enters current 6-digit code from authenticator app             │
│ API Call: POST /auth/2fa/verify-setup                                │
│   Body: { token: "123456", secret: "base32secret" }                 │
│                                                                      │
│ Backend Processing:                                                  │
│   1. Use speakeasy.totp.verify() to validate token                   │
│      - Uses shared secret                                            │
│      - Current time (30-second window)                               │
│      - Allows ±60 seconds drift (window: 2)                          │
│   2. If VALID:                                                       │
│      UPDATE users SET two_factor_enabled = TRUE WHERE id = ?         │
│   3. If INVALID:                                                     │
│      Return 400 error, do NOT enable 2FA                             │
│                                                                      │
│ Response: { success: true, user: { ...twoFactorEnabled: true } }    │
└──────────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 4: Show Backup Codes                                           │
├──────────────────────────────────────────────────────────────────────┤
│ Frontend: Display success message + backup codes                     │
│ User Actions:                                                         │
│   - Copy backup codes to clipboard                                   │
│   - Save codes in password manager or safe location                  │
│   - Click "Complete Setup"                                           │
│                                                                      │
│ Frontend: Navigate to /profile                                       │
│ Result: 2FA is now ACTIVE on the account                             │
└──────────────────────────────────────────────────────────────────────┘
```

## State Flow in TwoFactorSetupPage

```typescript
type SetupStep = 
  | 'loading'          // Initial load, calling /auth/2fa/setup
  | 'show-qr'          // Display QR code and secret
  | 'verify-totp'      // User enters verification code
  | 'show-backup-codes' // Show backup codes after successful verification
  | 'error'            // Error state
```

### Step Transitions

1. **loading → show-qr**: After successfully receiving QR code from backend
2. **show-qr → verify-totp**: User clicks "I've Scanned - Verify Now"
3. **verify-totp → show-backup-codes**: Successful verification (2FA now enabled!)
4. **show-backup-codes → (redirect)**: User clicks "Complete Setup" → Navigate to /profile
5. **any → error**: Network error or API failure

## API Endpoints

### POST /auth/2fa/setup
**Purpose:** Initialize 2FA setup  
**Auth:** Required (cookie-based JWT)  
**Request:** `{}`  
**Response:**
```json
{
  "success": true,
  "message": "2FA setup initiated",
  "setupData": {
    "secret": "BASE32ENCODEDSECRET",
    "qrCode": "base64EncodedPNGimage",
    "backupCodes": ["CODE1234", "CODE5678", ...]
  }
}
```

### POST /auth/2fa/verify-setup
**Purpose:** Verify TOTP token and permanently enable 2FA  
**Auth:** Required (cookie-based JWT)  
**Request:**
```json
{
  "token": "123456",
  "secret": "BASE32ENCODEDSECRET"
}
```
**Response:**
```json
{
  "success": true,
  "message": "2FA has been successfully enabled",
  "user": {
    "id": 1,
    "username": "player",
    "twoFactorEnabled": true,
    ...
  }
}
```

## Database State Changes

### After /auth/2fa/setup
```sql
UPDATE users SET
  two_factor_secret = 'BASE32SECRET',
  two_factor_backup_codes = '["CODE1", "CODE2", ...]',
  two_factor_enabled = FALSE  -- NOT ENABLED YET!
WHERE id = ?
```

### After /auth/2fa/verify-setup (successful)
```sql
UPDATE users SET
  two_factor_enabled = TRUE  -- NOW ENABLED!
WHERE id = ?
-- Secret and backup codes remain unchanged
```

## Security Considerations

### Why Two Routes?

1. **POST /auth/2fa/setup**: Generates secrets but doesn't enable 2FA
   - Safe to call multiple times
   - User can restart setup process
   - No lockout risk

2. **POST /auth/2fa/verify-setup**: Enables 2FA permanently
   - Only succeeds if user proves they have working authenticator
   - Prevents account lockout
   - Updates user's 2FA status

### Time Synchronization

TOTP codes are time-based (30-second windows). The `window: 2` parameter allows:
- Current time window (0)
- Previous window (-1)
- Next window (+1)
- Total tolerance: ±60 seconds

This accommodates:
- Clock drift between server and authenticator
- User delay in entering code
- Network latency

## Common Issues

### Issue: User claims 2FA doesn't work after setup
**Diagnosis:** Check if `two_factor_enabled = TRUE` in database  
**Cause:** User might have skipped verification step  
**Fix:** User must complete verification to enable 2FA

### Issue: Verification always fails
**Diagnosis:** Check server time vs user device time  
**Cause:** Clock skew > 60 seconds  
**Fix:** Synchronize server time (NTP), increase window parameter

### Issue: QR code not scanning
**Diagnosis:** Check QR code contains valid `otpauth://` URL  
**Fix:** Provide manual entry option (show secret key)

## Testing Checklist

- [ ] Setup generates unique secret per user
- [ ] QR code displays correctly
- [ ] Manual secret entry works
- [ ] Valid TOTP code enables 2FA
- [ ] Invalid TOTP code returns error (doesn't enable 2FA)
- [ ] Backup codes are stored
- [ ] User object updates with `twoFactorEnabled: true`
- [ ] Multiple setup attempts work (if user restarts)
- [ ] Verification timeout handled gracefully
- [ ] Cancel button works at each step

## Related Documentation

- [2FA Login Flow](./2FA_LOGIN_FLOW.md) - How 2FA verification works during login
- [TOTP Algorithm](../../TOTP_EXPLAINED.md) - How time-based codes are generated
- [Backend 2FA Routes](../../backend/2FA_ROUTES.md) - API endpoint details
