/**
 * @brief Internationalization system implementation for ft_transcendence
 * 
 * @description Lightweight i18n system without external dependencies.
 * Handles translation loading, caching, and interpolation with support for
 * 4 languages (EN, FR, ES, IT). Provides locale detection, persistence,
 * and event-driven updates for component reactivity.
 * 
 * Phase C1 implementation - Core i18n System
 */

import type { SupportedLocale, TranslationParams, I18nConfig } from './types'

/**
 * @brief Main internationalization class for multi-language support
 * 
 * @description Manages translation loading, locale switching, parameter interpolation,
 * and component notifications. Uses dynamic imports for code splitting and localStorage
 * for persistence. Implements fallback mechanism with English as default.
 */
export class I18n {
  /** Current active locale */
  private currentLocale: SupportedLocale = 'en'
  
  /** Map of loaded translations: locale -> translation object */
  private translations: Map<SupportedLocale, Record<string, string>> = new Map()
  
  /** Fallback locale when translations are missing */
  private readonly fallbackLocale: SupportedLocale = 'en'
  
  /** Set of locale change listeners for reactive updates */
  private listeners: Set<(locale: SupportedLocale) => void> = new Set()
  
  /** Configuration object with default settings */
  private config: I18nConfig = {
    defaultLocale: 'en',
    supportedLocales: ['en', 'fr', 'es', 'it'],
    fallbackLocale: 'en',
    storageKey: 'ft_transcendence_locale'
  }
  
  /** Whether the i18n system has been initialized */
  private initialized: boolean = false

  /**
   * @brief Initialize i18n system with locale detection and translation loading
   * 
   * @param defaultLocale - Default locale to use if detection fails
   * @return Promise that resolves when initialization is complete
   * 
   * @description Sets up the i18n system by detecting user locale, loading translations,
   * and preparing the fallback locale. Must be called before using translation features.
   */
  async init(defaultLocale: SupportedLocale = 'en'): Promise<void> {
    if (this.initialized) {
      console.warn('I18n system already initialized')
      return
    }

    try {
      // Update default locale in config
      this.config.defaultLocale = defaultLocale
      
      // Detect user's preferred locale
      const detectedLocale = this.detectUserLocale() || defaultLocale
      this.currentLocale = detectedLocale
      
      console.log(`🌐 I18n initializing with locale: ${this.currentLocale}`)
      
      // Load translations for current locale
      await this.loadTranslations(this.currentLocale)
      
      // Load fallback locale if different from current
      if (this.currentLocale !== this.fallbackLocale) {
        await this.loadTranslations(this.fallbackLocale)
      }
      
      this.initialized = true
      console.log(`✅ I18n system initialized successfully`)
      
    } catch (error) {
      console.error('❌ Failed to initialize I18n system:', error)
      
      // Fallback to English if initialization fails
      this.currentLocale = 'en'
      await this.loadTranslations('en')
      this.initialized = true
    }
  }

  /**
   * @brief Change current locale and load new translations
   * 
   * @param locale - New locale to set
   * @return Promise that resolves when locale change is complete
   * 
   * @description Switches to new locale, loads translations if needed,
   * persists choice to localStorage, and notifies all listeners.
   */
  async setLocale(locale: SupportedLocale): Promise<void> {
    if (!this.isLocaleSupported(locale)) {
      console.error(`❌ Locale '${locale}' is not supported`)
      return
    }

    if (locale === this.currentLocale) {
      console.log(`🌐 Already using locale: ${locale}`)
      return
    }

    const previousLocale = this.currentLocale
    
    try {
      console.log(`🌐 Switching locale: ${previousLocale} → ${locale}`)
      
      // Load translations for new locale if not already loaded
      await this.loadTranslations(locale)
      
      // Update current locale
      this.currentLocale = locale
      
      // Persist locale preference
      this.saveUserLocale(locale)
      
      // Notify all listeners of locale change
      this.notifyListeners()
      
      console.log(`✅ Locale switched successfully to: ${locale}`)
      
    } catch (error) {
      console.error(`❌ Failed to switch to locale '${locale}':`, error)
      
      // Revert to previous locale on error
      this.currentLocale = previousLocale
      throw error
    }
  }

