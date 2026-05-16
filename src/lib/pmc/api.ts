import { calculateProductPricing } from './pricing'
import { loadStore, newId, nextRefNumber, saveStore } from './storage'
import type {
  PMCLineBreakdown,
  PMCProduct,
  PMCProductMaterial,
  PMCProductParams,
  PMCReference,
  PMCReferencePrice,
  PMCRawMaterial,
  PMCPricingResult,
} from './types'

function read() {
  return loadStore()
}

function write(store: ReturnType<typeof loadStore>) {
  saveStore(store)
}

export const pmcApi = {
  // ─── Raw materials ─────────────────────────────────────────
  listRawMaterials(): PMCRawMaterial[] {
    return read()
      .raw_materials.filter((m) => m.is_active)
      .sort((a, b) => a.name.localeCompare(b.name))
  },

  listAllRawMaterials(): PMCRawMaterial[] {
    return read().raw_materials.sort((a, b) => a.name.localeCompare(b.name))
  },

  upsertRawMaterial(input: { id?: string; name: string; unit?: string }): PMCRawMaterial {
    const store = read()
    const now = new Date().toISOString()
    if (input.id) {
      const idx = store.raw_materials.findIndex((m) => m.id === input.id)
      if (idx >= 0) {
        store.raw_materials[idx] = {
          ...store.raw_materials[idx],
          name: input.name.trim(),
          unit: input.unit?.trim() || 'Kg',
        }
        write(store)
        return store.raw_materials[idx]
      }
    }
    const row: PMCRawMaterial = {
      id: newId(),
      name: input.name.trim(),
      unit: input.unit?.trim() || 'Kg',
      is_active: true,
      created_at: now,
    }
    store.raw_materials.push(row)
    write(store)
    return row
  },

  deactivateRawMaterial(id: string): void {
    const store = read()
    const m = store.raw_materials.find((x) => x.id === id)
    if (m) m.is_active = false
    write(store)
  },

  // ─── Products ──────────────────────────────────────────────
  listProducts(): PMCProduct[] {
    return read()
      .products.filter((p) => p.is_active)
      .sort((a, b) => a.name.localeCompare(b.name))
  },

  getProduct(id: string): PMCProduct | undefined {
    return read().products.find((p) => p.id === id)
  },

  upsertProduct(input: { id?: string; name: string; code?: string }): PMCProduct {
    const store = read()
    const now = new Date().toISOString()
    if (input.id) {
      const idx = store.products.findIndex((p) => p.id === input.id)
      if (idx >= 0) {
        store.products[idx] = {
          ...store.products[idx],
          name: input.name.trim(),
          code: input.code?.trim() || null,
        }
        write(store)
        return store.products[idx]
      }
    }
    const row: PMCProduct = {
      id: newId(),
      name: input.name.trim(),
      code: input.code?.trim() || null,
      is_active: true,
      created_at: now,
    }
    store.products.push(row)
    write(store)
    return row
  },

  listProductMaterials(productId: string): PMCProductMaterial[] {
    return read()
      .product_materials.filter((m) => m.product_id === productId)
      .sort((a, b) => a.sort_order - b.sort_order)
  },

  setProductMaterials(
    productId: string,
    rows: { raw_material_id: string; qty: number }[]
  ): void {
    const store = read()
    store.product_materials = store.product_materials.filter((m) => m.product_id !== productId)
    rows.forEach((row, i) => {
      if (!row.raw_material_id || row.qty <= 0) return
      store.product_materials.push({
        id: newId(),
        product_id: productId,
        raw_material_id: row.raw_material_id,
        qty: row.qty,
        sort_order: i,
      })
    })
    write(store)
  },

  // ─── References ──────────────────────────────────────────
  listReferences(): PMCReference[] {
    return read().references.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  },

  getReference(id: string): PMCReference | undefined {
    return read().references.find((r) => r.id === id)
  },

  getReferencePrices(referenceId: string): PMCReferencePrice[] {
    return read().reference_prices.filter((p) => p.reference_id === referenceId)
  },

  getLatestReference(): PMCReference | undefined {
    return pmcApi.listReferences()[0]
  },

  getPricesForReference(referenceId: string): Map<string, number> {
    const map = new Map<string, number>()
    pmcApi.getReferencePrices(referenceId).forEach((p) => {
      map.set(p.raw_material_id, p.price)
    })
    return map
  },

  createReference(
    prices: { raw_material_id: string; price: number }[],
    notes?: string
  ): PMCReference {
    const store = read()
    const ref_number = nextRefNumber(store.references)
    const ref: PMCReference = {
      id: newId(),
      ref_number,
      created_at: new Date().toISOString(),
      notes: notes?.trim() || null,
    }
    store.references.push(ref)
    prices.forEach((p) => {
      store.reference_prices.push({
        id: newId(),
        reference_id: ref.id,
        raw_material_id: p.raw_material_id,
        price: p.price,
      })
    })
    write(store)
    return ref
  },

  // ─── Product params (per reference) ────────────────────────
  getProductParams(productId: string, referenceId: string): PMCProductParams | undefined {
    return read().product_params.find(
      (p) => p.product_id === productId && p.reference_id === referenceId
    )
  },

  listProductParams(productId: string): PMCProductParams[] {
    return read().product_params.filter((p) => p.product_id === productId)
  },

  upsertProductParams(input: {
    product_id: string
    reference_id: string
    overhead: number
    tons_kg: number
    yield_value: number
  }): PMCProductParams {
    const store = read()
    const idx = store.product_params.findIndex(
      (p) => p.product_id === input.product_id && p.reference_id === input.reference_id
    )
    const row: PMCProductParams = {
      id: idx >= 0 ? store.product_params[idx].id : newId(),
      product_id: input.product_id,
      reference_id: input.reference_id,
      overhead: input.overhead,
      tons_kg: input.tons_kg,
      yield_value: input.yield_value,
      updated_at: new Date().toISOString(),
    }
    if (idx >= 0) store.product_params[idx] = row
    else store.product_params.push(row)
    write(store)
    return row
  },

  // ─── Pricing ─────────────────────────────────────────────
  calculatePricing(productId: string, referenceId: string): PMCPricingResult | null {
    const store = read()
    const reference = store.references.find((r) => r.id === referenceId)
    if (!reference) return null
    const params = store.product_params.find(
      (p) => p.product_id === productId && p.reference_id === referenceId
    )
    const materials = store.product_materials.filter((m) => m.product_id === productId)
    const refPrices = store.reference_prices.filter((p) => p.reference_id === referenceId)
    return calculateProductPricing(
      reference,
      materials,
      store.raw_materials,
      refPrices,
      params ?? null
    )
  },

  pricingSheetForProduct(productId: string): {
    reference: PMCReference
    params: PMCProductParams | null
    result: PMCPricingResult | null
  }[] {
    return pmcApi.listReferences().map((reference) => {
      const params = pmcApi.getProductParams(productId, reference.id) ?? null
      const result = pmcApi.calculatePricing(productId, reference.id)
      return { reference, params, result }
    })
  },

  // ─── Dashboard ───────────────────────────────────────────
  dashboardStats() {
    const store = read()
    const references = pmcApi.listReferences()
    const products = pmcApi.listProducts()
    const recentRefs = references.slice(0, 5)
    const recentProducts = [...products]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
    return {
      referenceCount: references.length,
      productCount: products.length,
      rawMaterialCount: pmcApi.listRawMaterials().length,
      recentRefs,
      recentProducts,
    }
  },

  breakdownLines(productId: string, referenceId: string): PMCLineBreakdown[] {
    return pmcApi.calculatePricing(productId, referenceId)?.lines ?? []
  },
}
