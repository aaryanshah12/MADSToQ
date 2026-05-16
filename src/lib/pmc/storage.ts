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

export function loadStore(): PMCStore {
  if (typeof window === 'undefined') return emptyStore()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyStore()
    return { ...emptyStore(), ...JSON.parse(raw) }
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
