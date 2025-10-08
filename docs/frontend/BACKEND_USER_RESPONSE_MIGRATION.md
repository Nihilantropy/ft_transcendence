# Frontend Migration Guide - Backend User Response Changes

**Date:** October 8, 2025  
**Impact:** Field name standardization in backend auth responses

---

## ⚠️ **Breaking Changes**

The backend now returns consistent **camelCase** field names in all authentication responses.

---

## 🔄 **Field Name Changes**

| Old Field Name | New Field Name | Type | Notes |
|----------------|----------------|------|-------|
| `email_verified` | `emailVerified` | boolean | Consistent camelCase |
| `is_online` | `isOnline` | boolean | Consistent camelCase |
| `two_factor_enabled` | `twoFactorEnabled` | boolean | Consistent camelCase |
| `avatar_url` | `avatar` | string \| null | Shorter, cleaner name |

---

## 📝 **TypeScript Interface Update**

### **Before (Inconsistent)**

```typescript
// ❌ Old - had inconsistent naming
interface User {
  id: number;
  username: string;
  email: string;
  email_verified?: boolean;      // Snake case
  emailVerified?: boolean;        // Camel case (some endpoints)
  avatar?: string | null;
  avatar_url?: string;            // Different field name
  is_online?: boolean;            // Snake case
  isOnline?: boolean;             // Camel case (some endpoints)
  two_factor_enabled?: boolean;   // Snake case
  twoFactorEnabled?: boolean;     // Camel case (some endpoints)
}
```

---

### **After (Consistent)**

```typescript
// ✅ New - consistent camelCase everywhere
interface AuthUser {
  id: number;
  username: string;
  email: string;
  emailVerified: boolean;      // Always camelCase
  avatar: string | null;       // Always this name
  isOnline: boolean;           // Always camelCase
  twoFactorEnabled: boolean;   // Always camelCase
}
```

---

## 🔍 **Where to Update Frontend**

### **1. TypeScript Interfaces**

**File:** `/srcs/frontend/src/services/auth/schemas/auth.schemas.ts`

```typescript
// Update your AuthUser interface
export interface AuthUser {
  id: number;
  username: string;
  email: string;
  emailVerified: boolean;      // ✅ Changed from email_verified
  avatar: string | null;       // ✅ Changed from avatar_url
  isOnline: boolean;           // ✅ Changed from is_online
  twoFactorEnabled: boolean;   // ✅ Changed from two_factor_enabled
}
```

---

### **2. Zod Schemas**

**File:** `/srcs/frontend/src/services/auth/schemas/auth.schemas.ts`

```typescript
// Update your Zod validation schemas
export const AuthUserSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().email(),
  emailVerified: z.boolean(),      // ✅ Changed
  avatar: z.string().nullable(),   // ✅ Changed
  isOnline: z.boolean(),           // ✅ Changed
  twoFactorEnabled: z.boolean()    // ✅ Changed
});
```

---

### **3. Component Code**

Search for these patterns and update:

```typescript
// ❌ Old patterns to find and replace:
user.email_verified
user.is_online
user.two_factor_enabled
user.avatar_url

// ✅ New patterns:
user.emailVerified
user.isOnline
user.twoFactorEnabled
user.avatar
```

---

### **4. Store/State Management**

**File:** `/srcs/frontend/src/stores/auth.store.ts`

```typescript
// Update auth store
interface AuthState {
  user: AuthUser | null;
  // ... other state
}

// Update any mapping functions
function mapUserFromAPI(apiUser: any): AuthUser {
  return {
    id: apiUser.id,
    username: apiUser.username,
    email: apiUser.email,
    emailVerified: apiUser.emailVerified,  // ✅ No more mapping needed!
    avatar: apiUser.avatar,
    isOnline: apiUser.isOnline,
    twoFactorEnabled: apiUser.twoFactorEnabled
  };
}
```

---

## 🔧 **Find & Replace Commands**

### **VS Code Global Search & Replace**

```
Find:    \.email_verified
Replace: .emailVerified

Find:    \.is_online
Replace: .isOnline

Find:    \.two_factor_enabled
Replace: .twoFactorEnabled

Find:    \.avatar_url
Replace: .avatar
```

### **Or Use Grep to Find Files**

```bash
# Find all TypeScript files that might need updating
cd srcs/frontend
grep -r "email_verified" src/ --include="*.ts" --include="*.tsx"
grep -r "is_online" src/ --include="*.ts" --include="*.tsx"
grep -r "two_factor_enabled" src/ --include="*.ts" --include="*.tsx"
grep -r "avatar_url" src/ --include="*.ts" --include="*.tsx"
```

---

## 📋 **Affected API Endpoints**

All these endpoints now return consistent user objects:

- ✅ `POST /api/auth/login`
- ✅ `POST /api/auth/register`
- ✅ `POST /api/auth/2fa/verify`
- ✅ `POST /api/auth/2fa/verify-setup`
- ✅ `POST /api/auth/2fa/disable`
- ✅ `GET /api/auth/verify-email`
- ✅ `POST /api/auth/oauth/google/callback`

---

## ✅ **Migration Checklist**

### **Step 1: Update Type Definitions**
- [ ] Update `AuthUser` interface in auth schemas
- [ ] Update Zod schemas if using validation
- [ ] Update any other user type definitions

