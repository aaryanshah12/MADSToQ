import type { PMCStore } from './types'

const STORAGE_KEY = 'pmc-store-v1'

const emptyStore = (): PMCStore => ({
  raw_materials: [],
  products: [],
  product_materials: [],
  references: [],
  reference_prices: [],
  product_params: [],
})

function migrateStore(store: PMCStore): PMCStore {
  store.product_params = store.product_params.map((p) => {
    const legacy = (p as { tons_kg?: number }).tons_kg
    const batch_multiplier =
      p.batch_multiplier > 0
        ? p.batch_multiplier
        : legacy !== undefined && legacy > 0
          ? legacy
          : 1
    const { tons_kg: _removed, ...rest } = p as PMCStore['product_params'][0] & {
      tons_kg?: number
    }
    return { ...rest, batch_multiplier }
  })

  store.product_materials = store.product_materials.map((m) => ({
    ...m,
    is_primary: Boolean(m.is_primary),
  }))

  const byProduct = new Map<string, typeof store.product_materials>()
  for (const m of store.product_materials) {
    const list = byProduct.get(m.product_id) ?? []
    list.push(m)
    byProduct.set(m.product_id, list)
  }
  byProduct.forEach((rows) => {
    if (rows.some((r) => r.is_primary)) return
    if (rows.length > 0) rows[0].is_primary = true
  })

  return store
}

export function loadStore(): PMCStore {
  if (typeof window === 'undefined') return emptyStore()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyStore()
    return migrateStore({ ...emptyStore(), ...JSON.parse(raw) })
  } catch {
    return emptyStore()
  }
}

export function saveStore(store: PMCStore): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export function newId(): string {
  return crypto.randomUUID()
}

export function nextRefNumber(references: { ref_number: string }[]): string {
  const prefix = `REF-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-`
  const today = references.filter((r) => r.ref_number.startsWith(prefix))
  const seq = today.length + 1
  return `${prefix}${String(seq).padStart(3, '0')}`
}
