import { authClient } from '@madstoq/auth'

let cachedAccessToken: string | null = null
let inflightToken: Promise<string | null> | null = null
let sessionListenerReady = false

function ensureSessionListener() {
  if (sessionListenerReady || typeof window === 'undefined') return
  sessionListenerReady = true
  authClient.auth.getSession().then(({ data }) => {
    cachedAccessToken = data.session?.access_token ?? null
  })
  authClient.auth.onAuthStateChange((_event, session) => {
    cachedAccessToken = session?.access_token ?? null
  })
}

/** Call after sign-in so the next API request does not wait on getSession(). */
export function setCachedAccessToken(token: string | null) {
  cachedAccessToken = token
}

async function getAccessToken(): Promise<string | null> {
  ensureSessionListener()
  if (cachedAccessToken) return cachedAccessToken
  if (!inflightToken) {
    inflightToken = authClient.auth.getSession().then(({ data }) => {
      cachedAccessToken = data.session?.access_token ?? null
      inflightToken = null
      return cachedAccessToken
    })
  }
  return inflightToken
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

export async function rpcPost<T>(path: string, action: string, params?: Record<string, unknown>): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ action, params: params ?? {} }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(json.error || `Request failed (${res.status})`)
  }
  return json.data as T
}

export async function apiGet<T>(path: string, query?: Record<string, string>): Promise<T> {
  const qs = query ? `?${new URLSearchParams(query).toString()}` : ''
  const res = await fetch(`${path}${qs}`, { headers: await getAuthHeaders() })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(json.error || `Request failed (${res.status})`)
  }
  return json as T
}
