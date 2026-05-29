import { createPmcApi } from '../api/scoped-api'

/** Sample procurement + product + batch (optional demo). */
export async function seedPMCDemoIfEmpty(factoryId: string): Promise<boolean> {
  const pmcApi = createPmcApi(factoryId)
  if (pmcApi.listRawMaterials().length > 0) return false

  const specs = [
    { name: 'ONT', code: 'ONT', price: 165 },
    { name: 'SUPLHURIC 98 %', code: 'H2SO4', price: 32 },
    { name: 'OLEUM 65 %', code: 'OLEUM', price: 39 },
    { name: 'CAUSTIC LYE', code: 'LYE', price: 47 },
    { name: 'SPENT', code: 'SPENT', price: 7 },
  ]
  const materials = []
  for (const s of specs) {
    materials.push(
      await pmcApi.upsertRawMaterial({
        name: s.name,
        code: s.code,
        price: s.price,
        item_type: 'material',
      })
    )
  }

  const product = await pmcApi.upsertProduct({ name: 'Sample dye batch', code: 'SAMPLE' })
  await pmcApi.setProductMaterials(
    product.id,
    materials.map((m, i) => ({
      raw_material_id: m.id,
      qty: [2000, 200, 2050, 2250, 3500][i] / 1000,
      is_primary: i === 0,
    }))
  )

  const lines = pmcApi.buildBatchLinesFromProduct(product.id, 1)
  await pmcApi.createBatch({
    product_id: product.id,
    batch_size: 1,
    status: 'active',
    lines: lines.map((l) => ({
      raw_material_id: l.raw_material_id,
      item_code: l.item_code,
      item_name: l.item_name,
      item_type: l.item_type,
      qty: l.qty,
      unit_price: l.unit_price,
      is_primary: l.is_primary,
    })),
  })

  return true
}
