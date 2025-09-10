/**
 * @brief Main assets barrel export
 * 
 * @description Central export point for all static assets.
 * Provides clean imports for images, fonts, and icons throughout the application.
 */

// Re-export all asset categories
export * from './images'

// This allows imports like:
// import { logo, HomeIcon, orbitronBold } from '@/assets'