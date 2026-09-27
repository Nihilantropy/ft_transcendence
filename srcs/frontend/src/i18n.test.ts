import { describe, expect, test } from 'vitest'
import { LANGS, breedLabel, errorMessage, translate } from './i18n'
import itDict from './locales/it.json'
import enDict from './locales/en.json'
import esDict from './locales/es.json'

const dicts: Record<string, Record<string, string>> = { it: itDict, en: enDict, es: esDict }

// Every code the backend or api.ts can produce that deserves its own copy.
const CODES = [
  'UNSUPPORTED_SPECIES', 'CONTENT_POLICY_VIOLATION', 'SPECIES_DETECTION_FAILED',
  'BREED_DETECTION_FAILED', 'INVALID_IMAGE_FORMAT', 'IMAGE_TOO_LARGE', 'IMAGE_TOO_SMALL',
  'INVALID_CREDENTIALS', 'EMAIL_ALREADY_EXISTS', 'RATE_LIMIT_EXCEEDED', 'VALIDATION_ERROR',
  'VISION_SERVICE_UNAVAILABLE', 'SERVICE_UNAVAILABLE', 'INTERNAL_ERROR', 'NOT_FOUND',
  'PET_NOT_FOUND', 'NETWORK_ERROR', 'TIMEOUT', 'UNKNOWN',
  'INVALID_2FA_CODE', 'TWO_FACTOR_ALREADY_ENABLED', 'TWO_FACTOR_SETUP_REQUIRED',
  'TWO_FACTOR_NOT_ENABLED', 'TOKEN_EXPIRED',
]

describe('dictionaries', () => {
  test('every language has exactly the Italian keys', () => {
    const keys = Object.keys(itDict).sort()
    for (const l of LANGS) expect(Object.keys(dicts[l]).sort()).toEqual(keys)
  })
  test('no empty strings', () => {
    for (const l of LANGS) for (const [k, v] of Object.entries(dicts[l])) expect(v.trim(), `${l}:${k}`).not.toBe('')
  })
  test('every error code has copy', () => {
    for (const c of CODES) expect(itDict, c).toHaveProperty(`error.${c}`)
  })
})

describe('lookups', () => {
  test('translate falls back to the key', () => {
    expect(translate('en', 'nav.pets')).toBe('My pets')
    expect(translate('es', 'no.such.key')).toBe('no.such.key')
  })
  test('unknown error code gets the generic message', () => {
    expect(errorMessage('en', 'ACCOUNT_DISABLED')).toBe(enDict['error.UNKNOWN'])
    expect(errorMessage('it', 'UNSUPPORTED_SPECIES')).toBe(itDict['error.UNSUPPORTED_SPECIES'])
  })
  test('breedLabel humanises classifier ids', () => {
    expect(breedLabel('golden_retriever')).toBe('Golden Retriever')
    expect(breedLabel('german_shepherd_golden_retriever_mix')).toBe('German Shepherd Golden Retriever Mix')
  })
})
