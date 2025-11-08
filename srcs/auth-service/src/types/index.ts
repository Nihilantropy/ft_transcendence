/**
 * @file Type definitions for Auth Service
 * @description Centralized TypeScript types and interfaces
 */

import { FastifyRequest } from 'fastify';

// User types
export interface User {
  id: number;
  username: string;
  email: string;
  password_hash?: string;
  display_name?: string;
  avatar_url?: string;
  status: 'online' | 'offline' | 'in_game';
  two_factor_enabled: boolean;
  two_factor_secret?: string;
  two_factor_secret_tmp?: string;
  backup_codes?: string;
  backup_codes_tmp?: string;
  google_id?: string;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

// JWT payload
export interface JWTPayload {
  id: number;
  username: string;
  email: string;
}

// Request types with JWT
export interface AuthenticatedRequest extends FastifyRequest {
  user: JWTPayload;
}

// Login request body
export interface LoginBody {
  identifier: string;  // Changed from 'email' to 'identifier'
  password: string;
  twoFactorCode?: string;
}

// Register request body
export interface RegisterBody {
  username: string;
  email: string;
  password: string;
}

// OAuth callback query
export interface OAuthCallbackQuery {
  code: string;
  state: string;
}

// 2FA setup response
export interface TwoFactorSetupResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

// Auth response
export interface AuthResponse {
  user: Omit<User, 'password_hash' | 'two_factor_secret'>;
  accessToken: string;
  refreshToken: string;
}

// Error response
export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}
