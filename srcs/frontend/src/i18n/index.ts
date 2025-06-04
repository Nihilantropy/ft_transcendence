/**
 * @brief Main i18n barrel export
 * 
 * @description Central export point for internationalization system.
 * Provides clean imports for i18n functionality throughout the application.
 */

// Re-export i18n components
export * from './i18n'
export * from './types'

// Translation files will be imported dynamically in Phase C1
// This allows imports like:
// import { i18n, SupportedLocale } from '@/i18n'