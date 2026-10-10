import type { Worksheet, Workbook, BorderStyle } from 'exceljs'
import {
  alignCrudeWashSteps,
  crudeWashMaterials,
  isCrudeWashStage,
  type CrudeWashStep,
} from '@/lib/crude-wash'

export type ExportProductRm = {
  id: string
  material_name: string
  unit?: string
  sort_order: number
  allow_multi_lot: boolean
  max_lots?: number
  stock_kind?: 'rm' | 'sfg'
  process?: 'sfg' | 'fg'
}

export type ExportProductStage = {
  id: string
  name: string
  sort_order: number
  capture_start_date: boolean
  capture_end_date: boolean
  capture_start_time: boolean
  capture_end_time: boolean
  capture_start_temp: boolean
  capture_end_temp: boolean
  capture_integrity?: boolean
  lot_rm_def_id?: string | null
  process?: 'sfg' | 'fg'
}

export type ExportProductOutput = {
  id: string
  name: string
  sort_order: number
}

export type ExportProduct = {
  id: string
  code: string
  name: string
  rms: ExportProductRm[]
  stages: ExportProductStage[]
  outputs: ExportProductOutput[]
}

export type ExportRmLine = {
  rm_def_id: string
  qty: number
  lot_slot: number | null
  notes: string | null
}

export type ExportStageLog = {
  stage_id: string
  lot_slot: number
  start_date: string | null
  end_date: string | null
  start_time: string | null
  end_time: string | null
  start_temp: number | null
  end_temp: number | null
  integrity_ok?: boolean | null
  wash_steps?: CrudeWashStep[] | null
}

export type ExportOutputRow = {
  output_field_id: string
  qty: number
}

export type ExportBatch = {
  id: string
  batch_no: string
  vessel: string | null
  mfg_date: string | null
  created_at: string | null
  rm_lines: ExportRmLine[]
  stage_logs: ExportStageLog[]
  outputs: ExportOutputRow[]
}

export type ExportProductGroup = {
  product: ExportProduct
  batches: ExportBatch[]
}

type StageField =
  | 'start_date'
  | 'end_date'
  | 'start_time'
  | 'end_time'
  | 'start_temp'
  | 'end_temp'
  | 'integrity'

type Col =
  | { kind: 'batch_no' }
  | { kind: 'rm'; rmId: string; lotSlot: number; multi: boolean }
  | { kind: 'rm_total'; rmId: string }
  | { kind: 'vessel' }
  | { kind: 'stage'; stageId: string; lotSlot: number; field: StageField; multiLot: boolean }
  | {
      kind: 'wash'
      stageId: string
      material: string
      field: 'start_date' | 'start_time' | 'end_date' | 'end_time'
    }
  | { kind: 'output'; outputId: string }

const EMPTY = '-'
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

const GREEN = 'FF92D050'
const YELLOW = 'FFFFFF00'
const ORANGE = 'FFFFC000'
const BLUE = 'FF9CC2E5'
const BLACK = 'FF000000'
const RED = 'FFFF0000'

const thin: { style: BorderStyle; color: { argb: string } } = {
  style: 'thin',
  color: { argb: BLACK },
}
const medium: { style: BorderStyle; color: { argb: string } } = {
  style: 'medium',
  color: { argb: BLACK },
}
const headerBorder = { top: medium, left: medium, bottom: medium, right: medium }
const dataBorder = { top: thin, left: thin, bottom: thin, right: thin }

function safeFilename(part: string): string {
  return part.replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 80)
}

