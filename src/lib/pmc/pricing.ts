import type {
  PMCLineBreakdown,
  PMCProductMaterial,
  PMCProductParams,
  PMCPricingResult,
  PMCReference,
  PMCReferencePrice,
  PMCRawMaterial,
} from './types'

export function calculateProductPricing(
  reference: PMCReference,
  materials: PMCProductMaterial[],
  rawMaterials: PMCRawMaterial[],
  referencePrices: PMCReferencePrice[],
  params: PMCProductParams | null
): PMCPricingResult | null {
  if (!params || params.yield_value <= 0) return null

  const primaryRow = materials.find((m) => m.is_primary)
  if (!primaryRow || primaryRow.qty <= 0) return null

  const batchMultiplier =
    params.batch_multiplier > 0 ? params.batch_multiplier : 1

  const primary_effective_qty = primaryRow.qty * batchMultiplier
  const real_final_product = params.yield_value * primary_effective_qty
  if (real_final_product <= 0) return null

  const priceByMaterial = new Map(
    referencePrices
      .filter((p) => p.reference_id === reference.id)
      .map((p) => [p.raw_material_id, p.price])
  )

  const nameById = new Map(rawMaterials.map((m) => [m.id, m.name]))

  const lines: PMCLineBreakdown[] = materials.map((row) => {
    const price = priceByMaterial.get(row.raw_material_id) ?? 0
    const effective_qty = row.qty * batchMultiplier
    return {
      raw_material_id: row.raw_material_id,
      raw_material_name: nameById.get(row.raw_material_id) ?? '—',
      base_qty: row.qty,
      effective_qty,
      price,
      line_total: effective_qty * price,
      is_primary: row.is_primary,
    }
  })

  const material_total = lines.reduce((sum, l) => sum + l.line_total, 0)
  const unit_before_overhead = material_total / real_final_product
  const final_rmc = unit_before_overhead + params.overhead

  return {
    reference_id: reference.id,
    ref_number: reference.ref_number,
    lines,
    material_total,
    batch_multiplier: batchMultiplier,
    yield_value: params.yield_value,
    primary_material_name: nameById.get(primaryRow.raw_material_id) ?? '—',
    primary_material_qty: primary_effective_qty,
    real_final_product,
    overhead: params.overhead,
    unit_before_overhead,
    final_rmc,
  }
}

export function formatINR(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatQty(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
  }).format(value)
}
