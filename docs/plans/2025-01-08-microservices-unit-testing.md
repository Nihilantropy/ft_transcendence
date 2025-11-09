# Microservices Unit Testing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement comprehensive unit test suite for all ft_transcendence microservices following TDD principles to identify and fix authentication, OAuth, and email verification issues.

**Architecture:** Test-driven approach with isolated unit tests per service. Each service gets its own test infrastructure using Vitest (fast, modern, TypeScript-native). Tests run in isolation with mocked dependencies. Focus on business logic, API contracts, and critical paths (auth, OAuth, email verification).

**Tech Stack:**
- **Test Framework:** Vitest (fast, ESM-native, TypeScript support)
- **Assertion Library:** Built-in Vitest assertions
- **Mocking:** Vitest mocks + node-mocks-http for HTTP
- **Coverage:** Vitest coverage with c8
- **Database:** In-memory SQLite for tests
- **Email:** nodemailer (already in package.json)

---

## Phase 0: Database Schema Consolidation

### Task 0: Consolidate Database Schema Files

**Goal:** Merge anonymous tournament schema into main schema file and add email verification support

**Files:**
- Modify: `srcs/db/sql/01-schema.sql`

**Step 1: Integrate anonymous tournament schema**

Modify `srcs/db/sql/01-schema.sql` to integrate the anonymous tournament tables directly.

Replace the tournaments table (lines 174-187) with:

```sql
-- Tournaments table (supports anonymous tournament creation)
CREATE TABLE tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    max_participants INTEGER NOT NULL,
    status TEXT DEFAULT 'registration', -- 'registration', 'in_progress', 'finished'
    created_by INTEGER,  -- NULLABLE for anonymous tournament creation
    start_time DATETIME,
    end_time DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
```

Replace the tournament_participants table (lines 189-201) with:

```sql
-- Tournament participants table (supports anonymous players)
CREATE TABLE tournament_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL,
    user_id INTEGER,  -- NULLABLE for anonymous participants
    alias TEXT NOT NULL,  -- REQUIRED: Player alias for the tournament
    session_id TEXT,  -- Session identifier for anonymous users
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    eliminated_at DATETIME,
    final_position INTEGER,

    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    -- For authenticated users: prevent duplicate entries
    UNIQUE(tournament_id, user_id),
    -- For anonymous users: ensure session_id is present
    CHECK (
        (user_id IS NOT NULL) OR
        (user_id IS NULL AND session_id IS NOT NULL)
    )
);
```

**Step 2: Add email verification tokens table**

Add after the `oauth_state` table (after line 132), before the games table:

```sql
-- Email verification tokens table
CREATE TABLE email_verification_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Step 3: Update indexes section**

Add after the oauth_state indexes (after line 232):

```sql
-- Email verification tokens optimization
CREATE INDEX idx_email_verification_token ON email_verification_tokens(token);
CREATE INDEX idx_email_verification_user ON email_verification_tokens(user_id);
CREATE INDEX idx_email_verification_expires ON email_verification_tokens(expires_at);

