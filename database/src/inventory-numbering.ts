import { prisma } from './prisma'

export type InventoryDocType = 'po' | 'lot' | 'batch' | 'sale' | 'coa'
/** slash_seq_fy → prefix/seq/FY (PO, Lot). seq_slash_prefix_fy → seq/prefix/FY (batch). */
export type InventoryNumberFormat = 'slash_seq_fy' | 'seq_slash_prefix_fy'

export type InventoryNumberingRow = {
  prefix: string
  numberFormat: InventoryNumberFormat
  padWidth: number
}

type ConfigDbRow = {
  doc_type: string
  prefix: string
  number_format: string
  pad_width: number
}

const DEFAULTS: Record<InventoryDocType, InventoryNumberingRow> = {
  po: { prefix: 'PO', numberFormat: 'slash_seq_fy', padWidth: 0 },
  lot: { prefix: 'RM', numberFormat: 'slash_seq_fy', padWidth: 0 },
  batch: { prefix: 'BAT', numberFormat: 'seq_slash_prefix_fy', padWidth: 0 },
  sale: { prefix: 'SL', numberFormat: 'slash_seq_fy', padWidth: 0 },
  coa: { prefix: 'COA', numberFormat: 'slash_seq_fy', padWidth: 0 },
}

const DOC_TYPES: InventoryDocType[] = ['po', 'lot', 'batch', 'sale', 'coa']

/** Indian financial year label: Apr–Mar → e.g. 26-27 */
export function indianFiscalYear(at: Date = new Date()): string {
  const y = at.getFullYear()
  const month = at.getMonth() // 0 = Jan
  const startYear = month >= 3 ? y : y - 1 // Apr (3) starts FY
  const a = String(startYear).slice(-2)
  const b = String(startYear + 1).slice(-2)
  return `${a}-${b}`
}

export function normalizeInventoryNumberFormat(
  value: string | null | undefined,
  docType?: InventoryDocType,
): InventoryNumberFormat {
  if (value === 'seq_slash_prefix_fy' || value === 'slash_seq_fy') return value
  return docType === 'batch' ? 'seq_slash_prefix_fy' : 'slash_seq_fy'
}

export function formatInventoryDocNumber(params: {
  prefix: string
  seq: number
  fiscalYear: string
  numberFormat?: InventoryNumberFormat
  padWidth?: number
}): string {
  const prefix = (params.prefix || '').replace(/\/+$/, '')
  const pad = Math.max(0, Math.min(8, params.padWidth ?? 0))
  const seq =
    pad > 0 ? String(params.seq).padStart(pad, '0') : String(params.seq)
  if (params.numberFormat === 'seq_slash_prefix_fy') {
    return `${seq}/${prefix}/${params.fiscalYear}`
  }
  return `${prefix}/${seq}/${params.fiscalYear}`
}

export function previewInventoryDocNumber(
  row: InventoryNumberingRow,
  exampleSeq = 92,
  at: Date = new Date(),
): string {
  return formatInventoryDocNumber({
    prefix: row.prefix,
    seq: exampleSeq,
    fiscalYear: indianFiscalYear(at),
    numberFormat: row.numberFormat,
    padWidth: row.padWidth,
  })
}

export async function getInventoryNumberingConfig(
  factoryId: string,
): Promise<Record<InventoryDocType, InventoryNumberingRow>> {
  const rows = await prisma.$queryRaw<ConfigDbRow[]>`
    SELECT doc_type, prefix, number_format, pad_width
    FROM inventory_numbering_config
    WHERE factory_id = ${factoryId}::uuid
  `

  const out: Record<InventoryDocType, InventoryNumberingRow> = {
    po: { ...DEFAULTS.po },
    lot: { ...DEFAULTS.lot },
    batch: { ...DEFAULTS.batch },
    sale: { ...DEFAULTS.sale },
    coa: { ...DEFAULTS.coa },
  }
  for (const row of rows) {
    if (
      row.doc_type !== 'po' &&
      row.doc_type !== 'lot' &&
      row.doc_type !== 'batch' &&
      row.doc_type !== 'sale' &&
      row.doc_type !== 'coa'
    ) {
      continue
    }
    const docType = row.doc_type
    out[docType] = {
      prefix: row.prefix ?? DEFAULTS[docType].prefix,
      numberFormat: normalizeInventoryNumberFormat(row.number_format, docType),
      padWidth: Number.isFinite(Number(row.pad_width)) ? Number(row.pad_width) : 0,
    }
  }
  return out
}

