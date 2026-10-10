export type StockKind = 'rm' | 'sfg' | 'fg' | 'byproduct'
export type UsageReason =
  | 'plant_consume'
  | 'warehouse_release'
  | 'production_input'
  | 'fg_dispatch'
  | 'byproduct_dispatch'

export type LedgerTab = 'rm' | 'sfg' | 'sfg_rejected' | 'fg' | 'fg_rejected' | 'byproduct'
export type PlantUsageTab = 'rm_sfg' | 'rm_fg' | 'sfg'

export function isByproductLotNo(invoiceNumber: string) {
  return /\/BP\//i.test(String(invoiceNumber || ''))
}

export function parseStockKind(value: unknown, fallback: StockKind = 'rm'): StockKind {
  const s = String(value ?? fallback).toLowerCase().trim()
  if (s === 'sfg' || s === 'fg' || s === 'rm' || s === 'byproduct') return s
  return fallback
}

/** Stored column only. Extra args ignored (call-site compatibility). */
export function resolveStockKind(
  value: unknown,
  _invoiceNumber?: string | null,
  fallback: StockKind = 'rm',
): StockKind {
  return parseStockKind(value, fallback)
}

export function parseStockGrade(value: unknown): 'approved' | 'rejected' {
  return String(value ?? 'approved').toLowerCase().trim() === 'rejected' ? 'rejected' : 'approved'
}

export function parseUsageReason(value: unknown, fallback: UsageReason = 'plant_consume'): UsageReason {
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

export const LEDGER_TABS: Array<{ key: LedgerTab; label: string }> = [
  { key: 'rm', label: 'Raw materials' },
  { key: 'sfg', label: 'Semi-finished goods' },
  { key: 'sfg_rejected', label: 'Rejected SFG' },
  { key: 'fg', label: 'Finished goods' },
  { key: 'fg_rejected', label: 'Rejected FG' },
  { key: 'byproduct', label: 'Byproduct' },
]

/** Plant batch consume: RM split by output batch kind, plus SFG lots consumed. */
export const PLANT_USAGE_TABS: Array<{ key: PlantUsageTab; label: string }> = [
  { key: 'rm_sfg', label: 'RM used in SFG' },
  { key: 'rm_fg', label: 'RM used in FG' },
  { key: 'sfg', label: 'SFG used in FG' },
]

export function isPlantBatchUsage(row: {
  usage_reason?: string | null
  process_id?: string | null
}): boolean {
  if (String(row.process_id || '').startsWith('PROD:')) return true
  return parseUsageReason(row.usage_reason) === 'production_input'
}

export function isWarehouseReleaseUsage(row: {
  usage_reason?: string | null
  process_id?: string | null
}): boolean {
  if (String(row.process_id || '').startsWith('WH-ISSUE:')) return true
  return parseUsageReason(row.usage_reason) === 'warehouse_release'
}

export function productionBatchIdFromUsage(row: {
  batch_id?: string | null
  process_id?: string | null
}): string | null {
  if (row.batch_id) return row.batch_id
  const processId = String(row.process_id || '')
  if (processId.startsWith('PROD:')) return processId.slice(5) || null
  return null
}

function outputKindFromBatch(row: {
  batch_kind?: string | null
  batch_no?: string | null
}): 'sfg' | 'fg' {
  const kind = String(row.batch_kind || '').toLowerCase().trim()
  if (kind === 'fg') return 'fg'
  if (kind === 'sfg') return 'sfg'
  if (/\/SF\//i.test(String(row.batch_no || ''))) return 'sfg'
  return 'sfg'
}

export function plantUsageTabOf(row: {
  stock_kind?: string | null
  batch_kind?: string | null
  batch_no?: string | null
}): PlantUsageTab {
  if (parseStockKind(row.stock_kind) === 'sfg') return 'sfg'
  return outputKindFromBatch(row) === 'fg' ? 'rm_fg' : 'rm_sfg'
}

export const USAGE_REASON_LABEL: Record<UsageReason, string> = {
  plant_consume: 'Plant consume',
  warehouse_release: 'Warehouse release',
  production_input: 'Production input',
  fg_dispatch: 'FG dispatch',
  byproduct_dispatch: 'Byproduct invoice',
}

export function ledgerTabOf(row: {
  stock_kind?: string | null
  stock_grade?: string | null
}): LedgerTab {
  const kind = parseStockKind(row.stock_kind)
  const rejected = parseStockGrade(row.stock_grade) === 'rejected'
  if (kind === 'byproduct') return 'byproduct'
  if (kind === 'sfg') return rejected ? 'sfg_rejected' : 'sfg'
  if (kind === 'fg') return rejected ? 'fg_rejected' : 'fg'
  return 'rm'
}

export function kindBadge(kind: StockKind) {
  if (kind === 'sfg') return 'SFG'
  if (kind === 'fg') return 'FG'
  if (kind === 'byproduct') return 'BP'
  return 'RM'
}

export function usageReasonLabel(value: unknown) {
  return USAGE_REASON_LABEL[parseUsageReason(value)]
}