function excelSheetName(raw: string, used: Set<string>): string {
  const cleaned = raw.replace(/[\\/*?:[\]]/g, ' ').replace(/\s+/g, ' ').trim() || 'Product'
  let base = cleaned.slice(0, 31)
  let name = base
  let n = 2
  while (used.has(name.toLowerCase())) {
    const suffix = ` (${n})`
    name = `${base.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`
    n += 1
  }
  used.add(name.toLowerCase())
  return name
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function parseYmd(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12))
  return Number.isNaN(d.getTime()) ? null : d
}

function batchSortDate(b: ExportBatch): Date | null {
  return parseYmd(b.mfg_date) || parseYmd(b.created_at?.slice(0, 10) ?? null)
}

function parseTime(v: string | null): number | string | typeof EMPTY {
  if (!v || !String(v).trim()) return EMPTY
  const s = String(v).trim()
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(s)
  if (!m) return s
  const h = Number(m[1])
  const min = Number(m[2])
  const sec = Number(m[3] || 0)
  if (h > 23 || min > 59) return s
  return (h * 3600 + min * 60 + sec) / 86400
}

function qtyLotsForRm(rm: ExportProductRm, batches: ExportBatch[]): number[] {
  const usedSlots = batches.flatMap((b) =>
    b.rm_lines
      .filter(
        (l) =>
          l.rm_def_id === rm.id &&
          (Number(l.qty) > 0 || Boolean((l.notes || '').trim())),
      )
      .map((l) => l.lot_slot ?? 1),
  )
  const maxSeen = usedSlots.length ? Math.max(...usedSlots) : 1
  if (!rm.allow_multi_lot) return [1]
  return Array.from({ length: Math.max(2, maxSeen) }, (_, i) => i + 1)
}

function rmDisplayName(rm: ExportProductRm, product: ExportProduct): string {
  const named = (rm.material_name || '').trim()
  if (named) return named
  const stage = product.stages.find((s) => s.lot_rm_def_id === rm.id)
  if (!stage?.name) return ''
  return stage.name.replace(/\s+addition$/i, '').trim() || stage.name
}

function rmHasConsumption(rm: ExportProductRm, batches: ExportBatch[]): boolean {
  return batches.some((b) =>
    b.rm_lines.some(
      (l) =>
        l.rm_def_id === rm.id &&
        (Number(l.qty) > 0 || Boolean((l.notes || '').trim())),
    ),
  )
}

function lotSlotsForStage(stage: ExportProductStage, batches: ExportBatch[]): number[] {
  const fromData = batches.flatMap((b) =>
    b.stage_logs.filter((l) => l.stage_id === stage.id).map((l) => l.lot_slot ?? 1),
  )
  const maxSeen = fromData.length ? Math.max(...fromData) : 1
  if (!stage.lot_rm_def_id && maxSeen <= 1) return [1]
  return Array.from({ length: Math.max(maxSeen, 1) }, (_, i) => i + 1)
}

function stageFields(stage: ExportProductStage): StageField[] {
  const fields: StageField[] = []
  if (stage.capture_start_date !== false) fields.push('start_date')
  if (stage.capture_start_time !== false) fields.push('start_time')
  if (stage.capture_end_time !== false) fields.push('end_time')
  if (stage.capture_start_temp !== false) fields.push('start_temp')
  if (stage.capture_end_temp !== false) fields.push('end_temp')
  if (stage.capture_end_date !== false) fields.push('end_date')
  if (stage.capture_integrity) fields.push('integrity')
  return fields
}

function buildColumns(product: ExportProduct, batches: ExportBatch[]): Col[] {
  const cols: Col[] = [{ kind: 'batch_no' }]
  const rms = [...product.rms].sort((a, b) => a.sort_order - b.sort_order)
  for (const rm of rms) {
    const name = rmDisplayName(rm, product)
    const linked = product.stages.some((s) => s.lot_rm_def_id === rm.id)
    if (!name && !linked && !rmHasConsumption(rm, batches)) continue
    const lots = qtyLotsForRm(rm, batches)
    const multi = lots.length > 1
    for (const lot of lots) cols.push({ kind: 'rm', rmId: rm.id, lotSlot: lot, multi })
    if (multi) cols.push({ kind: 'rm_total', rmId: rm.id })
  }
  cols.push({ kind: 'vessel' })
  const stages = [...product.stages].sort((a, b) => a.sort_order - b.sort_order)
  for (const stage of stages) {
    const washMaterials = isCrudeWashStage(stage.name)
      ? crudeWashMaterials(product.rms, stage.process)
      : []
    if (washMaterials.length > 0) {
      for (const material of washMaterials) {
        for (const field of ['start_date', 'start_time', 'end_date', 'end_time'] as const) {
          cols.push({ kind: 'wash', stageId: stage.id, material, field })
        }
      }
      continue
    }
    const lots = lotSlotsForStage(stage, batches)
    const fields = stageFields(stage)
    if (fields.length === 0) continue
    for (const lot of lots) {
      for (const field of fields) {
        cols.push({
          kind: 'stage',
          stageId: stage.id,
          lotSlot: lot,
          field,
          multiLot: lots.length > 1,
        })
      }
    }
  }
  const outputs = [...product.outputs].sort((a, b) => a.sort_order - b.sort_order)
  for (const o of outputs) cols.push({ kind: 'output', outputId: o.id })
  return cols
}

function lotLabel(n: number): string {
  return `LOT -${n}`
}

function r1Of(c: Col): string {
  if (c.kind === 'batch_no') return 'BATCH NO'
  if (c.kind === 'rm' || c.kind === 'rm_total' || c.kind === 'vessel') {
    return 'Raw Material Consumption Record'
  }
  if (c.kind === 'stage' || c.kind === 'wash') return 'PROCESS RECORD'
  return 'FINISHED PRODUCT'
}

function r2Of(c: Col, stageById: Map<string, ExportProductStage>): string {
  if (c.kind === 'stage' || c.kind === 'wash') return stageById.get(c.stageId)?.name ?? ''
  return ''
}

function r3Of(
  c: Col,
  rmNameById: Map<string, string>,
  outById: Map<string, ExportProductOutput>,
): string {
  if (c.kind === 'rm') return rmNameById.get(c.rmId) ?? ''
  if (c.kind === 'rm_total') {
    const name = rmNameById.get(c.rmId) || 'RM'
    return `TOTAL ${name} QTY`
  }
  if (c.kind === 'vessel') return 'VESSEL'
  if (c.kind === 'output') return outById.get(c.outputId)?.name ?? ''
  if (c.kind === 'wash') return c.material
  if (c.kind !== 'stage') return ''
  if (c.field === 'integrity') return 'FILTER INTEGRITY'
  if (c.field === 'start_date') return 'START DATE'
  if (c.field === 'end_date') return 'END DATE'
  if (c.field === 'start_time' || c.field === 'end_time') {
    return c.multiLot ? lotLabel(c.lotSlot) : 'TIME'
  }
  return 'TEMP.'
}

function r4Of(c: Col): string {
  if (c.kind === 'rm' && c.multi) return lotLabel(c.lotSlot)
  if (c.kind === 'wash') {
    if (c.field === 'start_date') return 'START DATE'
    if (c.field === 'end_date') return 'END DATE'
    if (c.field === 'start_time') return 'START'
    return 'END'
  }
  if (c.kind !== 'stage') return ''
  if (c.field === 'start_time' || c.field === 'start_temp') return 'START'
  if (c.field === 'end_time' || c.field === 'end_temp') return 'END'
  return ''
}

function fillFor(row: 1 | 2 | 3 | 4, c: Col): string {
  if (row === 1) {
    if (c.kind === 'batch_no') return GREEN
    return YELLOW
  }
  if (row === 2) {
    if (c.kind === 'stage' || c.kind === 'wash') return ORANGE
    if (c.kind === 'batch_no') return GREEN
    return YELLOW
  }
  return GREEN
}

function fontFor(row: 1 | 2 | 3 | 4, c: Col): { name: string; size: number; bold: boolean } {
  if (row === 1 && (c.kind === 'rm' || c.kind === 'rm_total' || c.kind === 'vessel')) {
    return { name: 'Arial', size: 18, bold: true }
  }
  if (row === 1 && (c.kind === 'stage' || c.kind === 'wash' || c.kind === 'output')) {
    return { name: 'Arial', size: 14, bold: true }
  }
  if (row === 2 && (c.kind === 'stage' || c.kind === 'wash')) {
    return { name: 'Arial', size: 14, bold: true }
  }
  return { name: 'Arial', size: 12, bold: true }
}

function paintHeader(
  ws: Worksheet,
  row: number,
  col: number,
  value: string,
  fill: string,
  font: { name: string; size: number; bold: boolean },
) {
  const cell = ws.getCell(row, col)
  cell.value = value || null
  cell.font = { name: font.name, size: font.size, bold: font.bold, color: { argb: BLACK } }
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
  cell.border = headerBorder
}

function tryMerge(ws: Worksheet, r1: number, c1: number, r2: number, c2: number) {
  if (r1 === r2 && c1 === c2) return
  try {
    ws.mergeCells(r1, c1, r2, c2)
  } catch {
    /* overlapping merge — skip */
  }
}

function mergeRuns(
  ws: Worksheet,
  row: number,
  cols: Col[],
  labelOf: (c: Col, i: number) => string,
) {
  let i = 0
  while (i < cols.length) {
    const label = labelOf(cols[i], i)
    let j = i + 1
    while (j < cols.length && labelOf(cols[j], j) === label && label) j += 1
    if (label && j - i > 1) tryMerge(ws, row, i + 1, row, j)
    i = j
  }
}

function firstLast(cols: Col[], pred: (c: Col) => boolean): [number, number] | null {
  let start = -1
  let end = -1
  cols.forEach((c, i) => {
    if (!pred(c)) return
    if (start < 0) start = i
    end = i
  })
  if (start < 0) return null
  return [start + 1, end + 1]
}

function writeHeaders(ws: Worksheet, product: ExportProduct, cols: Col[]) {
  const rmNameById = new Map(
    product.rms.map((r) => [r.id, rmDisplayName(r, product)]),
  )
  const stageById = new Map(product.stages.map((s) => [s.id, s]))
  const outById = new Map(product.outputs.map((o) => [o.id, o]))

  const labels = [
    cols.map((c) => r1Of(c)),
    cols.map((c) => r2Of(c, stageById)),
    cols.map((c) => r3Of(c, rmNameById, outById)),
    cols.map((c) => r4Of(c)),
  ] as const

  for (let i = 0; i < cols.length; i++) {
    const c = cols[i]
    paintHeader(ws, 1, i + 1, labels[0][i], fillFor(1, c), fontFor(1, c))
    paintHeader(ws, 2, i + 1, labels[1][i], fillFor(2, c), fontFor(2, c))
    paintHeader(ws, 3, i + 1, labels[2][i], fillFor(3, c), fontFor(3, c))
    paintHeader(ws, 4, i + 1, labels[3][i], fillFor(4, c), fontFor(4, c))
  }

  tryMerge(ws, 1, 1, 4, 1)

  const rmRange = firstLast(
    cols,
    (c) => c.kind === 'rm' || c.kind === 'rm_total' || c.kind === 'vessel',
  )
  if (rmRange) tryMerge(ws, 1, rmRange[0], 2, rmRange[1])

  const procRange = firstLast(cols, (c) => c.kind === 'stage' || c.kind === 'wash')
  if (procRange) tryMerge(ws, 1, procRange[0], 1, procRange[1])

  mergeRuns(ws, 2, cols, (c) => r2Of(c, stageById))

  const fgRange = firstLast(cols, (c) => c.kind === 'output')
  if (fgRange) tryMerge(ws, 1, fgRange[0], 2, fgRange[1])

  mergeRuns(ws, 3, cols, (c) =>
    c.kind === 'wash'
      ? `wash:${c.stageId}:${c.material}`
      : r3Of(c, rmNameById, outById) + (c.kind === 'stage' ? `#${c.stageId}-${c.lotSlot}` : ''),
  )

  cols.forEach((c, i) => {
    if (r3Of(c, rmNameById, outById) && !r4Of(c)) {
      tryMerge(ws, 3, i + 1, 4, i + 1)
    }
  })

  ws.getRow(1).height = 22
  ws.getRow(2).height = 18
  ws.getRow(3).height = 16
  ws.getRow(4).height = 24
  ws.views = [{ state: 'frozen', ySplit: 4, topLeftCell: 'A5', activePane: 'bottomLeft' }]
}

function rmCell(batch: ExportBatch, rmId: string, lotSlot: number): string | number {
  const lines = batch.rm_lines.filter(
    (l) => l.rm_def_id === rmId && (l.lot_slot ?? 1) === lotSlot,
  )
  const qty = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0)
  if (!(qty > 0)) return EMPTY
  return qty
}

