import { ApiError } from './api'

export type Values = Record<string, string>
export type Errors = Record<string, string>
/** Returns an i18n key when the value is invalid, else null. */
export type Rule = (value: string, all: Values) => string | null

export const required: Rule = (v) => (v.trim() ? null : 'validation.required')
export const email: Rule = (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? null : 'validation.email')

// Mirrors auth-service: MinimumLengthValidator(8) + PasswordValidator (a letter and a digit).
// Similarity to the email and common-password checks stay server-side (serverFieldKey).
export const PASSWORD_RULES = [
  { id: 'length', key: 'password.rule.length', test: (v: string) => v.length >= 8 },
  { id: 'letter', key: 'password.rule.letter', test: (v: string) => /[A-Za-z]/.test(v) },
  { id: 'number', key: 'password.rule.number', test: (v: string) => /\d/.test(v) },
] as const
export const strongPassword: Rule = (v) => (PASSWORD_RULES.every((r) => r.test(v)) ? null : 'validation.password')

export const sameAs = (field: string): Rule => (v, all) => (v === (all[field] ?? '') ? null : 'validation.mismatch')
export const max100: Rule = (v) => (v.length <= 100 ? null : 'validation.max_100')
// Empty = "unknown", which the backend accepts for age and weight.
export const wholeNumber: Rule = (v) => (v === '' || /^\d+$/.test(v) ? null : 'validation.whole_number')
export const positiveNumber: Rule = (v) => (v === '' || Number(v) > 0 ? null : 'validation.positive')

export function validate(values: Values, schema: Record<string, Rule[]>): Errors {
  const errors: Errors = {}
  for (const [field, rules] of Object.entries(schema)) {
    for (const rule of rules) {
      const key = rule(values[field] ?? '', values)
      if (key) {
        errors[field] = key
        break
      }
    }
  }
  return errors
}

export function formValues(form: HTMLFormElement): Values {
  const values: Values = {}
  new FormData(form).forEach((v, k) => { values[k] = String(v) })
  return values
}

// Backend field messages are English prose from Django: show our own translated copy instead.
const SERVER_FIELD_KEYS: Record<string, string> = {
  email: 'validation.email',
  password: 'validation.password_server',
  new_password: 'validation.password_server',
  password_confirm: 'validation.mismatch',
  new_password_confirm: 'validation.mismatch',
  current_password: 'validation.current_password',
  name: 'validation.invalid',
  age: 'validation.whole_number',
  weight: 'validation.positive',
}

export function serverFieldKey(e: unknown, field: string): string | undefined {
  if (!(e instanceof ApiError) || e.code !== 'VALIDATION_ERROR' || !(field in e.details)) return undefined
  return SERVER_FIELD_KEYS[field] ?? 'validation.invalid'
}
