export type Pet = {
  id: string
  name: string
  species: 'dog' | 'cat' | 'other'
  breed: string
  breed_confidence: number | null
  age: number | null
  weight: number | null
  health_conditions: string[]
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details: Record<string, string[] | string> = {},
  ) {
    super(message)
  }
}

type Opts = { method?: string; body?: unknown; timeoutMs?: number }

// Paths whose 401 means "wrong credentials / no session", never "access token expired".
const NO_REFRESH = ['/auth/login', '/auth/login/2fa', '/auth/register', '/auth/refresh', '/auth/logout']

// nginx answers these itself with an HTML page, not the JSON envelope.
const STATUS_CODES: Record<number, string> = {
  413: 'IMAGE_TOO_LARGE',
  429: 'RATE_LIMIT_EXCEEDED',
  502: 'SERVICE_UNAVAILABLE',
  503: 'SERVICE_UNAVAILABLE',
  504: 'TIMEOUT',
}

let onLogout = () => {}
export function setLogoutHandler(fn: () => void) {
  onLogout = fn
}

// One refresh in flight at a time: parallel 401s all wait on the same promise.
let refreshing: Promise<boolean> | null = null
function refresh(): Promise<boolean> {
  refreshing ??= fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'same-origin' })
    .then((r) => r.ok, () => false)
    .finally(() => { refreshing = null })
  return refreshing
}

// A positive-integer Retry-After is honoured (seconds), else a 2s default; either way capped at
// 5s so a misbehaving/hostile upstream can't stall the caller.
function retryDelayMs(res: Response): number {
  const header = res.headers.get('Retry-After')
  const seconds = header && /^\d+$/.test(header) && Number(header) > 0 ? Number(header) : 2
  return Math.min(seconds, 5) * 1000
}

export async function api<T = unknown>(path: string, opts: Opts = {}, retried = false): Promise<T> {
  const hasBody = opts.body !== undefined
  let res: Response
  // ponytail: fixed 2-retry ceiling for 429s (nginx's own burst limit, not the API's); a real
  // request queue/backoff is only worth it if this proves insufficient in practice.
  for (let attempt = 0; ; attempt++) {
    try {
      res = await fetch('/api/v1' + path, {
        method: opts.method ?? 'GET',
        credentials: 'same-origin',
        headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
        body: hasBody ? JSON.stringify(opts.body) : undefined,
        signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
      })
    } catch (e) {
      const timeout = e instanceof DOMException && e.name === 'TimeoutError'
      throw new ApiError(timeout ? 'TIMEOUT' : 'NETWORK_ERROR', String(e), 0)
    }
    if (res.status !== 429 || attempt >= 2) break
    await new Promise((r) => setTimeout(r, retryDelayMs(res)))
  }

  if (res.status === 401 && !NO_REFRESH.includes(path)) {
    if (!retried && (await refresh())) return api<T>(path, opts, true)
    onLogout()
  }

  const text = await res.text()
  let body: any = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    // ponytail: non-JSON = an nginx HTML page; mapped by status below
  }
  if (res.ok && body?.success !== false) return body?.data as T

  // The vision route raises HTTPException, so FastAPI nests the envelope under "detail".
  const inner = body?.detail && typeof body.detail === 'object' ? body.detail : body
  const err = inner?.error
  if (err?.code) throw new ApiError(err.code, err.message ?? '', res.status, err.details ?? {})
  throw new ApiError(STATUS_CODES[res.status] ?? 'UNKNOWN', text.slice(0, 200), res.status)
}
