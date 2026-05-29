import { getPmcCache } from '../lib/cache'
import { calculateProductPricing } from '../lib/pricing'
import { productUnitPriceFromRecipe } from '../lib/bom-pricing'
import {
  createBatchDb,
  createReferenceDb,
  deactivateProductDb,
  deactivateRawMaterialDb,
  deleteBatchDb,
  deleteReferenceDb,
  reloadPmcCache,
  saveProductWithMaterialsDb,
  setProductMaterialsDb,
  updateBatchDb,
  updateProcurementPriceDb,
  updateReferenceDb,
  upsertProductDb,
  upsertProductParamsDb,
  upsertRawMaterialDb,
} from './rpc'
import type {
  PMCBatch,
  PMCBatchLine,
  PMCBatchStatus,
  PMCLineBreakdown,
  PMCProduct,
  PMCProductMaterial,
  PMCProductParams,
  PMCReference,
  PMCReferencePrice,
  PMCRawMaterial,
  PMCPricingResult,
} from '../lib/types'
import type { CreateBatchInput } from './rpc'

function read() {
  return getPmcCache()
}

function inFactory<T extends { factory_id: string }>(items: T[], factoryId: string): T[] {
  if (!factoryId) return []
  return items.filter((i) => i.factory_id === factoryId)
}

function productIdsForFactory(factoryId: string): Set<string> {
  return new Set(inFactory(read().products, factoryId).map((p) => p.id))
}

function batchIdsForFactory(factoryId: string): Set<string> {
  return new Set(inFactory(read().batches, factoryId).map((b) => b.id))
}

