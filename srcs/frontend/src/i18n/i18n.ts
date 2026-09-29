import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import enAnalyze from './locales/en/analyze.json'
import enAuth from './locales/en/auth.json'
import enBot from './locales/en/bot.json'
import enBreeds from './locales/en/breeds.json'
import enCommon from './locales/en/common.json'
import enDashboard from './locales/en/dashboard.json'
import enLanding from './locales/en/landing.json'
import enPets from './locales/en/pets.json'
import enProfile from './locales/en/profile.json'
import itAnalyze from './locales/it/analyze.json'
import itAuth from './locales/it/auth.json'
import itBot from './locales/it/bot.json'
import itBreeds from './locales/it/breeds.json'
import itCommon from './locales/it/common.json'
import itDashboard from './locales/it/dashboard.json'
import itLanding from './locales/it/landing.json'
import itPets from './locales/it/pets.json'
import itProfile from './locales/it/profile.json'
import jaAnalyze from './locales/ja/analyze.json'
import jaAuth from './locales/ja/auth.json'
import jaBot from './locales/ja/bot.json'
import jaBreeds from './locales/ja/breeds.json'
import jaCommon from './locales/ja/common.json'
import jaDashboard from './locales/ja/dashboard.json'
import jaLanding from './locales/ja/landing.json'
import jaPets from './locales/ja/pets.json'
import jaProfile from './locales/ja/profile.json'

export const LANGUAGES = ['it', 'en', 'ja'] as const
export type Language = (typeof LANGUAGES)[number]

// the active language
export const currentLanguage = (): Language =>
  (i18n.resolvedLanguage as Language | undefined) ?? 'it'

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      it: {
        common: itCommon,
        landing: itLanding,
        auth: itAuth,
        pets: itPets,
        profile: itProfile,
        dashboard: itDashboard,
        bot: itBot,
        analyze: itAnalyze,
        breeds: itBreeds,
      },
      en: {
        common: enCommon,
        landing: enLanding,
        auth: enAuth,
        pets: enPets,
        profile: enProfile,
        dashboard: enDashboard,
        bot: enBot,
        analyze: enAnalyze,
        breeds: enBreeds,
      },
      ja: {
        common: jaCommon,
        landing: jaLanding,
        auth: jaAuth,
        pets: jaPets,
        profile: jaProfile,
        dashboard: jaDashboard,
        bot: jaBot,
        analyze: jaAnalyze,
        breeds: jaBreeds,
      },
    },
    fallbackLng: 'it',
    supportedLngs: LANGUAGES,
    defaultNS: 'common',
    ns: ['common', 'landing', 'auth', 'pets', 'dashboard', 'bot', 'analyze', 'breeds', 'profile'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  })

export default i18n
