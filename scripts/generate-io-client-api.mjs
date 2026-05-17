import fs from 'fs'

const all = [
  ['getNextNumber', 'type: DocType, date?: string, factoryId?: string | null', 'Promise<string>', "rpcPost<string>(RPC, 'getNextNumber', { type, date, factoryId })"],
  ['fetchUnits', '', 'Promise<IOUnit[]>', "rpcPost<IOUnit[]>(RPC, 'fetchUnits')"],
  ['saveUnit', 'unit: Partial<IOUnit>', 'Promise<void>', "rpcPost(RPC, 'saveUnit', { unit })"],
  ['deleteUnit', 'id: number', 'Promise<void>', "rpcPost(RPC, 'deleteUnit', { id })"],
  ['fetchCountries', '', 'Promise<IOCountry[]>', "rpcPost<IOCountry[]>(RPC, 'fetchCountries')"],
  ['saveCountry', 'c: Partial<IOCountry>', 'Promise<void>', "rpcPost(RPC, 'saveCountry', { c })"],
  ['deleteCountry', 'id: number', 'Promise<void>', "rpcPost(RPC, 'deleteCountry', { id })"],
  ['ensureCountry', 'name: string, code?: string | null', 'Promise<IOCountry>', "rpcPost<IOCountry>(RPC, 'ensureCountry', { name, code })"],
  ['fetchStates', 'country_id?: number', 'Promise<IOState[]>', "rpcPost<IOState[]>(RPC, 'fetchStates', { country_id })"],
  ['saveState', 's: Partial<IOState>', 'Promise<void>', "rpcPost(RPC, 'saveState', { s })"],
  ['deleteState', 'id: number', 'Promise<void>', "rpcPost(RPC, 'deleteState', { id })"],
  ['ensureState', 'name: string, country_id: number, code?: string | null', 'Promise<IOState>', "rpcPost<IOState>(RPC, 'ensureState', { name, country_id, code })"],
  ['fetchCities', 'state_id?: number', 'Promise<IOCity[]>', "rpcPost<IOCity[]>(RPC, 'fetchCities', { state_id })"],
  ['saveCity', 'c: Partial<IOCity>', 'Promise<void>', "rpcPost(RPC, 'saveCity', { c })"],
  ['deleteCity', 'id: number', 'Promise<void>', "rpcPost(RPC, 'deleteCity', { id })"],
  ['ensureCity', 'name: string, state_id: number', 'Promise<IOCity>', "rpcPost<IOCity>(RPC, 'ensureCity', { name, state_id })"],
  ['fetchCompanies', "type?: CompanyType | 'all', factory_id?: string", 'Promise<IOCompany[]>', "rpcPost<IOCompany[]>(RPC, 'fetchCompanies', { type, factory_id })"],
  ['saveCompany', 'c: Partial<IOCompany>', 'Promise<IOCompany>', "rpcPost<IOCompany>(RPC, 'saveCompany', { c })"],
  ['deleteCompany', 'id: string', 'Promise<void>', "rpcPost(RPC, 'deleteCompany', { id })"],
  ['fetchNumberingConfig', 'factory_id: string', 'Promise<Record<DocType, { prefix: string; suffix: string }>>', "rpcPost(RPC, 'fetchNumberingConfig', { factory_id })"],
  ['saveNumberingConfig', 'factory_id: string, config: Record<DocType, { prefix: string; suffix: string }>', 'Promise<void>', "rpcPost(RPC, 'saveNumberingConfig', { factory_id, config })"],
  ['fetchProducts', 'factory_id?: string', 'Promise<IOProduct[]>', "rpcPost<IOProduct[]>(RPC, 'fetchProducts', { factory_id })"],
  ['saveProduct', 'p: Partial<IOProduct>', 'Promise<IOProduct>', "rpcPost<IOProduct>(RPC, 'saveProduct', { p })"],
  ['deleteProduct', 'id: string', 'Promise<void>', "rpcPost(RPC, 'deleteProduct', { id })"],
  ['fetchInwards', 'factory_id?: string', 'Promise<IOInward[]>', "rpcPost<IOInward[]>(RPC, 'fetchInwards', { factory_id })"],
  ['saveInward', 'inward: Partial<IOInward> & { items: IOLineItem[] }', 'Promise<IOInward>', "rpcPost<IOInward>(RPC, 'saveInward', { inward })"],
  ['deleteInward', 'id: string', 'Promise<void>', "rpcPost(RPC, 'deleteInward', { id })"],
  ['fetchOutwards', 'factory_id?: string', 'Promise<IOOutward[]>', "rpcPost<IOOutward[]>(RPC, 'fetchOutwards', { factory_id })"],
  ['fetchOutwardByRefNo', 'refNo: string, factory_id?: string', 'Promise<IOOutward | null>', "rpcPost<IOOutward | null>(RPC, 'fetchOutwardByRefNo', { refNo, factory_id })"],
  ['searchOutwards', 'query: string, factory_id?: string', 'Promise<IOOutward[]>', "rpcPost<IOOutward[]>(RPC, 'searchOutwards', { query, factory_id })"],
  ['saveOutward', 'outward: Partial<IOOutward> & { items: IOLineItem[] }', 'Promise<IOOutward>', "rpcPost<IOOutward>(RPC, 'saveOutward', { outward })"],
  ['deleteOutward', 'id: string', 'Promise<void>', "rpcPost(RPC, 'deleteOutward', { id })"],
  ['fetchDomestics', 'factory_id?: string', 'Promise<IODomestic[]>', "rpcPost<IODomestic[]>(RPC, 'fetchDomestics', { factory_id })"],
  ['saveDomestic', 'doc: Partial<IODomestic> & { items: IOLineItem[] }', 'Promise<IODomestic>', "rpcPost<IODomestic>(RPC, 'saveDomestic', { doc })"],
  ['deleteDomestic', 'id: string', 'Promise<void>', "rpcPost(RPC, 'deleteDomestic', { id })"],
  ['fetchInternationals', 'factory_id?: string', 'Promise<IOInternational[]>', "rpcPost<IOInternational[]>(RPC, 'fetchInternational', { factory_id })"],
  ['saveInternational', 'doc: Partial<IOInternational> & { items: IOLineItem[] }', 'Promise<IOInternational>', "rpcPost<IOInternational>(RPC, 'saveInternational', { doc })"],
  ['deleteInternational', 'id: string', 'Promise<void>', "rpcPost(RPC, 'deleteInternational', { id })"],
  ['fetchQuotations', 'factory_id?: string', 'Promise<IOQuotation[]>', "rpcPost<IOQuotation[]>(RPC, 'fetchQuotations', { factory_id })"],
  ['saveQuotation', 'doc: Partial<IOQuotation> & { items: IOQuotationItem[] }', 'Promise<IOQuotation>', "rpcPost<IOQuotation>(RPC, 'saveQuotation', { doc })"],
  ['deleteQuotation', 'id: string', 'Promise<void>', "rpcPost(RPC, 'deleteQuotation', { id })"],
  ['fetchIOStats', 'factory_id?: string', 'Promise<{ inward: number; outward: number; domestic: number; international: number; quotations: number }>', "rpcPost(RPC, 'fetchIOStats', { factory_id })"],
]

let out = `import { rpcPost } from '@/lib/client/api-fetch'
import type {
  IOUnit, IOCountry, IOState, IOCity,
  IOCompany, IOProduct,
  IOInward, IOOutward, IODomestic, IOInternational,
  IOQuotation, IOLineItem, IOQuotationItem,
  CompanyType, DocType,
} from './types'

const RPC = '/api/rpc/io'

`

for (const [name, args, ret, body] of all) {
  const argPart = args ? `${args}` : ''
  out += `export async function ${name}(${argPart}): ${ret} {\n  return ${body}\n}\n\n`
}

const helpers = fs.readFileSync('src/lib/io/api.ts', 'utf8')
const helperStart = helpers.indexOf('export const fmtDate')
if (helperStart >= 0) out += helpers.slice(helperStart)

fs.writeFileSync('src/lib/io/api.ts', out)
console.log('Generated', out.length, 'bytes')