export function createPmcApi(factoryId: string) {
  const assertFactory = () => {
    if (!factoryId) throw new Error('Select a factory to continue')
  }

  const api = {
    factoryId,

    listRawMaterials(): PMCRawMaterial[] {
      return inFactory(read().raw_materials, factoryId)
        .filter((m) => m.is_active)
        .sort((a, b) => a.name.localeCompare(b.name))
    },

    listAllRawMaterials(): PMCRawMaterial[] {
      return inFactory(read().raw_materials, factoryId).sort((a, b) => a.name.localeCompare(b.name))
    },

    async upsertRawMaterial(input: {
      id?: string
      name: string
      code: string
      price: number
      item_type: 'service' | 'material'
      vendor?: string | null
      description?: string | null
      unit?: string
    }): Promise<PMCRawMaterial> {
      assertFactory()
      await upsertRawMaterialDb({ factory_id: factoryId, ...input })
      await reloadPmcCache()
      const store = read()
      if (input.id) return inFactory(store.raw_materials, factoryId).find((m) => m.id === input.id)!
      return inFactory(store.raw_materials, factoryId).find(
        (m) => m.code === input.code.trim() && m.name === input.name.trim()
      )!
    },

    async updateProcurementPrice(id: string, price: number): Promise<void> {
      assertFactory()
      await updateProcurementPriceDb(factoryId, id, price)
      await reloadPmcCache()
    },

    async deactivateRawMaterial(id: string): Promise<void> {
      assertFactory()
      await deactivateRawMaterialDb(factoryId, id)
      await reloadPmcCache()
    },

    listProducts(): PMCProduct[] {
      return inFactory(read().products, factoryId)
        .filter((p) => p.is_active)
        .sort((a, b) => a.name.localeCompare(b.name))
    },

    getProduct(id: string): PMCProduct | undefined {
      const p = read().products.find((x) => x.id === id)
      return p?.factory_id === factoryId ? p : undefined
    },

    async upsertProduct(input: { id?: string; name: string; code?: string }): Promise<PMCProduct> {
      assertFactory()
      const id = await upsertProductDb({ factory_id: factoryId, ...input })
      await reloadPmcCache()
      return api.getProduct(id)!
    },

    async deactivateProduct(id: string): Promise<void> {
      assertFactory()
      await deactivateProductDb(factoryId, id)
      await reloadPmcCache()
    },

    listProductMaterials(productId: string): PMCProductMaterial[] {
      if (!productIdsForFactory(factoryId).has(productId)) return []
      return read()
        .product_materials.filter((m) => m.product_id === productId)
        .sort((a, b) => a.sort_order - b.sort_order)
    },

    getProductRecipeLines(productId: string) {
      const nameById = new Map(
        inFactory(read().raw_materials, factoryId).map((m) => [m.id, m])
      )
      return api.listProductMaterials(productId).map((pm) => {
        const rm = nameById.get(pm.raw_material_id)
        return {
          raw_material_id: pm.raw_material_id,
          raw_material_name: rm?.name ?? '—',
          item_code: rm?.code ?? '—',
          item_type: rm?.item_type ?? 'material',
          unit: rm?.unit ?? 'Kg',
          unit_price: rm?.price ?? 0,
          qty: pm.qty,
          is_primary: pm.is_primary,
          line_total: pm.qty * (rm?.price ?? 0),
        }
      })
    },

    countProductMaterials(productId: string): number {
      return api.listProductMaterials(productId).length
    },

    templateUnitPrice(productId: string): number {
      const lines = api.getProductRecipeLines(productId)
      return productUnitPriceFromRecipe(lines.map((l) => ({ qty: l.qty, unit_price: l.unit_price })))
    },

    listBatches(productId?: string): PMCBatch[] {
      let list = inFactory(read().batches, factoryId)
      if (productId) list = list.filter((b) => b.product_id === productId)
      return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    },

    getBatch(id: string): PMCBatch | undefined {
      const b = read().batches.find((x) => x.id === id)
      return b?.factory_id === factoryId ? b : undefined
    },

    listBatchLines(batchId: string): PMCBatchLine[] {
      if (!batchIdsForFactory(factoryId).has(batchId)) return []
      return read()
        .batch_lines.filter((l) => l.batch_id === batchId)
        .sort((a, b) => a.sort_order - b.sort_order)
    },

    buildBatchLinesFromProduct(productId: string, batchSize: number) {
      return api.getProductRecipeLines(productId).map((l) => ({
        raw_material_id: l.raw_material_id,
        item_code: l.item_code,
        item_name: l.raw_material_name,
        item_type: l.item_type as 'service' | 'material',
        qty: l.qty,
        unit_price: l.unit_price,
        is_primary: l.is_primary,
        line_total: l.qty * batchSize * l.unit_price,
      }))
    },

    async createBatch(input: Omit<CreateBatchInput, 'factory_id'>): Promise<PMCBatch> {
      assertFactory()
      const id = await createBatchDb({ factory_id: factoryId, ...input })
      await reloadPmcCache()
      return api.getBatch(id)!
    },

    async updateBatch(
      batchId: string,
      input: {
        status?: PMCBatchStatus
        batch_size?: number
        lines?: CreateBatchInput['lines']
      }
    ): Promise<void> {
      assertFactory()
      await updateBatchDb(factoryId, batchId, input)
      await reloadPmcCache()
    },

    async deleteBatch(batchId: string): Promise<void> {
      assertFactory()
      await deleteBatchDb(factoryId, batchId)
      await reloadPmcCache()
    },

    compareBatches(batchIdA: string, batchIdB: string) {
      const batchA = api.getBatch(batchIdA)
      const batchB = api.getBatch(batchIdB)
      if (!batchA || !batchB) return null
      const linesA = api.listBatchLines(batchIdA)
      const linesB = api.listBatchLines(batchIdB)
      const keys = new Set([
        ...linesA.map((l) => l.item_code || l.item_name),
        ...linesB.map((l) => l.item_code || l.item_name),
      ])
      const rows = Array.from(keys).map((key) => {
        const a = linesA.find((l) => (l.item_code || l.item_name) === key)
        const b = linesB.find((l) => (l.item_code || l.item_name) === key)
        return {
          key,
          a: a
            ? {
                item_name: a.item_name,
                item_type: a.item_type,
                qty: a.qty,
                unit_price: a.unit_price,
                line_total: a.qty * batchA.batch_size * a.unit_price,
              }
            : null,
          b: b
            ? {
                item_name: b.item_name,
                item_type: b.item_type,
                qty: b.qty,
                unit_price: b.unit_price,
                line_total: b.qty * batchB.batch_size * b.unit_price,
              }
            : null,
        }
      })
      return { batchA, batchB, rows }
    },

    async saveProductWithMaterials(
      product: { id?: string; name: string; code?: string },
      materials: { raw_material_id: string; qty: number }[]
    ): Promise<PMCProduct> {
      assertFactory()
      const valid = materials.filter((r) => r.raw_material_id && r.qty > 0)
      const id = await saveProductWithMaterialsDb(factoryId, product, valid)
      await reloadPmcCache()
      return api.getProduct(id)!
    },

    async setProductMaterials(
      productId: string,
      rows: { raw_material_id: string; qty: number }[]
    ): Promise<void> {
      assertFactory()
      const valid = rows.filter((r) => r.raw_material_id && r.qty > 0)
      await setProductMaterialsDb(
        factoryId,
        productId,
        valid.map((r) => ({ ...r, is_primary: false }))
      )
      await reloadPmcCache()
    },

    getPrimaryMaterial(productId: string): PMCProductMaterial | undefined {
      return api.listProductMaterials(productId).find((m) => m.is_primary)
    },

    getReferenceDetail(referenceId: string) {
      const reference = api.getReference(referenceId)
      if (!reference) return null
      const prices = api.getReferencePrices(referenceId)
      const materials = api.listRawMaterials()
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
      return api.listReferences()[0]
    },

    getPricesForReference(referenceId: string): Map<string, number> {
      const map = new Map<string, number>()
      api.getReferencePrices(referenceId).forEach((p) => {
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
        inFactory(store.raw_materials, factoryId),
        refPrices,
        params ?? null
      )
    },

    pricingSheetForProduct(productId: string): {
      reference: PMCReference
      params: PMCProductParams | null
      result: PMCPricingResult | null
    }[] {
      return api.listReferences().map((reference) => {
        const params = api.getProductParams(productId, reference.id) ?? null
        const result = api.calculatePricing(productId, reference.id)
        return { reference, params, result }
      })
    },

    dashboardStats() {
      const products = api.listProducts()
      const batches = api.listBatches()
      const procurement = api.listRawMaterials()
      const recentBatches = batches.slice(0, 5)
      const recentProducts = [...products]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
      return {
        productCount: products.length,
        procurementCount: procurement.length,
        batchCount: batches.length,
        activeBatchCount: batches.filter((b) => b.status === 'active' || b.status === 'draft').length,
        recentBatches,
        recentProducts,
      }
    },

    breakdownLines(productId: string, referenceId: string): PMCLineBreakdown[] {
      return api.calculatePricing(productId, referenceId)?.lines ?? []
    },
  }

  return api
}

export type PmcApi = ReturnType<typeof createPmcApi>
