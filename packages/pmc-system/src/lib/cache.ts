import type { PMCStore } from '../lib/types'
import { migrateStore } from '../lib/storage'

const emptyStore = (): PMCStore => ({
  raw_materials: [],
  products: [],
  product_materials: [],
  references: [],
  reference_prices: [],
  product_params: [],
})

let cache: PMCStore | null = null

export function getPmcCache(): PMCStore {
  return cache ?? emptyStore()
}

export function setPmcCache(store: PMCStore): void {
  cache = migrateStore({ ...emptyStore(), ...store })
}

export function clearPmcCache(): void {
  cache = null
}
