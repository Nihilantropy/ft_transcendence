# 2FA Backend Logic Flow - Visual Guide

## Complete Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          2FA SETUP & VERIFICATION FLOW                        │
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: USER INITIATES SETUP                                                │
└─────────────────────────────────────────────────────────────────────────────┘

Frontend                        Backend                         Database
   │                               │                                 │
   │  POST /auth/2fa/setup         │                                 │
   │──────────────────────────────>│                                 │
   │                               │                                 │
   │                               │ Generate TOTP secret            │
   │                               │ Generate QR code                │
   │                               │ Generate 8 backup codes         │
   │                               │                                 │
   │                               │  SELECT two_factor_enabled      │
   │                               │────────────────────────────────>│
   │                               │<────────────────────────────────│
   │                               │  Check: already enabled?        │
   │                               │                                 │
   │                               │  UPDATE users SET               │
   │                               │    two_factor_secret_tmp = ?    │
   │                               │    backup_codes_tmp = ?         │
   │                               │  WHERE id = ?                   │
   │                               │────────────────────────────────>│
   │                               │<────────────────────────────────│
   │                               │  ✅ Stored in _tmp columns      │
   │                               │                                 │
   │<──────────────────────────────│                                 │
   │  200 OK                       │                                 │
   │  {                            │                                 │
   │    secret: "BASE32...",       │                                 │
   │    qrCode: "data:image...",   │                                 │
   │    backupCodes: ["CODE1"...]  │                                 │
   │  }                            │                                 │
   │                               │                                 │

DATABASE STATE: two_factor_enabled=0, secret=NULL, secret_tmp=SET ✅

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: USER SCANS QR CODE                                                  │
└─────────────────────────────────────────────────────────────────────────────┘

Frontend
   │
   │ 1. Display QR code to user
   │ 2. User opens Google Authenticator / Authy
   │ 3. User scans QR code
   │ 4. App starts generating 6-digit codes every 30s
   │ 5. User enters code in frontend form
   │

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: USER VERIFIES TOTP TOKEN                                            │
└─────────────────────────────────────────────────────────────────────────────┘

Frontend                        Backend                         Database
   │                               │                                 │
   │  POST /auth/2fa/verify-setup  │                                 │
   │  {                            │                                 │
   │    token: "123456",           │                                 │
   │    secret: "BASE32..."        │                                 │
   │  }                            │                                 │
   │──────────────────────────────>│                                 │
   │                               │                                 │
   │                               │  SELECT                         │
   │                               │    two_factor_secret_tmp,       │
   │                               │    backup_codes_tmp,            │
   │                               │    two_factor_enabled           │
   │                               │  FROM users                     │
   │                               │  WHERE id = ?                   │
   │                               │────────────────────────────────>│
   │                               │<────────────────────────────────│
   │                               │  {                              │
   │                               │    secret_tmp: "BASE32...",     │
   │                               │    backup_codes_tmp: "[...]",   │
   │                               │    two_factor_enabled: 0        │
   │                               │  }                              │
   │                               │                                 │
   │                               │ ✅ CHECK 1: User exists?        │
   │                               │ ✅ CHECK 2: 2FA not enabled?    │
   │                               │ ✅ CHECK 3: Has _tmp data?      │
   │                               │ ✅ CHECK 4: Secret matches?     │
   │                               │    if (secret_tmp !== secret)   │
   │                               │      return 400 "Mismatch"      │
   │                               │                                 │
   │                               │ 🔐 Verify TOTP                  │
   │                               │    speakeasy.totp.verify({      │
   │                               │      secret: secret_tmp,        │
   │                               │      token: "123456"            │
   │                               │    })                           │
   │                               │                                 │
   │                               │    ✅ Valid? Continue           │
   │                               │    ❌ Invalid? Return 400       │
   │                               │                                 │
   │                               │  UPDATE users SET               │
   │                               │    two_factor_enabled = 1,      │
   │                               │    two_factor_secret = tmp,     │
   │                               │    backup_codes = tmp_codes,    │
   │                               │    two_factor_secret_tmp = NULL,│
   │                               │    backup_codes_tmp = NULL      │
   │                               │  WHERE id = ?                   │
   │                               │────────────────────────────────>│
   │                               │<────────────────────────────────│
   │                               │  ✅ 2FA ENABLED!                │
   │                               │  ✅ _tmp cleared                │
   │                               │                                 │
   │<──────────────────────────────│                                 │
   │  200 OK                       │                                 │
   │  {                            │                                 │
   │    success: true,             │                                 │
   │    user: {                    │                                 │
   │      twoFactorEnabled: true   │                                 │
   │    }                          │                                 │
   │  }                            │                                 │
   │                               │                                 │

