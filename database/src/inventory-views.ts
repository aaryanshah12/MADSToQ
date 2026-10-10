import { decryptField, decryptMoney } from './field-crypto'
import { prisma } from './prisma'

export type StockGrade = 'approved' | 'rejected'
export type StockKind = 'rm' | 'sfg' | 'fg' | 'byproduct'
export type ProductionKind = 'sfg' | 'fg'
export type UsageReason =
  | 'plant_consume'
  | 'warehouse_release'
  | 'production_input'
  | 'fg_dispatch'
  | 'byproduct_dispatch'

export function isByproductLotNo(invoiceNumber: string) {
  return /\/BP\//i.test(String(invoiceNumber || ''))
}

export function parseStockGrade(
  value: unknown,
  fallback: StockGrade = 'approved',
): StockGrade {
  const s = String(value ?? fallback).toLowerCase().trim()
  return s === 'rejected' ? 'rejected' : 'approved'
}

export function parseStockKind(
  value: unknown,
  fallback: StockKind = 'rm',
): StockKind {
  const s = String(value ?? fallback).toLowerCase().trim()
  if (s === 'sfg' || s === 'fg' || s === 'rm' || s === 'byproduct') return s
  return fallback
}

/** Stored column only. `invoiceNumber` is ignored (kept so existing call sites compile). */
export function resolveStockKind(
  value: unknown,
  _invoiceNumber?: string | null,
  fallback: StockKind = 'rm',
): StockKind {
  return parseStockKind(value, fallback)
}

export function parseUsageReason(
  value: unknown,
  fallback: UsageReason = 'plant_consume',
): UsageReason {
  const s = String(value ?? fallback).toLowerCase().trim()
  if (
    s === 'plant_consume' ||
    s === 'warehouse_release' ||
    s === 'production_input' ||
    s === 'fg_dispatch' ||
    s === 'byproduct_dispatch'
  ) {
    return s
  }
  return fallback
}

export function inferUsageReason(params: {
  processId?: string | null
  batchNotes?: string | null
  stockKind?: string | null
  invoiceNumber?: string | null
}): UsageReason {
  const processId = String(params.processId || '')
  const notes = String(params.batchNotes || '').toLowerCase()
  const kind = resolveStockKind(params.stockKind, params.invoiceNumber)
  if (processId.startsWith('WH-ISSUE:')) return 'warehouse_release'
  if (processId.startsWith('PROD:')) return 'production_input'
  if (processId.startsWith('DISPATCH:')) {
    if (kind === 'byproduct' || notes.includes('byproduct')) return 'byproduct_dispatch'
    return 'fg_dispatch'
  }
  return 'plant_consume'
}

export function effectiveUsageReason(params: {
  usageReason?: string | null
  processId?: string | null
  batchNotes?: string | null
  stockKind?: string | null
  invoiceNumber?: string | null
}): UsageReason {
  const inferred = inferUsageReason(params)
  if (inferred !== 'plant_consume') return inferred
  return parseUsageReason(params.usageReason)
}

export function parseProductionKind(
  value: unknown,
  fallback: ProductionKind = 'sfg',
): ProductionKind {
  const s = String(value ?? fallback).toLowerCase().trim()
  return s === 'fg' ? 'fg' : 'sfg'
}

/** Warehouse lot kind for a production input line (never FG — chemist cannot consume FG). */
export function parseRmInputKind(value: unknown, fallback: 'rm' | 'sfg' = 'rm'): 'rm' | 'sfg' {
  const s = String(value ?? fallback).toLowerCase().trim()
  return s === 'sfg' ? 'sfg' : 'rm'
}

export type StockBalanceRow = {
  factory_id: string
  factory_name: string
  invoice_number: string
  material_type: string
  stock_grade: string
  stock_kind: string
  tons_loaded: number
  tons_used: number
  tons_remaining: number
  entry_date: Date
  supplier_name: string | null
}

export type ReleasedLotBalanceRow = {
  factory_id: string
  invoice_number: string
  material_type: string
  qty_released: number
  qty_consumed: number
  qty_remaining: number
}

export type FactorySummaryRow = {
  factory_id: string
  factory_name: string
  total_invoices: number
  total_tons_loaded: number
  total_tons_used: number
  closing_balance: number
  total_stock_value: number
}

export type StockEntrySafeRow = {
  id: string
  factory_id: string
  invoice_number: string
  supplier_name: string
  material_type: string
  tons_loaded: number
  entry_date: Date
  notes: string | null
  stock_kind: StockKind
}

/**
 * Stock balances in one SQL statement. Usage is summed in the same round trip.
 * PROD: rows are plant consumption of stock the warehouse already issued.
 */
