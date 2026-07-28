import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import enAuth from './locales/en/auth.json'
import enBreeds from './locales/en/breeds.json'
import enCommon from './locales/en/common.json'
import enLanding from './locales/en/landing.json'
import enPets from './locales/en/pets.json'
import itAuth from './locales/it/auth.json'
import itBreeds from './locales/it/breeds.json'
import itCommon from './locales/it/common.json'
import itLanding from './locales/it/landing.json'
import itPets from './locales/it/pets.json'

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
        breeds: itBreeds,
      },
      en: {
        common: enCommon,
        landing: enLanding,
        auth: enAuth,
        pets: enPets,
        breeds: enBreeds,
      },
    },
    fallbackLng: 'it',
    supportedLngs: ['it', 'en'],
    defaultNS: 'common',
    ns: ['common', 'landing', 'auth', 'pets', 'breeds'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  })

export default i18n