DATABASE STATE: two_factor_enabled=1, secret=SET, secret_tmp=NULL ✅

┌─────────────────────────────────────────────────────────────────────────────┐
│ EDGE CASE: INVALID TOKEN                                                    │
└─────────────────────────────────────────────────────────────────────────────┘

Frontend                        Backend                         Database
   │                               │                                 │
   │  POST /auth/2fa/verify-setup  │                                 │
   │  { token: "999999" }          │                                 │
   │──────────────────────────────>│                                 │
   │                               │                                 │
   │                               │  Read _tmp from database        │
   │                               │  Verify TOTP with _tmp secret   │
   │                               │  ❌ Token invalid!              │
   │                               │                                 │
   │                               │  ⚠️ NO DATABASE UPDATE          │
   │                               │  ⚠️ _tmp remains unchanged      │
   │                               │  ⚠️ two_factor_enabled stays 0  │
   │                               │                                 │
   │<──────────────────────────────│                                 │
   │  400 Bad Request              │                                 │
   │  {                            │                                 │
   │    success: false,            │                                 │
   │    message: "Invalid token"   │                                 │
   │  }                            │                                 │
   │                               │                                 │

DATABASE STATE: two_factor_enabled=0, secret=NULL, secret_tmp=SET (unchanged)
User can try again with correct token ✅

┌─────────────────────────────────────────────────────────────────────────────┐
│ EDGE CASE: SECRET MANIPULATION ATTACK                                       │
└─────────────────────────────────────────────────────────────────────────────┘

Frontend                        Backend                         Database
   │                               │                                 │
   │ 1. Setup returns secret "ABC" │                                 │
   │ 2. Attacker changes to "XYZ"  │                                 │
   │                               │                                 │
   │  POST /auth/2fa/verify-setup  │                                 │
   │  {                            │                                 │
   │    token: "123456",           │                                 │
   │    secret: "XYZ" ← modified!  │                                 │
   │  }                            │                                 │
   │──────────────────────────────>│                                 │
   │                               │                                 │
   │                               │  Read secret_tmp from database  │
   │                               │    secret_tmp = "ABC"           │
   │                               │                                 │
   │                               │  Compare:                       │
   │                               │    secret_tmp ("ABC") ≠         │
   │                               │    secret ("XYZ")               │
   │                               │                                 │
   │                               │  ❌ MISMATCH DETECTED!          │
   │                               │  ⚠️ Possible attack attempt     │
   │                               │  ⚠️ NO DATABASE UPDATE          │
   │                               │                                 │
   │<──────────────────────────────│                                 │
   │  400 Bad Request              │                                 │
   │  {                            │                                 │
   │    success: false,            │                                 │
   │    message: "Invalid setup    │                                 │
   │              data. Restart."  │                                 │
   │  }                            │                                 │
   │                               │                                 │

DATABASE STATE: Unchanged, attack prevented! ✅

┌─────────────────────────────────────────────────────────────────────────────┐
│ EDGE CASE: ABANDONED SETUP                                                  │
└─────────────────────────────────────────────────────────────────────────────┘

