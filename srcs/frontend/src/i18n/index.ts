/**
 * @brief Main i18n barrel export for ft_transcendence
 * 
 * @description Central export point for internationalization system.
 * Provides clean imports for i18n functionality throughout the application.
 * 
 * Phase C1 implementation - Complete i18n Core System
 */

// Export main I18n class and singleton instance
export { I18n, i18n } from './i18n'

// Export all TypeScript type definitions
export type {
  SupportedLocale,
  LocaleInfo,
  TranslationKey,
  FlatTranslation,
  Translation,
  I18nConfig,
  TranslationParams,
  TranslationFunction,
  LocaleChangeListener,
  I18nComponentProps,
  I18nHookReturn,
  TranslationLoadingState,
  LanguageSwitcherProps,
  PluralizationRule,
  I18nDateFormatOptions,
  I18nNumberFormatOptions,
  TranslationValidationResult,
  I18nError
} from './types'

// Export enums and constants
export { I18nErrorType, LOCALE_INFO, DEFAULT_I18N_CONFIG } from './types'

// This allows imports like:
// import { i18n, SupportedLocale } from '@/i18n'
// import { LOCALE_INFO, DEFAULT_I18N_CONFIG } from '@/i18n'

/**
 * @brief Initialize i18n system for application startup
 * 
 * @param locale - Optional locale to initialize with
 * @return Promise that resolves when i18n is ready
 * 
 * @description Convenience function for initializing i18n in main.ts.
 * Automatically detects user locale if none provided.
 */
export async function initializeI18n(locale?: SupportedLocale): Promise<void> {
  return i18n.init(locale)
}

/**
 * @brief Get translation function for use in components
 * 
 * @return Translation function
 * 
 * @description Convenience function to get the translation function.
 * Equivalent to i18n.t but shorter for frequent use.
 */
export function useTranslation(): TranslationFunction {
  return i18n.t.bind(i18n)
}

/**
 * @brief Get current locale information
 * 
 * @return Current locale info object
 * 
 * @description Returns complete locale information including name, flag, etc.
 */
export function getCurrentLocaleInfo(): LocaleInfo {
  const currentLocale = i18n.getCurrentLocale()
  return LOCALE_INFO[currentLocale]
}

/**
 * @brief Check if a locale is supported
 * 
 * @param locale - Locale code to check
 * @return True if locale is supported
 * 
 * @description Type-safe way to check if a locale is supported.
 */
export function isSupportedLocale(locale: string): locale is SupportedLocale {
  return i18n.isLocaleSupported(locale)
}