export async function queryStockBalance(params: {
  factoryIds?: string[]
  invoiceNumbers?: string[]
}): Promise<StockBalanceRow[]> {
  const values: unknown[] = []
  const where: string[] = ['TRUE']
  if (params.factoryIds?.length) {
    values.push(params.factoryIds)
    where.push(`s.factory_id::text = ANY($${values.length}::text[])`)
  }
  if (params.invoiceNumbers?.length) {
    values.push(params.invoiceNumbers)
    where.push(`s.invoice_number = ANY($${values.length}::text[])`)
  }
  const stockRows = await prisma.$queryRawUnsafe<
    {
      factory_id: string
      factory_name: string
      invoice_number: string
      material_type: string
      stock_grade: string | null
      stock_kind: string | null
      tons_loaded: unknown
      entry_date: Date
      supplier_name: string | null
      total_used: number
      prod_used: number
    }[]
  >(
    `SELECT
       s.factory_id,
       f.name AS factory_name,
       s.invoice_number,
       s.material_type,
       s.stock_grade,
       s.stock_kind,
       s.tons_loaded,
       s.entry_date,
       s.supplier_name,
       COALESCE(u.total_used, 0)::float8 AS total_used,
       COALESCE(u.prod_used, 0)::float8 AS prod_used
     FROM stock_entries s
     JOIN factories f ON f.id = s.factory_id
     LEFT JOIN (
       SELECT invoice_number,
         SUM(tons_used) AS total_used,
         SUM(tons_used) FILTER (WHERE process_id LIKE 'PROD:%') AS prod_used
       FROM usage_entries
       GROUP BY invoice_number
     ) u ON u.invoice_number = s.invoice_number
     WHERE ${where.join(' AND ')}
     ORDER BY s.entry_date DESC`,
    ...values,
  )

  return stockRows.map((s) => {
    const tons_loaded = Number(s.tons_loaded)
    const tons_used = Number(s.total_used) - Number(s.prod_used)
    return {
      factory_id: s.factory_id,
      factory_name: decryptField(s.factory_name) ?? s.factory_name,
      invoice_number: s.invoice_number,
      material_type: decryptField(s.material_type) ?? s.material_type,
      stock_grade: s.stock_grade || 'approved',
      stock_kind: resolveStockKind(s.stock_kind, s.invoice_number),
      tons_loaded,
      tons_used,
      tons_remaining: tons_loaded - tons_used,
      entry_date: s.entry_date,
      supplier_name: decryptField(s.supplier_name),
    }
  })
}

export async function getInvoiceRemaining(invoiceNumber: string): Promise<number | null> {
  const rows = await queryStockBalance({ invoiceNumbers: [invoiceNumber] })
  return rows[0]?.tons_remaining ?? null
}

/**
 * Released-to-plant remaining per Lot/GRN: sum(issue releases) − posted production RM lines.
 * Includes zero-remaining rows so callers can distinguish “never released” vs “fully used”.
 */
export async function queryReleasedLotBalance(params: {
  factoryId: string
  materialType?: string
}): Promise<ReleasedLotBalanceRow[]> {
  const materialFilter = params.materialType?.trim()
  const releases = await prisma.warehouseIssueRelease.findMany({
    where: {
      request: {
        factoryId: params.factoryId,
        ...(materialFilter
          ? { materialType: { equals: materialFilter, mode: 'insensitive' as const } }
          : {}),
      },
    },
    select: {
      invoiceNumber: true,
      qty: true,
      request: { select: { materialType: true } },
    },
  })

  const releasedMap = new Map<
    string,
    { invoice_number: string; material_type: string; qty_released: number }
  >()
  for (const r of releases) {
    const material_type = r.request.materialType
    const key = `${r.invoiceNumber}\0${material_type.toLowerCase()}`
    const existing = releasedMap.get(key)
    if (existing) {
      existing.qty_released += Number(r.qty)
    } else {
      releasedMap.set(key, {
        invoice_number: r.invoiceNumber,
        material_type,
        qty_released: Number(r.qty),
      })
    }
  }

  if (releasedMap.size === 0) return []

  const invoiceNumbers = [...new Set([...releasedMap.values()].map((v) => v.invoice_number))]
  const consumedLines = await prisma.productionBatchRmLine.findMany({
    where: {
      usageEntryId: { not: null },
      lotInvoice: { in: invoiceNumbers },
      batch: { factoryId: params.factoryId },
    },
    select: {
      qty: true,
      lotInvoice: true,
      rmDef: { select: { materialName: true } },
    },
  })

  const consumedMap = new Map<string, number>()
  for (const line of consumedLines) {
    if (!line.lotInvoice) continue
    const key = `${line.lotInvoice}\0${line.rmDef.materialName.toLowerCase()}`
    consumedMap.set(key, (consumedMap.get(key) ?? 0) + Number(line.qty))
  }

  const rows: ReleasedLotBalanceRow[] = []
  for (const [key, rel] of releasedMap) {
    const qty_consumed = consumedMap.get(key) ?? 0
    rows.push({
      factory_id: params.factoryId,
      invoice_number: rel.invoice_number,
      material_type: rel.material_type,
      qty_released: rel.qty_released,
      qty_consumed,
      qty_remaining: rel.qty_released - qty_consumed,
    })
  }

  rows.sort((a, b) => {
    const mat = a.material_type.localeCompare(b.material_type)
    if (mat !== 0) return mat
    return a.invoice_number.localeCompare(b.invoice_number)
  })
  return rows
}