Frontend                        Backend                         Database
   │                               │                                 │
   │  POST /auth/2fa/setup         │                                 │
   │──────────────────────────────>│                                 │
   │<──────────────────────────────│                                 │
   │  Returns QR code              │                                 │
   │                               │                                 │
   │ User navigates away           │                                 │
   │ (Never calls verify-setup)    │                                 │
   │                               │                                 │

DATABASE STATE: two_factor_enabled=0, secret=NULL, secret_tmp=SET
Status: Safe! User can restart setup later ✅

   │                               │                                 │
   │  POST /auth/2fa/setup (again) │                                 │
   │──────────────────────────────>│                                 │
   │                               │                                 │
   │                               │  UPDATE users SET               │
   │                               │    secret_tmp = new_secret      │
   │                               │  WHERE id = ?                   │
   │                               │────────────────────────────────>│
   │                               │  ✅ Old _tmp overwritten        │
   │                               │                                 │

Result: User can restart setup anytime ✅

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 4: DISABLE 2FA                                                          │
└─────────────────────────────────────────────────────────────────────────────┘

Frontend                        Backend                         Database
   │                               │                                 │
   │  POST /auth/2fa/disable       │                                 │
   │  { password: "..." }          │                                 │
   │──────────────────────────────>│                                 │
   │                               │                                 │
   │                               │  Verify password                │
   │                               │                                 │
   │                               │  UPDATE users SET               │
   │                               │    two_factor_enabled = 0,      │
   │                               │    two_factor_secret = NULL,    │
   │                               │    two_factor_secret_tmp = NULL,│
   │                               │    backup_codes = NULL,         │
   │                               │    backup_codes_tmp = NULL      │
   │                               │  WHERE id = ?                   │
   │                               │────────────────────────────────>│
   │                               │<────────────────────────────────│
   │                               │  ✅ ALL 2FA data cleared        │
   │                               │                                 │
   │<──────────────────────────────│                                 │
   │  200 OK                       │                                 │
   │                               │                                 │

DATABASE STATE: ALL 2FA columns NULL ✅
```

## Database State Transitions

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Column States During 2FA Lifecycle                                         │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ INITIAL STATE (No 2FA)                                                     │
│ ┌──────────────────────┬──────┬────────┬────────────┬──────────┬─────────┐│
│ │ State                │ En   │ Secret │ Secret_tmp │ Backup   │ Backup_ ││
│ │                      │ abled│        │            │ _codes   │ tmp     ││
│ ├──────────────────────┼──────┼────────┼────────────┼──────────┼─────────┤│
│ │ No 2FA               │  0   │  NULL  │    NULL    │   NULL   │  NULL   ││
│ └──────────────────────┴──────┴────────┴────────────┴──────────┴─────────┘│
│                                                                             │
│ AFTER POST /2fa/setup                                                       │
│ ┌──────────────────────┬──────┬────────┬────────────┬──────────┬─────────┐│
│ │ Setup In Progress    │  0   │  NULL  │    SET ✅  │   NULL   │  SET ✅ ││
│ └──────────────────────┴──────┴────────┴────────────┴──────────┴─────────┘│
│                                                                             │
│ AFTER POST /2fa/verify-setup (Success)                                     │
│ ┌──────────────────────┬──────┬────────┬────────────┬──────────┬─────────┐│
│ │ 2FA Active           │  1   │  SET ✅│    NULL    │   SET ✅ │  NULL   ││
│ └──────────────────────┴──────┴────────┴────────────┴──────────┴─────────┘│
│                                                                             │
│ AFTER POST /2fa/disable                                                     │
│ ┌──────────────────────┬──────┬────────┬────────────┬──────────┬─────────┐│
│ │ 2FA Disabled         │  0   │  NULL  │    NULL    │   NULL   │  NULL   ││
│ └──────────────────────┴──────┴────────┴────────────┴──────────┴─────────┘│
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

## Security Validation Checklist

### Setup Phase (/2fa/setup)
- [x] Generates cryptographically secure secret
- [x] Stores secret in two_factor_secret_tmp (not permanent column)
- [x] Stores backup codes in backup_codes_tmp (not permanent column)
- [x] Does NOT enable 2FA yet (two_factor_enabled stays 0)
- [x] Returns secret to frontend (needed for QR code display)
- [x] Allows multiple setup attempts (overwrites _tmp each time)

### Verification Phase (/2fa/verify-setup)
- [x] Reads secret from database _tmp column (not from request)
- [x] Compares request secret with database secret (integrity check)
- [x] Rejects if secrets don't match (prevents manipulation)
- [x] Uses database secret for TOTP verification (not request secret)
- [x] Only enables 2FA if TOTP is valid
- [x] Moves _tmp data to permanent columns atomically
- [x] Clears _tmp columns after success
- [x] Preserves backup codes (doesn't lose them)
- [x] Returns 400 on invalid token (doesn't enable 2FA)

### Disable Phase (/2fa/disable)
- [x] Requires password confirmation
- [x] Clears all permanent 2FA columns
- [x] Clears all _tmp columns
- [x] Sets two_factor_enabled to 0
- [x] Uses transaction for atomicity

## Why This Design?

### 1. Temporary Columns Pattern
**Problem:** What if user starts setup but never completes?  
**Solution:** Use _tmp columns that don't affect production state

**Benefits:**
- Safe rollback: Failed verification doesn't corrupt permanent data
- Restart capability: User can abandon and restart setup
- Audit trail: Can track setup attempts vs completions
- Data integrity: Frontend can't manipulate server-side secrets

### 2. Secret Integrity Validation
**Problem:** Frontend receives secret, sends it back - could be modified  
**Solution:** Always verify frontend secret matches database secret

**Attack Scenario Prevented:**
```javascript
// Attacker intercepts response from /setup
// Changes secret from "ABC" to "XYZ"
// Generates TOTP code using "XYZ"
// Sends { token: "...", secret: "XYZ" }

