import { supabase } from './supabase'

export type MonthlyEntry = {
  id?: string
  factory_id: string
  batch_id: string
  month: number
  fiscal_year: string
  oleum_23?: number | null
  as_is_kg?: number | null
  purity_nv?: number | null
  free_acidity?: number | null
  actual_real_kg?: number | null
  used_pnt?: number | null
  yield_pct?: number | null
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

export const getCurrentFiscalYear = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() + 1 // 1-12
  // FY starts in April
  const startYear = month >= 4 ? year : year - 1
  const endYear = startYear + 1
  return `FY${startYear}-${String(endYear).slice(-2)}`
}

export const getFiscalYears = (count = 5) => {
  const current = getCurrentFiscalYear()
  const startYear = Number(current.slice(2, 6))
  const years: string[] = []
  for (let i = 0; i < count; i++) {
    const fyStart = startYear - i
    const fyEnd = (fyStart + 1).toString().slice(-2)
    years.push(`FY${fyStart}-${fyEnd}`)
  }
  return years
}

export const monthOptions = [
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
]

export async function fetchMonthlyEntries(params: { fiscal_year: string; month: number; factoryIds?: string[] }) {
  const headers = await authHeaders()
  const qs = new URLSearchParams({
    fiscal_year: params.fiscal_year,
    month: String(params.month),
  })
  if (params.factoryIds && params.factoryIds.length > 0) {
    qs.set('factoryIds', params.factoryIds.join(','))
  }
  const res = await fetch(`/api/inventory/monthly-material?${qs.toString()}`, { headers })
  const json: ApiResponse<{ entries: MonthlyEntry[] }> = await res.json()
  if (!res.ok) throw new Error(json.error || 'Failed to fetch entries')
  const entries = json.entries ?? []
  // Keep batches sorted ascending for consistent table and export order
  return entries.slice().sort((a, b) =>
    String(a.batch_id ?? '').localeCompare(String(b.batch_id ?? ''), undefined, {
      numeric: true,
      sensitivity: 'base',
    }),
  )
}

export async function saveMonthlyEntry(entry: MonthlyEntry) {
  const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) }
  const isUpdate = Boolean(entry.id)
  const res = await fetch('/api/inventory/monthly-material', {
    method: isUpdate ? 'PATCH' : 'POST',
    headers,
    body: JSON.stringify(entry),
  })
  const json: ApiResponse<{ entry: MonthlyEntry }> = await res.json()
  if (!res.ok) throw new Error(json.error || 'Failed to save entry')
  return json.entry
}

export async function deleteMonthlyEntry(id: string) {
  const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) }
  const res = await fetch('/api/inventory/monthly-material', {
    method: 'DELETE',
    headers,
    body: JSON.stringify({ id }),
  })
  const json: ApiResponse<{}> = await res.json()
  if (!res.ok) throw new Error(json.error || 'Failed to delete entry')
  return true
}

export const computeDerived = (entry: MonthlyEntry) => {
  const asIs = Number(entry.as_is_kg ?? 0)
  const purity = Number(entry.purity_nv ?? 0)
  const usedPnt = Number(entry.used_pnt ?? 5000)
  const actual_real_kg = round2((asIs * purity) / 100)
  const yield_pct = round2(usedPnt > 0 ? actual_real_kg / usedPnt : 0)
  return { actual_real_kg, used_pnt: usedPnt, yield_pct }
}

export const totalsFor = (entries: MonthlyEntry[]) => {
  const totalActual = entries.reduce((s, e) => s + Number(e.actual_real_kg ?? 0), 0)
  const totalUsed = entries.reduce((s, e) => s + Number(e.used_pnt ?? 0), 0)
  const avgYield = entries.length > 0
    ? entries.reduce((s, e) => s + Number(e.yield_pct ?? 0), 0) / entries.length
    : 0
  return { totalActual: round2(totalActual), totalUsed: round2(totalUsed), avgYield: round2(avgYield) }
}

export const toCsv = (entries: MonthlyEntry[], includeFreeAcidity: boolean, includeTotals = false) => {
  const entriesWithDerived = entries.map(e => {
    const derived = computeDerived(e)
    return {
      ...e,
      actual_real_kg: e.actual_real_kg ?? derived.actual_real_kg,
      yield_pct: e.yield_pct ?? derived.yield_pct,
      used_pnt: e.used_pnt ?? derived.used_pnt,
    }
  })
  const headers = [
    'BatchId',
    'Oleum23',
    'AS_IS_Kg',
    'Purity_NV',
    ...(includeFreeAcidity ? ['Free_Acidity'] : []),
    'Actual_Real_KG',
    'Used_PNT',
    'Yield',
  ]
  const rows = entriesWithDerived.map(e => [
    e.batch_id,
    e.oleum_23 ?? '',
    e.as_is_kg ?? '',
    e.purity_nv ?? '',
    ...(includeFreeAcidity ? [e.free_acidity ?? ''] : []),
    round2(Number(e.actual_real_kg ?? 0)).toFixed(2),
    round2(Number(e.used_pnt ?? 0)).toFixed(2),
    round2(Number(e.yield_pct ?? 0)).toFixed(2),
  ])

  if (includeTotals) {
    const totals = totalsFor(entriesWithDerived)
    rows.push([])
    rows.push([
      'Totals',
      '',
      '',
      '',
      ...(includeFreeAcidity ? [''] : []),
      totals.totalActual.toFixed(2),
      totals.totalUsed.toFixed(2),
      `${totals.avgYield.toFixed(2)} (avg)`,
    ])
  }

  const lines = [headers.join(','), ...rows.map(r => r.join(','))]
  return lines.join('\n')
}
