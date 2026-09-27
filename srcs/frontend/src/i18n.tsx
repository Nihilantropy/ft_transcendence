import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import it from './locales/it.json'
import en from './locales/en.json'
import es from './locales/es.json'

export const LANGS = ['it', 'en', 'es'] as const
export type Lang = (typeof LANGS)[number]
const DICTS: Record<Lang, Record<string, string>> = { it, en, es }

export function translate(lang: Lang, key: string): string {
  return DICTS[lang][key] ?? DICTS.it[key] ?? key
}

export function errorMessage(lang: Lang, code: string): string {
  const key = `error.${code}`
  return key in DICTS[lang] ? DICTS[lang][key] : DICTS[lang]['error.UNKNOWN']
}

// Classifier ids are snake_case ("golden_retriever", "x_y_mix"); breed names stay English.
export function breedLabel(breed: string): string {
  return breed.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('lang')
    if ((LANGS as readonly string[]).includes(saved ?? '')) return saved as Lang
  } catch {
    // ponytail: storage blocked (private mode) → default language
  }
  return 'it'
}

type I18n = { lang: Lang; setLang(l: Lang): void; t(key: string): string; errorMessage(code: string): string }
const I18nCtx = createContext<I18n>(null!)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])
  const setLang = (l: Lang) => {
    try {
      localStorage.setItem('lang', l)
    } catch {
      // ponytail: not persisted, still applied for this visit
    }
    setLangState(l)
  }
  const value: I18n = {
    lang,
    setLang,
    t: (key) => translate(lang, key),
    errorMessage: (code) => errorMessage(lang, code),
  }
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>
}

export const useI18n = () => useContext(I18nCtx)
