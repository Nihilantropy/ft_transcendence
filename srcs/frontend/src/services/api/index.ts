/**
 * @brief API communication services
 * 
 * @description Barrel export for HTTP API services.
 * Handles communication with backend microservices.
 */

// Base API Service
export * from './BaseApiService'

// Specific API Services
export * from '../user/UserService'
export * from './FriendsService'

// API Configuration (to be implemented in Phase B3)
// export { apiConfig } from './config'
// export { apiErrorHandler } from './errorHandler'