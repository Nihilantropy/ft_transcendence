import { extractError, type ApiErrorDetails } from '@/lib/utils'
import ky, { HTTPError, type Hooks } from 'ky'

declare module 'ky' {
  interface HTTPError {
    detail?: string
    code?: string
    details?: ApiErrorDetails
  }
}

export const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api'

let refreshPromise: Promise<boolean> | null = null

async function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
      return res.ok
    } catch {
      return false
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

const hooks: Hooks = {
  afterResponse: [
    // refresh-on-401: try to renew the access cookie once, then replay
    async ({ request, response }) => {
      if (response.status !== 401) return response
      if (request.url.includes('/auth/refresh') || request.url.includes('/auth/login')) {
        return response
      }
      const refreshed = await tryRefresh()
      if (!refreshed) return response
      return ky(request)
    },
  ],
  beforeError: [
    // enrich the HTTPError with `code` + `detail` pulled from the response body
    ({ error }) => {
      if (!(error instanceof HTTPError)) return error
      const { code, message, details } = extractError(error.data)
      error.code = code
      error.detail = message
      error.details = details
      return error
    },
  ],
}

export const api = ky.create({
  prefix: BASE_URL,
  credentials: 'include',
  retry: { limit: 0 },
  hooks,
})
