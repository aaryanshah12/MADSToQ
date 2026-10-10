export type InstrumentDocMeta = {
  log_title?: string
  form_code?: string
  annexure?: string
  /** Full instrument line. Empty string omits it; omitted uses "INSTRUMENT ID: {code}". */
  id_line?: string
}

export type LogBookColumn = {
  key: string
  header: string
  from: 'entry' | 'payload'
}

export type LogBookEntryRow = {
  id: string
  stage: string
  subject_id: string
  subject_label?: string | null
  entry_date: string
  sample_name: string
  remarks: string | null
  payload: Record<string, unknown>
}

export function parseInstrumentDocMeta(raw: unknown): InstrumentDocMeta {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const o = raw as Record<string, unknown>
  const str = (k: string) => {
    const v = o[k]
    return typeof v === 'string' && v.trim() ? v.trim() : undefined
  }
  return {
    log_title: str('log_title'),
    form_code: str('form_code'),
    annexure: str('annexure'),
    id_line: typeof o.id_line === 'string' ? o.id_line : undefined,
  }
}

export function logBookTitle(instrument: {
  name: string
  doc_meta?: unknown
}): string {
  return parseInstrumentDocMeta(instrument.doc_meta).log_title || `${instrument.name} Log Book`
}

export function sanitizeLogBookFilename(code: string): string {
  const stem = code
    .trim()
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40)
  return `${stem || 'instrument'}_log-book`
}

export function formatLogBookDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

export function logBookIdLine(instrument: { code: string; doc_meta?: unknown }): string | null {
  const meta = parseInstrumentDocMeta(instrument.doc_meta)
  if (meta.id_line !== undefined) {
    const line = meta.id_line.trim()
    return line || null
  }
  return `INSTRUMENT ID: ${instrument.code}`
}

export function logBookColumns(type: string): LogBookColumn[] {
  if (type === 'density') {
    return [
      { key: 'entry_date', header: 'DATE', from: 'entry' },
      { key: 'sample_name', header: 'SAMPLE NAME', from: 'entry' },
      { key: 'tare_g', header: 'TARE WEIGHT (GM)', from: 'payload' },
      { key: 'gross_g', header: 'GROSS WEIGHT (GM)', from: 'payload' },
      { key: 'net_g', header: 'NET WEIGHT (W IN GM)', from: 'payload' },
      { key: 'volume_ml', header: 'VOLUME (V IN ML)', from: 'payload' },
      { key: 'density', header: 'DENSITY (W/V)', from: 'payload' },
      { key: 'remarks', header: 'REMARK', from: 'entry' },
    ]
  }
  if (type === 'boiling_point') {
    return [
      { key: 'entry_date', header: 'DATE', from: 'entry' },
      { key: 'sample_name', header: 'SAMPLE NAME', from: 'entry' },
      { key: 'result_c', header: 'RESULT (°C)', from: 'payload' },
      { key: 'remarks', header: 'REMARKS', from: 'entry' },
    ]
  }
  if (type === 'karl_fisher') {
    return [
      { key: 'entry_date', header: 'DATE', from: 'entry' },
      { key: 'sample_name', header: 'SAMPLE NAME', from: 'entry' },
      { key: 'water_factor_1', header: '1', from: 'payload' },
      { key: 'water_factor_2', header: '2', from: 'payload' },
      { key: 'water_factor_3', header: '3', from: 'payload' },
      { key: 'average_factor', header: 'AVERGAE FACTOR', from: 'payload' },
      { key: 'inject_volume_ml', header: 'INJECT VOLUME (ml)', from: 'payload' },
      { key: 'density', header: 'DENSITY ( W/V )', from: 'payload' },
      { key: 'result_pct', header: 'RESULT (%)', from: 'payload' },
      { key: 'remarks', header: 'REMARK', from: 'entry' },
    ]
  }
  if (type === 'gc') {
    return [
      { key: 'entry_date', header: 'DATE', from: 'entry' },
      { key: 'sample_name', header: 'SAMPLE NAME', from: 'entry' },
      { key: 'method', header: 'METHOD', from: 'payload' },
      { key: 'file_no', header: 'FILE NO', from: 'payload' },
      { key: 'rt_min', header: 'R.T. (Min)', from: 'payload' },
      { key: 'percentage', header: 'PERCENTAGE (%)', from: 'payload' },
      { key: 'remarks', header: 'REMARKS', from: 'entry' },
    ]
  }
  return [
    { key: 'entry_date', header: 'DATE', from: 'entry' },
    { key: 'sample_name', header: 'SAMPLE NAME', from: 'entry' },
    { key: 'remarks', header: 'REMARKS', from: 'entry' },
  ]
}

