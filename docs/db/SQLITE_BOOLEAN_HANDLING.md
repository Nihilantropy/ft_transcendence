# SQLite Boolean Handling

## Overview

SQLite does not have a native boolean data type. Booleans must be stored and queried as integers.

## Critical Rule

**❌ NEVER bind JavaScript boolean values to SQLite queries**
```javascript
// ❌ WRONG - Will cause error
databaseConnection.run(`UPDATE users SET two_factor_enabled = ?`, [true])
// Error: SQLite3 can only bind numbers, strings, bigints, buffers, and null

// ✅ CORRECT - Use integers
databaseConnection.run(`UPDATE users SET two_factor_enabled = ?`, [1])
```

## Boolean Representation

| JavaScript | SQLite | SQL Value |
|------------|--------|-----------|
| `true`     | `1`    | INTEGER   |
| `false`    | `0`    | INTEGER   |

## Schema Definition

In SQLite, boolean columns are defined as INTEGER with default values:

```sql
CREATE TABLE users (
    two_factor_enabled BOOLEAN DEFAULT FALSE,  -- Actually stored as 0 or 1
    email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    is_online BOOLEAN DEFAULT FALSE
);
```

Behind the scenes, SQLite treats `BOOLEAN` as `INTEGER`.

## Common Operations

### 1. INSERT with Boolean Values

```javascript
// ❌ WRONG
databaseConnection.run(
  'INSERT INTO users (username, email_verified) VALUES (?, ?)',
  ['user', true]  // Error!
)

// ✅ CORRECT
databaseConnection.run(
  'INSERT INTO users (username, email_verified) VALUES (?, ?)',
  ['user', 1]  // Use 1 for true
)
```

### 2. UPDATE with Boolean Values

```javascript
// ❌ WRONG
databaseConnection.run(
  'UPDATE users SET two_factor_enabled = ? WHERE id = ?',
  [true, userId]  // Error!
)

// ✅ CORRECT
databaseConnection.run(
  'UPDATE users SET two_factor_enabled = ? WHERE id = ?',
  [1, userId]  // Use 1 for true
)
```

### 3. SELECT with Boolean Conditions

```javascript
// ✅ CORRECT - Query using integers
const user = databaseConnection.get(
  'SELECT * FROM users WHERE email_verified = ? AND is_active = ?',
  [1, 1]  // 1 = true
)

// ✅ CORRECT - Query for false
const unverifiedUsers = databaseConnection.all(
  'SELECT * FROM users WHERE email_verified = ?',
  [0]  // 0 = false
)
```

### 4. Converting Results to JavaScript Booleans

SQLite returns integers, but you can convert them to booleans:

```javascript
const user = databaseConnection.get(
  'SELECT id, email_verified, is_active FROM users WHERE id = ?',
  [userId]
)

// Convert integers to booleans for frontend
const userResponse = {
  id: user.id,
  emailVerified: Boolean(user.email_verified),  // 1 → true, 0 → false
  isActive: Boolean(user.is_active)
}
```

### 5. Using Boolean Column Aliases

For cleaner code, use SQL aliases to convert during SELECT:

```javascript
const user = databaseConnection.get(`
  SELECT 
    id,
    username,
    email_verified as emailVerified,
    is_active as isActive,
    two_factor_enabled as twoFactorEnabled
  FROM users
  WHERE id = ?
`, [userId])

// Still need to convert if frontend expects strict booleans
user.emailVerified = Boolean(user.emailVerified)
user.isActive = Boolean(user.isActive)
user.twoFactorEnabled = Boolean(user.twoFactorEnabled)
```

## Helper Function (Optional)

You can create a helper to convert booleans automatically:

```javascript
/**
 * @brief Convert JavaScript boolean to SQLite integer
 * @param {boolean|number|null} value - Boolean or integer value
 * @return {number|null} - 1, 0, or null
 */
function toSQLiteBoolean(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return value ? 1 : 0
  return value ? 1 : 0
}

// Usage
databaseConnection.run(
  'UPDATE users SET two_factor_enabled = ?, is_active = ? WHERE id = ?',
  [
    toSQLiteBoolean(true),   // 1
    toSQLiteBoolean(false),  // 0
    userId
  ]
)
```

## Comparison Operations

SQLite boolean comparisons work with integers:

```sql
-- All these are equivalent
SELECT * FROM users WHERE email_verified = 1;
SELECT * FROM users WHERE email_verified = TRUE;
SELECT * FROM users WHERE email_verified;

-- All these are equivalent
SELECT * FROM users WHERE email_verified = 0;
SELECT * FROM users WHERE email_verified = FALSE;
SELECT * FROM users WHERE NOT email_verified;
```

## Common Pitfalls

### ❌ Binding Boolean Directly
```javascript
// Error: SQLite3 can only bind numbers, strings, bigints, buffers, and null
databaseConnection.run(
  'UPDATE users SET is_online = ?',
  [true]
)
```

### ❌ Using String 'true'/'false'
```javascript
// Will store string "true" instead of boolean, causes data corruption
databaseConnection.run(
  'UPDATE users SET two_factor_enabled = ?',
  ["true"]  // Wrong!
)
```

### ❌ Assuming JavaScript Truthy/Falsy
```javascript
// SQLite stores actual integers, not truthy/falsy
const isOnline = 2  // Truthy in JavaScript
databaseConnection.run(
  'UPDATE users SET is_online = ?',
  [isOnline]  // Will store 2, not 1! Should be: isOnline ? 1 : 0
)
```

## Checking Current Values

To see how SQLite stores your booleans:

```sql
-- View actual stored values
SELECT 
  username,
  two_factor_enabled,  -- Will show 0 or 1
  typeof(two_factor_enabled) as type  -- Will show "integer"
FROM users;
```

## Migration Checklist

When working with booleans in SQLite:

- [ ] Schema uses `BOOLEAN` type (treated as INTEGER by SQLite)
- [ ] All INSERT operations use `1` or `0` (never `true`/`false`)
- [ ] All UPDATE operations use `1` or `0` (never `true`/`false`)
- [ ] SELECT queries compare against `1` or `0`
- [ ] API responses convert integers to booleans if needed
- [ ] Documentation clarifies integer storage for booleans

## Related Files

- `/srcs/db/sql/01-schema.sql` - Boolean column definitions
- `/srcs/backend/src/database.js` - Database connection wrapper
- `/srcs/backend/src/routes/auth/2fa-verify-setup.js` - Example boolean usage

## References

- [SQLite Datatypes](https://www.sqlite.org/datatype3.html)
- [SQLite Boolean Datatype](https://www.sqlite.org/datatype3.html#boolean_datatype)