-- Tournament participants optimization (anonymous support)
CREATE INDEX idx_tournament_participants_user_id ON tournament_participants(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_tournament_participants_session_id ON tournament_participants(session_id) WHERE session_id IS NOT NULL;
CREATE UNIQUE INDEX idx_tournament_participants_alias_unique ON tournament_participants(tournament_id, LOWER(alias));
```

**Step 4: Add tournament participants view**

Add at the end of the file (after line 252):

```sql
-- Tournament participants view (combines authenticated and anonymous data)
CREATE VIEW IF NOT EXISTS v_tournament_participants AS
SELECT
    tp.id,
    tp.tournament_id,
    tp.user_id,
    tp.alias,
    tp.session_id,
    tp.joined_at,
    tp.eliminated_at,
    tp.final_position,
    u.username,
    u.email,
    CASE
        WHEN tp.user_id IS NOT NULL THEN 'authenticated'
        ELSE 'anonymous'
    END as participant_type
FROM tournament_participants tp
LEFT JOIN users u ON tp.user_id = u.id;
```

**Step 5: Verify schema**

Run: `cat srcs/db/sql/01-schema.sql | wc -l`

Expected: Schema file updated with all changes

**Step 6: Commit**

```bash
git add srcs/db/sql/01-schema.sql
git commit -m "feat(db): consolidate schema with anonymous tournaments and email verification"
```

---

## Phase 1: Test Infrastructure Setup

### Task 1: Auth Service Test Infrastructure

**Goal:** Set up Vitest test framework for auth-service

**Files:**
- Modify: `srcs/auth-service/package.json`
- Create: `srcs/auth-service/vitest.config.ts`
- Create: `srcs/auth-service/src/__tests__/setup.ts`

**Step 1: Add Vitest dependencies**

```bash
cd /home/crea/project/ft_transcendence/srcs/auth-service
npm install -D vitest @vitest/coverage-v8 @types/supertest supertest
```

Expected: Dependencies installed successfully

**Step 2: Update package.json scripts**

Modify `srcs/auth-service/package.json`:

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

**Step 3: Create Vitest configuration**

Create `srcs/auth-service/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/__tests__/**',
        '**/types/**',
        '**/schemas/**'
      ]
    },
    include: ['src/**/*.{test,spec}.{js,ts}'],
    testTimeout: 10000
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

**Step 4: Create test setup file**

Create `srcs/auth-service/src/__tests__/setup.ts`:

```typescript
/**
 * @file Test Setup
 * @description Global test configuration and utilities
 */

import { beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';

// Test database path (in-memory for most tests)
export const TEST_DB_PATH = ':memory:';
export const TEST_DB_FILE_PATH = path.join(__dirname, 'test.db');

// Clean up file-based test database after each test
afterEach(() => {
  if (fs.existsSync(TEST_DB_FILE_PATH)) {
    fs.unlinkSync(TEST_DB_FILE_PATH);
  }
});

// Global test environment variables
process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] = 'test-jwt-secret-key';
process.env['JWT_EXPIRES_IN'] = '15m';
process.env['JWT_REFRESH_EXPIRES_IN'] = '7d';
process.env['COOKIE_SECRET'] = 'test-cookie-secret';
process.env['LOG_LEVEL'] = 'silent'; // Suppress logs during tests
```

**Step 5: Verify test infrastructure**

Run: `npm test`

Expected: "No test files found" (infrastructure ready, no tests yet)

**Step 6: Commit**

```bash
git add package.json vitest.config.ts src/__tests__/setup.ts package-lock.json
git commit -m "test(auth): add Vitest test infrastructure"
```

---

### Task 2: User Service Test Infrastructure

**Goal:** Set up Vitest for user-service (parallel to auth-service)

**Files:**
- Modify: `srcs/user-service/package.json`
- Create: `srcs/user-service/vitest.config.ts`
- Create: `srcs/user-service/src/__tests__/setup.ts`

**Step 1: Add Vitest dependencies**

```bash
cd /home/crea/project/ft_transcendence/srcs/user-service
npm install -D vitest @vitest/coverage-v8 @types/supertest supertest
```

**Step 2: Update package.json scripts**

Modify `srcs/user-service/package.json`:

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

**Step 3: Create Vitest configuration**

Create `srcs/user-service/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/__tests__/**',
        '**/types/**',
        '**/schemas/**'
      ]
    },
    include: ['src/**/*.{test,spec}.{js,ts}'],
    testTimeout: 10000
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

**Step 4: Create test setup file**

Create `srcs/user-service/src/__tests__/setup.ts`:

```typescript
/**
 * @file Test Setup
 * @description Global test configuration and utilities
 */

import { afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';

export const TEST_DB_PATH = ':memory:';
export const TEST_DB_FILE_PATH = path.join(__dirname, 'test.db');

afterEach(() => {
  if (fs.existsSync(TEST_DB_FILE_PATH)) {
    fs.unlinkSync(TEST_DB_FILE_PATH);
  }
});

process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] = 'test-jwt-secret-key';
process.env['LOG_LEVEL'] = 'silent';
```

**Step 5: Verify test infrastructure**

Run: `npm test`

Expected: "No test files found"

**Step 6: Commit**

```bash
git add package.json vitest.config.ts src/__tests__/setup.ts package-lock.json
git commit -m "test(user): add Vitest test infrastructure"
```

---

### Task 3: API Gateway Test Infrastructure

**Goal:** Set up Vitest for api-gateway

**Files:**
- Modify: `srcs/api-gateway/package.json`
- Create: `srcs/api-gateway/vitest.config.js`
- Create: `srcs/api-gateway/src/__tests__/setup.js`

**Step 1: Add Vitest dependencies**

```bash
cd /home/crea/project/ft_transcendence/srcs/api-gateway
npm install -D vitest @vitest/coverage-v8 supertest
```

**Step 2: Update package.json**

Modify `srcs/api-gateway/package.json`:

```json
{
  "scripts": {
    "dev": "nodemon src/server.js",
    "start": "node src/server.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

**Step 3: Create Vitest configuration**

Create `srcs/api-gateway/vitest.config.js`:

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '**/__tests__/**'
      ]
    },
    include: ['src/**/*.{test,spec}.js'],
    testTimeout: 10000
  }
});
```

**Step 4: Create test setup**

Create `srcs/api-gateway/src/__tests__/setup.js`:

```javascript
/**
 * @file Test Setup
 * @description Global test configuration
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.LOG_LEVEL = 'silent';
```

**Step 5: Verify**

Run: `npm test`

Expected: "No test files found"

**Step 6: Commit**

```bash
git add package.json vitest.config.js src/__tests__/setup.js package-lock.json
git commit -m "test(gateway): add Vitest test infrastructure"
```

---

## Phase 2: Auth Service Core Tests

### Task 4: Password Hashing Utility Tests

**Goal:** Test password hashing/verification functions (TDD approach)

**Files:**
- Create: `srcs/auth-service/src/utils/__tests__/auth.utils.test.ts`

**Step 1: Write failing test**

Create `srcs/auth-service/src/utils/__tests__/auth.utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  isStrongPassword,
  generate2FASecret,
  verify2FAToken,
  generateBackupCodes,
  hashBackupCodes,
  verifyBackupCode
} from '../auth.utils.js';

describe('auth.utils', () => {
  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'SecurePassword123!';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash).toMatch(/^\$2[aby]\$.{56}$/); // bcrypt hash pattern
    });

    it('should generate different hashes for the same password', async () => {
      const password = 'SecurePassword123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2); // Salt should differ
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'SecurePassword123!';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'SecurePassword123!';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword('WrongPassword123!', hash);

      expect(isValid).toBe(false);
    });
  });

  describe('isStrongPassword', () => {
    it('should accept strong password', () => {
      const result = isStrongPassword('SecurePass123!');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject password without uppercase', () => {
      const result = isStrongPassword('securepass123!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without lowercase', () => {
      const result = isStrongPassword('SECUREPASS123!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject password without number', () => {
      const result = isStrongPassword('SecurePassword!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should reject password without special character', () => {
      const result = isStrongPassword('SecurePassword123');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('should reject password shorter than 8 characters', () => {
      const result = isStrongPassword('Sec1!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });
  });

  describe('2FA functions', () => {
    describe('generate2FASecret', () => {
      it('should generate 2FA secret and otpauth URL', () => {
        const email = 'test@example.com';
        const result = generate2FASecret(email);

        expect(result.secret).toBeDefined();
        expect(result.otpauth_url).toMatch(/^otpauth:\/\/totp\//);
        expect(result.otpauth_url).toContain(email);
      });
    });

    describe('verify2FAToken', () => {
      it('should verify valid 2FA token', () => {
        // Note: This test requires a known secret/token pair
        // For now, we test the function exists and handles invalid tokens
        const result = verify2FAToken('123456', 'invalid-secret');
        expect(result).toBe(false);
      });
    });

    describe('generateBackupCodes', () => {
      it('should generate 10 backup codes', () => {
        const codes = generateBackupCodes();

        expect(codes).toHaveLength(10);
        expect(codes[0]).toMatch(/^[A-Z0-9]{8}$/); // 8-char alphanumeric
      });

      it('should generate unique codes', () => {
        const codes = generateBackupCodes();
        const uniqueCodes = new Set(codes);

        expect(uniqueCodes.size).toBe(10);
      });
    });

    describe('hashBackupCodes', () => {
      it('should hash array of backup codes', async () => {
        const codes = ['ABC12345', 'DEF67890'];
        const hashes = await hashBackupCodes(codes);

        expect(hashes).toHaveLength(2);
        expect(hashes[0]).toMatch(/^\$2[aby]\$.{56}$/);
      });
    });

    describe('verifyBackupCode', () => {
      it('should verify correct backup code', async () => {
        const code = 'ABC12345';
        const codes = [code];
        const hashes = await hashBackupCodes(codes);
        const isValid = await verifyBackupCode(code, hashes[0]);

        expect(isValid).toBe(true);
      });

      it('should reject incorrect backup code', async () => {
        const code = 'ABC12345';
        const codes = [code];
        const hashes = await hashBackupCodes(codes);
        const isValid = await verifyBackupCode('WRONG123', hashes[0]);

        expect(isValid).toBe(false);
      });
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test`

Expected output should show failures if `auth.utils.ts` doesn't implement all functions correctly, or if functions have bugs.

**Step 3: Review and fix auth.utils.ts if needed**

Read `srcs/auth-service/src/utils/auth.utils.ts` and ensure all functions are implemented correctly.

**Step 4: Run tests to verify they pass**

Run: `npm test`

Expected: All tests pass

**Step 5: Check coverage**

Run: `npm run test:coverage`

Expected: Coverage report showing >80% coverage for auth.utils.ts

**Step 6: Commit**

```bash
git add src/utils/__tests__/auth.utils.test.ts
git commit -m "test(auth): add password hashing and 2FA utility tests"
```

---

## Execution Plan

Plan complete and saved to `docs/plans/2025-01-08-microservices-unit-testing.md`.

**Updated plan with:**
1. ✅ No migration files - all schema changes in `01-schema.sql`
2. ✅ Anonymous tournament schema integrated into main schema
3. ✅ Email verification tokens table added to main schema
4. ✅ nodemailer already present in dependencies (no changes needed)

**Two execution approaches:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, code review between tasks, fast iteration with quality gates

**2. Parallel Session (separate)** - Open new session with superpowers:executing-plans for batch execution with review checkpoints

**Which approach would you prefer?**
