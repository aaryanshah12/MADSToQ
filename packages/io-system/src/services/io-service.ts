import {
  getPrisma,
  getRequestUser,
  moneyStr,
  textOrNull,
  pageDocumentIds,
  parsePageParams,
  reorderByIds,
  type DocumentTable,
  type PageResult,
} from '@madstoq/database'
import {
  assertCanDeleteDocuments,
  assertCanManageMaster,
  assertCanWriteDocuments,
  assertDocumentFactoryAccess,
  assertFactoryAccess,
  factoryListWhere,
} from '../auth/io-access'
import { isIoDomesticEnabled, isIoInternationalEnabled } from '../io-module-flags'
import type { IoNumberFormat } from '../numbering-formats'
import type {
  IOUnit,
  IOCountry,
  IOState,
  IOCity,
  IOCompany,
  IOProduct,
  IOInward,
  IOOutward,
  IODomestic,
  IOInternational,
  IOQuotation,
  IOLineItem,
  IOQuotationItem,
  CompanyType,
  DocType,
} from '../types'

const prisma = getPrisma()

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

function userId() {
  return getRequestUser()?.id ?? null
}

function num(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  if (typeof v === 'object' && v !== null && 'toNumber' in v) {
    return (v as { toNumber(): number }).toNumber()
  }
  return Number(v) || 0
}

function dateStr(d: Date | null | undefined): string | undefined {
  if (!d) return undefined
  return d.toISOString().slice(0, 10)
}

function iso(d: Date | null | undefined): string | undefined {
  return d?.toISOString()
}

function parseDate(s: string): Date {
  return new Date(`${s.slice(0, 10)}T00:00:00.000Z`)
}

function rowToUnit(r: { id: number; name: string; abbreviation: string | null; createdAt: Date }): IOUnit {
  return { id: r.id, name: r.name, abbreviation: r.abbreviation, created_at: iso(r.createdAt) }
}

function rowToCountry(r: { id: number; name: string; code: string | null; createdAt: Date }): IOCountry {
  return { id: r.id, name: r.name, code: r.code, created_at: iso(r.createdAt) }
}

function rowToState(
  r: { id: number; countryId: number; name: string; code: string | null; createdAt: Date; country?: { name: string } | null }
): IOState {
  return {
    id: r.id,
    country_id: r.countryId,
    name: r.name,
    code: r.code,
    created_at: iso(r.createdAt),
    country: r.country ? { name: r.country.name } : undefined,
  }
}

function rowToCity(
  r: { id: number; stateId: number; name: string; createdAt: Date; state?: { name: string } | null }
): IOCity {
  return {
    id: r.id,
    state_id: r.stateId,
    name: r.name,
    created_at: iso(r.createdAt),
    state: r.state ? { name: r.state.name } : undefined,
  }
}

function rowToCompany(r: {
  id: string
  factoryId: string | null
  companyType: string
  companyName: string
  personTitle: string | null
  personName: string | null
  countryId: number | null
  stateId: number | null
  cityId: number | null
  address: string | null
  pincode: string | null
  mobile: string | null
  email: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  country?: { name: string } | null
  state?: { name: string } | null
  city?: { name: string } | null
}): IOCompany {
  return {
    id: r.id,
    factory_id: r.factoryId,
    company_type: r.companyType as CompanyType,
    company_name: r.companyName,
    person_title: r.personTitle,
    person_name: r.personName,
    country_id: r.countryId,
    state_id: r.stateId,
    city_id: r.cityId,
    address: r.address,
    pincode: r.pincode,
    mobile: r.mobile,
    email: r.email,
    is_active: r.isActive,
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt),
    country: r.country ? { name: r.country.name } : null,
    state: r.state ? { name: r.state.name } : null,
    city: r.city ? { name: r.city.name } : null,
  }
}

function rowToProduct(r: {
  id: string
  factoryId: string | null
  productName: string
  description: string | null
  hsnCode: string | null
  unitId: number | null
  rate: unknown
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  unit?: { name: string; abbreviation: string | null } | null
}): IOProduct {
  return {
    id: r.id,
    factory_id: r.factoryId,
    product_name: r.productName,
    description: r.description,
    hsn_code: r.hsnCode,
    unit_id: r.unitId,
    rate: r.rate != null ? num(r.rate) : null,
    is_active: r.isActive,
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt),
    unit: r.unit ? { name: r.unit.name, abbreviation: r.unit.abbreviation } : null,
  }
}

function rowToLineItem(r: {
  id: string
  productId: string
  quantity: unknown
  price: unknown
  remarks: string | null
  sortOrder: number
  product?: { productName: string; hsnCode: string | null } | null
}): IOLineItem {
  return {
    id: r.id,
    product_id: r.productId,
    quantity: num(r.quantity),
    price: num(r.price),
    remarks: r.remarks ?? undefined,
    sort_order: r.sortOrder,
    product: r.product
      ? { product_name: r.product.productName, hsn_code: r.product.hsnCode } as IOProduct
      : null,
  }
}

function rowToQuotationItem(r: {
  id: string
  quotationId: string
  referenceNo: string | null
  productId: string | null
  productNameOverride: string | null
  price: unknown
  priceUnit?: string | null
  sortOrder: number
  product?: { productName: string } | null
}): IOQuotationItem {
  return {
    id: r.id,
    quotation_id: r.quotationId,
    reference_no: r.referenceNo,
    product_id: r.productId,
    product_name_override: r.productNameOverride,
    price: num(r.price),
    price_unit: (r.priceUnit === 'USD/KG' ? 'USD/KG' : 'INR/KG') as IOQuotationItem['price_unit'],
    sort_order: r.sortOrder,
    product: r.product ? { product_name: r.product.productName } as IOProduct : null,
  }
}

const lineItemInclude = {
  orderBy: { sortOrder: 'asc' as const },
  include: { product: { select: { productName: true, hsnCode: true } } },
}

const inwardInclude = {
  factory: { select: { id: true, name: true } },
  supplier: { select: { id: true, companyName: true, personName: true } },
  items: lineItemInclude,
}

const outwardInclude = {
  factory: { select: { id: true, name: true } },
  supplier: { select: { id: true, companyName: true, personName: true } },
  items: lineItemInclude,
}

