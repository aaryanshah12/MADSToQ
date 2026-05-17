import { pmcApi } from './api'

/** Sample data matching the pricing sheet example (optional demo). */
export async function seedPMCDemoIfEmpty(): Promise<boolean> {
  if (pmcApi.listRawMaterials().length > 0) return false

  const materials = []
  for (const m of [
    { name: 'ONT', unit: 'Kg' },
    { name: 'SUPLHURIC 98 %', unit: 'Kg' },
    { name: 'OLEUM 65 %', unit: 'Kg' },
    { name: 'CAUSTIC LYE', unit: 'Kg' },
    { name: 'SPENT', unit: 'Kg' },
  ]) {
    materials.push(await pmcApi.upsertRawMaterial(m))
  }

  const ref = await pmcApi.createReference(
    materials.map((m, i) => ({
      raw_material_id: m.id,
      price: [165, 32, 39, 47, 7][i],
    })),
    'Initial reference'
  )

  const product = await pmcApi.upsertProduct({ name: 'Sample dye batch', code: 'SAMPLE' })
  await pmcApi.setProductMaterials(
    product.id,
    materials.map((m, i) => ({
      raw_material_id: m.id,
      qty: [2000, 200, 2050, 2250, 3500][i],
      is_primary: i === 0,
    }))
  )

  await pmcApi.upsertProductParams({
    product_id: product.id,
    reference_id: ref.id,
    overhead: 30,
    batch_multiplier: 1,
    yield_value: 0.54,
  })

  return true
}