/** DXA widths matching the paper books, scaled to A4 content (~10466). */
export function logBookColumnWidths(type: string): number[] {
  const cols = logBookColumns(type)
  const samples: Record<string, number[]> = {
    boiling_point: [1440, 3690, 2700, 2610],
    density: [900, 1260, 1440, 1440, 1440, 1530, 1350, 1260],
    karl_fisher: [900, 1260, 630, 720, 720, 1350, 1260, 1350, 1170, 1260],
    gc: [1011, 2580, 1350, 1350, 1440, 1350, 1546],
  }
  const raw = samples[type]
  if (!raw || raw.length !== cols.length) {
    const even = Math.floor(10466 / cols.length)
    return cols.map(() => even)
  }
  const sum = raw.reduce((a, b) => a + b, 0)
  const usable = 10466
  return raw.map((w) => Math.round((w / sum) * usable))
}

export type LogBookHeaderCell = {
  text: string
  span: number
  rowSpan?: number
}

export type LogBookHeaderRow = {
  offset: number
  cells: LogBookHeaderCell[]
}

/** One or two header rows; Karl Fisher groups water factors 1/2/3. */
export function logBookHeaderRows(type: string): LogBookHeaderRow[] {
  if (type === 'karl_fisher') {
    return [
      {
        offset: 0,
        cells: [
          { text: 'DATE', span: 1, rowSpan: 2 },
          { text: 'SAMPLE NAME', span: 1, rowSpan: 2 },
          { text: 'WATER FACTOR', span: 3 },
          { text: 'AVERGAE FACTOR', span: 1, rowSpan: 2 },
          { text: 'INJECT VOLUME (ml)', span: 1, rowSpan: 2 },
          { text: 'DENSITY\n( W/V )', span: 1, rowSpan: 2 },
          { text: 'RESULT (%)', span: 1, rowSpan: 2 },
          { text: 'REMARK', span: 1, rowSpan: 2 },
        ],
      },
      {
        offset: 2,
        cells: [
          { text: '1', span: 1 },
          { text: '2', span: 1 },
          { text: '3', span: 1 },
        ],
      },
    ]
  }
  return [
    {
      offset: 0,
      cells: logBookColumns(type).map((col) => ({ text: col.header, span: 1 })),
    },
  ]
}

function formatNum(value: unknown, decimals?: number): string {
  if (value == null || value === '') return ''
  const n = Number(value)
  if (!Number.isFinite(n)) return String(value)
  if (decimals != null) return n.toFixed(decimals)
  return String(n)
}

export function logBookCell(entry: LogBookEntryRow, col: LogBookColumn): string {
  if (col.from === 'entry') {
    if (col.key === 'entry_date') return formatLogBookDate(entry.entry_date)
    if (col.key === 'sample_name') return entry.sample_name || ''
    if (col.key === 'remarks') return entry.remarks || ''
    return ''
  }
  const payload = entry.payload || {}
  const value = payload[col.key]
  if (col.key === 'density' || col.key === 'average_factor') return formatNum(value, 4)
  if (col.key === 'net_g' || col.key === 'tare_g' || col.key === 'gross_g') return formatNum(value, 3)
  if (col.key === 'result_c' || col.key === 'rt_min' || col.key === 'result_pct' || col.key === 'percentage') {
    return formatNum(value)
  }
  if (value == null || value === '') return ''
  return String(value)
}