function rmTotalCell(batch: ExportBatch, rmId: string): string | number {
  const lines = batch.rm_lines.filter((l) => l.rm_def_id === rmId)
  const qty = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0)
  const notes = [...new Set(lines.map((l) => (l.notes || '').trim()).filter(Boolean))]
  if (!(qty > 0) && notes.length === 0) return EMPTY
  if (notes.length) {
    const q = qty > 0 ? String(qty) : ''
    return q ? `${q} (${notes.join('; ')})` : notes.join('; ')
  }
  return qty
}

function stageCell(
  batch: ExportBatch,
  col: Extract<Col, { kind: 'stage' }>,
): string | number | Date {
  const log = batch.stage_logs.find(
    (l) => l.stage_id === col.stageId && (l.lot_slot ?? 1) === col.lotSlot,
  )
  if (!log) return EMPTY
  if (col.field === 'start_date' || col.field === 'end_date') {
    const d = parseYmd(col.field === 'start_date' ? log.start_date : log.end_date)
    return d ?? EMPTY
  }
  if (col.field === 'start_time') return parseTime(log.start_time)
  if (col.field === 'end_time') return parseTime(log.end_time)
  if (col.field === 'integrity') {
    if (log.integrity_ok === true) return 'Ok'
    if (log.integrity_ok === false) return 'Not Ok'
    return EMPTY
  }
  const temp = col.field === 'start_temp' ? log.start_temp : log.end_temp
  return temp == null ? EMPTY : temp
}