### **Step 2: Update Component Code**
- [ ] Search for `email_verified` and replace with `emailVerified`
- [ ] Search for `is_online` and replace with `isOnline`
- [ ] Search for `two_factor_enabled` and replace with `twoFactorEnabled`
- [ ] Search for `avatar_url` and replace with `avatar`

### **Step 3: Update Store/State**
- [ ] Update auth store interface
- [ ] Update any mapping functions
- [ ] Remove any field name conversions (no longer needed!)

### **Step 4: Update Components**
- [ ] Navbar (shows username, avatar, online status)
- [ ] Profile page (shows all user fields)
- [ ] Settings page (shows 2FA status, email verification)
- [ ] Email verification banner (checks emailVerified)
- [ ] Any other components using user data

### **Step 5: Test**
- [ ] Test login flow
- [ ] Test registration flow
- [ ] Test 2FA flow
- [ ] Test email verification
- [ ] Test profile display
- [ ] Check browser console for errors

---

## 🎯 **Example Component Updates**

### **Email Verification Banner**

```typescript
// ❌ Before
{!user.email_verified && (
  <Banner>Please verify your email</Banner>
)}

// ✅ After
{!user.emailVerified && (
  <Banner>Please verify your email</Banner>
)}
```

---

### **Online Status Indicator**

```typescript
// ❌ Before
<StatusDot active={user.is_online} />

// ✅ After
<StatusDot active={user.isOnline} />
```

---

### **2FA Badge**

```typescript
// ❌ Before
{user.two_factor_enabled && (
  <Badge>2FA Enabled</Badge>
)}

// ✅ After
{user.twoFactorEnabled && (
  <Badge>2FA Enabled</Badge>
)}
```

---

### **Avatar Display**

```typescript
// ❌ Before
<Avatar src={user.avatar_url || '/default-avatar.png'} />

// ✅ After
<Avatar src={user.avatar || '/default-avatar.png'} />
```

---

## 🐛 **Bug Fixes You Get**

### **1. Avatar Always Has Correct Value**

**Before:**
```typescript
// Some endpoints returned null even when user had avatar
user.avatar = null  // ❌ Bug!
```

**After:**
```typescript
// All endpoints now return actual avatar URL
user.avatar = "https://example.com/avatar.jpg"  // ✅ Fixed!
user.avatar = null  // Only when user has no avatar
```

---

### **2. Consistent Field Names**

**Before:**
```typescript
// Had to handle both variations
if (response.data.email_verified || response.data.emailVerified) {
  // Show verified badge
}
```

**After:**
```typescript
// Always the same field name
if (response.data.emailVerified) {
  // Show verified badge
}
```

---

## 📊 **Testing Strategy**

### **Unit Tests**

```typescript
describe('AuthUser', () => {
  it('should have camelCase field names', () => {
    const user: AuthUser = {
      id: 1,
      username: 'test',
      email: 'test@example.com',
      emailVerified: true,      // ✅ camelCase
      avatar: null,
      isOnline: true,           // ✅ camelCase
      twoFactorEnabled: false   // ✅ camelCase
    };
    
    expect(user.emailVerified).toBeDefined();
    expect(user.isOnline).toBeDefined();
    expect(user.twoFactorEnabled).toBeDefined();
  });
});
```

### **Integration Tests**

```typescript
describe('Login API', () => {
  it('should return user with camelCase fields', async () => {
    const response = await authService.login('test', 'password');
    
    expect(response.user).toMatchObject({
      id: expect.any(Number),
      username: expect.any(String),
      emailVerified: expect.any(Boolean),
      isOnline: expect.any(Boolean),
      twoFactorEnabled: expect.any(Boolean)
    });
  });
});
```

---

## ⚡ **Quick Migration (5 Minutes)**

If you're in a hurry, here's the fastest way:

```bash
# 1. Update TypeScript interface (1 min)
# Edit: srcs/frontend/src/services/auth/schemas/auth.schemas.ts
# Change: email_verified → emailVerified, etc.

# 2. Global find/replace (2 min)
# VS Code: Ctrl+Shift+H
# Find: \.email_verified → Replace: .emailVerified
# Find: \.is_online → Replace: .isOnline
# Find: \.two_factor_enabled → Replace: .twoFactorEnabled
# Find: \.avatar_url → Replace: .avatar

# 3. Test login (2 min)
# Start frontend, try logging in
# Check console for errors
```

---

## 🎊 **Benefits After Migration**

- ✅ **Consistency:** All endpoints use same field names
- ✅ **Type Safety:** TypeScript interfaces match backend exactly
- ✅ **No Mapping:** No need to convert field names
- ✅ **Cleaner Code:** No more checking both field name variations
- ✅ **Bug Fix:** Avatar always has correct value
- ✅ **Maintainability:** Single source of truth for field names

---

## 📞 **Need Help?**

If you encounter issues during migration:

1. **Check browser console** for TypeScript errors
2. **Check network tab** to see actual API responses
3. **Verify field names** in API response match your code
4. **Test one endpoint at a time** (start with login)

---

**Status:** Migration guide ready  
**Estimated Time:** 5-15 minutes  
**Difficulty:** Easy (mostly find/replace)  
**Breaking Changes:** Field names only (same data)
