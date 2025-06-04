/**
 * @brief Main services barrel export
 * 
 * @description Central export point for all service categories.
 * Provides clean imports for business logic throughout the application.
 */

// Re-export all service categories
export * from './api'
export * from './auth'
export * from './game'
export * from './websocket'

// This allows imports like:
// import { AuthService, GameService } from '@/services'
// import { WebSocketManager, ApiService } from '@/services'