function washCell(
  batch: ExportBatch,
  col: Extract<Col, { kind: 'wash' }>,
): string | number | Date {
  const log = batch.stage_logs.find((l) => l.stage_id === col.stageId)
  if (!log) return EMPTY
  const step = alignCrudeWashSteps(log.wash_steps, [col.material])[0]
  if (!step) return EMPTY
  if (col.field === 'start_date' || col.field === 'end_date') {
    const d = parseYmd(col.field === 'start_date' ? step.start_date : step.end_date)
    return d ?? EMPTY
  }
  if (col.field === 'start_time') return parseTime(step.start_time)
  return parseTime(step.end_time)
}

function outputCell(batch: ExportBatch, outputId: string): string | number {
  const row = batch.outputs.find((o) => o.output_field_id === outputId)
  if (!row || !(Number(row.qty) > 0)) return EMPTY
  return Number(row.qty)
}

function applyDataFormat(ws: Worksheet, row: number, col: number, colDef: Col, value: unknown) {
  const cell = ws.getCell(row, col)
  cell.font = { name: 'Arial', size: 11, bold: false }
  cell.alignment = { vertical: 'middle', horizontal: 'center' }
  cell.border = dataBorder
  if (value instanceof Date) {
    cell.value = value
    cell.numFmt = 'dd/mm/yyyy'
    return
  }
  if (
    (colDef.kind === 'stage' || colDef.kind === 'wash') &&
    (colDef.field === 'start_time' || colDef.field === 'end_time') &&
    typeof value === 'number'
  ) {
    cell.value = value
    cell.numFmt = 'h:mm AM/PM'
    return
  }
  cell.value = value as string | number
}