const domesticInclude = {
  factory: { select: { id: true, name: true } },
  customer: { select: { id: true, companyName: true, personName: true } },
  items: lineItemInclude,
}

const internationalInclude = {
  factory: { select: { id: true, name: true } },
  customer: { select: { id: true, companyName: true, personName: true } },
  items: lineItemInclude,
}

const quotationInclude = {
  factory: { select: { id: true, name: true } },
  customer: { select: { id: true, companyName: true, personTitle: true, personName: true } },
  items: {
    orderBy: { sortOrder: 'asc' as const },
    include: { product: { select: { productName: true } } },
  },
}

function rowToInward(r: {
  id: string
  factoryId: string | null
  inwardNumber: string
  inwardDate: Date
  supplierId: string | null
  supplierRefNo: string | null
  remarks: string | null
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
  factory?: { id: string; name: string } | null
  supplier?: { id: string; companyName: string; personName: string | null } | null
  items?: Array<Parameters<typeof rowToLineItem>[0] & { inwardId?: string }>
}): IOInward {
  return {
    id: r.id,
    factory_id: r.factoryId,
    inward_number: r.inwardNumber,
    inward_date: dateStr(r.inwardDate)!,
    supplier_id: r.supplierId,
    supplier_ref_no: r.supplierRefNo,
    remarks: r.remarks,
    created_by: r.createdBy ?? undefined,
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt),
    factory: r.factory ?? null,
    supplier: r.supplier
      ? {
          id: r.supplier.id,
          company_name: r.supplier.companyName,
          person_name: r.supplier.personName,
          company_type: 'supplier',
          is_active: true,
        }
      : null,
    items: r.items?.map(rowToLineItem),
  }
}

function rowToOutward(r: {
  id: string
  factoryId: string | null
  outwardNumber: string
  outwardDate: Date
  supplierId: string | null
  supplierRefNo: string | null
  remarks: string | null
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
  factory?: { id: string; name: string } | null
  supplier?: { id: string; companyName: string; personName: string | null } | null
  items?: Array<Parameters<typeof rowToLineItem>[0]>
}): IOOutward {
  return {
    id: r.id,
    factory_id: r.factoryId,
    outward_number: r.outwardNumber,
    outward_date: dateStr(r.outwardDate)!,
    supplier_id: r.supplierId,
    supplier_ref_no: r.supplierRefNo,
    remarks: r.remarks,
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt),
    factory: r.factory ?? null,
    supplier: r.supplier
      ? {
          id: r.supplier.id,
          company_name: r.supplier.companyName,
          person_name: r.supplier.personName,
          company_type: 'supplier',
          is_active: true,
        }
      : null,
    items: r.items?.map(rowToLineItem),
  }
}

function rowToDomestic(r: {
  id: string
  factoryId: string | null
  invoiceNumber: string
  taxInvoiceNumber: string | null
  invoiceDate: Date
  customerId: string | null
  remarks: string | null
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
  factory?: { id: string; name: string } | null
  customer?: { id: string; companyName: string; personName: string | null } | null
  items?: Array<Parameters<typeof rowToLineItem>[0]>
}): IODomestic {
  return {
    id: r.id,
    factory_id: r.factoryId,
    invoice_number: r.invoiceNumber,
    tax_invoice_number: r.taxInvoiceNumber,
    invoice_date: dateStr(r.invoiceDate)!,
    customer_id: r.customerId,
    remarks: r.remarks,
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt),
    factory: r.factory ?? null,
    customer: r.customer
      ? {
          id: r.customer.id,
          company_name: r.customer.companyName,
          person_name: r.customer.personName,
          company_type: 'customer',
          is_active: true,
        }
      : null,
    items: r.items?.map(rowToLineItem),
  }
}

function rowToInternational(r: Parameters<typeof rowToDomestic>[0]): IOInternational {
  return rowToDomestic(r) as IOInternational
}

function rowToQuotation(r: {
  id: string
  factoryId: string | null
  quotationNumber: string
  quotationDate: Date
  customerId: string | null
  outwardRefNo: string | null
  headerContent: string | null
  footerContent: string | null
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
  factory?: { id: string; name: string } | null
  customer?: { id: string; companyName: string; personTitle: string | null; personName: string | null } | null
  items?: Array<Parameters<typeof rowToQuotationItem>[0]>
}): IOQuotation {
  return {
    id: r.id,
    factory_id: r.factoryId,
    quotation_number: r.quotationNumber,
    quotation_date: dateStr(r.quotationDate)!,
    customer_id: r.customerId,
    outward_ref_no: r.outwardRefNo,
    header_content: r.headerContent,
    footer_content: r.footerContent,
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt),
    factory: r.factory ?? null,
    customer: r.customer
      ? {
          id: r.customer.id,
          company_name: r.customer.companyName,
          person_title: r.customer.personTitle,
          person_name: r.customer.personName,
          company_type: 'customer',
          is_active: true,
        }
      : null,
    items: r.items?.map(rowToQuotationItem),
  }
}

// ── Next Document Number ───────────────────────────────────────
const NO_VH_TYPES: DocType[] = ['domestic', 'international']

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

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

export type { IoNumberFormat } from '../numbering-formats'
export { IO_NUMBER_FORMAT_OPTIONS, ioNumberFormatLabel } from '../numbering-formats'

function normalizeNumberFormat(v: unknown): IoNumberFormat {
  return String(v ?? '').trim().toLowerCase() === 'slash_pad3' ? 'slash_pad3' : 'standard'
}

function isSlashPad3Format(format: IoNumberFormat) {
  return format === 'slash_pad3'
}

function makeSlashPad3Number(seq: number, date: Date, prefix: string) {
  const yy = pad2(date.getFullYear() % 100)
  const p = String(prefix ?? '').trim()
  const seqPad = String(seq).padStart(3, '0')
  return p ? `${p}/${seqPad}/${yy}` : `${seqPad}/${yy}`
}

