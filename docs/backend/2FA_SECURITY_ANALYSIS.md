# 2FA Setup Security Analysis & Fixes

## Overview

This document details the security vulnerabilities found in the 2FA setup flow and the implemented fixes.

## Critical Issues Found

### Issue 1: ❌ Secret Exposure (FIXED)

**Original Vulnerable Flow:**
```javascript
// 1. POST /2fa/setup - Store secret in _tmp
UPDATE users SET two_factor_secret_tmp = ? WHERE id = ?

// 2. Return secret to frontend
return { secret: secret.base32 }

// 3. Frontend stores in sessionStorage
sessionStorage.setItem('ft_2fa_setup_secret', secret)

// 4. POST /2fa/verify-setup - Frontend sends secret back
{ token: "123456", secret: "BASE32SECRET" }

// 5. Backend trusts frontend secret (VULNERABLE!)
UPDATE users SET two_factor_secret = ? WHERE id = ?
```

**Security Problems:**
1. Secret exposed in HTTP response body
2. Secret stored in browser sessionStorage (vulnerable to XSS)
3. Backend trusts secret from frontend (can be manipulated)
4. _tmp columns never read (pointless storage)

**Fixed Secure Flow:**
```javascript
// 1. POST /2fa/setup - Store secret in _tmp only
UPDATE users SET 
  two_factor_secret_tmp = ?,
  backup_codes_tmp = ?
WHERE id = ?

// 2. Still return secret to frontend (needed for QR code)
// But backend will IGNORE this secret during verification

// 3. POST /2fa/verify-setup - Verify secret integrity
const user = db.get('SELECT two_factor_secret_tmp FROM users WHERE id = ?')

// Integrity check: frontend secret must match database
if (user.two_factor_secret_tmp !== secret) {
  return error('Invalid setup data')
}

// 4. Move _tmp to permanent columns
UPDATE users SET 
  two_factor_secret = two_factor_secret_tmp,
  backup_codes = backup_codes_tmp,
  two_factor_secret_tmp = NULL,
  backup_codes_tmp = NULL,
  two_factor_enabled = 1
WHERE id = ?
```

### Issue 2: ❌ Backup Codes Lost (FIXED)

**Original Problem:**
```javascript
// Setup stored backup codes in _tmp
UPDATE users SET backup_codes_tmp = ? WHERE id = ?

// Verify-setup IGNORED _tmp, lost backup codes!
UPDATE users SET 
  two_factor_secret = ?,  // Only updated secret
  two_factor_enabled = 1
WHERE id = ?
// Result: backup_codes column stays NULL!
```

**Fixed:**
```javascript
// Verify-setup now moves ALL _tmp data to permanent columns
UPDATE users SET 
  two_factor_secret = two_factor_secret_tmp,
  backup_codes = backup_codes_tmp,  // ✅ Now preserved!
  two_factor_secret_tmp = NULL,
  backup_codes_tmp = NULL,
  two_factor_enabled = 1
WHERE id = ?
```

### Issue 3: ❌ _tmp Columns Never Cleaned (FIXED)

**Original Problem:**
- Setup stores in _tmp columns
- Verify-setup never reads or clears them
- User cancels setup → _tmp data persists forever
- Disable 2FA → _tmp data remains

**Fixed:**
```javascript
// verify-setup.js - Clear _tmp after successful verification
UPDATE users SET 
  two_factor_secret_tmp = NULL,
  backup_codes_tmp = NULL
WHERE id = ?

// 2fa-disable.js - Clear ALL 2FA data including _tmp
UPDATE users SET 
  two_factor_enabled = 0,
  two_factor_secret = NULL,
  two_factor_secret_tmp = NULL,      // ✅ Added
  backup_codes = NULL,
  backup_codes_tmp = NULL            // ✅ Added
WHERE id = ?
```

## Database Schema

```sql
CREATE TABLE users (
    -- Permanent 2FA columns (active when two_factor_enabled = 1)
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret TEXT,
    backup_codes TEXT,
    
    -- Temporary 2FA columns (during setup, before verification)
    two_factor_secret_tmp TEXT,
    backup_codes_tmp TEXT,
    
    -- Other columns...
);
```

## State Machine

### 2FA Setup States

| State | two_factor_enabled | two_factor_secret | two_factor_secret_tmp | Description |
|-------|-------------------|-------------------|----------------------|-------------|
| **No 2FA** | 0 | NULL | NULL | Initial state |
| **Setup In Progress** | 0 | NULL | SET | User scanning QR |
| **Setup Complete** | 1 | SET | NULL | 2FA active |
| **Setup Abandoned** | 0 | NULL | SET | User left setup |

