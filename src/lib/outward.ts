import { supabase } from './supabase'

export type OutwardEntry = {
  id?: string
  factory_id: string
  product_id: string
  product_name?: string | null
  entry_date?: string | null
  batch_no: string
  no_of_bags: number
  as_is: number
  purity: number
  real?: number | null
  created_by?: string
  created_at?: string
  updated_at?: string
}

type ApiResponse<T> = { error?: string; [key: string]: any } & T

const round2 = (v: number) => Math.round((v ?? 0) * 100) / 100

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const computeReal = (entry: Pick<OutwardEntry, 'as_is' | 'purity'>) =>
  round2((Number(entry.as_is ?? 0) * Number(entry.purity ?? 0)) / 100)

export async function fetchOutwardEntries(params: { factoryIds?: string[]; from?: string; to?: string }) {
  const headers = await authHeaders()
  const qs = new URLSearchParams()
  if (params.factoryIds && params.factoryIds.length > 0) qs.set('factoryIds', params.factoryIds.join(','))
  if (params.from) qs.set('from', params.from)
  if (params.to) qs.set('to', params.to)
  const url = qs.toString().length ? `/api/inventory/outward?${qs.toString()}` : '/api/inventory/outward'
  const res = await fetch(url, { headers })
  const json: ApiResponse<{ entries: OutwardEntry[] }> = await res.json()
  if (!res.ok) throw new Error(json.error || 'Failed to fetch outward entries')
  return json.entries ?? []
}

export async function saveOutwardEntry(entry: OutwardEntry & { created_by: string }) {
  const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) }
  const res = await fetch('/api/inventory/outward', {
    method: 'POST',
    headers,
    body: JSON.stringify(entry),
  })
  const json: ApiResponse<{ entry: OutwardEntry }> = await res.json()
  if (!res.ok) throw new Error(json.error || 'Failed to save outward entry')
  return json.entry
}

export async function deleteOutwardEntry(id: string) {
  const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) }
  const res = await fetch('/api/inventory/outward', {
    method: 'DELETE',
    headers,
    body: JSON.stringify({ id }),
  })
  const json: ApiResponse<{}> = await res.json()
  if (!res.ok) throw new Error(json.error || 'Failed to delete outward entry')
  return true
}

export const totalsForOutward = (entries: OutwardEntry[]) => {
  const totalBags = entries.reduce((s, e) => s + Number(e.no_of_bags ?? 0), 0)
  const totalAsIs = entries.reduce((s, e) => s + Number(e.as_is ?? 0), 0)
  const totalReal = entries.reduce((s, e) => s + Number(e.real ?? computeReal(e)), 0)
  const avgPurity = entries.length > 0
    ? entries.reduce((s, e) => s + Number(e.purity ?? 0), 0) / entries.length
    : 0
  return {
    totalBags,
    totalAsIs: round2(totalAsIs),
    totalReal: round2(totalReal),
    avgPurity: round2(avgPurity),
  }
}

export const toOutwardCsv = (
  entries: OutwardEntry[],
  opts: { includeTotals?: boolean; factoryNameById?: Record<string, string> } = {},
) => {
  const headers = ['Date', 'Factory', 'Product', 'Batch No', 'Bags', 'As is (Kg)', 'Purity (%)', 'Real (Kg)']
  const nameMap = opts.factoryNameById ?? {}
  const rows = entries.map(e => [
    e.entry_date ?? '',
    nameMap[e.factory_id] ?? '',
    e.product_name ?? '',
    e.batch_no ?? '',
    String(Number(e.no_of_bags ?? 0)),
    round2(Number(e.as_is ?? 0)).toFixed(2),
    round2(Number(e.purity ?? 0)).toFixed(2),
    round2(Number(e.real ?? computeReal(e))).toFixed(2),
  ])

  if (opts.includeTotals) {
    const totals = totalsForOutward(entries)
    rows.push([])
    rows.push([
      'Totals',
      '',
      '',
      '',
      String(totals.totalBags),
      totals.totalAsIs.toFixed(2),
      `${totals.avgPurity.toFixed(2)} (avg)`,
      totals.totalReal.toFixed(2),
    ])
  }

  const lines = [headers.join(','), ...rows.map(r => r.join(','))]
  return lines.join('\n')
}

