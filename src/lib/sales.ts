import { supabase } from './supabase'
import { getCurrentFiscalYear, getFiscalYears, monthOptions } from './monthlyMaterial'

export { getCurrentFiscalYear, getFiscalYears, monthOptions }

export type SalesEntry = {
  id?: string
  fiscal_year: string
  month: number
  factory_id?: string
  turnover?: number | null
  pntosa?: number | null
  hydrazone?: number | null
  sales_entry_lines?: SalesEntryLine[]
  notes?: string | null
  created_by?: string
  created_at?: string
  updated_at?: string
}

export type SalesEntryLine = {
  id?: string
  sales_entry_id?: string
  product_name: string
  price_rupees?: number | null
  quantity_kg?: number | null
}

type ApiResponse<T> = { error?: string; [key: string]: any } & T

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function fetchSalesEntries(params: { fiscal_year: string; factory_id: string }) {
  const headers = await authHeaders()
  const qs = new URLSearchParams({ fiscal_year: params.fiscal_year, factory_id: params.factory_id })
  const res = await fetch(`/api/inventory/sales?${qs.toString()}`, { headers })
  const json: ApiResponse<{ entries: SalesEntry[] }> = await res.json()
  if (!res.ok) throw new Error(json.error || 'Failed to fetch sales entries')
  return json.entries ?? []
}

export type SaveSalesEntryPayload =
  Pick<SalesEntry, 'fiscal_year' | 'month' | 'factory_id' | 'notes' | 'turnover' | 'pntosa' | 'hydrazone'> & {
    created_by: string
    lines?: Array<Pick<SalesEntryLine, 'product_name' | 'price_rupees' | 'quantity_kg'>>
  }

export async function saveSalesEntry(entry: SaveSalesEntryPayload) {
  const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) }
  const res = await fetch('/api/inventory/sales', {
    method: 'POST',
    headers,
    body: JSON.stringify(entry),
  })
  const json: ApiResponse<{ entry: SalesEntry }> = await res.json()
  if (!res.ok) throw new Error(json.error || 'Failed to save sales entry')
  return json.entry
}

export async function deleteSalesEntry(id: string) {
  const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) }
  const res = await fetch('/api/inventory/sales', {
    method: 'DELETE',
    headers,
    body: JSON.stringify({ id }),
  })
  const json: ApiResponse<{}> = await res.json()
  if (!res.ok) throw new Error(json.error || 'Failed to delete sales entry')
  return true
}

const round2 = (v: number) => Math.round((v ?? 0) * 100) / 100

export function toCsv(entries: SalesEntry[]) {
  // Export line-items; falls back to legacy totals when no lines exist.
  const headers = ['Fiscal_Year', 'Month', 'Product', 'Price_Rupees', 'Quantity_KG', 'Notes']
  const rows: string[][] = []

  entries
    .slice()
    .sort((a, b) => (a.month ?? 0) - (b.month ?? 0))
    .forEach(e => {
      const notes = (e.notes ?? '').replaceAll('\n', ' ').replaceAll(',', ' ')
      const lines = (e.sales_entry_lines ?? []).slice()
      if (lines.length === 0) {
        ;[
          ['Turnover', e.turnover, null],
          ['PNTOSA', e.pntosa, null],
          ['Hydrazone', e.hydrazone, null],
        ].forEach(([product, price]) => {
          if (price == null) return
          rows.push([
            e.fiscal_year,
            String(e.month),
            String(product),
            round2(Number(price)).toFixed(2),
            '',
            notes,
          ])
        })
        return
      }
      lines.forEach(l => {
        rows.push([
          e.fiscal_year,
          String(e.month),
          (l.product_name ?? '').replaceAll(',', ' '),
          l.price_rupees == null ? '' : round2(Number(l.price_rupees)).toFixed(2),
          l.quantity_kg == null ? '' : round2(Number(l.quantity_kg)).toFixed(2),
          notes,
        ])
      })
    })

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
}

