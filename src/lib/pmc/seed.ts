import { pmcApi } from './api'

/** Sample data matching the pricing sheet example (optional demo). */
export function seedPMCDemoIfEmpty(): boolean {
  if (pmcApi.listRawMaterials().length > 0) return false

  const materials = [
    { name: 'ONT', unit: 'Kg' },
    { name: 'SUPLHURIC 98 %', unit: 'Kg' },
    { name: 'OLEUM 65 %', unit: 'Kg' },
    { name: 'CAUSTIC LYE', unit: 'Kg' },
    { name: 'SPENT', unit: 'Kg' },
  ].map((m) => pmcApi.upsertRawMaterial(m))

  const ref = pmcApi.createReference(
    materials.map((m, i) => ({
      raw_material_id: m.id,
      price: [165, 32, 39, 47, 7][i],
    })),
    'Initial reference'
  )

  const product = pmcApi.upsertProduct({ name: 'Sample dye batch', code: 'SAMPLE' })
  pmcApi.setProductMaterials(
    product.id,
    materials.map((m, i) => ({
      raw_material_id: m.id,
      qty: [2000, 200, 2050, 2250, 3500][i],
      is_primary: i === 0,
    }))
  )

  // yield × primary (2000 × batch 1) = 1080 → RMC ≈ 536.1 with batch multiplier 1
  pmcApi.upsertProductParams({
    product_id: product.id,
    reference_id: ref.id,
    overhead: 30,
    batch_multiplier: 1,
    yield_value: 0.54,
  })

  return true
}
