import { describe, expect, test } from 'vitest'
import { ApiError } from './api'
import {
  PASSWORD_RULES, email, max100, positiveNumber, required, sameAs, serverFieldKey, strongPassword,
  validate, wholeNumber,
} from './validation'

const none = {}

describe('rules', () => {
  test('required ignores surrounding spaces', () => {
    expect(required('  ', none)).toBe('validation.required')
    expect(required(' a ', none)).toBeNull()
  })
  test('email', () => {
    expect(email('a@b.co', none)).toBeNull()
    for (const bad of ['a', 'a@', 'a@b', '@b.co', 'a b@c.de']) expect(email(bad, none), bad).toBe('validation.email')
  })
  test('strongPassword mirrors auth-service (8+, a letter, a digit)', () => {
    expect(strongPassword('abcdefg1', none)).toBeNull()
    expect(strongPassword('abc1', none)).toBe('validation.password')
    expect(strongPassword('abcdefgh', none)).toBe('validation.password')
    expect(strongPassword('12345678', none)).toBe('validation.password')
  })
  test('PASSWORD_RULES report each requirement', () => {
    const met = (v: string) => PASSWORD_RULES.filter((r) => r.test(v)).map((r) => r.id)
    expect(met('')).toEqual([])
    expect(met('abc')).toEqual(['letter'])
    expect(met('abcdefg1')).toEqual(['length', 'letter', 'number'])
  })
  test('sameAs compares with another field', () => {
    expect(sameAs('password')('x', { password: 'x' })).toBeNull()
    expect(sameAs('password')('y', { password: 'x' })).toBe('validation.mismatch')
  })
  test('max100', () => {
    expect(max100('a'.repeat(100), none)).toBeNull()
    expect(max100('a'.repeat(101), none)).toBe('validation.max_100')
  })
  test('wholeNumber allows empty (unknown) and 0+ integers only', () => {
    for (const ok of ['', '0', '36']) expect(wholeNumber(ok, none), ok).toBeNull()
    for (const bad of ['-1', '2.5', '1e3']) expect(wholeNumber(bad, none), bad).toBe('validation.whole_number')
  })
  test('positiveNumber allows empty (unknown) and > 0', () => {
    for (const ok of ['', '0.5', '31.5']) expect(positiveNumber(ok, none), ok).toBeNull()
    for (const bad of ['0', '-2', 'abc']) expect(positiveNumber(bad, none), bad).toBe('validation.positive')
  })
})

describe('validate', () => {
  test('first failing rule per field, only failing fields, schema order', () => {
    const errors = validate({ email: '', password: 'short' }, {
      email: [required, email], password: [required, strongPassword], other: [],
    })
    expect(errors).toEqual({ email: 'validation.required', password: 'validation.password' })
    expect(Object.keys(errors)).toEqual(['email', 'password'])
  })
})

describe('serverFieldKey', () => {
  const err = new ApiError('VALIDATION_ERROR', 'x', 422, { current_password: ['Current password is incorrect.'], foo: ['?'] })
  test('maps known fields, falls back to a generic key, ignores untouched fields', () => {
    expect(serverFieldKey(err, 'current_password')).toBe('validation.current_password')
    expect(serverFieldKey(err, 'foo')).toBe('validation.invalid')
    expect(serverFieldKey(err, 'email')).toBeUndefined()
  })
  test('only VALIDATION_ERROR carries field errors', () => {
    expect(serverFieldKey(new ApiError('INVALID_CREDENTIALS', 'x', 401, { email: ['x'] }), 'email')).toBeUndefined()
    expect(serverFieldKey(new Error('x'), 'email')).toBeUndefined()
  })
})
