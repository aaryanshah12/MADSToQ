export type Role = 'owner' | 'inputer' | 'chemist'
export type Shift = 'morning' | 'afternoon' | 'night'

export interface Factory {
  id: string
  name: string
  location: string | null
  is_active: boolean
  created_at: string
  materials?: string[] | null
}

export interface Profile {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  role: Role
  is_active: boolean
  created_at: string
  updated_at: string
  factories?: Factory[]
}

export interface StockEntry {
  id: string
  factory_id: string
  invoice_number: string
  supplier_name: string
  material_type: string
  tons_loaded: number
  rate_per_ton: number       // hidden from chemist
  total_value: number        // hidden from chemist
  vehicle_number: string | null
  driver_name: string | null
  entry_date: string
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
  factory?: Factory
}

// Safe version — no financial data (for chemist)
export interface StockEntrySafe {
  id: string
  factory_id: string
  invoice_number: string
  supplier_name: string
  material_type: string
  tons_loaded: number
  entry_date: string
  notes: string | null
}

export interface UsageEntry {
  id: string
  factory_id: string
  invoice_number: string
  tons_used: number
  process_id: string | null
  batch_notes: string | null
  shift: Shift | null
  usage_date: string
  created_by: string
  created_at: string
  factory?: Factory
  stock_entry?: StockEntrySafe
}

export interface StockBalance {
  factory_id: string
  factory_name: string
  invoice_number: string
  material_type: string
  tons_loaded: number
  tons_used: number
  tons_remaining: number
  entry_date: string
}

export interface FactorySummary {
  factory_id: string
  factory_name: string
  total_invoices: number
  total_tons_loaded: number
  total_tons_used: number
  closing_balance: number
  total_stock_value: number
}

export interface PermissionOverride {
  id: string
  profile_id: string
  feature: string
  is_allowed: boolean
  expires_at: string | null
  created_by: string
  created_at: string
}

export type FeatureKey =
  | 'view_stock_balance'
  | 'edit_past_entries'
  | 'view_invoice_details'
  | 'export_data'
  | 'view_rate_cost'
  | 'view_all_factories'