export async function getReleasedInvoiceRemaining(
  factoryId: string,
  invoiceNumber: string,
  materialType: string,
): Promise<number | null> {
  const rows = await queryReleasedLotBalance({ factoryId, materialType })
  const lower = materialType.toLowerCase()
  const hit = rows.find(
    (r) =>
      r.invoice_number === invoiceNumber && r.material_type.toLowerCase() === lower,
  )
  return hit ? hit.qty_remaining : null
}

export async function queryFactorySummary(factoryIds: string[]) {
  if (factoryIds.length === 0) return []

  const rows = await prisma.$queryRawUnsafe<
    {
      factory_id: string
      factory_name: string
      invoice_number: string | null
      tons_loaded: unknown
      rate_per_ton: unknown
      net_used: number | null
    }[]
  >(
    `SELECT
       f.id AS factory_id,
       f.name AS factory_name,
       s.invoice_number,
       s.tons_loaded,
       s.rate_per_ton,
       COALESCE(u.net_used, 0)::float8 AS net_used
     FROM factories f
     LEFT JOIN stock_entries s ON s.factory_id = f.id
     LEFT JOIN (
       SELECT invoice_number,
         SUM(tons_used) FILTER (WHERE process_id IS NULL OR process_id NOT LIKE 'PROD:%') AS net_used
       FROM usage_entries
       WHERE factory_id::text = ANY($1::text[])
       GROUP BY invoice_number
     ) u ON u.invoice_number = s.invoice_number
     WHERE f.id::text = ANY($1::text[])`,
    factoryIds,
  )

  const byFactory = new Map<
    string,
    {
      factory_name: string
      invoices: Set<string>
      total_tons_loaded: number
      total_tons_used: number
      total_stock_value: number
    }
  >()

  for (const row of rows) {
    let agg = byFactory.get(row.factory_id)
    if (!agg) {
      agg = {
        factory_name: decryptField(row.factory_name) ?? row.factory_name,
        invoices: new Set(),
        total_tons_loaded: 0,
        total_tons_used: 0,
        total_stock_value: 0,
      }
      byFactory.set(row.factory_id, agg)
    }
    if (!row.invoice_number) continue
    const tons = Number(row.tons_loaded ?? 0)
    const rate = decryptMoney(row.rate_per_ton) ?? 0
    agg.total_tons_loaded += tons
    agg.total_stock_value += tons * rate
    if (!agg.invoices.has(row.invoice_number)) {
      agg.invoices.add(row.invoice_number)
      agg.total_tons_used += Number(row.net_used ?? 0)
    }
  }

  return factoryIds.map((id) => {
    const agg = byFactory.get(id) ?? {
      factory_name: '',
      invoices: new Set<string>(),
      total_tons_loaded: 0,
      total_tons_used: 0,
      total_stock_value: 0,
    }
    return {
      factory_id: id,
      factory_name: agg.factory_name,
      total_invoices: agg.invoices.size,
      total_tons_loaded: agg.total_tons_loaded,
      total_tons_used: agg.total_tons_used,
      closing_balance: agg.total_tons_loaded - agg.total_tons_used,
      total_stock_value: agg.total_stock_value,
    }
  })
}

export async function queryStockEntriesSafe(params: {
  factoryIds?: string[]
  invoiceNumbers?: string[]
  entryDate?: string
  createdBy?: string
}): Promise<StockEntrySafeRow[]> {
  const rows = await prisma.stockEntry.findMany({
    where: {
      ...(params.factoryIds?.length ? { factoryId: { in: params.factoryIds } } : {}),
      ...(params.invoiceNumbers?.length
        ? { invoiceNumber: { in: params.invoiceNumbers } }
        : {}),
      ...(params.entryDate
        ? { entryDate: new Date(`${params.entryDate}T00:00:00.000Z`) }
        : {}),
      ...(params.createdBy ? { createdBy: params.createdBy } : {}),
    },
    select: {
      id: true,
      factoryId: true,
      invoiceNumber: true,
      supplierName: true,
      materialType: true,
      tonsLoaded: true,
      entryDate: true,
      notes: true,
      stockKind: true,
    },
  })

  return rows.map((row) => ({
    id: row.id,
    factory_id: row.factoryId,
    invoice_number: row.invoiceNumber,
    supplier_name: row.supplierName,
    material_type: row.materialType,
    tons_loaded: Number(row.tonsLoaded),
    entry_date: row.entryDate,
    notes: row.notes,
    stock_kind: resolveStockKind(row.stockKind, row.invoiceNumber),
  }))
}
