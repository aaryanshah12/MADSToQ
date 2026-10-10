/** API helpers — Auth.js session cookie (same-origin); no Supabase. */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  return { 'Content-Type': 'application/json' }
}

export async function rpcPost<T>(path: string, action: string, params?: Record<string, unknown>): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
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
  const res = await fetch(`${path}${qs}`, {
    credentials: 'same-origin',
    headers: await getAuthHeaders(),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(json.error || `Request failed (${res.status})`)
  }
  return json as T
}