### State Transitions

```
┌─────────────┐
│   No 2FA    │ two_factor_enabled=0, secret=NULL, secret_tmp=NULL
└──────┬──────┘
       │ POST /2fa/setup
       │ Store in _tmp columns
       ↓
┌─────────────┐
│   Setup     │ two_factor_enabled=0, secret=NULL, secret_tmp=SET
│ In Progress │
└──────┬──────┘
       │ POST /2fa/verify-setup (success)
       │ Move _tmp → permanent, clear _tmp
       ↓
┌─────────────┐
│   Active    │ two_factor_enabled=1, secret=SET, secret_tmp=NULL
│    2FA      │
└──────┬──────┘
       │ POST /2fa/disable
       │ Clear all columns
       ↓
┌─────────────┐
│   No 2FA    │ Back to initial state
└─────────────┘
```

## Security Best Practices Implemented

### 1. ✅ Source of Truth: Database

**Principle:** Backend database is always the source of truth, never trust frontend data blindly.

```javascript
// ❌ BAD: Trust frontend secret
const { secret } = request.body
UPDATE users SET two_factor_secret = ? WHERE id = ?

// ✅ GOOD: Verify frontend secret matches database
const user = db.get('SELECT two_factor_secret_tmp FROM users WHERE id = ?')
if (user.two_factor_secret_tmp !== secret) {
  throw error('Secret mismatch')
}
UPDATE users SET two_factor_secret = two_factor_secret_tmp WHERE id = ?
```

### 2. ✅ Atomic State Transitions

**Principle:** State changes must be atomic (all or nothing).

```javascript
// ✅ GOOD: Single UPDATE moves ALL _tmp data atomically
UPDATE users SET 
  two_factor_secret = two_factor_secret_tmp,
  backup_codes = backup_codes_tmp,
  two_factor_secret_tmp = NULL,
  backup_codes_tmp = NULL,
  two_factor_enabled = 1
WHERE id = ?
```

### 3. ✅ Cleanup Temporary Data

**Principle:** Always clean up temporary data after use or cancellation.

```javascript
// Success case: Move _tmp to permanent, then clear _tmp
// Disable case: Clear ALL columns including _tmp
// Abandoned setup: _tmp remains (user can restart)
```

### 4. ✅ Integrity Checks

**Principle:** Verify data integrity before critical operations.

```javascript
// Check 1: User exists
if (!user) return error('User not found')

// Check 2: Setup in progress
if (!user.two_factor_secret_tmp) return error('No setup in progress')

// Check 3: 2FA not already enabled
if (user.two_factor_enabled) return error('2FA already enabled')

// Check 4: Secret integrity
if (user.two_factor_secret_tmp !== secret) return error('Secret mismatch')

// Only then: Verify TOTP and enable
```

## API Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ CLIENT                    SERVER                     DATABASE    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ POST /2fa/setup                                                   │
│ ─────────────────────────►                                       │
│                           Generate secret                         │
│                           Generate QR code                        │
│                           Generate backup codes                   │
│                           ─────────────────────────►              │
│                           UPDATE users SET                        │
│                             two_factor_secret_tmp = secret        │
│                             backup_codes_tmp = codes              │
│                           ◄─────────────────────────              │
│ ◄─────────────────────────                                       │
│ { secret, qrCode, backupCodes }                                  │
│                                                                   │
│ [User scans QR code]                                             │
│ [User enters 6-digit code]                                       │
│                                                                   │
│ POST /2fa/verify-setup                                           │
│ { token: "123456", secret }                                      │
│ ─────────────────────────►                                       │
│                           ─────────────────────────►              │
│                           SELECT two_factor_secret_tmp            │
│                           FROM users WHERE id = ?                 │
│                           ◄─────────────────────────              │
│                           Verify: secret matches tmp              │
│                           Verify: TOTP token valid                │
│                           ─────────────────────────►              │
│                           UPDATE users SET                        │
│                             two_factor_secret = tmp,              │
│                             backup_codes = tmp_codes,             │
│                             two_factor_secret_tmp = NULL,         │
│                             backup_codes_tmp = NULL,              │
│                             two_factor_enabled = 1                │
│                           ◄─────────────────────────              │
│ ◄─────────────────────────                                       │
│ { success: true, user }                                          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Testing Checklist

