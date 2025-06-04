/**
 * @brief Main components barrel export
 * 
 * @description Central export point for all component categories.
 * Provides clean imports for components throughout the application.
 */

// Re-export all component categories
export * from './base'
export * from './ui'
export * from './game'
export * from './layout'

// This allows imports like:
// import { Button, Modal } from '@/components'
// import { GameContainer, Scoreboard } from '@/components'