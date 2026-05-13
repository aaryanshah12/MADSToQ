import { supabase } from './supabase'

export type DrilldownRow = {
  supplier: string
  product: string
  quantity: number
  unit?: string
}

type BaseOptions = {
  factoryIds: string[]
}

type LoadedOptions = BaseOptions & {
  createdBy?: string
}

const normalizeText = (value: string | null | undefined, fallback: string) =>
  (value ?? '').trim() || fallback

const aggregate = (rows: DrilldownRow[]) => {
  const map = new Map<string, DrilldownRow>()
  rows.forEach(r => {
    const key = `${r.supplier}||${r.product}`
    const existing = map.get(key)
    if (existing) {
      existing.quantity += r.quantity
    } else {
      map.set(key, { ...r })
    }
  })
  return Array.from(map.values()).sort((a, b) => b.quantity - a.quantity)
}

export async function fetchLoadedDrilldown({ factoryIds, createdBy }: LoadedOptions): Promise<DrilldownRow[]> {
  if (factoryIds.length === 0) return []

  let query = supabase
    .from('stock_entries_safe')
    .select('supplier_name, material_type, tons_loaded')
    .in('factory_id', factoryIds)

  if (createdBy) {
    query = query.eq('created_by', createdBy)
  }

  const { data, error } = await query
  if (error || !data) return []

  const rows = data.map(d => ({
    supplier: normalizeText(d.supplier_name, 'Unknown supplier'),
    product: normalizeText(d.material_type, 'Unknown product'),
    quantity: Number(d.tons_loaded ?? 0),
    unit: 'KGS',
  }))

  return aggregate(rows)
}

export async function fetchRemainingDrilldown({ factoryIds }: BaseOptions): Promise<DrilldownRow[]> {
  if (factoryIds.length === 0) return []

  const { data: balances, error } = await supabase
    .from('stock_balance')
    .select('invoice_number, material_type, tons_remaining')
    .in('factory_id', factoryIds)

  if (error || !balances) return []

  const invoiceNumbers = Array.from(
    new Set(
      balances
        .map(b => b.invoice_number)
        .filter(Boolean)
    )
  )

  let supplierMap: Record<string, string> = {}
  if (invoiceNumbers.length > 0) {
    const { data: stocks } = await supabase
      .from('stock_entries_safe')
      .select('invoice_number, supplier_name')
      .in('invoice_number', invoiceNumbers)

    supplierMap = Object.fromEntries(
      (stocks ?? []).map(s => [s.invoice_number, s.supplier_name ?? 'Unknown supplier'])
    )
  }

  const rows = balances
    .filter(b => Number(b.tons_remaining) > 0)
    .map(b => ({
      supplier: normalizeText(supplierMap[b.invoice_number] ?? 'Unknown supplier', 'Unknown supplier'),
      product: normalizeText(b.material_type, 'Unknown product'),
      quantity: Number(b.tons_remaining ?? 0),
      unit: 'KGS',
    }))

  return aggregate(rows)
}
