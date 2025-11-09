import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseService } from '../database.service.js';
import { hashPassword } from '../../utils/auth.utils.js';
import fs from 'fs';
import path from 'path';

describe('DatabaseService - User Operations', () => {
  let db: DatabaseService;
  let testDbPath: string;

  beforeEach(() => {
    // Use in-memory database for tests (faster and isolated)
    testDbPath = ':memory:';

    db = new DatabaseService(testDbPath);

    // Initialize schema - path goes up to srcs/ then to db/sql
    const schemaPath = path.join(__dirname, '../../../../db/sql/01-schema.sql');
    let schema = fs.readFileSync(schemaPath, 'utf-8');

    // Fix duplicate index issue in schema (temporary workaround)
    schema = schema.replace(/CREATE INDEX /g, 'CREATE INDEX IF NOT EXISTS ');

    // Execute entire schema at once (better-sqlite3 handles multi-statement)
    db['db'].exec(schema);
  });

  afterEach(() => {
    db.close();
  });

  describe('createUser', () => {
    it('should create user with password', async () => {
      const passwordHash = await hashPassword('SecurePass123!');
      const user = db.createUser({
        username: 'testuser',
        email: 'test@example.com',
        password_hash: passwordHash
      });

      expect(user.id).toBeDefined();
      expect(user.username).toBe('testuser');
      expect(user.email).toBe('test@example.com');
      expect(user.password_hash).toBe(passwordHash);
      expect(user.email_verified).toBeFalsy(); // SQLite returns 0 for false
    });

    it('should create user with Google OAuth', () => {
      const user = db.createUser({
        username: 'googleuser',
        email: 'google@example.com',
        google_id: 'google-123'
      });

      expect(user.id).toBeDefined();
      expect(user.username).toBe('googleuser');
      expect(user.google_id).toBe('google-123');
      expect(user.email_verified).toBeTruthy(); // Auto-verified for OAuth (SQLite returns 1 for true)
      expect(user.password_hash).toBeNull();
    });

    it('should throw error on duplicate email', () => {
      db.createUser({
        username: 'user1',
        email: 'duplicate@example.com'
      });

      expect(() => {
        db.createUser({
          username: 'user2',
          email: 'duplicate@example.com'
        });
      }).toThrow();
    });

    it('should throw error on duplicate username', () => {
      db.createUser({
        username: 'duplicateuser',
        email: 'user1@example.com'
      });

      expect(() => {
        db.createUser({
          username: 'duplicateuser',
          email: 'user2@example.com'
        });
      }).toThrow();
    });
  });

  describe('findUserByEmail', () => {
    it('should find existing user by email', () => {
      const created = db.createUser({
        username: 'findme',
        email: 'findme@example.com'
      });

      const found = db.findUserByEmail('findme@example.com');

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.email).toBe('findme@example.com');
    });

    it('should return undefined for non-existent email', () => {
      const found = db.findUserByEmail('nonexistent@example.com');
      expect(found).toBeUndefined();
    });
  });

  describe('findUserByIdentifier', () => {
    beforeEach(() => {
      db.createUser({
        username: 'identuser',
        email: 'ident@example.com'
      });
    });

    it('should find user by email', () => {
      const found = db.findUserByIdentifier('ident@example.com');
      expect(found).toBeDefined();
      expect(found?.username).toBe('identuser');
    });

    it('should find user by username', () => {
      const found = db.findUserByIdentifier('identuser');
      expect(found).toBeDefined();
      expect(found?.email).toBe('ident@example.com');
    });

    it('should return undefined for non-existent identifier', () => {
      const found = db.findUserByIdentifier('nonexistent');
      expect(found).toBeUndefined();
    });
  });

  describe('findUserById', () => {
    it('should find existing user by ID', () => {
      const created = db.createUser({
        username: 'iduser',
        email: 'id@example.com'
      });

      const found = db.findUserById(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.username).toBe('iduser');
    });

    it('should return undefined for non-existent ID', () => {
      const found = db.findUserById(99999);
      expect(found).toBeUndefined();
    });
  });

  describe('findUserByGoogleId', () => {
    it('should find user by Google ID', () => {
      const created = db.createUser({
        username: 'googleuser',
        email: 'google@example.com',
        google_id: 'google-456'
      });

      const found = db.findUserByGoogleId('google-456');

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.google_id).toBe('google-456');
    });

    it('should return undefined for non-existent Google ID', () => {
      const found = db.findUserByGoogleId('nonexistent-google-id');
      expect(found).toBeUndefined();
    });
  });

  describe('updateUser', () => {
    it('should update user fields', () => {
      const user = db.createUser({
        username: 'updateme',
        email: 'update@example.com'
      });

      db.updateUser(user.id, {
        email_verified: true // SQLite uses 1 for true
      });

      const updated = db.findUserById(user.id);
      expect(updated?.email_verified).toBeTruthy();
    });

    it('should handle partial updates', () => {
      const user = db.createUser({
        username: 'partial',
        email: 'partial@example.com'
      });

      const updated = db.findUserById(user.id);
      expect(updated?.email).toBe('partial@example.com'); // Unchanged
    });

    it('should handle empty updates gracefully', () => {
      const user = db.createUser({
        username: 'noupdate',
        email: 'noupdate@example.com'
      });

      db.updateUser(user.id, {});

      const updated = db.findUserById(user.id);
      expect(updated).toBeDefined();
    });
  });
});

