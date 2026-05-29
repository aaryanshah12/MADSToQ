export type PMCItemType = 'service' | 'material'
export type PMCBatchStatus = 'draft' | 'active' | 'completed' | 'cancelled'

/** Procurement item (stored in pmc_raw_materials). */
export interface PMCRawMaterial {
  id: string
  factory_id: string
  name: string
  code: string
  price: number
  item_type: PMCItemType
  vendor: string | null
  description: string | null
  unit: string
  is_active: boolean
  created_at: string
}

export interface PMCProduct {
  id: string
  factory_id: string
  name: string
  code: string | null
  unit_price: number
  is_active: boolean
  created_at: string
}

export interface PMCProductMaterial {
  id: string
  product_id: string
  raw_material_id: string
  qty: number
  sort_order: number
  is_primary: boolean
}

export interface PMCBatch {
  id: string
  factory_id: string
  batch_code: string
  status: PMCBatchStatus
  product_id: string
  batch_size: number
  unit_price: number
  created_at: string
}

/** Frozen BOM line for a batch (prices do not change when procurement updates). */
export interface PMCBatchLine {
  id: string
  batch_id: string
  raw_material_id: string | null
  item_code: string
  item_name: string
  item_type: PMCItemType
  qty: number
  unit_price: number
  is_primary: boolean
  sort_order: number
}

/** @deprecated Reference pricing removed from UI; kept for legacy store migration. */
export interface PMCReference {
  id: string
  ref_number: string
  created_at: string
  notes: string | null
}

/** @deprecated */
export interface PMCReferencePrice {
  id: string
  reference_id: string
  raw_material_id: string
  price: number
}

/** @deprecated */
export interface PMCProductParams {
  id: string
  product_id: string
  reference_id: string
  overhead: number
  batch_multiplier: number
  yield_value: number
  updated_at: string
  tons_kg?: number
}

export interface PMCLineBreakdown {
  raw_material_id: string
  raw_material_name: string
  base_qty: number
  effective_qty: number
  price: number
  line_total: number
  is_primary: boolean
}

export interface PMCPricingResult {
  reference_id: string
  ref_number: string
  lines: PMCLineBreakdown[]
  material_total: number
  batch_multiplier: number
  yield_value: number
  primary_material_name: string
  primary_material_qty: number
  real_final_product: number
  overhead: number
  unit_before_overhead: number
  final_rmc: number
}

export interface PMCStore {
  raw_materials: PMCRawMaterial[]
  products: PMCProduct[]
  product_materials: PMCProductMaterial[]
  batches: PMCBatch[]
  batch_lines: PMCBatchLine[]
  references: PMCReference[]
  reference_prices: PMCReferencePrice[]
  product_params: PMCProductParams[]
}
