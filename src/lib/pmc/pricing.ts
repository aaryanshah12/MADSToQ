import type {
  PMCLineBreakdown,
  PMCProductMaterial,
  PMCProductParams,
  PMCPricingResult,
  PMCReference,
  PMCReferencePrice,
  PMCRawMaterial,
} from './types'

/** Divisor for RMC: entered yield (e.g. 0.108) × 1000 → 1080 */
export function yieldDivisor(yieldValue: number): number {
  return yieldValue * 1000
}

export function calculateProductPricing(
  reference: PMCReference,
  materials: PMCProductMaterial[],
  rawMaterials: PMCRawMaterial[],
  referencePrices: PMCReferencePrice[],
  params: PMCProductParams | null
): PMCPricingResult | null {
  if (!params || params.yield_value <= 0) return null

  const priceByMaterial = new Map(
    referencePrices
      .filter((p) => p.reference_id === reference.id)
      .map((p) => [p.raw_material_id, p.price])
  )

  const nameById = new Map(rawMaterials.map((m) => [m.id, m.name]))

  const lines: PMCLineBreakdown[] = materials.map((row) => {
    const price = priceByMaterial.get(row.raw_material_id) ?? 0
    return {
      raw_material_id: row.raw_material_id,
      raw_material_name: nameById.get(row.raw_material_id) ?? '—',
      qty: row.qty,
      price,
      line_total: row.qty * price,
    }
  })

  const material_total = lines.reduce((sum, l) => sum + l.line_total, 0)
  const divisor = yieldDivisor(params.yield_value)
  const unit_before_overhead = material_total / divisor
  const final_rmc = unit_before_overhead + params.overhead

  return {
    reference_id: reference.id,
    ref_number: reference.ref_number,
    lines,
    material_total,
    tons_kg: params.tons_kg,
    yield_value: params.yield_value,
    yield_divisor: divisor,
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
