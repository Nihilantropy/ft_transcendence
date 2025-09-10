/**
 * @brief Authentication service logic
 * 
 * @description Barrel export for authentication-related services.
 * Handles JWT tokens, login, logout, and session management.
 */

// Authentication Services
export { AuthService, authService } from './AuthService'

// Auth Types
export type { 
  LoginCredentials, 
  RegisterCredentials,
  AuthResponse, 
  User 
} from './AuthService'

// Future authentication services (to be implemented in Phase 4)
// export { TokenManager } from './TokenManager'
// export { TwoFactorAuth } from './TwoFactorAuth'
// export { GoogleOAuth } from './GoogleOAuth'

// Auth Utilities (to be implemented in Phase B2)
// export { authGuard } from './authGuard'
// export { sessionManager } from './sessionManager'
// export { authStorage } from './authStorage'