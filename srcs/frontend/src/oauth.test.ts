import { describe, expect, test } from 'vitest'
import { cameBackFromOAuth, readOAuthReturn } from './oauth'

describe('readOAuthReturn', () => {
  test('failure, unavailable and exists', () => {
    expect(readOAuthReturn('?oauth=error', '')).toEqual({ kind: 'error' })
    expect(readOAuthReturn('?oauth=unavailable', '')).toEqual({ kind: 'unavailable' })
    expect(readOAuthReturn('?oauth=exists', '')).toEqual({ kind: 'exists' })
  })
  test('mfa carries the challenge from the fragment', () => {
    expect(readOAuthReturn('?oauth=mfa', '#eyJ.abc.def')).toEqual({ kind: 'mfa', token: 'eyJ.abc.def' })
  })
  test('mfa without a token is a failure', () => {
    expect(readOAuthReturn('?oauth=mfa', '')).toEqual({ kind: 'error' })
    expect(readOAuthReturn('?oauth=mfa', '#')).toEqual({ kind: 'error' })
  })
  test('anything else is not an OAuth return', () => {
    expect(readOAuthReturn('', '')).toBeNull()
    expect(readOAuthReturn('?oauth=ok', '')).toBeNull()
    expect(readOAuthReturn('?oauth=<script>', '#x')).toBeNull()
  })
})

test('cameBackFromOAuth', () => {
  expect(cameBackFromOAuth('?oauth=ok')).toBe(true)
  expect(cameBackFromOAuth('?oauth=error')).toBe(false)
  expect(cameBackFromOAuth('')).toBe(false)
})