describe('DatabaseService - 2FA Operations', () => {
  let db: DatabaseService;
  let testDbPath: string;
  let testUserId: number;

  beforeEach(() => {
    // Use in-memory database for tests (faster and isolated)
    testDbPath = ':memory:';

    db = new DatabaseService(testDbPath);

    // Initialize schema - path goes up to srcs/ then to db/sql
    const schemaPath = path.join(__dirname, '../../../../db/sql/01-schema.sql');
    let schema = fs.readFileSync(schemaPath, 'utf-8');

    // Fix duplicate index issue in schema (temporary workaround)
    schema = schema.replace(/CREATE INDEX /g, 'CREATE INDEX IF NOT EXISTS ');

    // Execute entire schema at once (better-sqlite3 handles multi-statement)
    db['db'].exec(schema);

    // Create test user
    const user = db.createUser({
      username: '2fauser',
      email: '2fa@example.com'
    });
    testUserId = user.id;
  });

  afterEach(() => {
    db.close();
  });

  describe('enable2FA', () => {
    it('should enable 2FA with secret and backup codes', () => {
      const secret = 'TEST2FASECRET123456';
      const backupCodes = JSON.stringify(['BACKUP1', 'BACKUP2']);

      db.enable2FA(testUserId, secret, backupCodes);

      const user = db.findUserById(testUserId);
      expect(user?.two_factor_enabled).toBeTruthy();
      expect(user?.two_factor_secret).toBe(secret);
      expect(user?.backup_codes).toBe(backupCodes);
      expect(user?.two_factor_secret_tmp).toBeNull();
    });

    it('should enable 2FA without backup codes', () => {
      const secret = 'TEST2FASECRET123456';

      db.enable2FA(testUserId, secret);

      const user = db.findUserById(testUserId);
      expect(user?.two_factor_enabled).toBeTruthy();
      expect(user?.two_factor_secret).toBe(secret);
      expect(user?.backup_codes).toBeNull();
    });
  });

  describe('disable2FA', () => {
    it('should disable 2FA and clear secrets', () => {
      // First enable 2FA
      db.enable2FA(testUserId, 'SECRET123', JSON.stringify(['CODE1']));

      // Then disable it
      db.disable2FA(testUserId);

      const user = db.findUserById(testUserId);
      expect(user?.two_factor_enabled).toBeFalsy();
      expect(user?.two_factor_secret).toBeNull();
      expect(user?.backup_codes).toBeNull();
    });
  });

  describe('saveTempBackupCodes', () => {
    it('should save temporary backup codes', () => {
      const tempCodes = JSON.stringify(['TEMP1', 'TEMP2']);

      db.saveTempBackupCodes(testUserId, tempCodes);

      const user = db.findUserById(testUserId);
      expect(user?.backup_codes_tmp).toBe(tempCodes);
    });
  });

  describe('useBackupCode', () => {
    it('should remove used backup code', async () => {
      const backupCodes = ['HASH1', 'HASH2', 'HASH3'];
      db.enable2FA(testUserId, 'SECRET', JSON.stringify(backupCodes));

      const result = db.useBackupCode(testUserId, 'HASH2');

      expect(result).toBe(true);

      const user = db.findUserById(testUserId);
      const remaining = JSON.parse(user?.backup_codes as string);
      expect(remaining).toHaveLength(2);
      expect(remaining).not.toContain('HASH2');
      expect(remaining).toContain('HASH1');
      expect(remaining).toContain('HASH3');
    });

    it('should return false for non-existent code', () => {
      db.enable2FA(testUserId, 'SECRET', JSON.stringify(['HASH1']));

      const result = db.useBackupCode(testUserId, 'NONEXISTENT');

      expect(result).toBe(false);
    });

    it('should return false for user without backup codes', () => {
      const result = db.useBackupCode(testUserId, 'ANYCODE');
      expect(result).toBe(false);
    });
  });
});

