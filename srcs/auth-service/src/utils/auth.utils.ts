/**
 * @file Auth Utilities
 * @description Password hashing, JWT generation, and validation helpers
 */

import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

const SALT_ROUNDS = 12;

// Password operations
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// 2FA operations
export function generate2FASecret(email: string): {
  secret: string;
  otpauth_url: string;
} {
  const generated = speakeasy.generateSecret({
    name: `ft_transcendence (${email})`,
    issuer: 'ft_transcendence',
    length: 32
  });

  return {
    secret: generated.base32 as string,
    otpauth_url: generated.otpauth_url as string
  };
}

export async function generate2FAQRCode(otpauth_url: string): Promise<string> {
  return QRCode.toDataURL(otpauth_url);
}

export function verify2FAToken(token: string, secret: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 2 // Allow 2 time steps before/after
  });
}

export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    codes.push(code);
  }
  return codes;
}

export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  const hashedCodes: string[] = [];
  for (const code of codes) {
    const hashed = await hashPassword(code);
    hashedCodes.push(hashed);
  }
  return hashedCodes;
}

export async function verifyBackupCode(code: string, hash: string): Promise<boolean> {
  return verifyPassword(code, hash);
}

// Random string generation
export function generateRandomString(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Email validation
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Password strength validation
export function isStrongPassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
