/**
 * @brief i18n TypeScript type definitions for ft_transcendence
 * 
 * @description Complete type system for internationalization including
 * locale management, translation parameters, configuration, and component
 * integration types. Provides type safety for 4-language support (EN, FR, ES, IT).
 * 
 * Phase C1 implementation - i18n Type System
 */

/**
 * @brief Supported locale type union
 * 
 * @description Union type of all supported locale codes.
 * Ensures type safety when working with locales throughout the application.
 */
export type SupportedLocale = 'en' | 'fr' | 'es' | 'it'

/**
 * @brief Locale information interface
 * 
 * @description Complete metadata for each supported locale including
 * display information and text direction for future RTL support.
 */
export interface LocaleInfo {
  /** Locale code (e.g., 'en', 'fr') */
  code: SupportedLocale
  
  /** Human-readable name in English */
  name: string
  
  /** Human-readable name in the locale's own language */
  nativeName: string
  
  /** Flag emoji for UI display */
  flag: string
  
  /** Text direction for layout (future RTL support) */
  direction: 'ltr' | 'rtl'
  
  /** Whether this locale is fully translated */
  complete: boolean
}

/**
 * @brief Translation key structure interface
 * 
 * @description Nested translation object structure supporting
 * hierarchical keys like 'common.loading' or 'game.player.score'.
 */
export interface TranslationKey {
  [key: string]: string | TranslationKey
}

/**
 * @brief Flattened translation interface
 * 
 * @description Flat key-value structure used internally by i18n system.
 * Keys use dot notation (e.g., 'common.loading', 'game.winner').
 */
export interface FlatTranslation {
  [key: string]: string
}

/**
 * @brief Translation file structure
 * 
 * @description Complete translation file metadata including
 * locale information and translation data.
 */
export interface Translation {
  /** Locale code this translation is for */
  locale: SupportedLocale
  
  /** Translation data as flat key-value pairs */
  data: FlatTranslation
  
  /** Optional metadata about the translation file */
  meta?: {
    /** Version of the translation file */
    version?: string
    
    /** Last update timestamp */
    lastUpdated?: string
    
    /** Translation completion percentage */
    completeness?: number
    
    /** Contributors to this translation */
    contributors?: string[]
  }
}

/**
 * @brief i18n system configuration interface
 * 
 * @description Configuration options for the i18n system including
 * locale settings, storage options, and behavior preferences.
 */
export interface I18nConfig {
  /** Default locale to use on first load */
  defaultLocale: SupportedLocale
  
  /** Array of all supported locales */
  supportedLocales: SupportedLocale[]
  
  /** Fallback locale when translations are missing */
  fallbackLocale: SupportedLocale
  
  /** localStorage key for persisting locale preference */
  storageKey: string
  
  /** Optional namespace for translation keys */
  namespace?: string
  
  /** Whether to log missing translation warnings */
  warnOnMissing?: boolean
  
  /** Whether to interpolate HTML (security consideration) */
  allowHTML?: boolean
}

/**
 * @brief Translation function parameters interface
 * 
 * @description Parameters for interpolation in translation strings.
 * Supports strings, numbers, and dates for common use cases.
 */
export interface TranslationParams {
  /** Parameter key-value pairs for {{param}} interpolation */
  [key: string]: string | number | Date
}

/**
 * @brief Translation function type definition
 * 
 * @param key - Translation key (e.g., 'common.loading')
 * @param params - Optional interpolation parameters
 * @return Translated and interpolated string
 * 
 * @description Type for the main translation function used throughout components.
 */
export type TranslationFunction = (
  key: string,
  params?: TranslationParams
) => string

/**
 * @brief Locale change listener function type
 * 
 * @param locale - New locale that was activated
 * 
 * @description Callback function type for locale change notifications.
 */
export type LocaleChangeListener = (locale: SupportedLocale) => void

/**
 * @brief i18n component props interface
 * 
 * @description Props for components that support internationalization.
 * Used by i18n-enabled components for locale-specific behavior.
 */
export interface I18nComponentProps {
  /** Override locale for this component (optional) */
  locale?: SupportedLocale
  
  /** Custom translations for this component (optional) */
  translations?: FlatTranslation
  
  /** Translation namespace for this component (optional) */
  namespace?: string
}

/**
 * @brief i18n hook return type (for future React-style hooks)
 * 
 * @description Return type for i18n functionality in components.
 * Provides translation function and current locale information.
 */
export interface I18nHookReturn {
  /** Translation function */
  t: TranslationFunction
  
  /** Current active locale */
  locale: SupportedLocale
  
  /** Function to change locale */
  setLocale: (locale: SupportedLocale) => Promise<void>
  
  /** Array of supported locales */
  supportedLocales: SupportedLocale[]
  
  /** Whether i18n system is ready */
  ready: boolean
}