describe('DatabaseService - OAuth State Management', () => {
  let db: DatabaseService;
  let testDbPath: string;

  beforeEach(() => {
    testDbPath = ':memory:';

    db = new DatabaseService(testDbPath);

    const schemaPath = path.join(__dirname, '../../../../db/sql/01-schema.sql');
    let schema = fs.readFileSync(schemaPath, 'utf-8');

    // Fix duplicate index issue in schema (temporary workaround)
    schema = schema.replace(/CREATE INDEX /g, 'CREATE INDEX IF NOT EXISTS ');

    db['db'].exec(schema);
  });

  afterEach(() => {
    db.close();
  });

  describe('saveOAuthState', () => {
    it('should save OAuth state without user ID', () => {
      const state = 'test-state-123';

      db.saveOAuthState(state);

      const isValid = db.validateOAuthState(state);
      expect(isValid).toBe(true);
    });

    it('should save OAuth state with user ID', () => {
      const user = db.createUser({
        username: 'oauthuser',
        email: 'oauth@example.com'
      });
      const state = 'test-state-456';

      db.saveOAuthState(state, user.id);

      const isValid = db.validateOAuthState(state);
      expect(isValid).toBe(true);
    });
  });

  describe('validateOAuthState', () => {
    it('should validate existing non-expired state', () => {
      const state = 'valid-state';
      db.saveOAuthState(state);

      const isValid = db.validateOAuthState(state);
      expect(isValid).toBe(true);
    });

    it('should reject non-existent state', () => {
      const isValid = db.validateOAuthState('nonexistent-state');
      expect(isValid).toBe(false);
    });

    it('should reject expired state', () => {
      const state = 'expired-state';
      db.saveOAuthState(state);

      // Manually expire the state
      db['db'].exec(`
        UPDATE oauth_state
        SET expires_at = datetime('now', '-1 hour')
        WHERE state = '${state}'
      `);

      const isValid = db.validateOAuthState(state);
      expect(isValid).toBe(false);
    });
  });

  describe('deleteOAuthState', () => {
    it('should delete OAuth state', () => {
      const state = 'delete-me';
      db.saveOAuthState(state);

      db.deleteOAuthState(state);

      const isValid = db.validateOAuthState(state);
      expect(isValid).toBe(false);
    });
  });

  describe('cleanupExpiredStates', () => {
    it('should remove expired states', () => {
      const validState = 'valid-state';
      const expiredState = 'expired-state';

      db.saveOAuthState(validState);
      db.saveOAuthState(expiredState);

      // Expire one state
      db['db'].exec(`
        UPDATE oauth_state
        SET expires_at = datetime('now', '-1 hour')
        WHERE state = '${expiredState}'
      `);

      db.cleanupExpiredStates();

      expect(db.validateOAuthState(validState)).toBe(true);
      expect(db.validateOAuthState(expiredState)).toBe(false);
    });
  });
});
