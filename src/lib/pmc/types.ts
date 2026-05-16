export interface PMCRawMaterial {
  id: string
  name: string
  unit: string
  is_active: boolean
  created_at: string
}

export interface PMCProduct {
  id: string
  name: string
  code: string | null
  is_active: boolean
  created_at: string
}

export interface PMCProductMaterial {
  id: string
  product_id: string
  raw_material_id: string
  qty: number
  sort_order: number
}

export interface PMCReference {
  id: string
  ref_number: string
  created_at: string
  notes: string | null
}

export interface PMCReferencePrice {
  id: string
  reference_id: string
  raw_material_id: string
  price: number
}

export interface PMCProductParams {
  id: string
  product_id: string
  reference_id: string
  overhead: number
  tons_kg: number
  yield_value: number
  updated_at: string
}

export interface PMCLineBreakdown {
  raw_material_id: string
  raw_material_name: string
  qty: number
  price: number
  line_total: number
}

export interface PMCPricingResult {
  reference_id: string
  ref_number: string
  lines: PMCLineBreakdown[]
  material_total: number
  tons_kg: number
  yield_value: number
  overhead: number
  unit_before_overhead: number
  final_rmc: number
}

export interface PMCStore {
  raw_materials: PMCRawMaterial[]
  products: PMCProduct[]
  product_materials: PMCProductMaterial[]
  references: PMCReference[]
  reference_prices: PMCReferencePrice[]
  product_params: PMCProductParams[]
}