/**
 * @brief Translation loading state interface
 * 
 * @description Represents the loading state of translation files.
 * Useful for UI loading indicators and error handling.
 */
export interface TranslationLoadingState {
  /** Locale being loaded */
  locale: SupportedLocale
  
  /** Whether translations are currently loading */
  loading: boolean
  
  /** Whether translations loaded successfully */
  loaded: boolean
  
  /** Error message if loading failed */
  error?: string
  
  /** Loading progress (0-100) if available */
  progress?: number
}

/**
 * @brief Language switcher component props
 * 
 * @description Props for language switcher UI components.
 * Supports different display modes and styling options.
 */
export interface LanguageSwitcherProps {
  /** Display variant (dropdown or button list) */
  variant?: 'dropdown' | 'buttons' | 'menu'
  
  /** Whether to show flag emojis */
  showFlags?: boolean
  
  /** Whether to show native language names */
  showNativeNames?: boolean
  
  /** Size variant for the switcher */
  size?: 'sm' | 'md' | 'lg'
  
  /** Additional CSS classes */
  className?: string
  
  /** Callback when locale is changed */
  onLocaleChange?: (locale: SupportedLocale) => void
  
  /** Whether the switcher is disabled */
  disabled?: boolean
}

/**
 * @brief Pluralization rule interface (future feature)
 * 
 * @description Defines pluralization rules for different locales.
 * Currently not implemented but defined for future expansion.
 */
export interface PluralizationRule {
  /** Locale this rule applies to */
  locale: SupportedLocale
  
  /** Function to determine plural form based on count */
  getForm: (count: number) => 'zero' | 'one' | 'two' | 'few' | 'many' | 'other'
}

/**
 * @brief Date formatting options interface (future feature)
 * 
 * @description Options for locale-aware date formatting.
 * Extends Intl.DateTimeFormatOptions with locale preferences.
 */
export interface I18nDateFormatOptions extends Intl.DateTimeFormatOptions {
  /** Locale-specific formatting preference */
  localePreference?: 'short' | 'medium' | 'long' | 'full'
}

/**
 * @brief Number formatting options interface (future feature)
 * 
 * @description Options for locale-aware number formatting.
 * Extends Intl.NumberFormatOptions with custom preferences.
 */
export interface I18nNumberFormatOptions extends Intl.NumberFormatOptions {
  /** Whether to use locale-specific number separators */
  useLocaleNumbers?: boolean
}

/**
 * @brief Translation validation result
 * 
 * @description Result of translation file validation including
 * missing keys, format errors, and completeness metrics.
 */
export interface TranslationValidationResult {
  /** Whether validation passed */
  valid: boolean
  
  /** Array of missing translation keys */
  missingKeys: string[]
  
  /** Array of format errors */
  formatErrors: string[]
  
  /** Translation completeness percentage */
  completeness: number
  
  /** Total number of expected keys */
  totalKeys: number
  
  /** Number of translated keys */
  translatedKeys: number
}

/**
 * @brief i18n error types
 * 
 * @description Union type of possible i18n system errors for better error handling.
 */
export type I18nErrorType = 
  | 'LOCALE_NOT_SUPPORTED'
  | 'TRANSLATION_LOAD_FAILED'
  | 'INTERPOLATION_ERROR'
  | 'INITIALIZATION_FAILED'
  | 'STORAGE_ERROR';

/**
 * @brief i18n error interface
 * 
 * @description Structured error information for i18n system failures.
 */
export interface I18nError extends Error {
  /** Type of i18n error */
  type: I18nErrorType
  
  /** Locale related to the error (if applicable) */
  locale?: SupportedLocale
  
  /** Translation key related to the error (if applicable) */
  key?: string
  
  /** Additional error context */
  context?: Record<string, any>
}

/**
 * @brief Locale metadata constants
 * 
 * @description Complete metadata for all supported locales.
 * Used by language switchers and locale detection.
 */
export const LOCALE_INFO: Record<SupportedLocale, LocaleInfo> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇺🇸',
    direction: 'ltr',
    complete: true
  },
  fr: {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    flag: '🇫🇷',
    direction: 'ltr',
    complete: true
  },
  es: {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
    direction: 'ltr',
    complete: true
  },
  it: {
    code: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    flag: '🇮🇹',
    direction: 'ltr',
    complete: true
  }
}

/**
 * @brief Default i18n configuration
 * 
 * @description Default settings for the i18n system.
 * Can be overridden during initialization.
 */
export const DEFAULT_I18N_CONFIG: I18nConfig = {
  defaultLocale: 'en',
  supportedLocales: ['en', 'fr', 'es', 'it'],
  fallbackLocale: 'en',
  storageKey: 'ft_transcendence_locale',
  warnOnMissing: true,
  allowHTML: false
}