export async function saveInventoryNumberingConfig(
  factoryId: string,
  values: Record<InventoryDocType, InventoryNumberingRow>,
): Promise<Record<InventoryDocType, InventoryNumberingRow>> {
  await prisma.$transaction(async (tx) => {
    for (const docType of DOC_TYPES) {
      const prefix = (values[docType]?.prefix ?? DEFAULTS[docType].prefix).trim()
      const numberFormat = normalizeInventoryNumberFormat(
        values[docType]?.numberFormat,
        docType,
      )
      const padWidth = Math.max(
        0,
        Math.min(8, Number(values[docType]?.padWidth ?? 0) || 0),
      )
      await tx.$executeRaw`
        INSERT INTO inventory_numbering_config
          (factory_id, doc_type, prefix, number_format, pad_width, updated_at)
        VALUES (
          ${factoryId}::uuid,
          ${docType},
          ${prefix},
          ${numberFormat},
          ${padWidth},
          now()
        )
        ON CONFLICT (factory_id, doc_type) DO UPDATE SET
          prefix = EXCLUDED.prefix,
          number_format = EXCLUDED.number_format,
          pad_width = EXCLUDED.pad_width,
          updated_at = now()
      `
    }
  })

  return getInventoryNumberingConfig(factoryId)
}

type NumberingDb = {
  $queryRaw: typeof prisma.$queryRaw
}

/**
 * Allocate next PO, Lot/GRN, or production batch number (atomic counter per FY).
 * Pass `db` (e.g. a transaction client) so a failed create rolls back the seq bump.
 */
export async function nextInventoryDocNumber(params: {
  factoryId: string
  docType: InventoryDocType
  at?: Date
  db?: NumberingDb
}): Promise<string> {
  const at = params.at ?? new Date()
  const fy = indianFiscalYear(at)
  const config = await getInventoryNumberingConfig(params.factoryId)
  const row = config[params.docType]
  const db = params.db ?? prisma

  const bumped = await db.$queryRaw<{ last_seq: number }[]>`
    INSERT INTO inventory_doc_counters (factory_id, doc_type, fiscal_year, last_seq, updated_at)
    VALUES (${params.factoryId}::uuid, ${params.docType}, ${fy}, 1, now())
    ON CONFLICT (factory_id, doc_type, fiscal_year)
    DO UPDATE SET
      last_seq = inventory_doc_counters.last_seq + 1,
      updated_at = now()
    RETURNING last_seq
  `

  const seq = Number(bumped[0]?.last_seq ?? 1)
  return formatInventoryDocNumber({
    prefix: row.prefix,
    seq,
    fiscalYear: fy,
    numberFormat: row.numberFormat,
    padWidth: row.padWidth,
  })
}

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

export function titleCaseMonthShort(monthShort: string): string {
  const s = String(monthShort || '').trim()
  if (!s) return 'Jan'
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

export function calendarMonthShort(at: Date = new Date()): string {
  return MONTH_SHORT[at.getMonth()] ?? 'Jan'
}

export function sanitizeSfgProductCode(code: string): string {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9._-]+/g, '')
}

export function formatSfgBatchNumber(params: {
  monthShort: string
  productCode: string
  seq: number
  fiscalYear: string
}): string {
  const code = sanitizeSfgProductCode(params.productCode) || 'PROD'
  return `${titleCaseMonthShort(params.monthShort)}/${code}/SF/${params.seq}/${params.fiscalYear}`
}

export function previewSfgBatchNumber(
  productCode = 'CODE',
  exampleSeq = 1,
  at: Date = new Date(),
): string {
  return formatSfgBatchNumber({
    monthShort: calendarMonthShort(at),
    productCode,
    seq: exampleSeq,
    fiscalYear: indianFiscalYear(at),
  })
}

function sfgCounterPeriod(productCode: string, at: Date): string {
  const y = at.getFullYear()
  const m = String(at.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}:${sanitizeSfgProductCode(productCode) || 'PROD'}`
}

/** Allocate next SFG batch: `{Mmm}/{productCode}/SF/{seq}/{FY}`. Seq resets per factory + month + product. */
export async function nextSfgBatchNumber(params: {
  factoryId: string
  productCode: string
  at?: Date
  db?: NumberingDb
}): Promise<string> {
  const at = params.at ?? new Date()
  const fy = indianFiscalYear(at)
  const period = sfgCounterPeriod(params.productCode, at)
  const db = params.db ?? prisma

  const bumped = await db.$queryRaw<{ last_seq: number }[]>`
    INSERT INTO inventory_doc_counters (factory_id, doc_type, fiscal_year, last_seq, updated_at)
    VALUES (${params.factoryId}::uuid, 'sfg', ${period}, 1, now())
    ON CONFLICT (factory_id, doc_type, fiscal_year)
    DO UPDATE SET
      last_seq = inventory_doc_counters.last_seq + 1,
      updated_at = now()
    RETURNING last_seq
  `

  const seq = Number(bumped[0]?.last_seq ?? 1)
  return formatSfgBatchNumber({
    monthShort: calendarMonthShort(at),
    productCode: params.productCode,
    seq,
    fiscalYear: fy,
  })
}
