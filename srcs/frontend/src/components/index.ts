/**
 * @brief Main components barrel export
 * 
 * @description Central export point for all component categories.
 * Provides clean imports for components throughout the application.
 * Phase A3 Point 1 - Base Component system ready.
 */

// Re-export all component categories
export * from './base'
export * from './ui'
export * from './game'
export * from './layout'

// This allows imports like:
// import { Component } from '@/components'
// import { Button, Modal } from '@/components' (when implemented)
// import { GameContainer, Scoreboard } from '@/components' (when implemented)