/**
 * @brief Main pages barrel export
 * 
 * @description Central export point for all page components.
 * Provides clean imports for page-level components used by the router.
 */

// Re-export all page categories
export * from './home'
export * from './game'
export * from './profile'
export * from './settings'

// This allows imports like:
// import { HomePage, GameLobbyPage } from '@/pages'
// import { ProfilePage, SettingsPage } from '@/pages'