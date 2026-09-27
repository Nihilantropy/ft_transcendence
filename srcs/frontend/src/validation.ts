import { ApiError } from './api'

export type Values = Record<string, string>
export type Errors = Record<string, string>
/** Returns an i18n key when the value is invalid, else null. */
export type Rule = (value: string, all: Values) => string | null

export const required: Rule = (v) => (v.trim() ? null : 'validation.required')
export const email: Rule = (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? null : 'validation.email')

// Mirrors auth-service: MinimumLengthValidator(8) + PasswordValidator (a letter and a digit).
// validation.password_server (serverFieldKey) is generic: validate_password runs with user=None,
// so the backend never actually runs the email-similarity check.
export const PASSWORD_RULES = [
  { id: 'length', key: 'password.rule.length', test: (v: string) => v.length >= 8 },
  { id: 'letter', key: 'password.rule.letter', test: (v: string) => /[A-Za-z]/.test(v) },
  { id: 'number', key: 'password.rule.number', test: (v: string) => /\d/.test(v) },
] as const
export const strongPassword: Rule = (v) => (PASSWORD_RULES.every((r) => r.test(v)) ? null : 'validation.password')

export const sameAs = (field: string): Rule => (v, all) => (v === (all[field] ?? '') ? null : 'validation.mismatch')
export const max100: Rule = (v) => (v.length <= 100 ? null : 'validation.max_100')
export const max150: Rule = (v) => (v.length <= 150 ? null : 'validation.max_150')
// Empty = "unknown", which the backend accepts for age and weight.
export const wholeNumber: Rule = (v) => (v === '' || /^\d+$/.test(v) ? null : 'validation.whole_number')
export const positiveNumber: Rule = (v) => (v === '' || (Number.isFinite(Number(v)) && Number(v) > 0) ? null : 'validation.positive')

// 2FA codes, read the way auth-service's normalize_code reads them: spaces and dashes dropped, case ignored.
const compact = (v: string) => v.replace(/[\s-]/g, '').toUpperCase()
export const totpCode: Rule = (v) => (/^\d{6}$/.test(compact(v)) ? null : 'validation.totp')
// 12 characters of auth-service's recovery alphabet (no 0/O/1/I), shown as ABCD-EFGH-JKMN.
export const recoveryCode: Rule = (v) => (/^[A-HJ-NP-Z2-9]{12}$/.test(compact(v)) ? null : 'validation.recovery')
export const secondFactor: Rule = (v, all) =>
  (totpCode(v, all) && recoveryCode(v, all) ? 'validation.second_factor' : null)

export type CodeKind = 'totp' | 'recovery' | 'any'
export const CODE_RULES: Record<CodeKind, Rule[]> = {
  totp: [required, totpCode],
  recovery: [required, recoveryCode],
  any: [required, secondFactor],
}

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
  first_name: 'validation.max_150',
  last_name: 'validation.max_150',
  code: 'validation.required', // auth-service's only field error on code: "a code is required"
  name: 'validation.invalid',
  age: 'validation.whole_number',
  weight: 'validation.positive',
}

// Also used for a browser-rejected <input type="number"> value (validity.badInput) — same field,
// same message, whether the value never left the browser or came back invalid from the server.
export function invalidKeyFor(field: string): string {
  return SERVER_FIELD_KEYS[field] ?? 'validation.invalid'
}

export function serverFieldKey(e: unknown, field: string): string | undefined {
  if (!(e instanceof ApiError)) return undefined
  // A rejected 2FA code is about what the user typed: show it on the code field.
  if (field === 'code' && e.code === 'INVALID_2FA_CODE') return 'validation.code_wrong'
  // ponytail: any 429 on a form with a code field reads as auth-service's 2FA lockout; api.ts has
  // already retried nginx/gateway 429s twice, so in practice this is the lockout.
  if (field === 'code' && e.code === 'RATE_LIMIT_EXCEEDED') return 'validation.code_locked'
  if (e.code !== 'VALIDATION_ERROR' || !(field in e.details)) return undefined
  return invalidKeyFor(field)
}