  /**
   * @brief Get translated text with parameter interpolation
   * 
   * @param key - Translation key (e.g., 'game.winner', 'common.loading')
   * @param params - Optional parameters for interpolation
   * @return Translated text with parameters replaced
   * 
   * @description Retrieves translation for given key, applies parameter interpolation
   * using {{param}} syntax, and falls back to English if translation missing.
   */
  t(key: string, params?: TranslationParams): string {
    if (!this.initialized) {
      console.warn('I18n system not initialized, returning key')
      return `[${key}]`
    }

    // Get translation from current locale or fallback
    const translation = this.getTranslation(key)
    
    // Apply parameter interpolation if params provided
    return params ? this.interpolate(translation, params) : translation
  }

  /**
   * @brief Subscribe to locale change notifications
   * 
   * @param listener - Callback function to call when locale changes
   * @return Unsubscribe function to remove the listener
   * 
   * @description Registers listener for locale changes. Returned function
   * should be called to prevent memory leaks when component unmounts.
   */
  onLocaleChange(listener: (locale: SupportedLocale) => void): () => void {
    this.listeners.add(listener)
    
    console.log(`📡 Locale change listener added (total: ${this.listeners.size})`)
    
    // Return unsubscribe function
    return () => {
      const removed = this.listeners.delete(listener)
      if (removed) {
        console.log(`📡 Locale change listener removed (total: ${this.listeners.size})`)
      }
      return removed
    }
  }

  /**
   * @brief Get current active locale
   * 
   * @return Current locale code
   * 
   * @description Returns the currently active locale for the i18n system.
   */
  getCurrentLocale(): SupportedLocale {
    return this.currentLocale
  }

  /**
   * @brief Get list of supported locales
   * 
   * @return Array of supported locale codes
   * 
   * @description Returns all locales supported by the application.
   */
  getSupportedLocales(): SupportedLocale[] {
    return [...this.config.supportedLocales]
  }

  /**
   * @brief Check if locale is supported
   * 
   * @param locale - Locale code to check
   * @return True if locale is supported
   * 
   * @description Validates if a locale is in the supported locales list.
   */
  isLocaleSupported(locale: string): locale is SupportedLocale {
    return this.config.supportedLocales.includes(locale as SupportedLocale)
  }

  /**
   * @brief Get current i18n configuration
   * 
   * @return I18n configuration object
   * 
   * @description Returns the current configuration for debugging and inspection.
   */
  getConfig(): Readonly<I18nConfig> {
    return { ...this.config }
  }

  /**
   * @brief Check if translations are loaded for a locale
   * 
   * @param locale - Locale to check
   * @return True if translations are loaded
   * 
   * @description Checks if translations have been loaded and cached for given locale.
   */
  isLocaleLoaded(locale: SupportedLocale): boolean {
    return this.translations.has(locale)
  }

  /**
   * @brief Load translations for a specific locale
   * 
   * @param locale - Locale to load translations for
   * @return Promise that resolves when translations are loaded
   * 
   * @description Dynamically imports translation file using code splitting.
   * Caches translations in memory for performance. Handles loading errors gracefully.
   */
  private async loadTranslations(locale: SupportedLocale): Promise<void> {
    // Return early if already loaded
    if (this.translations.has(locale)) {
      console.log(`📚 Translations for '${locale}' already loaded`)
      return
    }

    try {
      console.log(`📚 Loading translations for locale: ${locale}`)
      
      // Dynamic import for code splitting - each locale is a separate chunk
      const module = await import(`./locales/${locale}.json`)
      
      // Store translations in cache
      this.translations.set(locale, module.default)
      
      console.log(`✅ Translations loaded for '${locale}'`)
      
    } catch (error) {
      console.error(`❌ Failed to load translations for locale '${locale}':`, error)
      
      // Don't throw error - system should continue with fallback
      // Set empty translations to avoid repeated loading attempts
      this.translations.set(locale, {})
    }
  }