### Setup Flow
- [ ] Setup stores secret in two_factor_secret_tmp
- [ ] Setup stores backup codes in backup_codes_tmp
- [ ] Setup does NOT set two_factor_enabled
- [ ] Setup returns QR code and backup codes to frontend
- [ ] Multiple setup calls overwrite previous _tmp data

### Verify-Setup Flow
- [ ] Verify-setup reads secret from two_factor_secret_tmp
- [ ] Verify-setup compares frontend secret with database secret
- [ ] Secret mismatch returns 400 error
- [ ] Invalid TOTP returns 400 error (does NOT enable 2FA)
- [ ] Valid TOTP moves _tmp → permanent columns
- [ ] Valid TOTP clears _tmp columns
- [ ] Valid TOTP sets two_factor_enabled = 1
- [ ] backup_codes are preserved (not lost)

### Disable Flow
- [ ] Disable clears two_factor_secret
- [ ] Disable clears backup_codes
- [ ] Disable clears two_factor_secret_tmp
- [ ] Disable clears backup_codes_tmp
- [ ] Disable sets two_factor_enabled = 0

### Edge Cases
- [ ] User starts setup, never verifies → _tmp data persists (safe)
- [ ] User starts setup multiple times → _tmp overwritten each time
- [ ] User completes setup → _tmp columns are NULL
- [ ] User disables 2FA → ALL 2FA columns are NULL
- [ ] User tries to verify with wrong secret → Error, no state change
- [ ] User tries to verify after disabling → Error, no _tmp data

## Migration Guide

If you have existing users with 2FA enabled from the old vulnerable code:

### Step 1: Audit Existing Data
```sql
-- Check users with 2FA enabled
SELECT id, username, 
       two_factor_enabled,
       two_factor_secret IS NOT NULL as has_secret,
       backup_codes IS NOT NULL as has_backup_codes,
       two_factor_secret_tmp IS NOT NULL as has_tmp_secret,
       backup_codes_tmp IS NOT NULL as has_tmp_backup
FROM users
WHERE two_factor_enabled = 1;
```

### Step 2: Clean Up Orphaned _tmp Data
```sql
-- Clear any _tmp data for users with active 2FA
UPDATE users
SET two_factor_secret_tmp = NULL,
    backup_codes_tmp = NULL
WHERE two_factor_enabled = 1;
```

### Step 3: Fix Users Missing Backup Codes
Users who completed setup with old code might have:
- two_factor_enabled = 1
- two_factor_secret = SET
- backup_codes = NULL (LOST!)

**Options:**
1. **Force Re-setup:** Disable their 2FA, make them set up again
2. **Generate New Backup Codes:** Create endpoint to regenerate codes

```javascript
// Option 2: Add regenerate-backup-codes endpoint
fastify.post('/2fa/regenerate-backup-codes', {
  preHandler: requireAuth
}, async (request, reply) => {
  const userId = request.user.id
  
  // Verify user has 2FA enabled
  const user = db.get('SELECT two_factor_enabled FROM users WHERE id = ?', [userId])
  if (!user.two_factor_enabled) {
    return { success: false, message: '2FA not enabled' }
  }
  
  // Generate new backup codes
  const backupCodes = generateBackupCodes()
  
  db.run('UPDATE users SET backup_codes = ? WHERE id = ?', 
    [JSON.stringify(backupCodes), userId]
  )
  
  return { success: true, backupCodes }
})
```

## Related Files

- `/srcs/backend/src/routes/auth/2fa-setup.js` - Setup route
- `/srcs/backend/src/routes/auth/2fa-verify-setup.js` - Verification route
- `/srcs/backend/src/routes/auth/2fa-disable.js` - Disable route
- `/srcs/db/sql/01-schema.sql` - Database schema
- `/docs/frontend/2FA_SETUP_FLOW.md` - Frontend flow documentation

## Conclusion

The fixes implement a secure 2FA setup flow that:
1. ✅ Uses database as source of truth
2. ✅ Validates data integrity
3. ✅ Preserves backup codes
4. ✅ Cleans up temporary data
5. ✅ Prevents secret manipulation
6. ✅ Follows atomic state transitions

The temporary columns pattern provides:
- **Rollback capability:** Failed verification doesn't corrupt permanent data
- **Restart capability:** User can abandon and restart setup
- **Audit trail:** Can track setup attempts vs completions
- **Integrity validation:** Can verify frontend data matches backend expectations
