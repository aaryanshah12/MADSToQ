import { supabase } from './supabase'

export type InwardEntry = {
  id?: string
  factory_id: string
  product_id: string
  product_name?: string | null
  entry_date?: string | null
  tons: number
  created_by?: string
  created_at?: string
  updated_at?: string
}

type ApiResponse<T> = { error?: string; [key: string]: any } & T

const round3 = (v: number) => Math.round((v ?? 0) * 1000) / 1000

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function fetchInwardEntries(params: { factoryIds?: string[]; from?: string; to?: string }) {
  const headers = await authHeaders()
  const qs = new URLSearchParams()
  if (params.factoryIds && params.factoryIds.length > 0) qs.set('factoryIds', params.factoryIds.join(','))
  if (params.from) qs.set('from', params.from)
  if (params.to) qs.set('to', params.to)
  const url = qs.toString().length ? `/api/inventory/inward?${qs.toString()}` : '/api/inventory/inward'
  const res = await fetch(url, { headers })
  const json: ApiResponse<{ entries: InwardEntry[] }> = await res.json()
  if (!res.ok) throw new Error(json.error || 'Failed to fetch inward entries')
  return json.entries ?? []
}

export async function saveInwardEntry(entry: InwardEntry & { created_by: string }) {
  const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) }
  const res = await fetch('/api/inventory/inward', {
    method: 'POST',
    headers,
    body: JSON.stringify(entry),
  })
  const json: ApiResponse<{ entry: InwardEntry }> = await res.json()
  if (!res.ok) throw new Error(json.error || 'Failed to save inward entry')
  return json.entry
}

export async function deleteInwardEntry(id: string) {
  const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) }
  const res = await fetch('/api/inventory/inward', {
    method: 'DELETE',
    headers,
    body: JSON.stringify({ id }),
  })
  const json: ApiResponse<{}> = await res.json()
  if (!res.ok) throw new Error(json.error || 'Failed to delete inward entry')
  return true
}

export const totalsForInward = (entries: InwardEntry[]) => {
  const totalTons = entries.reduce((s, e) => s + Number(e.tons ?? 0), 0)
  return { totalTons: round3(totalTons) }
}

export const toInwardCsv = (
  entries: InwardEntry[],
  opts: { includeTotals?: boolean; factoryNameById?: Record<string, string> } = {},
) => {
  const headers = ['Date', 'Factory', 'Product', 'TONS (in Kg)']
  const nameMap = opts.factoryNameById ?? {}
  const rows = entries.map(e => [
    e.entry_date ?? '',
    nameMap[e.factory_id] ?? '',
    e.product_name ?? '',
    round3(Number(e.tons ?? 0)).toFixed(3),
  ])

  if (opts.includeTotals) {
    const totals = totalsForInward(entries)
    rows.push([])
    rows.push(['Totals', '', '', totals.totalTons.toFixed(3)])
  }

  const lines = [headers.join(','), ...rows.map(r => r.join(','))]
  return lines.join('\n')
}

