import { rpcPost } from "@madstoq/core";
import type {
  IOUnit, IOCountry, IOState, IOCity,
  IOCompany, IOProduct,
  IOInward, IOOutward, IODomestic, IOInternational,
  IOQuotation, IOLineItem, IOQuotationItem,
  CompanyType, DocType,
} from './types'

const RPC = '/api/rpc/io'

export type IoPage<T> = { rows: T[]; total: number; page: number; pageSize: number }

export type IoDocListQuery = {
  factory_id?: string | null
  q?: string | null
  party_id?: string | null
  fy_start?: number | null
  month?: number | null
  date?: string | null
  page?: number | null
  page_size?: number | null
  all?: boolean | null
}

function ioQuery(factoryOrQuery?: string | IoDocListQuery): IoDocListQuery {
  if (typeof factoryOrQuery === 'string' || factoryOrQuery == null) return { factory_id: factoryOrQuery }
  return factoryOrQuery
}

/** Latest document numbers first (e.g. VIB/010/26 before VIB/009/26). */
export function compareIoDocNumbersDesc(a: string, b: string): number {
  return b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' })
}

export async function getNextNumber(type: DocType, date?: string, factoryId?: string | null): Promise<string> {
  return rpcPost<string>(RPC, 'getNextNumber', { type, date, factoryId })
}

export async function fetchUnits(): Promise<IOUnit[]> {
  return rpcPost<IOUnit[]>(RPC, 'fetchUnits')
}

export async function saveUnit(unit: Partial<IOUnit>): Promise<void> {
  return rpcPost(RPC, 'saveUnit', { unit })
}

export async function deleteUnit(id: number): Promise<void> {
  return rpcPost(RPC, 'deleteUnit', { id })
}

export async function fetchCountries(): Promise<IOCountry[]> {
  return rpcPost<IOCountry[]>(RPC, 'fetchCountries')
}

export async function saveCountry(c: Partial<IOCountry>): Promise<void> {
  return rpcPost(RPC, 'saveCountry', { c })
}

export async function deleteCountry(id: number): Promise<void> {
  return rpcPost(RPC, 'deleteCountry', { id })
}

export async function ensureCountry(name: string, code?: string | null): Promise<IOCountry> {
  return rpcPost<IOCountry>(RPC, 'ensureCountry', { name, code })
}

export async function fetchStates(country_id?: number): Promise<IOState[]> {
  return rpcPost<IOState[]>(RPC, 'fetchStates', { country_id })
}

export async function saveState(s: Partial<IOState>): Promise<void> {
  return rpcPost(RPC, 'saveState', { s })
}

export async function deleteState(id: number): Promise<void> {
  return rpcPost(RPC, 'deleteState', { id })
}

export async function ensureState(name: string, country_id: number, code?: string | null): Promise<IOState> {
  return rpcPost<IOState>(RPC, 'ensureState', { name, country_id, code })
}

export async function fetchCities(state_id?: number): Promise<IOCity[]> {
  return rpcPost<IOCity[]>(RPC, 'fetchCities', { state_id })
}

export async function saveCity(c: Partial<IOCity>): Promise<void> {
  return rpcPost(RPC, 'saveCity', { c })
}

export async function deleteCity(id: number): Promise<void> {
  return rpcPost(RPC, 'deleteCity', { id })
}

export async function ensureCity(name: string, state_id: number): Promise<IOCity> {
  return rpcPost<IOCity>(RPC, 'ensureCity', { name, state_id })
}

export async function fetchCompanies(type?: CompanyType | 'all', factory_id?: string): Promise<IOCompany[]> {
  return rpcPost<IOCompany[]>(RPC, 'fetchCompanies', { type, factory_id })
}

export async function saveCompany(c: Partial<IOCompany>): Promise<IOCompany> {
  return rpcPost<IOCompany>(RPC, 'saveCompany', { c })
}

export async function deleteCompany(id: string): Promise<void> {
  return rpcPost(RPC, 'deleteCompany', { id })
}

export async function fetchNumberingConfig(factory_id: string): Promise<Record<DocType, { prefix: string; suffix: string; numberFormat: 'standard' | 'slash_pad3' }>> {
  return rpcPost(RPC, 'fetchNumberingConfig', { factory_id })
}

