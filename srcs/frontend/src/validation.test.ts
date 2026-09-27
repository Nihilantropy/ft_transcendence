import { describe, expect, test } from 'vitest'
import { ApiError } from './api'
import {
  CODE_RULES, PASSWORD_RULES, email, max100, max150, positiveNumber, recoveryCode, required, sameAs,
  secondFactor, serverFieldKey, strongPassword, totpCode, validate, wholeNumber,
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
    for (const bad of ['0', '-2', 'abc', '1e400']) expect(positiveNumber(bad, none), bad).toBe('validation.positive')
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

describe('2FA codes', () => {
  test('totpCode: 6 digits, spaces and dashes tolerated', () => {
    for (const ok of ['123456', '123 456', '123-456', ' 123456 ']) expect(totpCode(ok, none), ok).toBeNull()
    for (const bad of ['12345', '1234567', '12345a', '']) expect(totpCode(bad, none), bad).toBe('validation.totp')
  })
  test('recoveryCode: 12 chars of the unambiguous alphabet, dashes/case/spaces ignored', () => {
    for (const ok of ['ABCD-EFGH-JKMN', 'abcd efgh jkmn', 'ABCDEFGHJKMN', '2345-6789-ABCD'])
      expect(recoveryCode(ok, none), ok).toBeNull()
    for (const bad of ['ABCD-EFGH-JKM', 'ABCD-EFGH-JKMO', 'ABCD-EFGH-JKM1', '123456'])
      expect(recoveryCode(bad, none), bad).toBe('validation.recovery')
  })
  test('secondFactor accepts either kind', () => {
    expect(secondFactor('123 456', none)).toBeNull()
    expect(secondFactor('abcd-efgh-jkmn', none)).toBeNull()
    expect(secondFactor('12345', none)).toBe('validation.second_factor')
  })
  test('CODE_RULES start with required', () => {
    expect(validate({ code: '' }, { code: CODE_RULES.any })).toEqual({ code: 'validation.required' })
  })
  test('max150', () => {
    expect(max150('a'.repeat(150), none)).toBeNull()
    expect(max150('a'.repeat(151), none)).toBe('validation.max_150')
  })
})

describe('serverFieldKey on the code field', () => {
  test('a wrong code and the lockout belong to the code field', () => {
    expect(serverFieldKey(new ApiError('INVALID_2FA_CODE', 'x', 401), 'code')).toBe('validation.code_wrong')
    expect(serverFieldKey(new ApiError('RATE_LIMIT_EXCEEDED', 'x', 429), 'code')).toBe('validation.code_locked')
  })
  test('only on the code field', () => {
    expect(serverFieldKey(new ApiError('INVALID_2FA_CODE', 'x', 422), 'current_password')).toBeUndefined()
    expect(serverFieldKey(new ApiError('RATE_LIMIT_EXCEEDED', 'x', 429), 'email')).toBeUndefined()
  })
  test('a missing code (VALIDATION_ERROR) reads as required', () => {
    expect(serverFieldKey(new ApiError('VALIDATION_ERROR', 'x', 422, { code: ['required'] }), 'code')).toBe('validation.required')
  })
})
