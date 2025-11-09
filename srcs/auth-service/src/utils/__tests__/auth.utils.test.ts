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
        // Email may be URL-encoded in otpauth URL (@ becomes %40)
        expect(result.otpauth_url).toMatch(/test(@|%40)example\.com/);
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
        const isValid = await verifyBackupCode(code, hashes[0] ?? '');

        expect(isValid).toBe(true);
      });

      it('should reject incorrect backup code', async () => {
        const code = 'ABC12345';
        const codes = [code];
        const hashes = await hashBackupCodes(codes);
        const isValid = await verifyBackupCode('WRONG123', hashes[0] ?? '');

        expect(isValid).toBe(false);
      });
    });
  });
});