export async function saveNumberingConfig(factory_id: string, config: Record<DocType, { prefix: string; suffix: string; numberFormat?: 'standard' | 'slash_pad3' }>): Promise<void> {
  return rpcPost(RPC, 'saveNumberingConfig', { factory_id, config })
}

export async function fetchProducts(factory_id?: string): Promise<IOProduct[]> {
  return rpcPost<IOProduct[]>(RPC, 'fetchProducts', { factory_id })
}

export async function saveProduct(p: Partial<IOProduct>): Promise<IOProduct> {
  return rpcPost<IOProduct>(RPC, 'saveProduct', { p })
}

export async function deleteProduct(id: string): Promise<void> {
  return rpcPost(RPC, 'deleteProduct', { id })
}

export async function fetchInwards(factoryOrQuery?: string | IoDocListQuery): Promise<IoPage<IOInward>> {
  return rpcPost<IoPage<IOInward>>(RPC, 'fetchInwards', ioQuery(factoryOrQuery))
}

export async function saveInward(inward: Partial<IOInward> & { items: IOLineItem[] }): Promise<IOInward> {
  return rpcPost<IOInward>(RPC, 'saveInward', { inward })
}

export async function deleteInward(id: string): Promise<void> {
  return rpcPost(RPC, 'deleteInward', { id })
}

export async function fetchOutwards(factoryOrQuery?: string | IoDocListQuery): Promise<IoPage<IOOutward>> {
  return rpcPost<IoPage<IOOutward>>(RPC, 'fetchOutwards', ioQuery(factoryOrQuery))
}

export async function fetchOutwardByRefNo(refNo: string, factory_id?: string): Promise<IOOutward | null> {
  return rpcPost<IOOutward | null>(RPC, 'fetchOutwardByRefNo', { refNo, factory_id })
}

export async function searchOutwards(query: string, factory_id?: string): Promise<IOOutward[]> {
  return rpcPost<IOOutward[]>(RPC, 'searchOutwards', { query, factory_id })
}

export async function saveOutward(outward: Partial<IOOutward> & { items: IOLineItem[] }): Promise<IOOutward> {
  return rpcPost<IOOutward>(RPC, 'saveOutward', { outward })
}

export async function deleteOutward(id: string): Promise<void> {
  return rpcPost(RPC, 'deleteOutward', { id })
}

export async function fetchDomestics(factoryOrQuery?: string | IoDocListQuery): Promise<IoPage<IODomestic>> {
  return rpcPost<IoPage<IODomestic>>(RPC, 'fetchDomestics', ioQuery(factoryOrQuery))
}

export async function saveDomestic(doc: Partial<IODomestic> & { items: IOLineItem[] }): Promise<IODomestic> {
  return rpcPost<IODomestic>(RPC, 'saveDomestic', { doc })
}

export async function deleteDomestic(id: string): Promise<void> {
  return rpcPost(RPC, 'deleteDomestic', { id })
}

export async function fetchInternationals(factoryOrQuery?: string | IoDocListQuery): Promise<IoPage<IOInternational>> {
  return rpcPost<IoPage<IOInternational>>(RPC, 'fetchInternationals', ioQuery(factoryOrQuery))
}

export async function saveInternational(doc: Partial<IOInternational> & { items: IOLineItem[] }): Promise<IOInternational> {
  return rpcPost<IOInternational>(RPC, 'saveInternational', { doc })
}

export async function deleteInternational(id: string): Promise<void> {
  return rpcPost(RPC, 'deleteInternational', { id })
}

export async function fetchQuotations(factoryOrQuery?: string | IoDocListQuery): Promise<IoPage<IOQuotation>> {
  return rpcPost<IoPage<IOQuotation>>(RPC, 'fetchQuotations', ioQuery(factoryOrQuery))
}

export async function saveQuotation(doc: Partial<IOQuotation> & { items: IOQuotationItem[] }): Promise<IOQuotation> {
  return rpcPost<IOQuotation>(RPC, 'saveQuotation', { doc })
}

export async function deleteQuotation(id: string): Promise<void> {
  return rpcPost(RPC, 'deleteQuotation', { id })
}

export async function fetchIOStats(factory_id?: string): Promise<{ inward: number; outward: number; domestic: number; international: number; quotations: number }> {
  return rpcPost(RPC, 'fetchIOStats', { factory_id })
}

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
