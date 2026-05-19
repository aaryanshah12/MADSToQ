import { inventoryApi } from '@madstoq/inventory-system/api'

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

  const { rows } = await inventoryApi.fetchLoadedDrilldown(factoryIds, createdBy)

  const mapped = rows.map(d => ({
    supplier: normalizeText(d.supplier_name, 'Unknown supplier'),
    product: normalizeText(d.material_type, 'Unknown product'),
    quantity: Number(d.tons_loaded ?? 0),
    unit: 'KGS',
  }))

  return aggregate(mapped)
}

export async function fetchRemainingDrilldown({ factoryIds }: BaseOptions): Promise<DrilldownRow[]> {
  if (factoryIds.length === 0) return []

  const { rows, stocks } = await inventoryApi.fetchRemainingDrilldown(factoryIds)

  const supplierMap: Record<string, string> = Object.fromEntries(
    stocks.map(s => [s.invoice_number, s.supplier_name ?? 'Unknown supplier'])
  )

  const mapped = rows
    .filter(b => Number(b.tons_remaining) > 0)
    .map(b => ({
      supplier: normalizeText(supplierMap[b.invoice_number] ?? 'Unknown supplier', 'Unknown supplier'),
      product: normalizeText(b.material_type, 'Unknown product'),
      quantity: Number(b.tons_remaining ?? 0),
      unit: 'KGS',
    }))

  return aggregate(mapped)
}
