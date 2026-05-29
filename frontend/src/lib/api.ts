import { auth } from './auth'

// Empty (relative) by default: requests go to the same origin and the Vite dev
// proxy (see vite.config.ts) forwards /api to Django. Override with VITE_API_URL
// to point straight at the API (e.g. a deployed backend with CORS enabled).
export const API_BASE = import.meta.env.VITE_API_URL ?? ''

export interface TokenPair {
  username: string
  access: string
  refresh: string
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// POST /api/token/pair — exchange username/password for a JWT access/refresh pair.
export async function obtainTokenPair(
  username: string,
  password: string,
): Promise<TokenPair> {
  const res = await fetch(`${API_BASE}/api/token/pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    throw new ApiError(
      res.status,
      res.status === 401 || res.status === 403
        ? 'Invalid username or password.'
        : 'Could not sign in. Please try again.',
    )
  }
  return res.json() as Promise<TokenPair>
}

// POST /api/token/refresh — mint a fresh access token from the stored refresh
// token. Returns the new access token, or null if refresh is impossible (no
// refresh token, or the server rejected it — in which case the session is cleared).
async function refreshAccessToken(): Promise<string | null> {
  const refresh = auth.getRefresh()
  if (!refresh) return null

  const res = await fetch(`${API_BASE}/api/token/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  })
  if (!res.ok) {
    auth.clear()
    return null
  }

  const data = (await res.json()) as { access: string | null; refresh: string }
  if (data.access) auth.setAccess(data.access)
  return data.access
}

// Authenticated request against the Django API. Attaches the bearer token and,
// on a 401, transparently refreshes the access token once and retries.
export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const send = (token: string | null) =>
    fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

  let res = await send(auth.getToken())
  if (res.status === 401) {
    const access = await refreshAccessToken()
    if (access) res = await send(access)
  }
  return res
}
