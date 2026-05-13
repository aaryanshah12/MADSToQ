import { supabase } from '@/lib/supabase'
import type {
  IOUnit, IOCountry, IOState, IOCity,
  IOCompany, IOProduct,
  IOInward, IOOutward, IODomestic, IOInternational,
  IOQuotation, IOLineItem, IOQuotationItem,
  CompanyType, DocType,
} from './types'

const READ_CACHE_TTL_MS = 60_000
const readCache = new Map<string, { data: unknown; expiresAt: number }>()

function getCached<T>(key: string): T | null {
  const hit = readCache.get(key)
  if (!hit) return null
  if (Date.now() > hit.expiresAt) {
    readCache.delete(key)
    return null
  }
  return hit.data as T
}

function setCached<T>(key: string, data: T) {
  readCache.set(key, { data, expiresAt: Date.now() + READ_CACHE_TTL_MS })
}

function clearCachedPrefix(prefix: string) {
  readCache.forEach((_value, key) => {
    if (key.startsWith(prefix)) readCache.delete(key)
  })
}

// ── Auth helpers ───────────────────────────────────────────────
async function userId() {
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

// ── Next Document Number ───────────────────────────────────────
const DOC_TABLE: Record<DocType, { table: string; column: string }> = {
  inward:        { table: 'io_inward',        column: 'inward_number' },
  outward:       { table: 'io_outward',       column: 'outward_number' },
  quotation:     { table: 'io_quotations',    column: 'quotation_number' },
  domestic:      { table: 'io_domestic',      column: 'invoice_number' },
  international: { table: 'io_international', column: 'invoice_number' },
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

const NO_VH_TYPES: DocType[] = ['domestic', 'international']

function makeVHNumber(seq: number, date: Date) {
  const mm = pad2(date.getMonth() + 1)
  const yy = pad2(date.getFullYear() % 100)
  return `VH ${seq}/${mm}/${yy}`
}

function makePlainNumber(seq: number, date: Date) {
  const mm = pad2(date.getMonth() + 1)
  const yy = pad2(date.getFullYear() % 100)
  return `${seq}/${mm}/${yy}`
}

function parseVHNumber(v: unknown): { seq: number; yy: string } | null {
  if (typeof v !== 'string') return null
  // Accept both `VH1/04/26` and `VH 1/04/26`
  const m = v.trim().match(/^VH\s*(\d+)\/(\d{2})\/(\d{2})$/i)
  if (!m) return null
  return { seq: parseInt(m[1], 10) || 0, yy: m[3] }
}

function parsePlainNumber(v: unknown): { seq: number; yy: string } | null {
  if (typeof v !== 'string') return null
  const m = v.trim().match(/^(\d+)\/(\d{2})\/(\d{2})$/)
  if (!m) return null
  return { seq: parseInt(m[1], 10) || 0, yy: m[3] }
}

function stripOuterAffixes(full: string, prefix: string, suffix: string): string {
  let s = (full ?? '').trim()
  const p = prefix ?? ''
  const suf = suffix ?? ''
  if (p && s.startsWith(p)) s = s.slice(p.length).trim()
  if (suf && s.endsWith(suf)) s = s.slice(0, s.length - suf.length).trim()
  return s
}

function applyOuterAffixes(core: string, prefix: string, suffix: string): string {
  return `${prefix ?? ''}${core}${suffix ?? ''}`
}

function parseSeqForType(type: DocType, raw: unknown, prefix: string, suffix: string): { seq: number; yy: string } | null {
  const stripped = stripOuterAffixes(String(raw ?? ''), prefix, suffix)
  const noVH = NO_VH_TYPES.includes(type)
  if (noVH) {
    return parsePlainNumber(stripped) ?? parseVHNumber(stripped)
  }
  return parseVHNumber(stripped)
}

async function computeNextNumber(
  type: DocType,
  date = new Date(),
  factoryId?: string | null,
  prefix = '',
  suffix = '',
): Promise<string> {
  const { table, column } = DOC_TABLE[type]
  const yy = pad2(date.getFullYear() % 100)
  const noVH = NO_VH_TYPES.includes(type)

  // Pull a small slice of recent numbers and compute max for this year.
  // This keeps the logic in-app, even if the Supabase RPC isn't updated.
  let query = supabase
    .from(table)
    .select(column)
    .order('created_at', { ascending: false })
    .limit(2000)
  if (factoryId) query = query.eq('factory_id', factoryId)
  const { data, error } = await query
  if (error) throw error

  let max = 0
  for (const row of (data ?? []) as any[]) {
    const parsed = parseSeqForType(type, row?.[column], prefix, suffix)
    if (!parsed) continue
    if (parsed.yy !== yy) continue
    if (parsed.seq > max) max = parsed.seq
  }

  return noVH ? makePlainNumber(max + 1, date) : makeVHNumber(max + 1, date)
}

export async function getNextNumber(type: DocType, date?: string, factoryId?: string | null): Promise<string> {
  const d = date ? new Date(date) : new Date()
  let prefix = ''
  let suffix = ''
  if (factoryId) {
    try {
      const cfg = await fetchNumberingConfig(factoryId)
      prefix = cfg[type]?.prefix ?? ''
      suffix = cfg[type]?.suffix ?? ''
    } catch {
      /* ignore */
    }
  }

  if (factoryId) {
    try {
      const { data, error } = await supabase.rpc('io_next_number_by_factory', {
        p_doc_type: type,
        p_factory_id: factoryId,
        p_doc_date: d.toISOString().slice(0, 10),
      })
      if (!error && typeof data === 'string' && data.trim()) {
        const trimmed = data.trim()
        const core = stripOuterAffixes(trimmed, prefix, suffix)
        return applyOuterAffixes(core, prefix, suffix)
      }
    } catch {
      // ignore and fallback
    }
  }
  // Legacy RPC (non factory-wise). Domestic & International use plain numbering.
  if (!NO_VH_TYPES.includes(type) && !factoryId) {
    try {
      const { data, error } = await supabase.rpc('io_next_number', { p_doc_type: type })
      if (!error && typeof data === 'string' && parseVHNumber(data)) return data
    } catch {
      // ignore and fallback
    }
  }
  const core = await computeNextNumber(type, d, factoryId, prefix, suffix)
  return applyOuterAffixes(core, prefix, suffix)
}

// ── Units ──────────────────────────────────────────────────────
export const fetchUnits = async (): Promise<IOUnit[]> => {
  const { data, error } = await supabase.from('io_units').select('*').order('name')
  if (error) throw error
  return data ?? []
}
export const saveUnit = async (unit: Partial<IOUnit>) => {
  if (unit.id) {
    const { error } = await supabase.from('io_units').update({ name: unit.name, abbreviation: unit.abbreviation }).eq('id', unit.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('io_units').insert({ name: unit.name, abbreviation: unit.abbreviation })
    if (error) throw error
  }
}
export const deleteUnit = async (id: number) => {
  const { error } = await supabase.from('io_units').delete().eq('id', id)
  if (error) throw error
}

// ── Countries ──────────────────────────────────────────────────
export const fetchCountries = async (): Promise<IOCountry[]> => {
  const { data, error } = await supabase.from('io_countries').select('*').order('name')
  if (error) throw error
  return data ?? []
}
export const saveCountry = async (c: Partial<IOCountry>) => {
  if (c.id) {
    const { error } = await supabase.from('io_countries').update({ name: c.name, code: c.code }).eq('id', c.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('io_countries').insert({ name: c.name, code: c.code })
    if (error) throw error
  }
}
export const deleteCountry = async (id: number) => {
  const { error } = await supabase.from('io_countries').delete().eq('id', id)
  if (error) throw error
}

export const ensureCountry = async (name: string, code?: string | null): Promise<IOCountry> => {
  const n = (name ?? '').trim()
  if (!n) throw new Error('country name required')
  const { data: existing, error: se } = await supabase
    .from('io_countries')
    .select('*')
    .ilike('name', n)
    .limit(1)
  if (se) throw se
  if (existing?.[0]) return existing[0] as any

  const { data, error } = await supabase
    .from('io_countries')
    .insert({ name: n, code: (code ?? null) })
    .select('*')
    .single()
  if (error) throw error
  return data as any
}

// ── States ────────────────────────────────────────────────────
export const fetchStates = async (country_id?: number): Promise<IOState[]> => {
  let q = supabase.from('io_states').select('*, country:io_countries(name)').order('name')
  if (country_id) q = q.eq('country_id', country_id)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}
export const saveState = async (s: Partial<IOState>) => {
  if (s.id) {
    const { error } = await supabase.from('io_states').update({ name: s.name, code: s.code, country_id: s.country_id }).eq('id', s.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('io_states').insert({ name: s.name, code: s.code, country_id: s.country_id })
    if (error) throw error
  }
}
export const deleteState = async (id: number) => {
  const { error } = await supabase.from('io_states').delete().eq('id', id)
  if (error) throw error
}

export const ensureState = async (name: string, country_id: number, code?: string | null): Promise<IOState> => {
  const n = (name ?? '').trim()
  if (!n) throw new Error('state name required')
  const { data: existing, error: se } = await supabase
    .from('io_states')
    .select('*')
    .eq('country_id', country_id)
    .ilike('name', n)
    .limit(1)
  if (se) throw se
  if (existing?.[0]) return existing[0] as any

  const { data, error } = await supabase
    .from('io_states')
    .insert({ name: n, country_id, code: (code ?? null) })
    .select('*')
    .single()
  if (error) throw error
  return data as any
}

// ── Cities ────────────────────────────────────────────────────
export const fetchCities = async (state_id?: number): Promise<IOCity[]> => {
  let q = supabase.from('io_cities').select('*, state:io_states(name)').order('name')
  if (state_id) q = q.eq('state_id', state_id)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}
export const saveCity = async (c: Partial<IOCity>) => {
  if (c.id) {
    const { error } = await supabase.from('io_cities').update({ name: c.name, state_id: c.state_id }).eq('id', c.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('io_cities').insert({ name: c.name, state_id: c.state_id })
    if (error) throw error
  }
}
export const deleteCity = async (id: number) => {
  const { error } = await supabase.from('io_cities').delete().eq('id', id)
  if (error) throw error
}

export const ensureCity = async (name: string, state_id: number): Promise<IOCity> => {
  const n = (name ?? '').trim()
  if (!n) throw new Error('city name required')
  const { data: existing, error: se } = await supabase
    .from('io_cities')
    .select('*')
    .eq('state_id', state_id)
    .ilike('name', n)
    .limit(1)
  if (se) throw se
  if (existing?.[0]) return existing[0] as any

  const { data, error } = await supabase
    .from('io_cities')
    .insert({ name: n, state_id })
    .select('*')
    .single()
  if (error) throw error
  return data as any
}

// ── Companies ─────────────────────────────────────────────────
export const fetchCompanies = async (type?: CompanyType | 'all', factory_id?: string): Promise<IOCompany[]> => {
  const cacheKey = `companies:${type ?? 'all'}:${factory_id ?? 'all'}`
  const cached = getCached<IOCompany[]>(cacheKey)
  if (cached) return cached

  let q = supabase.from('io_companies')
    .select('*, country:io_countries(name), state:io_states(name), city:io_cities(name)')
    .eq('is_active', true).order('company_name')
  if (type && type !== 'all') q = q.or(`company_type.eq.${type},company_type.eq.both`)
  if (factory_id) q = q.eq('factory_id', factory_id)
  const { data, error } = await q
  if (error) throw error
  const rows = data ?? []
  setCached(cacheKey, rows)
  return rows
}
export const saveCompany = async (c: Partial<IOCompany>): Promise<IOCompany> => {
  const payload = {
    factory_id: c.factory_id || null,
    company_type: c.company_type, company_name: c.company_name,
    person_name: c.person_name || null, country_id: c.country_id || null,
    state_id: c.state_id || null, city_id: c.city_id || null,
    address: c.address || null, pincode: c.pincode || null,
    mobile: c.mobile || null, email: c.email || null,
    is_active: true, updated_at: new Date().toISOString(),
  }
  if (c.id) {
    const { data, error } = await supabase.from('io_companies').update(payload).eq('id', c.id).select().single()
    if (error) throw error
    clearCachedPrefix('companies:')
    return data
  } else {
    const { data, error } = await supabase.from('io_companies').insert(payload).select().single()
    if (error) throw error
    clearCachedPrefix('companies:')
    return data
  }
}
export const deleteCompany = async (id: string) => {
  const { error } = await supabase.from('io_companies').update({ is_active: false }).eq('id', id)
  if (error) throw error
  clearCachedPrefix('companies:')
}

// ── Numbering Config (Factory-wise) ───────────────────────────
export const fetchNumberingConfig = async (factory_id: string): Promise<Record<DocType, { prefix: string; suffix: string }>> => {
  const defaults: Record<DocType, { prefix: string; suffix: string }> = {
    inward: { prefix: '', suffix: '' },
    outward: { prefix: '', suffix: '' },
    domestic: { prefix: '', suffix: '' },
    international: { prefix: '', suffix: '' },
    quotation: { prefix: '', suffix: '' },
  }
  const { data, error } = await supabase
    .from('io_numbering_config')
    .select('doc_type,prefix,suffix')
    .eq('factory_id', factory_id)
  if (error) throw error
  for (const row of data ?? []) {
    const key = row.doc_type as DocType
    if (defaults[key]) defaults[key] = { prefix: row.prefix ?? '', suffix: row.suffix ?? '' }
  }
  return defaults
}

export const saveNumberingConfig = async (
  factory_id: string,
  values: Record<DocType, { prefix: string; suffix: string }>
) => {
  const docTypes: DocType[] = ['inward', 'outward', 'domestic', 'international', 'quotation']
  const rows = (['inward', 'outward', 'domestic', 'international', 'quotation'] as DocType[]).map((doc_type) => ({
    factory_id,
    doc_type,
    prefix: values[doc_type]?.prefix ?? '',
    suffix: values[doc_type]?.suffix ?? '',
    updated_at: new Date().toISOString(),
  }))
  // Safer than upsert when unique constraint/onConflict is inconsistent across environments.
  const { error: delError } = await supabase
    .from('io_numbering_config')
    .delete()
    .eq('factory_id', factory_id)
    .in('doc_type', docTypes)
  if (delError) throw delError

  const { error: insError } = await supabase
    .from('io_numbering_config')
    .insert(rows)
  if (insError) throw insError
}

// ── Products ──────────────────────────────────────────────────
export const fetchProducts = async (factory_id?: string): Promise<IOProduct[]> => {
  const cacheKey = `products:${factory_id ?? 'all'}`
  const cached = getCached<IOProduct[]>(cacheKey)
  if (cached) return cached

  let q = supabase.from('io_products')
    .select('*, unit:io_units(name, abbreviation)').eq('is_active', true).order('product_name')
  if (factory_id) q = q.eq('factory_id', factory_id)
  const { data, error } = await q
  if (error) throw error
  const rows = data ?? []
  setCached(cacheKey, rows)
  return rows
}
export const saveProduct = async (p: Partial<IOProduct>): Promise<IOProduct> => {
  const payload = {
    factory_id: p.factory_id || null,
    product_name: p.product_name, description: p.description || null,
    hsn_code: p.hsn_code || null, unit_id: p.unit_id || null,
    rate: p.rate ?? null, is_active: true, updated_at: new Date().toISOString(),
  }
  if (p.id) {
    const { data, error } = await supabase.from('io_products').update(payload).eq('id', p.id).select().single()
    if (error) throw error
    clearCachedPrefix('products:')
    return data
  } else {
    const { data, error } = await supabase.from('io_products').insert(payload).select().single()
    if (error) throw error
    clearCachedPrefix('products:')
    return data
  }
}
export const deleteProduct = async (id: string) => {
  const { error } = await supabase.from('io_products').update({ is_active: false }).eq('id', id)
  if (error) throw error
  clearCachedPrefix('products:')
}

// ── Inward ────────────────────────────────────────────────────
export const fetchInwards = async (factory_id?: string): Promise<IOInward[]> => {
  let q = supabase.from('io_inward')
    .select(`
      id, inward_number, inward_date, supplier_id, supplier_ref_no, remarks, factory_id, created_by, created_at, updated_at,
      factory:factories(id,name),
      supplier:io_companies(id,company_name,person_name),
      items:io_inward_items(id,inward_id,product_id,quantity,price,remarks,sort_order,product:io_products(product_name,hsn_code))
    `)
    .order('inward_date', { ascending: true })
  if (factory_id) q = q.eq('factory_id', factory_id)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as IOInward[]
}
export const saveInward = async (inward: Partial<IOInward> & { items: IOLineItem[] }): Promise<IOInward> => {
  const uid = await userId()
  if (inward.id) {
    const { data, error } = await supabase.from('io_inward').update({
      factory_id: inward.factory_id || null, inward_date: inward.inward_date,
      supplier_id: inward.supplier_id || null, supplier_ref_no: inward.supplier_ref_no || null,
      remarks: inward.remarks || null, updated_at: new Date().toISOString(),
    }).eq('id', inward.id).select().single()
    if (error) throw error
    await supabase.from('io_inward_items').delete().eq('inward_id', inward.id)
    if (inward.items.length > 0) {
      const { error: ie } = await supabase.from('io_inward_items').insert(
        inward.items.map((it, i) => ({ inward_id: inward.id, product_id: it.product_id, quantity: it.quantity, price: it.price, remarks: it.remarks || null, sort_order: i }))
      )
      if (ie) throw ie
    }
    return data as any
  } else {
    const number = await getNextNumber('inward', inward.inward_date, inward.factory_id || null)
    const { data, error } = await supabase.from('io_inward').insert({
      inward_number: number, factory_id: inward.factory_id || null,
      inward_date: inward.inward_date, supplier_id: inward.supplier_id || null,
      supplier_ref_no: inward.supplier_ref_no || null, remarks: inward.remarks || null, created_by: uid,
    }).select().single()
    if (error) throw error
    if (inward.items.length > 0) {
      const { error: ie } = await supabase.from('io_inward_items').insert(
        inward.items.map((it, i) => ({ inward_id: data.id, product_id: it.product_id, quantity: it.quantity, price: it.price, remarks: it.remarks || null, sort_order: i }))
      )
      if (ie) throw ie
    }
    return data as any
  }
}
export const deleteInward = async (id: string) => {
  const { error } = await supabase.from('io_inward').delete().eq('id', id)
  if (error) throw error
}

// ── Outward ───────────────────────────────────────────────────
export const fetchOutwards = async (factory_id?: string): Promise<IOOutward[]> => {
  let q = supabase.from('io_outward')
    .select(`
      id, outward_number, outward_date, supplier_id, supplier_ref_no, remarks, factory_id, created_by, created_at, updated_at,
      factory:factories(id,name),
      supplier:io_companies(id,company_name,person_name),
      items:io_outward_items(id,outward_id,product_id,quantity,price,remarks,sort_order,product:io_products(product_name,hsn_code))
    `)
    .order('outward_date', { ascending: true })
  if (factory_id) q = q.eq('factory_id', factory_id)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as IOOutward[]
}

export const fetchOutwardByRefNo = async (refNo: string, factory_id?: string): Promise<IOOutward | null> => {
  const ref = (refNo ?? '').trim()
  if (!ref) return null
  let q = supabase.from('io_outward')
    .select('*, factory:factories(id,name), supplier:io_companies(id,company_name,person_name), items:io_outward_items(*, product:io_products(product_name,hsn_code))')
    .or(`supplier_ref_no.eq.${ref},outward_number.eq.${ref}`)
    .order('outward_date', { ascending: false })
    .limit(1)
  if (factory_id) q = q.eq('factory_id', factory_id)
  const { data, error } = await q
  if (error) throw error
  return (data?.[0] as any) ?? null
}

export const searchOutwards = async (query: string, factory_id?: string) => {
  const q = (query ?? '').trim()
  if (!q) return []
  let s = supabase.from('io_outward')
    .select('id, outward_number, outward_date, supplier_ref_no, supplier:io_companies(id,company_name)')
    .order('outward_date', { ascending: false })
    .limit(25)
    .or(`outward_number.ilike.%${q}%,supplier_ref_no.ilike.%${q}%`)
  if (factory_id) s = s.eq('factory_id', factory_id)
  const { data, error } = await s
  if (error) throw error
  return data ?? []
}
export const saveOutward = async (outward: Partial<IOOutward> & { items: IOLineItem[] }): Promise<IOOutward> => {
  const uid = await userId()
  if (outward.id) {
    const { data, error } = await supabase.from('io_outward').update({
      factory_id: outward.factory_id || null, outward_date: outward.outward_date,
      supplier_id: outward.supplier_id || null, supplier_ref_no: outward.supplier_ref_no || null,
      remarks: outward.remarks || null, updated_at: new Date().toISOString(),
    }).eq('id', outward.id).select().single()
    if (error) throw error
    await supabase.from('io_outward_items').delete().eq('outward_id', outward.id)
    if (outward.items.length > 0) {
      const { error: ie } = await supabase.from('io_outward_items').insert(
        outward.items.map((it, i) => ({ outward_id: outward.id, product_id: it.product_id, quantity: it.quantity, price: it.price, remarks: it.remarks || null, sort_order: i }))
      )
      if (ie) throw ie
    }
    return data as any
  } else {
    const number = await getNextNumber('outward', outward.outward_date, outward.factory_id || null)
    const { data, error } = await supabase.from('io_outward').insert({
      outward_number: number, factory_id: outward.factory_id || null,
      outward_date: outward.outward_date, supplier_id: outward.supplier_id || null,
      supplier_ref_no: outward.supplier_ref_no || null, remarks: outward.remarks || null, created_by: uid,
    }).select().single()
    if (error) throw error
    if (outward.items.length > 0) {
      const { error: ie } = await supabase.from('io_outward_items').insert(
        outward.items.map((it, i) => ({ outward_id: data.id, product_id: it.product_id, quantity: it.quantity, price: it.price, remarks: it.remarks || null, sort_order: i }))
      )
      if (ie) throw ie
    }
    return data as any
  }
}
export const deleteOutward = async (id: string) => {
  const { error } = await supabase.from('io_outward').delete().eq('id', id)
  if (error) throw error
}

// ── Domestic ──────────────────────────────────────────────────
export const fetchDomestics = async (factory_id?: string): Promise<IODomestic[]> => {
  let q = supabase.from('io_domestic')
    .select(`
      id, invoice_number, tax_invoice_number, invoice_date, customer_id, remarks, factory_id, created_by, created_at, updated_at,
      factory:factories(id,name),
      customer:io_companies(id,company_name,person_name),
      items:io_domestic_items(id,domestic_id,product_id,quantity,price,remarks,sort_order,product:io_products(product_name,hsn_code))
    `)
    .order('invoice_date', { ascending: true })
  if (factory_id) q = q.eq('factory_id', factory_id)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as IODomestic[]
}
export const saveDomestic = async (doc: Partial<IODomestic> & { items: IOLineItem[] }): Promise<IODomestic> => {
  const uid = await userId()
  if (doc.id) {
    const { data, error } = await supabase.from('io_domestic').update({
      factory_id: doc.factory_id || null, invoice_date: doc.invoice_date,
      customer_id: doc.customer_id || null,
      remarks: doc.remarks || null, updated_at: new Date().toISOString(),
    }).eq('id', doc.id).select().single()
    if (error) throw error
    await supabase.from('io_domestic').update({ tax_invoice_number: data.invoice_number }).eq('id', doc.id)
    await supabase.from('io_domestic_items').delete().eq('domestic_id', doc.id)
    if (doc.items.length > 0) {
      const { error: ie } = await supabase.from('io_domestic_items').insert(
        doc.items.map((it, i) => ({ domestic_id: doc.id, product_id: it.product_id, quantity: it.quantity, price: it.price, remarks: it.remarks || null, sort_order: i }))
      )
      if (ie) throw ie
    }
    return data as any
  } else {
    const number = await getNextNumber('domestic', doc.invoice_date, doc.factory_id || null)
    const { data, error } = await supabase.from('io_domestic').insert({
      invoice_number: number, factory_id: doc.factory_id || null,
      invoice_date: doc.invoice_date, customer_id: doc.customer_id || null,
      tax_invoice_number: number,
      remarks: doc.remarks || null, created_by: uid,
    }).select().single()
    if (error) throw error
    if (doc.items.length > 0) {
      const { error: ie } = await supabase.from('io_domestic_items').insert(
        doc.items.map((it, i) => ({ domestic_id: data.id, product_id: it.product_id, quantity: it.quantity, price: it.price, remarks: it.remarks || null, sort_order: i }))
      )
      if (ie) throw ie
    }
    return data as any
  }
}
export const deleteDomestic = async (id: string) => {
  const { error } = await supabase.from('io_domestic').delete().eq('id', id)
  if (error) throw error
}

// ── International ─────────────────────────────────────────────
export const fetchInternationals = async (factory_id?: string): Promise<IOInternational[]> => {
  let q = supabase.from('io_international')
    .select(`
      id, invoice_number, tax_invoice_number, invoice_date, customer_id, remarks, factory_id, created_by, created_at, updated_at,
      factory:factories(id,name),
      customer:io_companies(id,company_name,person_name),
      items:io_international_items(id,international_id,product_id,quantity,price,remarks,sort_order,product:io_products(product_name,hsn_code))
    `)
    .order('invoice_date', { ascending: true })
  if (factory_id) q = q.eq('factory_id', factory_id)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as IOInternational[]
}
export const saveInternational = async (doc: Partial<IOInternational> & { items: IOLineItem[] }): Promise<IOInternational> => {
  const uid = await userId()
  if (doc.id) {
    const { data, error } = await supabase.from('io_international').update({
      factory_id: doc.factory_id || null, invoice_date: doc.invoice_date,
      customer_id: doc.customer_id || null,
      remarks: doc.remarks || null, updated_at: new Date().toISOString(),
    }).eq('id', doc.id).select().single()
    if (error) throw error
    await supabase.from('io_international').update({ tax_invoice_number: data.invoice_number }).eq('id', doc.id)
    await supabase.from('io_international_items').delete().eq('international_id', doc.id)
    if (doc.items.length > 0) {
      const { error: ie } = await supabase.from('io_international_items').insert(
        doc.items.map((it, i) => ({ international_id: doc.id, product_id: it.product_id, quantity: it.quantity, price: it.price, remarks: it.remarks || null, sort_order: i }))
      )
      if (ie) throw ie
    }
    return data as any
  } else {
    const number = await getNextNumber('international', doc.invoice_date, doc.factory_id || null)
    const { data, error } = await supabase.from('io_international').insert({
      invoice_number: number, factory_id: doc.factory_id || null,
      invoice_date: doc.invoice_date, customer_id: doc.customer_id || null,
      tax_invoice_number: number,
      remarks: doc.remarks || null, created_by: uid,
    }).select().single()
    if (error) throw error
    if (doc.items.length > 0) {
      const { error: ie } = await supabase.from('io_international_items').insert(
        doc.items.map((it, i) => ({ international_id: data.id, product_id: it.product_id, quantity: it.quantity, price: it.price, remarks: it.remarks || null, sort_order: i }))
      )
      if (ie) throw ie
    }
    return data as any
  }
}
export const deleteInternational = async (id: string) => {
  const { error } = await supabase.from('io_international').delete().eq('id', id)
  if (error) throw error
}

// ── Quotations ────────────────────────────────────────────────
export const fetchQuotations = async (factory_id?: string): Promise<IOQuotation[]> => {
  let q = supabase.from('io_quotations')
    .select(`
      id, quotation_number, quotation_date, customer_id, outward_ref_no, header_content, footer_content, factory_id, created_by, created_at, updated_at,
      factory:factories(id,name),
      customer:io_companies(id,company_name,person_name),
      items:io_quotation_items(id,quotation_id,reference_no,product_id,product_name_override,price,sort_order,product:io_products(product_name))
    `)
    .order('quotation_date', { ascending: true })
  if (factory_id) q = q.eq('factory_id', factory_id)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as IOQuotation[]
}
export const saveQuotation = async (doc: Partial<IOQuotation> & { items: IOQuotationItem[] }): Promise<IOQuotation> => {
  const uid = await userId()
  if (doc.id) {
    const { data, error } = await supabase.from('io_quotations').update({
      factory_id: doc.factory_id || null, quotation_date: doc.quotation_date,
      customer_id: doc.customer_id || null, outward_ref_no: doc.outward_ref_no || null,
      header_content: doc.header_content || null,
      footer_content: doc.footer_content || null, updated_at: new Date().toISOString(),
    }).eq('id', doc.id).select().single()
    if (error) throw error
    await supabase.from('io_quotation_items').delete().eq('quotation_id', doc.id)
    if (doc.items.length > 0) {
      const { error: ie } = await supabase.from('io_quotation_items').insert(
        doc.items.map((it, i) => ({ quotation_id: doc.id, reference_no: it.reference_no || null, product_id: it.product_id || null, product_name_override: it.product_name_override || null, price: it.price, sort_order: i }))
      )
      if (ie) throw ie
    }
    return data as any
  } else {
    const number = await getNextNumber('quotation', doc.quotation_date, doc.factory_id || null)
    const { data, error } = await supabase.from('io_quotations').insert({
      quotation_number: number, factory_id: doc.factory_id || null,
      quotation_date: doc.quotation_date, customer_id: doc.customer_id || null,
      outward_ref_no: doc.outward_ref_no || null,
      header_content: doc.header_content || null, footer_content: doc.footer_content || null, created_by: uid,
    }).select().single()
    if (error) throw error
    if (doc.items.length > 0) {
      const { error: ie } = await supabase.from('io_quotation_items').insert(
        doc.items.map((it, i) => ({ quotation_id: data.id, reference_no: it.reference_no || null, product_id: it.product_id || null, product_name_override: it.product_name_override || null, price: it.price, sort_order: i }))
      )
      if (ie) throw ie
    }
    return data as any
  }
}
export const deleteQuotation = async (id: string) => {
  const { error } = await supabase.from('io_quotations').delete().eq('id', id)
  if (error) throw error
}

// ── Dashboard Stats ───────────────────────────────────────────
export const fetchIOStats = async (factory_id?: string) => {
  const filter = (q: any) => factory_id ? q.eq('factory_id', factory_id) : q
  const [inward, outward, domestic, international, quotations] = await Promise.all([
    filter(supabase.from('io_inward').select('id', { count: 'exact', head: true })),
    filter(supabase.from('io_outward').select('id', { count: 'exact', head: true })),
    filter(supabase.from('io_domestic').select('id', { count: 'exact', head: true })),
    filter(supabase.from('io_international').select('id', { count: 'exact', head: true })),
    filter(supabase.from('io_quotations').select('id', { count: 'exact', head: true })),
  ])
  return {
    inward: inward.count ?? 0, outward: outward.count ?? 0,
    domestic: domestic.count ?? 0, international: international.count ?? 0,
    quotations: quotations.count ?? 0,
  }
}

// ── Helpers ───────────────────────────────────────────────────
export const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

export const today = () => new Date().toISOString().split('T')[0]

export const exportCSV = (rows: Record<string, unknown>[], filename: string) => {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