// Backend compares:
if (database_secret_tmp !== request_secret) {
  // "ABC" !== "XYZ" → ATTACK DETECTED!
  return 400 "Invalid setup data"
}
```

### 3. Atomic State Transitions
**Problem:** What if UPDATE succeeds but SELECT fails?  
**Solution:** Single UPDATE moves all _tmp → permanent atomically

```sql
-- ✅ GOOD: Single atomic operation
UPDATE users SET 
  two_factor_secret = two_factor_secret_tmp,
  backup_codes = backup_codes_tmp,
  two_factor_secret_tmp = NULL,
  backup_codes_tmp = NULL,
  two_factor_enabled = 1
WHERE id = ?

-- ❌ BAD: Multiple queries, not atomic
UPDATE users SET two_factor_secret = ? WHERE id = ?
UPDATE users SET backup_codes = ? WHERE id = ?
UPDATE users SET two_factor_enabled = 1 WHERE id = ?
-- What if query 2 fails? Partial state!
```

## Logging & Monitoring

Key log messages to monitor:

```javascript
// Normal flow
'🔐 Starting 2FA setup'           // User initiated setup
'✅ 2FA setup data generated'     // _tmp stored successfully
'🔐 Verifying 2FA setup'          // User submitted token
'✅ 2FA setup completed'          // Verification succeeded

// Error cases
'⚠️ 2FA already enabled'          // User has 2FA active
'⚠️ No 2FA setup in progress'     // Missing _tmp data
'⚠️ Secret mismatch'              // SECURITY: Possible attack!
'⚠️ Invalid 2FA token'            // Wrong TOTP code
```

**Alert on:** Multiple "Secret mismatch" logs from same user (possible attack)

## Related Files

- `/srcs/backend/src/routes/auth/2fa-setup.js`
- `/srcs/backend/src/routes/auth/2fa-verify-setup.js`
- `/srcs/backend/src/routes/auth/2fa-disable.js`
- `/srcs/db/sql/01-schema.sql`
- `/docs/backend/2FA_SECURITY_ANALYSIS.md`
- `/docs/backend/2FA_REVIEW_SUMMARY.md`
