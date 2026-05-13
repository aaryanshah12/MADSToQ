export type CompanyType = 'supplier' | 'customer' | 'both'
export type DocType = 'inward' | 'outward' | 'domestic' | 'international' | 'quotation'

export interface IOUnit {
  id: number
  name: string
  abbreviation?: string | null
  created_at?: string
}

export interface IOCountry {
  id: number
  name: string
  code?: string | null
  created_at?: string
}

export interface IOState {
  id: number
  country_id: number
  name: string
  code?: string | null
  created_at?: string
  country?: { name: string }
}

export interface IOCity {
  id: number
  state_id: number
  name: string
  created_at?: string
  state?: { name: string }
}

export interface IOCompany {
  id: string
  factory_id?: string | null
  company_type: CompanyType
  company_name: string
  person_name?: string | null
  country_id?: number | null
  state_id?: number | null
  city_id?: number | null
  address?: string | null
  pincode?: string | null
  mobile?: string | null
  email?: string | null
  is_active: boolean
  created_at?: string
  updated_at?: string
  country?: { name: string } | null
  state?: { name: string } | null
  city?: { name: string } | null
}

export interface IOProduct {
  id: string
  factory_id?: string | null
  product_name: string
  description?: string | null
  hsn_code?: string | null
  unit_id?: number | null
  rate?: number | null
  is_active: boolean
  created_at?: string
  updated_at?: string
  unit?: { name: string; abbreviation?: string | null } | null
}

export interface IOLineItem {
  id?: string
  product_id: string
  quantity: number
  price: number
  remarks?: string
  sort_order?: number
  product?: IOProduct | null
}

export interface IOInward {
  id: string
  factory_id?: string | null
  inward_number: string
  inward_date: string
  supplier_id?: string | null
  supplier_ref_no?: string | null
  remarks?: string | null
  created_at?: string
  updated_at?: string
  supplier?: IOCompany | null
  items?: IOLineItem[]
  factory?: { id: string; name: string } | null
}

export interface IOOutward {
  id: string
  factory_id?: string | null
  outward_number: string
  outward_date: string
  supplier_id?: string | null
  supplier_ref_no?: string | null
  remarks?: string | null
  created_at?: string
  updated_at?: string
  supplier?: IOCompany | null
  items?: IOLineItem[]
  factory?: { id: string; name: string } | null
}

export interface IODomestic {
  id: string
  factory_id?: string | null
  invoice_number: string
  tax_invoice_number?: string | null
  invoice_date: string
  customer_id?: string | null
  remarks?: string | null
  created_at?: string
  updated_at?: string
  customer?: IOCompany | null
  items?: IOLineItem[]
  factory?: { id: string; name: string } | null
}

export interface IOInternational {
  id: string
  factory_id?: string | null
  invoice_number: string
  tax_invoice_number?: string | null
  invoice_date: string
  customer_id?: string | null
  remarks?: string | null
  created_at?: string
  updated_at?: string
  customer?: IOCompany | null
  items?: IOLineItem[]
  factory?: { id: string; name: string } | null
}

export interface IOQuotationItem {
  id?: string
  quotation_id?: string
  reference_no?: string | null
  product_id?: string | null
  product_name_override?: string | null
  price: number
  sort_order?: number
  product?: IOProduct | null
}

export interface IOQuotation {
  id: string
  factory_id?: string | null
  quotation_number: string
  quotation_date: string
  customer_id?: string | null
  outward_ref_no?: string | null
  header_content?: string | null
  footer_content?: string | null
  created_at?: string
  updated_at?: string
  customer?: IOCompany | null
  items?: IOQuotationItem[]
  factory?: { id: string; name: string } | null
}

export interface IOFactory {
  id: string
  name: string
}
