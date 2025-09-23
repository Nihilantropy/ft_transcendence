/**
 * @brief API response and request type definitions
 * 
 * @description Types for HTTP API communication with backend services.
 * Includes request/response interfaces and error handling types.
 */

// Generic API Response Types (Active for current implementation)
export interface ApiResponse<T = any> {
  data: T
  success: boolean
  message?: string
  timestamp: number
  errorCode?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasNext: boolean
  hasPrev: boolean
}

// API Error Types (Active for current implementation)
export interface ApiError {
  code: string | number
  message: string
  details?: unknown
  field?: string
  userMessage?: string
}

// HTTP Method Types
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

// API Configuration Types (Active for current implementation)
export interface ApiConfig {
  baseUrl: string
  timeout: number
  retries: number
  headers: Record<string, string>
}

// Authentication Request Types (Active for current implementation)
export interface LoginRequest {
  identifier: string  // Can be either username or email
  password: string
  rememberMe?: boolean
  twoFactorToken?: string
}

// New simplified registration interface (no username required initially)
export interface RegisterRequest {
  email: string
  password: string
  confirmPassword: string
}

// Two-Factor Authentication API Types
export interface Setup2FARequest {
  userId: string
}

export interface Setup2FAResponse {
  secret: string
  qrCodeUrl: string
  backupCodes: string[]
  manualEntryKey: string
}

export interface Verify2FASetupRequest {
  userId: string
  token: string
  secret: string
}

export interface Verify2FARequest {
  userId: string
  token: string
  backupCode?: string
}

export interface Disable2FARequest {
  userId: string
  password: string
  token?: string
}

// Authentication Response Types
export interface AuthResponse {
  success: boolean
  user?: {
    id: string
    username: string
    email: string
    displayName?: string
    avatar?: string
    isOnline: boolean
    isVerified?: boolean
    createdAt: Date
    lastSeen?: Date
  }
  refreshToken?: string
  tokens?: {
    accessToken: string
    refreshToken: string
  }
  expiresAt?: number
  message?: string
  errorCode?: number
}

// User API Request Types
export interface UpdateUserRequest {
  displayName?: string
  email?: string
  avatar?: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

// Game API Types
export interface CreateGameRequest {
  type: 'classic' | 'tournament' | 'ai'
  settings?: {
    ballSpeed?: number
    paddleSpeed?: number
    maxScore?: number
    powerUpsEnabled?: boolean
    difficulty?: 'easy' | 'medium' | 'hard'
  }
}

export interface JoinGameRequest {
  gameId: string
}

// Common Response Status Types
export type ResponseStatus = 'success' | 'error' | 'warning' | 'info'