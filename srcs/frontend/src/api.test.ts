import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ApiError, api, fieldError, setLogoutHandler } from './api'

type Reply = { status: number; body?: unknown; html?: string; headers?: Record<string, string> }
const json = (r: Reply) =>
  new Response(r.html ?? (r.body === undefined ? '' : JSON.stringify(r.body)), {
    status: r.status,
    headers: { 'Content-Type': r.html ? 'text/html' : 'application/json', ...r.headers },
  })

// Replies are consumed in order per URL path; records every call.
function mockFetch(routes: Record<string, Reply[]>) {
  const calls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    calls.push(url)
    const next = routes[url]?.shift()
    if (!next) throw new Error(`unexpected fetch ${url}`)
    return json(next)
  }))
  return calls
}

const ok = (data: unknown) => ({ status: 200, body: { success: true, data, error: null } })
const fail = (status: number, code: string, details = {}) =>
  ({ status, body: { success: false, data: null, error: { code, message: code, details } } })

beforeEach(() => setLogoutHandler(() => {}))
afterEach(() => vi.unstubAllGlobals())

describe('api', () => {
  test('unwraps data on success', async () => {
    mockFetch({ '/api/v1/pets': [ok([{ id: '1' }])] })
    await expect(api('/pets')).resolves.toEqual([{ id: '1' }])
  })

  test('standard error envelope becomes ApiError', async () => {
    mockFetch({ '/api/v1/auth/register': [fail(422, 'VALIDATION_ERROR', { email: ['bad'] })] })
    const e = await api<any>('/auth/register', { method: 'POST', body: {} }).catch((x) => x)
    expect(e).toBeInstanceOf(ApiError)
    expect([e.code, e.status, e.details]).toEqual(['VALIDATION_ERROR', 422, { email: ['bad'] }])
    expect(fieldError(e, 'email')).toBe('bad')
    expect(fieldError(e, 'password')).toBeUndefined()
  })

  test('vision detail-wrapped envelope becomes ApiError', async () => {
    mockFetch({ '/api/v1/vision/analyze': [{ status: 422, body: { detail: fail(422, 'UNSUPPORTED_SPECIES').body } }] })
    const e = await api<any>('/vision/analyze', { method: 'POST', body: {} }).catch((x) => x)
    expect(e.code).toBe('UNSUPPORTED_SPECIES')
  })

  test('nginx HTML 413 maps to IMAGE_TOO_LARGE, 502 to SERVICE_UNAVAILABLE, other to UNKNOWN', async () => {
    mockFetch({ '/api/v1/vision/analyze': [
      { status: 413, html: '<html>413</html>' },
      { status: 502, html: '<html>502</html>' },
      { status: 418, html: '<html>?</html>' },
    ] })
    const codes = []
    for (let i = 0; i < 3; i++) codes.push((await api<any>('/vision/analyze').catch((x) => x)).code)
    expect(codes).toEqual(['IMAGE_TOO_LARGE', 'SERVICE_UNAVAILABLE', 'UNKNOWN'])
  })

  test('200 with success:false still throws', async () => {
    mockFetch({ '/api/v1/recommendations/food?pet_id=x': [{ status: 200, body: fail(200, 'UNAUTHORIZED').body }] })
    await expect(api('/recommendations/food?pet_id=x')).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  test('network failure becomes NETWORK_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    await expect(api('/pets')).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0 })
  })

  test('401 refreshes once and retries', async () => {
    const calls = mockFetch({
      '/api/v1/pets': [fail(401, 'UNAUTHORIZED'), ok([])],
      '/api/v1/auth/refresh': [ok({})],
    })
    await expect(api('/pets')).resolves.toEqual([])
    expect(calls).toEqual(['/api/v1/pets', '/api/v1/auth/refresh', '/api/v1/pets'])
  })

  test('parallel 401s share one refresh', async () => {
    const calls = mockFetch({
      '/api/v1/pets/1': [fail(401, 'UNAUTHORIZED'), ok({ id: '1' })],
      '/api/v1/recommendations/food?pet_id=1': [fail(401, 'UNAUTHORIZED'), ok({ recommendations: [] })],
      '/api/v1/auth/refresh': [ok({})],
    })
    await Promise.all([api('/pets/1'), api('/recommendations/food?pet_id=1')])
    expect(calls.filter((c) => c === '/api/v1/auth/refresh')).toHaveLength(1)
  })

  test('failed refresh logs out and rethrows the 401', async () => {
    const logout = vi.fn()
    setLogoutHandler(logout)
    mockFetch({ '/api/v1/pets': [fail(401, 'UNAUTHORIZED')], '/api/v1/auth/refresh': [fail(401, 'INVALID_TOKEN')] })
    await expect(api('/pets')).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 })
    expect(logout).toHaveBeenCalledOnce()
  })

  test('401 on login is a plain error, no refresh', async () => {
    const calls = mockFetch({ '/api/v1/auth/login': [fail(401, 'INVALID_CREDENTIALS')] })
    await expect(api('/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    expect(calls).toEqual(['/api/v1/auth/login'])
  })

  test('429 then 200 retries and resolves', async () => {
    vi.useFakeTimers()
    try {
      const calls = mockFetch({ '/api/v1/pets': [fail(429, 'RATE_LIMIT_EXCEEDED'), ok([])] })
      const p = api('/pets')
      await vi.advanceTimersByTimeAsync(2000) // no Retry-After header -> 2s default
      await expect(p).resolves.toEqual([])
      expect(calls).toEqual(['/api/v1/pets', '/api/v1/pets'])
    } finally {
      vi.useRealTimers()
    }
  })

  test('three 429s reject with RATE_LIMIT_EXCEEDED (nginx HTML body)', async () => {
    vi.useFakeTimers()
    try {
      const calls = mockFetch({ '/api/v1/pets': [
        { status: 429, html: '<html>429</html>' },
        { status: 429, html: '<html>429</html>' },
        { status: 429, html: '<html>429</html>' },
      ] })
      const p = api('/pets').catch((e) => e)
      await vi.advanceTimersByTimeAsync(10_000)
      await expect(p).resolves.toMatchObject({ code: 'RATE_LIMIT_EXCEEDED', status: 429 })
      expect(calls).toEqual(['/api/v1/pets', '/api/v1/pets', '/api/v1/pets'])
    } finally {
      vi.useRealTimers()
    }
  })

  test('honours a positive-integer Retry-After', async () => {
    vi.useFakeTimers()
    try {
      mockFetch({ '/api/v1/pets': [
        { status: 429, body: fail(429, 'RATE_LIMIT_EXCEEDED').body, headers: { 'Retry-After': '3' } },
        ok([]),
      ] })
      const p = api('/pets')
      let resolved = false
      p.then(() => { resolved = true })
      await vi.advanceTimersByTimeAsync(2900)
      expect(resolved).toBe(false) // not yet at 3s
      await vi.advanceTimersByTimeAsync(200)
      await expect(p).resolves.toEqual([])
      expect(resolved).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  test('caps Retry-After at 5s even when the header asks for longer', async () => {
    vi.useFakeTimers()
    try {
      mockFetch({ '/api/v1/pets': [
        { status: 429, body: fail(429, 'RATE_LIMIT_EXCEEDED').body, headers: { 'Retry-After': '60' } },
        ok([]),
      ] })
      const p = api('/pets')
      let resolved = false
      p.then(() => { resolved = true })
      await vi.advanceTimersByTimeAsync(4900)
      expect(resolved).toBe(false) // capped at 5s, not yet there
      await vi.advanceTimersByTimeAsync(200)
      await expect(p).resolves.toEqual([])
      expect(resolved).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  test('sends JSON with same-origin credentials', async () => {
    mockFetch({ '/api/v1/pets': [ok({})] })
    await api('/pets', { method: 'POST', body: { name: 'Rex' } })
    const init = vi.mocked(fetch).mock.calls[0][1]!
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('same-origin')
    expect(init.body).toBe('{"name":"Rex"}')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
  })
})
