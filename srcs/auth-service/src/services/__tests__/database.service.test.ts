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
        email_verified: 1, // SQLite uses 1 for true
        is_online: 1
      });

      const updated = db.findUserById(user.id);
      expect(updated?.email_verified).toBeTruthy();
      expect(updated?.is_online).toBeTruthy();
    });

    it('should handle partial updates', () => {
      const user = db.createUser({
        username: 'partial',
        email: 'partial@example.com'
      });

      db.updateUser(user.id, { is_online: 1 }); // SQLite uses 1 for true

      const updated = db.findUserById(user.id);
      expect(updated?.is_online).toBeTruthy();
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
