/**
 * @brief API communication services
 * 
 * @description Barrel export for HTTP API services.
 * Handles communication with backend microservices.
 */

// Base API Service
export { ApiService, apiService, ApiError } from './BaseApiService'

// Specific API Services
export { UserApiService, userApiService } from './UserApiService'

// TODO: Additional services to be implemented when backend services are ready
// export { AuthApiService } from './AuthApiService'      // Phase 4: Auth Service  
// export { GameApiService } from './GameApiService'      // Phase 6: Game Engine
// export { ChatApiService } from './ChatApiService'      // Phase 10: Chat Service
// export { StatsApiService } from './StatsApiService'    // Phase 11: Stats Service

// API Configuration (to be implemented in Phase B3)
// export { apiConfig } from './config'
// export { apiErrorHandler } from './errorHandler'