  /**
   * @brief Get translation for a key with fallback logic
   * 
   * @param key - Translation key to retrieve
   * @return Translated text or fallback
   * 
   * @description Attempts to get translation from current locale,
   * falls back to English, then shows key in brackets if not found.
   */
  private getTranslation(key: string): string {
    // Try current locale first
    const currentTranslations = this.translations.get(this.currentLocale)
    const currentTranslation = currentTranslations?.[key]
    
    if (currentTranslation) {
      return currentTranslation
    }
    
    // Fallback to English if available and different from current
    if (this.currentLocale !== this.fallbackLocale) {
      const fallbackTranslations = this.translations.get(this.fallbackLocale)
      const fallbackTranslation = fallbackTranslations?.[key]
      
      if (fallbackTranslation) {
        console.warn(`⚠️ Using fallback translation for key '${key}' in locale '${this.currentLocale}'`)
        return fallbackTranslation
      }
    }
    
    // Final fallback - return key in brackets
    console.warn(`❌ No translation found for key '${key}' in any locale`)
    return `[${key}]`
  }

  /**
   * @brief Interpolate parameters into translation text
   * 
   * @param text - Text with {{param}} placeholders
   * @param params - Parameters to interpolate
   * @return Text with parameters replaced
   * 
   * @description Replaces {{param}} placeholders with actual values.
   * Supports nested object notation and handles missing parameters gracefully.
   */
  private interpolate(text: string, params: TranslationParams): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = params[key]
      
      if (value !== undefined && value !== null) {
        return value.toString()
      }
      
      console.warn(`⚠️ Missing parameter '${key}' for interpolation`)
      return match // Return original placeholder if parameter missing
    })
  }

  /**
   * @brief Detect user's preferred locale from browser and storage
   * 
   * @return Detected locale code or null if none detected
   * 
   * @description Checks localStorage first, then browser language.
   * Only returns supported locales, filters out unsupported ones.
   */
  private detectUserLocale(): SupportedLocale | null {
    // Check saved preference in localStorage first
    const savedLocale = this.getSavedUserLocale()
    if (savedLocale && this.isLocaleSupported(savedLocale)) {
      console.log(`🌐 Found saved locale preference: ${savedLocale}`)
      return savedLocale
    }
    
    // Check browser language as fallback
    if (typeof navigator !== 'undefined') {
      // Get primary language from browser (e.g., 'en-US' -> 'en')
      const browserLang = navigator.language.split('-')[0]
      
      if (this.isLocaleSupported(browserLang)) {
        console.log(`🌐 Detected browser locale: ${browserLang}`)
        return browserLang
      }
      
      // Check additional browser languages
      const browserLanguages = navigator.languages || [navigator.language]
      for (const lang of browserLanguages) {
        const langCode = lang.split('-')[0]
        if (this.isLocaleSupported(langCode)) {
          console.log(`🌐 Detected browser locale from languages list: ${langCode}`)
          return langCode
        }
      }
    }
    
    console.log(`🌐 No supported locale detected, will use default`)
    return null
  }

  /**
   * @brief Save user locale preference to localStorage
   * 
   * @param locale - Locale to save
   * 
   * @description Persists locale choice to browser storage for future sessions.
   * Handles storage errors gracefully.
   */
  private saveUserLocale(locale: SupportedLocale): void {
    try {
      localStorage.setItem(this.config.storageKey, locale)
      console.log(`💾 Saved locale preference: ${locale}`)
    } catch (error) {
      console.warn('⚠️ Failed to save locale preference:', error)
    }
  }

  /**
   * @brief Get saved user locale from localStorage
   * 
   * @return Saved locale or null if not found
   * 
   * @description Retrieves previously saved locale preference from browser storage.
   */
  private getSavedUserLocale(): string | null {
    try {
      const saved = localStorage.getItem(this.config.storageKey)
      return saved
    } catch (error) {
      console.warn('⚠️ Failed to retrieve saved locale preference:', error)
      return null
    }
  }

  /**
   * @brief Notify all locale change listeners
   * 
   * @description Calls all registered listeners with the current locale.
   * Handles listener errors gracefully to prevent breaking other listeners.
   */
  private notifyListeners(): void {
    console.log(`📡 Notifying ${this.listeners.size} locale change listeners`)
    
    this.listeners.forEach(listener => {
      try {
        listener(this.currentLocale)
      } catch (error) {
        console.error('❌ Error in locale change listener:', error)
      }
    })
  }
}

// Export singleton instance for application use
export const i18n = new I18n()