import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import enAuth from './locales/en/auth.json'
import enCommon from './locales/en/common.json'
import enLanding from './locales/en/landing.json'
import itAuth from './locales/it/auth.json'
import itCommon from './locales/it/common.json'
import itLanding from './locales/it/landing.json'

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      it: { common: itCommon, landing: itLanding, auth: itAuth },
      en: { common: enCommon, landing: enLanding, auth: enAuth },
    },
    fallbackLng: 'it',
    supportedLngs: ['it', 'en'],
    defaultNS: 'common',
    ns: ['common', 'landing', 'auth'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  })

export default i18n
