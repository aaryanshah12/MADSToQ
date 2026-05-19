import { getPmcCache } from '../lib/cache'
import { calculateProductPricing } from '../lib/pricing'
import {
  createReferenceDb,
  deactivateProductDb,
  deactivateRawMaterialDb,
  deleteReferenceDb,
  reloadPmcCache,
  setProductMaterialsDb,
  updateReferenceDb,
  upsertProductDb,
  upsertProductParamsDb,
  upsertRawMaterialDb,
} from './rpc'
import type {
  PMCLineBreakdown,
  PMCProduct,
  PMCProductMaterial,
  PMCProductParams,
  PMCReference,
  PMCReferencePrice,
  PMCRawMaterial,
  PMCPricingResult,
} from '../lib/types'

function read() {
  return getPmcCache()
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

  async upsertRawMaterial(input: { id?: string; name: string; unit?: string }): Promise<PMCRawMaterial> {
    await upsertRawMaterialDb(input)
    await reloadPmcCache()
    const store = read()
    if (input.id) {
      return store.raw_materials.find((m) => m.id === input.id)!
    }
    return store.raw_materials.find(
      (m) => m.name === input.name.trim() && m.unit === (input.unit?.trim() || 'Kg')
    )!
  },

  async deactivateRawMaterial(id: string): Promise<void> {
    await deactivateRawMaterialDb(id)
    await reloadPmcCache()
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

  async upsertProduct(input: { id?: string; name: string; code?: string }): Promise<PMCProduct> {
    const id = await upsertProductDb(input)
    await reloadPmcCache()
    return read().products.find((p) => p.id === id)!
  },

  async deactivateProduct(id: string): Promise<void> {
    await deactivateProductDb(id)
    await reloadPmcCache()
  },

  listProductMaterials(productId: string): PMCProductMaterial[] {
    return read()
      .product_materials.filter((m) => m.product_id === productId)
      .sort((a, b) => a.sort_order - b.sort_order)
  },

  async setProductMaterials(
    productId: string,
    rows: { raw_material_id: string; qty: number; is_primary: boolean }[]
  ): Promise<void> {
    const valid = rows.filter((r) => r.raw_material_id && r.qty > 0)
    const primaryCount = valid.filter((r) => r.is_primary).length
    if (valid.length > 0 && primaryCount !== 1) {
      throw new Error('Select exactly one primary raw material (Yes).')
    }
    await setProductMaterialsDb(productId, valid)
    await reloadPmcCache()
  },

  getPrimaryMaterial(productId: string): PMCProductMaterial | undefined {
    return pmcApi.listProductMaterials(productId).find((m) => m.is_primary)
  },

  getReferenceDetail(referenceId: string) {
    const reference = pmcApi.getReference(referenceId)
    if (!reference) return null
    const prices = pmcApi.getReferencePrices(referenceId)
    const materials = pmcApi.listRawMaterials()
    const nameById = new Map(materials.map((m) => [m.id, m]))
    return {
      reference,
      prices: prices.map((p) => ({
        ...p,
        material_name: nameById.get(p.raw_material_id)?.name ?? '—',
        unit: nameById.get(p.raw_material_id)?.unit ?? 'Kg',
      })),
    }
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

  async createReference(
    prices: { raw_material_id: string; price: number }[],
    notes?: string
  ): Promise<PMCReference> {
    const id = await createReferenceDb(prices, notes)
    await reloadPmcCache()
    return read().references.find((r) => r.id === id)!
  },

  async updateReference(
    id: string,
    prices: { raw_material_id: string; price: number }[],
    notes?: string
  ): Promise<PMCReference> {
    await updateReferenceDb(id, prices, notes)
    await reloadPmcCache()
    return read().references.find((r) => r.id === id)!
  },

  async deleteReference(id: string): Promise<void> {
    await deleteReferenceDb(id)
    await reloadPmcCache()
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

  async upsertProductParams(input: {
    product_id: string
    reference_id: string
    overhead: number
    batch_multiplier: number
    yield_value: number
  }): Promise<PMCProductParams> {
    await upsertProductParamsDb(input)
    await reloadPmcCache()
    return read().product_params.find(
      (p) => p.product_id === input.product_id && p.reference_id === input.reference_id
    )!
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

  dashboardStats() {
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
