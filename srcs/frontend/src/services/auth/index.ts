/**
 * @brief Authentication service logic
 * 
 * @description Barrel export for authentication-related services.
 * Handles JWT tokens, login, logout, session management, and OAuth 2.0.
 */

// Authentication Services
export { AuthService, authService } from './AuthService'
export { PasswordUtils } from './PasswordUtils'
export { GoogleOAuthService, googleOAuthService } from './GoogleOAuthService'

// Auth Types (from types index)
export type { 
  LoginCredentials, 
  RegisterCredentials
} from './AuthService'

export type { 
  AuthResponse,
  User
} from '../../types'

// OAuth Types
export type {
  OAuthConfig,
  OAuthTokenResponse,
  OAuthError
} from './GoogleOAuthService'

// Password Utility Types
export type { 
  PasswordStrength, 
  PasswordValidation 
} from './PasswordUtils'

// Future authentication services
// export { TokenManager } from './TokenManager'
// export { TwoFactorAuth } from './TwoFactorAuth'

// Auth Utilities (to be implemented in Phase B2)
// export { authGuard } from './authGuard'
// export { sessionManager } from './sessionManager'
// export { authStorage } from './authStorage'