function parseSlashPad3Number(v: unknown, prefix: string): { seq: number; yy: string } | null {
  if (typeof v !== 'string') return null
  const p = String(prefix ?? '').trim()
  if (!p) return null
  const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = v.trim().match(new RegExp(`^${escaped}\\/(\\d+)\\/(\\d{2})$`, 'i'))
  if (!m) return null
  return { seq: parseInt(m[1], 10) || 0, yy: m[2] }
}

function parseVHNumber(v: unknown): { seq: number; yy: string } | null {
  if (typeof v !== 'string') return null
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
  const p = prefix ?? ''
  let suf = suffix ?? ''
  if (suf) {
    const sufBare = suf.replace(/^\//, '')
    if (sufBare && (core.endsWith(suf) || core.endsWith(sufBare))) suf = ''
  }
  if (!p && !suf) return core
  const gap = p && core && !/^\s/.test(core) ? ' ' : ''
  return `${p}${gap}${core}${suf}`
}

/** Master prefix/suffix replace legacy VH in the core (avoids VIB + VH 1/05/26 → VIBVH …). */
function usesCustomAffixes(prefix: string, suffix: string): boolean {
  return Boolean(String(prefix ?? '').trim() || String(suffix ?? '').trim())
}

function parseSeqForType(
  type: DocType,
  raw: unknown,
  prefix: string,
  suffix: string,
  numberFormat: IoNumberFormat = 'standard',
): { seq: number; yy: string } | null {
  const full = String(raw ?? '')
  const stripped = stripOuterAffixes(full, prefix, suffix)
  const noVH = NO_VH_TYPES.includes(type)
  if (isSlashPad3Format(numberFormat) && !noVH && String(prefix ?? '').trim()) {
    return (
      parseSlashPad3Number(full, prefix)
      ?? parseSlashPad3Number(stripped, prefix)
      ?? parsePlainNumber(stripped)
      ?? parseVHNumber(stripped)
    )
  }
  if (noVH || usesCustomAffixes(prefix, suffix)) {
    return parsePlainNumber(stripped) ?? parseVHNumber(stripped)
  }
  return parseVHNumber(stripped)
}

async function loadRecentNumbers(
  type: DocType,
  factoryId?: string | null
): Promise<Array<{ number: string; createdAt: Date }>> {
  const where = factoryId ? { factoryId } : factoryListWhere()
  const take = 2000
  switch (type) {
    case 'inward':
      return prisma.ioInward.findMany({
        where,
        select: { inwardNumber: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take,
      }).then((rows) => rows.map((r) => ({ number: r.inwardNumber, createdAt: r.createdAt })))
    case 'outward':
      return prisma.ioOutward.findMany({
        where,
        select: { outwardNumber: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take,
      }).then((rows) => rows.map((r) => ({ number: r.outwardNumber, createdAt: r.createdAt })))
    case 'quotation':
      return prisma.ioQuotation.findMany({
        where,
        select: { quotationNumber: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take,
      }).then((rows) => rows.map((r) => ({ number: r.quotationNumber, createdAt: r.createdAt })))
    case 'domestic':
      return prisma.ioDomestic.findMany({
        where,
        select: { invoiceNumber: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take,
      }).then((rows) => rows.map((r) => ({ number: r.invoiceNumber, createdAt: r.createdAt })))
    case 'international':
      return prisma.ioInternational.findMany({
        where,
        select: { invoiceNumber: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take,
      }).then((rows) => rows.map((r) => ({ number: r.invoiceNumber, createdAt: r.createdAt })))
  }
}

async function computeNextNumber(
  type: DocType,
  date = new Date(),
  factoryId?: string | null,
  prefix = '',
  suffix = '',
  numberFormat: IoNumberFormat = 'standard',
): Promise<string> {
  const yy = pad2(date.getFullYear() % 100)
  const rows = await loadRecentNumbers(type, factoryId)

  let max = 0
  for (const row of rows) {
    const parsed = parseSeqForType(type, row.number, prefix, suffix, numberFormat)
    if (!parsed) continue
    if (parsed.yy !== yy) continue
    if (parsed.seq > max) max = parsed.seq
  }

  const nextSeq = max + 1
  if (isSlashPad3Format(numberFormat) && !NO_VH_TYPES.includes(type) && String(prefix ?? '').trim()) {
    return makeSlashPad3Number(nextSeq, date, prefix)
  }

  const plainCore = NO_VH_TYPES.includes(type) || usesCustomAffixes(prefix, suffix)
  return plainCore ? makePlainNumber(nextSeq, date) : makeVHNumber(nextSeq, date)
}

export async function getNextNumber(type: DocType, date?: string, factoryId?: string | null): Promise<string> {
  const d = date ? parseDate(date) : new Date()
  let prefix = ''
  let suffix = ''
  let numberFormat: IoNumberFormat = 'standard'
  if (factoryId) {
    assertFactoryAccess(factoryId)
    try {
      const cfg = await fetchNumberingConfig(factoryId)
      prefix = cfg[type]?.prefix ?? ''
      suffix = cfg[type]?.suffix ?? ''
      numberFormat = cfg[type]?.numberFormat ?? 'standard'
    } catch {
      /* ignore */
    }
  }
  const core = await computeNextNumber(type, d, factoryId, prefix, suffix, numberFormat)
  if (isSlashPad3Format(numberFormat) && !NO_VH_TYPES.includes(type) && String(prefix ?? '').trim()) {
    return core
  }
  return applyOuterAffixes(core, prefix, suffix)
}

// ── Units ──────────────────────────────────────────────────────
export const fetchUnits = async (): Promise<IOUnit[]> => {
  const rows = await prisma.ioUnit.findMany({ orderBy: { name: 'asc' } })
  return rows.map(rowToUnit)
}

export const saveUnit = async (unit: Partial<IOUnit>) => {
  assertCanManageMaster()
  if (unit.id) {
    await prisma.ioUnit.update({
      where: { id: unit.id },
      data: { name: unit.name!, abbreviation: unit.abbreviation ?? null },
    })
  } else {
    await prisma.ioUnit.create({
      data: { name: unit.name!, abbreviation: unit.abbreviation ?? null },
    })
  }
}

export const deleteUnit = async (id: number) => {
  assertCanManageMaster()
  await prisma.ioUnit.delete({ where: { id } })
}

// ── Countries ──────────────────────────────────────────────────
export const fetchCountries = async (): Promise<IOCountry[]> => {
  const rows = await prisma.ioCountry.findMany({ orderBy: { name: 'asc' } })
  return rows.map(rowToCountry)
}

export const saveCountry = async (c: Partial<IOCountry>) => {
  assertCanManageMaster()
  if (c.id) {
    await prisma.ioCountry.update({
      where: { id: c.id },
      data: { name: c.name!, code: c.code ?? null },
    })
  } else {
    await prisma.ioCountry.create({ data: { name: c.name!, code: c.code ?? null } })
  }
}

export const deleteCountry = async (id: number) => {
  assertCanManageMaster()
  await prisma.ioCountry.delete({ where: { id } })
}

export const ensureCountry = async (name: string, code?: string | null): Promise<IOCountry> => {
  assertCanManageMaster()
  const n = (name ?? '').trim()
  if (!n) throw new Error('country name required')
  const existing = await prisma.ioCountry.findFirst({
    where: { name: { equals: n, mode: 'insensitive' } },
  })
  if (existing) return rowToCountry(existing)
  const created = await prisma.ioCountry.create({ data: { name: n, code: code ?? null } })
  return rowToCountry(created)
}

// ── States ────────────────────────────────────────────────────
export const fetchStates = async (country_id?: number): Promise<IOState[]> => {
  const rows = await prisma.ioState.findMany({
    where: country_id ? { countryId: country_id } : undefined,
    include: { country: { select: { name: true } } },
    orderBy: { name: 'asc' },
  })
  return rows.map(rowToState)
}

export const saveState = async (s: Partial<IOState>) => {
  assertCanManageMaster()
  if (s.id) {
    await prisma.ioState.update({
      where: { id: s.id },
      data: { name: s.name!, code: s.code ?? null, countryId: s.country_id! },
    })
  } else {
    await prisma.ioState.create({
      data: { name: s.name!, code: s.code ?? null, countryId: s.country_id! },
    })
  }
}

export const deleteState = async (id: number) => {
  assertCanManageMaster()
  await prisma.ioState.delete({ where: { id } })
}

export const ensureState = async (name: string, country_id: number, code?: string | null): Promise<IOState> => {
  assertCanManageMaster()
  const n = (name ?? '').trim()
  if (!n) throw new Error('state name required')
  const existing = await prisma.ioState.findFirst({
    where: { countryId: country_id, name: { equals: n, mode: 'insensitive' } },
  })
  if (existing) return rowToState(existing)
  const created = await prisma.ioState.create({
    data: { name: n, countryId: country_id, code: code ?? null },
  })
  return rowToState(created)
}

// ── Cities ────────────────────────────────────────────────────
export const fetchCities = async (state_id?: number): Promise<IOCity[]> => {
  const rows = await prisma.ioCity.findMany({
    where: state_id ? { stateId: state_id } : undefined,
    include: { state: { select: { name: true } } },
    orderBy: { name: 'asc' },
  })
  return rows.map(rowToCity)
}

export const saveCity = async (c: Partial<IOCity>) => {
  assertCanManageMaster()
  if (c.id) {
    await prisma.ioCity.update({
      where: { id: c.id },
      data: { name: c.name!, stateId: c.state_id! },
    })
  } else {
    await prisma.ioCity.create({ data: { name: c.name!, stateId: c.state_id! } })
  }
}

export const deleteCity = async (id: number) => {
  assertCanManageMaster()
  await prisma.ioCity.delete({ where: { id } })
}

export const ensureCity = async (name: string, state_id: number): Promise<IOCity> => {
  assertCanManageMaster()
  const n = (name ?? '').trim()
  if (!n) throw new Error('city name required')
  const existing = await prisma.ioCity.findFirst({
    where: { stateId: state_id, name: { equals: n, mode: 'insensitive' } },
  })
  if (existing) return rowToCity(existing)
  const created = await prisma.ioCity.create({ data: { name: n, stateId: state_id } })
  return rowToCity(created)
}

// ── Companies ─────────────────────────────────────────────────
export const fetchCompanies = async (type?: CompanyType | 'all', factory_id?: string): Promise<IOCompany[]> => {
  const cacheKey = `companies:${type ?? 'all'}:${factory_id ?? 'all'}`
  const cached = getCached<IOCompany[]>(cacheKey)
  if (cached) return cached

  const rows = await prisma.ioCompany.findMany({
    where: {
      isActive: true,
      ...factoryListWhere(factory_id),
      ...(type && type !== 'all'
        ? { OR: [{ companyType: type }, { companyType: 'both' }] }
        : {}),
    },
    include: {
      country: { select: { name: true } },
      state: { select: { name: true } },
      city: { select: { name: true } },
    },
    orderBy: { companyName: 'asc' },
  })
  const mapped = rows.map(rowToCompany)
  setCached(cacheKey, mapped)
  return mapped
}

export const saveCompany = async (c: Partial<IOCompany>): Promise<IOCompany> => {
  assertCanManageMaster()
  if (c.factory_id) assertFactoryAccess(c.factory_id)
  if (c.id) {
    const existing = await prisma.ioCompany.findUnique({ where: { id: c.id }, select: { factoryId: true } })
    if (existing?.factoryId) assertDocumentFactoryAccess(existing.factoryId)
  }
  const data = {
    factoryId: c.factory_id || null,
    companyType: c.company_type!,
    companyName: c.company_name!,
    personTitle: c.person_title || null,
    personName: c.person_name || null,
    countryId: c.country_id || null,
    stateId: c.state_id || null,
    cityId: c.city_id || null,
    address: c.address || null,
    pincode: c.pincode || null,
    mobile: c.mobile || null,
    email: c.email || null,
    isActive: true,
  }
  const companyInclude = {
    country: { select: { name: true } },
    state: { select: { name: true } },
    city: { select: { name: true } },
  } as const
  const row = c.id
    ? await prisma.ioCompany.update({ where: { id: c.id }, data, include: companyInclude })
    : await prisma.ioCompany.create({ data, include: companyInclude })
  clearCachedPrefix('companies:')
  return rowToCompany(row)
}

export const deleteCompany = async (id: string) => {
  assertCanManageMaster()
  const existing = await prisma.ioCompany.findUnique({ where: { id }, select: { factoryId: true } })
  if (existing?.factoryId) assertDocumentFactoryAccess(existing.factoryId)
  await prisma.ioCompany.update({ where: { id }, data: { isActive: false } })
  clearCachedPrefix('companies:')
}

// ── Numbering Config (Factory-wise) ───────────────────────────
export type IoNumberingRow = { prefix: string; suffix: string; numberFormat: IoNumberFormat }

export const fetchNumberingConfig = async (factory_id: string): Promise<Record<DocType, IoNumberingRow>> => {
  assertFactoryAccess(factory_id)
  const defaults: Record<DocType, IoNumberingRow> = {
    inward: { prefix: '', suffix: '', numberFormat: 'standard' },
    outward: { prefix: '', suffix: '', numberFormat: 'standard' },
    domestic: { prefix: '', suffix: '', numberFormat: 'standard' },
    international: { prefix: '', suffix: '', numberFormat: 'standard' },
    quotation: { prefix: '', suffix: '', numberFormat: 'standard' },
  }
  const rows = await prisma.ioNumberingConfig.findMany({ where: { factoryId: factory_id } })
  for (const row of rows) {
    const key = row.docType as DocType
    if (defaults[key]) {
      defaults[key] = {
        prefix: row.prefix ?? '',
        suffix: row.suffix ?? '',
        numberFormat: normalizeNumberFormat(row.numberFormat),
      }
    }
  }
  return defaults
}

export const saveNumberingConfig = async (
  factory_id: string,
  values: Record<DocType, IoNumberingRow>
) => {
  assertCanManageMaster()
  assertFactoryAccess(factory_id)
  const docTypes: DocType[] = ['inward', 'outward', 'domestic', 'international', 'quotation']
  const rows = docTypes.map((doc_type) => ({
    factoryId: factory_id,
    docType: doc_type,
    prefix: values[doc_type]?.prefix ?? '',
    suffix: values[doc_type]?.suffix ?? '',
    numberFormat: normalizeNumberFormat(values[doc_type]?.numberFormat),
  }))
  await prisma.$transaction([
    prisma.ioNumberingConfig.deleteMany({
      where: { factoryId: factory_id, docType: { in: docTypes } },
    }),
    prisma.ioNumberingConfig.createMany({ data: rows }),
  ])
}

// ── Products ──────────────────────────────────────────────────
export const fetchProducts = async (factory_id?: string): Promise<IOProduct[]> => {
  const cacheKey = `products:${factory_id ?? 'all'}`
  const cached = getCached<IOProduct[]>(cacheKey)
  if (cached) return cached

  const rows = await prisma.ioProduct.findMany({
    where: {
      isActive: true,
      ...factoryListWhere(factory_id),
    },
    include: { unit: { select: { name: true, abbreviation: true } } },
    orderBy: { createdAt: 'asc' },
  })
  const mapped = rows.map(rowToProduct).sort((a, b) => a.product_name.localeCompare(b.product_name))
  setCached(cacheKey, mapped)
  return mapped
}

export const saveProduct = async (p: Partial<IOProduct>): Promise<IOProduct> => {
  assertCanManageMaster()
  if (p.factory_id) assertFactoryAccess(p.factory_id)
  if (p.id) {
    const existing = await prisma.ioProduct.findUnique({ where: { id: p.id }, select: { factoryId: true } })
    if (existing?.factoryId) assertDocumentFactoryAccess(existing.factoryId)
  }
  const data = {
    factoryId: p.factory_id || null,
    productName: p.product_name!,
    description: p.description || null,
    hsnCode: p.hsn_code || null,
    unitId: p.unit_id || null,
    rate: p.rate != null ? moneyStr(p.rate) : null,
    isActive: true,
  }
  const row = p.id
    ? await prisma.ioProduct.update({ where: { id: p.id }, data, include: { unit: { select: { name: true, abbreviation: true } } } })
    : await prisma.ioProduct.create({ data, include: { unit: { select: { name: true, abbreviation: true } } } })
  clearCachedPrefix('products:')
  return rowToProduct(row)
}

export const deleteProduct = async (id: string) => {
  assertCanManageMaster()
  const existing = await prisma.ioProduct.findUnique({ where: { id }, select: { factoryId: true } })
  if (existing?.factoryId) assertDocumentFactoryAccess(existing.factoryId)
  await prisma.ioProduct.update({ where: { id }, data: { isActive: false } })
  clearCachedPrefix('products:')
}

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

function asIoQuery(input?: string | IoDocListQuery): IoDocListQuery {
  if (typeof input === 'string' || input == null) return { factory_id: input ?? undefined }
  return input
}

function factoryIdsForList(factory_id?: string | null): string[] {
  const where = factoryListWhere(factory_id)
  return typeof where.factoryId === 'string' ? [where.factoryId] : where.factoryId.in
}

async function fetchIoDocPage<T extends { id: string }>(
  table: DocumentTable,
  query: IoDocListQuery | undefined,
  load: (ids: string[]) => Promise<T[]>,
): Promise<PageResult<T>> {
  const page = parsePageParams(
    {
      page: query?.page ?? undefined,
      page_size: query?.page_size ?? undefined,
      all: query?.all ? '1' : undefined,
    },
    query?.page_size ? { defaultPageSize: query.page_size } : undefined,
  )
  const listed = await pageDocumentIds(
    prisma,
    table,
    {
      factoryIds: factoryIdsForList(query?.factory_id),
      q: query?.q,
      partyId: query?.party_id,
      fyStart: query?.fy_start,
      month: query?.month,
      date: query?.date,
    },
    page,
  )
  if (listed.ids.length === 0) {
    return { rows: [], total: listed.total, page: listed.page, pageSize: listed.pageSize }
  }
  const rows = reorderByIds(await load(listed.ids), listed.ids)
  return { rows, total: listed.total, page: listed.page, pageSize: listed.pageSize }
}

// ── Inward ────────────────────────────────────────────────────
export const fetchInwards = async (factoryOrQuery?: string | IoDocListQuery): Promise<PageResult<IOInward>> => {
  const query = asIoQuery(factoryOrQuery)
  return fetchIoDocPage('io_inward', query, async (ids) => {
    const rows = await prisma.ioInward.findMany({ where: { id: { in: ids } }, include: inwardInclude })
    return rows.map(rowToInward)
  })
}

export const saveInward = async (inward: Partial<IOInward> & { items: IOLineItem[] }): Promise<IOInward> => {
  assertCanWriteDocuments()
  if (inward.id) {
    const existing = await prisma.ioInward.findUnique({ where: { id: inward.id }, select: { factoryId: true } })
    if (!existing) throw new Error('Inward not found')
    assertDocumentFactoryAccess(existing.factoryId)
  }
  if (inward.factory_id) assertFactoryAccess(inward.factory_id)

  const uid = userId()
  const itemData = inward.items.map((it, i) => ({
    productId: it.product_id,
    quantity: it.quantity,
    price: moneyStr(it.price),
    remarks: textOrNull(it.remarks),
    sortOrder: i,
  }))

  if (inward.id) {
    const row = await prisma.$transaction(async (tx) => {
      const header = await tx.ioInward.update({
        where: { id: inward.id },
        data: {
          factoryId: inward.factory_id || null,
          inwardDate: parseDate(inward.inward_date!),
          supplierId: inward.supplier_id || null,
          supplierRefNo: inward.supplier_ref_no || null,
          remarks: inward.remarks || null,
        },
      })
      await tx.ioInwardItem.deleteMany({ where: { inwardId: header.id } })
      if (itemData.length > 0) {
        await tx.ioInwardItem.createMany({
          data: itemData.map((it) => ({ ...it, inwardId: header.id })),
        })
      }
      return tx.ioInward.findUniqueOrThrow({ where: { id: header.id }, include: inwardInclude })
    })
    return rowToInward(row)
  }

  const number = await getNextNumber('inward', inward.inward_date, inward.factory_id || null)
  const row = await prisma.$transaction(async (tx) => {
    const header = await tx.ioInward.create({
      data: {
        inwardNumber: number,
        factoryId: inward.factory_id || null,
        inwardDate: parseDate(inward.inward_date!),
        supplierId: inward.supplier_id || null,
        supplierRefNo: inward.supplier_ref_no || null,
        remarks: inward.remarks || null,
        createdBy: uid,
      },
    })
    if (itemData.length > 0) {
      await tx.ioInwardItem.createMany({
        data: itemData.map((it) => ({ ...it, inwardId: header.id })),
      })
    }
    return tx.ioInward.findUniqueOrThrow({ where: { id: header.id }, include: inwardInclude })
  })
  return rowToInward(row)
}

export const deleteInward = async (id: string) => {
  assertCanDeleteDocuments()
  const existing = await prisma.ioInward.findUnique({ where: { id }, select: { factoryId: true } })
  if (!existing) throw new Error('Inward not found')
  assertDocumentFactoryAccess(existing.factoryId)
  await prisma.ioInward.delete({ where: { id } })
}

// ── Outward ───────────────────────────────────────────────────
export const fetchOutwards = async (factoryOrQuery?: string | IoDocListQuery): Promise<PageResult<IOOutward>> => {
  const query = asIoQuery(factoryOrQuery)
  return fetchIoDocPage('io_outward', query, async (ids) => {
    const rows = await prisma.ioOutward.findMany({ where: { id: { in: ids } }, include: outwardInclude })
    return rows.map(rowToOutward)
  })
}

export const fetchOutwardByRefNo = async (refNo: string, factory_id?: string): Promise<IOOutward | null> => {
  const ref = (refNo ?? '').trim()
  if (!ref) return null
  const row = await prisma.ioOutward.findFirst({
    where: {
      ...factoryListWhere(factory_id),
      OR: [{ supplierRefNo: ref }, { outwardNumber: ref }],
    },
    include: outwardInclude,
    orderBy: [{ outwardNumber: 'desc' }, { createdAt: 'desc' }],
  })
  return row ? rowToOutward(row) : null
}

export const searchOutwards = async (query: string, factory_id?: string) => {
  const q = (query ?? '').trim()
  const rows = await prisma.ioOutward.findMany({
    where: {
      ...factoryListWhere(factory_id),
      ...(q
        ? {
            OR: [
              { outwardNumber: { contains: q, mode: 'insensitive' } },
              { supplierRefNo: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      outwardNumber: true,
      outwardDate: true,
      supplierRefNo: true,
      supplier: { select: { id: true, companyName: true } },
    },
    orderBy: [{ outwardNumber: 'desc' }, { createdAt: 'desc' }],
    take: 25,
  })
  return rows.map((r) => ({
    id: r.id,
    outward_number: r.outwardNumber,
    outward_date: dateStr(r.outwardDate),
    supplier_ref_no: r.supplierRefNo,
    supplier: r.supplier ? { id: r.supplier.id, company_name: r.supplier.companyName } : null,
  }))
}

export const saveOutward = async (outward: Partial<IOOutward> & { items: IOLineItem[] }): Promise<IOOutward> => {
  assertCanWriteDocuments()
  if (outward.id) {
    const existing = await prisma.ioOutward.findUnique({ where: { id: outward.id }, select: { factoryId: true } })
    if (!existing) throw new Error('Outward not found')
    assertDocumentFactoryAccess(existing.factoryId)
  }
  if (outward.factory_id) assertFactoryAccess(outward.factory_id)

  const uid = userId()
  const itemData = outward.items.map((it, i) => ({
    productId: it.product_id,
    quantity: it.quantity,
    price: moneyStr(it.price),
    remarks: textOrNull(it.remarks),
    sortOrder: i,
  }))

  if (outward.id) {
    const row = await prisma.$transaction(async (tx) => {
      const header = await tx.ioOutward.update({
        where: { id: outward.id },
        data: {
          factoryId: outward.factory_id || null,
          outwardDate: parseDate(outward.outward_date!),
          supplierId: outward.supplier_id || null,
          supplierRefNo: outward.supplier_ref_no || null,
          remarks: outward.remarks || null,
        },
      })
      await tx.ioOutwardItem.deleteMany({ where: { outwardId: header.id } })
      if (itemData.length > 0) {
        await tx.ioOutwardItem.createMany({
          data: itemData.map((it) => ({ ...it, outwardId: header.id })),
        })
      }
      return tx.ioOutward.findUniqueOrThrow({ where: { id: header.id }, include: outwardInclude })
    })
    return rowToOutward(row)
  }

  const number = await getNextNumber('outward', outward.outward_date, outward.factory_id || null)
  const row = await prisma.$transaction(async (tx) => {
    const header = await tx.ioOutward.create({
      data: {
        outwardNumber: number,
        factoryId: outward.factory_id || null,
        outwardDate: parseDate(outward.outward_date!),
        supplierId: outward.supplier_id || null,
        supplierRefNo: outward.supplier_ref_no || null,
        remarks: outward.remarks || null,
        createdBy: uid,
      },
    })
    if (itemData.length > 0) {
      await tx.ioOutwardItem.createMany({
        data: itemData.map((it) => ({ ...it, outwardId: header.id })),
      })
    }
    return tx.ioOutward.findUniqueOrThrow({ where: { id: header.id }, include: outwardInclude })
  })
  return rowToOutward(row)
}

export const deleteOutward = async (id: string) => {
  assertCanDeleteDocuments()
  const existing = await prisma.ioOutward.findUnique({ where: { id }, select: { factoryId: true } })
  if (!existing) throw new Error('Outward not found')
  assertDocumentFactoryAccess(existing.factoryId)
  await prisma.ioOutward.delete({ where: { id } })
}

// ── Domestic ──────────────────────────────────────────────────
export const fetchDomestics = async (factoryOrQuery?: string | IoDocListQuery): Promise<PageResult<IODomestic>> => {
  const query = asIoQuery(factoryOrQuery)
  return fetchIoDocPage('io_domestic', query, async (ids) => {
    const rows = await prisma.ioDomestic.findMany({ where: { id: { in: ids } }, include: domesticInclude })
    return rows.map(rowToDomestic)
  })
}

export const saveDomestic = async (doc: Partial<IODomestic> & { items: IOLineItem[] }): Promise<IODomestic> => {
  assertCanWriteDocuments()
  if (doc.id) {
    const existing = await prisma.ioDomestic.findUnique({ where: { id: doc.id }, select: { factoryId: true } })
    if (!existing) throw new Error('Domestic not found')
    assertDocumentFactoryAccess(existing.factoryId)
  }
  if (doc.factory_id) assertFactoryAccess(doc.factory_id)

  const uid = userId()
  const itemData = doc.items.map((it, i) => ({
    productId: it.product_id,
    quantity: it.quantity,
    price: moneyStr(it.price),
    remarks: textOrNull(it.remarks),
    sortOrder: i,
  }))

  if (doc.id) {
    const row = await prisma.$transaction(async (tx) => {
      const header = await tx.ioDomestic.update({
        where: { id: doc.id },
        data: {
          factoryId: doc.factory_id || null,
          invoiceDate: parseDate(doc.invoice_date!),
          customerId: doc.customer_id || null,
          remarks: doc.remarks || null,
        },
      })
      await tx.ioDomestic.update({
        where: { id: header.id },
        data: { taxInvoiceNumber: header.invoiceNumber },
      })
      await tx.ioDomesticItem.deleteMany({ where: { domesticId: header.id } })
      if (itemData.length > 0) {
        await tx.ioDomesticItem.createMany({
          data: itemData.map((it) => ({ ...it, domesticId: header.id })),
        })
      }
      return tx.ioDomestic.findUniqueOrThrow({ where: { id: header.id }, include: domesticInclude })
    })
    return rowToDomestic(row)
  }

  const number = await getNextNumber('domestic', doc.invoice_date, doc.factory_id || null)
  const row = await prisma.$transaction(async (tx) => {
    const header = await tx.ioDomestic.create({
      data: {
        invoiceNumber: number,
        taxInvoiceNumber: number,
        factoryId: doc.factory_id || null,
        invoiceDate: parseDate(doc.invoice_date!),
        customerId: doc.customer_id || null,
        remarks: doc.remarks || null,
        createdBy: uid,
      },
    })
    if (itemData.length > 0) {
      await tx.ioDomesticItem.createMany({
        data: itemData.map((it) => ({ ...it, domesticId: header.id })),
      })
    }
    return tx.ioDomestic.findUniqueOrThrow({ where: { id: header.id }, include: domesticInclude })
  })
  return rowToDomestic(row)
}

export const deleteDomestic = async (id: string) => {
  assertCanDeleteDocuments()
  const existing = await prisma.ioDomestic.findUnique({ where: { id }, select: { factoryId: true } })
  if (!existing) throw new Error('Domestic not found')
  assertDocumentFactoryAccess(existing.factoryId)
  await prisma.ioDomestic.delete({ where: { id } })
}

// ── International ─────────────────────────────────────────────
export const fetchInternationals = async (factoryOrQuery?: string | IoDocListQuery): Promise<PageResult<IOInternational>> => {
  const query = asIoQuery(factoryOrQuery)
  return fetchIoDocPage('io_international', query, async (ids) => {
    const rows = await prisma.ioInternational.findMany({ where: { id: { in: ids } }, include: internationalInclude })
    return rows.map(rowToInternational)
  })
}

export const saveInternational = async (doc: Partial<IOInternational> & { items: IOLineItem[] }): Promise<IOInternational> => {
  assertCanWriteDocuments()
  if (doc.id) {
    const existing = await prisma.ioInternational.findUnique({ where: { id: doc.id }, select: { factoryId: true } })
    if (!existing) throw new Error('International not found')
    assertDocumentFactoryAccess(existing.factoryId)
  }
  if (doc.factory_id) assertFactoryAccess(doc.factory_id)

  const uid = userId()
  const itemData = doc.items.map((it, i) => ({
    productId: it.product_id,
    quantity: it.quantity,
    price: moneyStr(it.price),
    remarks: textOrNull(it.remarks),
    sortOrder: i,
  }))

  if (doc.id) {
    const row = await prisma.$transaction(async (tx) => {
      const header = await tx.ioInternational.update({
        where: { id: doc.id },
        data: {
          factoryId: doc.factory_id || null,
          invoiceDate: parseDate(doc.invoice_date!),
          customerId: doc.customer_id || null,
          remarks: doc.remarks || null,
        },
      })
      await tx.ioInternational.update({
        where: { id: header.id },
        data: { taxInvoiceNumber: header.invoiceNumber },
      })
      await tx.ioInternationalItem.deleteMany({ where: { internationalId: header.id } })
      if (itemData.length > 0) {
        await tx.ioInternationalItem.createMany({
          data: itemData.map((it) => ({ ...it, internationalId: header.id })),
        })
      }
      return tx.ioInternational.findUniqueOrThrow({ where: { id: header.id }, include: internationalInclude })
    })
    return rowToInternational(row)
  }

  const number = await getNextNumber('international', doc.invoice_date, doc.factory_id || null)
  const row = await prisma.$transaction(async (tx) => {
    const header = await tx.ioInternational.create({
      data: {
        invoiceNumber: number,
        taxInvoiceNumber: number,
        factoryId: doc.factory_id || null,
        invoiceDate: parseDate(doc.invoice_date!),
        customerId: doc.customer_id || null,
        remarks: doc.remarks || null,
        createdBy: uid,
      },
    })
    if (itemData.length > 0) {
      await tx.ioInternationalItem.createMany({
        data: itemData.map((it) => ({ ...it, internationalId: header.id })),
      })
    }
    return tx.ioInternational.findUniqueOrThrow({ where: { id: header.id }, include: internationalInclude })
  })
  return rowToInternational(row)
}

export const deleteInternational = async (id: string) => {
  assertCanDeleteDocuments()
  const existing = await prisma.ioInternational.findUnique({ where: { id }, select: { factoryId: true } })
  if (!existing) throw new Error('International not found')
  assertDocumentFactoryAccess(existing.factoryId)
  await prisma.ioInternational.delete({ where: { id } })
}

// ── Quotations ────────────────────────────────────────────────
export const fetchQuotations = async (factoryOrQuery?: string | IoDocListQuery): Promise<PageResult<IOQuotation>> => {
  const query = asIoQuery(factoryOrQuery)
  return fetchIoDocPage('io_quotations', query, async (ids) => {
    const rows = await prisma.ioQuotation.findMany({ where: { id: { in: ids } }, include: quotationInclude })
    return rows.map(rowToQuotation)
  })
}

export const saveQuotation = async (doc: Partial<IOQuotation> & { items: IOQuotationItem[] }): Promise<IOQuotation> => {
  assertCanWriteDocuments()
  if (doc.id) {
    const existing = await prisma.ioQuotation.findUnique({ where: { id: doc.id }, select: { factoryId: true } })
    if (!existing) throw new Error('Quotation not found')
    assertDocumentFactoryAccess(existing.factoryId)
  }
  if (doc.factory_id) assertFactoryAccess(doc.factory_id)

  const uid = userId()
  const itemData = doc.items.map((it, i) => ({
    referenceNo: it.reference_no || null,
    productId: it.product_id || null,
    productNameOverride: textOrNull(it.product_name_override),
    price: moneyStr(it.price),
    priceUnit: it.price_unit === 'USD/KG' ? 'USD/KG' : 'INR/KG',
    sortOrder: i,
  }))

  if (doc.id) {
    const row = await prisma.$transaction(async (tx) => {
      const header = await tx.ioQuotation.update({
        where: { id: doc.id },
        data: {
          factoryId: doc.factory_id || null,
          quotationDate: parseDate(doc.quotation_date!),
          customerId: doc.customer_id || null,
          outwardRefNo: doc.outward_ref_no || null,
          headerContent: doc.header_content || null,
          footerContent: doc.footer_content || null,
        },
      })
      await tx.ioQuotationItem.deleteMany({ where: { quotationId: header.id } })
      if (itemData.length > 0) {
        await tx.ioQuotationItem.createMany({
          data: itemData.map((it) => ({ ...it, quotationId: header.id })),
        })
      }
      return tx.ioQuotation.findUniqueOrThrow({ where: { id: header.id }, include: quotationInclude })
    })
    return rowToQuotation(row)
  }

  const number = await getNextNumber('quotation', doc.quotation_date, doc.factory_id || null)
  const row = await prisma.$transaction(async (tx) => {
    const header = await tx.ioQuotation.create({
      data: {
        quotationNumber: number,
        factoryId: doc.factory_id || null,
        quotationDate: parseDate(doc.quotation_date!),
        customerId: doc.customer_id || null,
        outwardRefNo: doc.outward_ref_no || null,
        headerContent: doc.header_content || null,
        footerContent: doc.footer_content || null,
        createdBy: uid,
      },
    })
    if (itemData.length > 0) {
      await tx.ioQuotationItem.createMany({
        data: itemData.map((it) => ({ ...it, quotationId: header.id })),
      })
    }
    return tx.ioQuotation.findUniqueOrThrow({ where: { id: header.id }, include: quotationInclude })
  })
  return rowToQuotation(row)
}

export const deleteQuotation = async (id: string) => {
  assertCanDeleteDocuments()
  const existing = await prisma.ioQuotation.findUnique({ where: { id }, select: { factoryId: true } })
  if (!existing) throw new Error('Quotation not found')
  assertDocumentFactoryAccess(existing.factoryId)
  await prisma.ioQuotation.delete({ where: { id } })
}

// ── Dashboard Stats ───────────────────────────────────────────
export const fetchIOStats = async (factory_id?: string) => {
  const where = factoryListWhere(factory_id)
  const [inward, outward, domestic, international, quotations] = await Promise.all([
    prisma.ioInward.count({ where }),
    prisma.ioOutward.count({ where }),
    isIoDomesticEnabled() ? prisma.ioDomestic.count({ where }) : Promise.resolve(0),
    isIoInternationalEnabled() ? prisma.ioInternational.count({ where }) : Promise.resolve(0),
    prisma.ioQuotation.count({ where }),
  ])
  return { inward, outward, domestic, international, quotations }
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
