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

  const needsRefMigrate = store.references.some(
    (r) => !/^REF-\d{3}$/.test(r.ref_number)
  )
  if (needsRefMigrate && store.references.length > 0) {
    const sorted = [...store.references].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    sorted.forEach((r, i) => {
      const row = store.references.find((x) => x.id === r.id)
      if (row) row.ref_number = `REF-${String(i + 1).padStart(3, '0')}`
    })
  }

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

/** Sequential reference ids: REF-001, REF-002, … */
export function nextRefNumber(references: { ref_number: string }[]): string {
  let max = 0
  for (const r of references) {
    const m = r.ref_number.match(/^REF-(\d{3})$/)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `REF-${String(max + 1).padStart(3, '0')}`
}
