import { authClient } from '@madstoq/auth'

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await authClient.auth.getSession()
  const token = data.session?.access_token
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