function writeMonthRow(ws: Worksheet, row: number, colCount: number, label: string) {
  for (let c = 1; c <= colCount; c++) {
    const cell = ws.getCell(row, c)
    cell.border = headerBorder
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
  }
  tryMerge(ws, row, 1, row, colCount)
  const cell = ws.getCell(row, 1)
  cell.value = label
  cell.font = { name: 'Arial Black', size: 14, bold: true, color: { argb: RED } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
  cell.alignment = { vertical: 'middle', horizontal: 'center' }
  cell.border = headerBorder
  ws.getRow(row).height = 18
}

function colWidth(col: Col): number {
  if (col.kind === 'batch_no') return 14
  if (col.kind === 'rm') return 10
  if (col.kind === 'rm_total') return 18
  if (col.kind === 'vessel') return 11
  if (col.kind === 'output') return 16
  if (col.kind === 'stage' || col.kind === 'wash') {
    if (col.field === 'start_date' || col.field === 'end_date') return 13
    if (col.kind === 'stage' && (col.field === 'start_temp' || col.field === 'end_temp')) return 8
    return 10
  }
  return 12
}

function buildProductSheet(ws: Worksheet, product: ExportProduct, batches: ExportBatch[]) {
  const cols = buildColumns(product, batches)
  writeHeaders(ws, product, cols)
  cols.forEach((c, i) => {
    ws.getColumn(i + 1).width = colWidth(c)
  })

  ws.pageSetup = {
    orientation: 'landscape',
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0, footer: 0 },
  }

  const ordered = [...batches].sort((a, b) => {
    const da = batchSortDate(a)?.getTime() ?? 0
    const db = batchSortDate(b)?.getTime() ?? 0
    if (da !== db) return da - db
    return a.batch_no.localeCompare(b.batch_no)
  })

  let row = 5
  let lastMonth: string | null = null
  for (const batch of ordered) {
    const d = batchSortDate(batch)
    const monthKey = d ? `${d.getUTCFullYear()}-${d.getUTCMonth()}` : null
    const monthLabel = d ? MONTHS[d.getUTCMonth()] : null
    if (monthKey && monthKey !== lastMonth && monthLabel) {
      writeMonthRow(ws, row, cols.length, monthLabel)
      row += 1
      lastMonth = monthKey
    }
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i]
      let value: string | number | Date = EMPTY
      if (col.kind === 'batch_no') value = batch.batch_no || EMPTY
      else if (col.kind === 'rm') value = rmCell(batch, col.rmId, col.lotSlot)
      else if (col.kind === 'rm_total') value = rmTotalCell(batch, col.rmId)
      else if (col.kind === 'vessel') value = batch.vessel?.trim() || EMPTY
      else if (col.kind === 'stage') value = stageCell(batch, col)
      else if (col.kind === 'wash') value = washCell(batch, col)
      else value = outputCell(batch, col.outputId)
      applyDataFormat(ws, row, i + 1, col, value)
    }
    ws.getRow(row).height = 16
    row += 1
  }
}

export async function exportProductionRegisterToXlsx(input: {
  products: ExportProductGroup[]
  fileStem?: string
}): Promise<void> {
  const ExcelJS = (await import('exceljs')).default
  const wb: Workbook = new ExcelJS.Workbook()
  wb.creator = 'MADSTOQ'
  wb.created = new Date()

  const usedNames = new Set<string>()
  const groups = input.products.filter((g) => g.batches.length > 0)
  if (groups.length === 0) {
    const ws = wb.addWorksheet('Production')
    ws.getCell(1, 1).value = 'No production batches to export.'
  } else {
    for (const { product, batches } of groups) {
      const sheetName = excelSheetName(product.code || product.name, usedNames)
      const ws = wb.addWorksheet(sheetName)
      buildProductSheet(ws, product, batches)
    }
  }

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const stem = safeFilename(input.fileStem || 'production-record') || 'production-record'
  triggerDownload(blob, `${stem}.xlsx`)
}
