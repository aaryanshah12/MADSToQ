export type RmQcStickerData = {
  material_name: string
  lot_no: string
  supplier: string
  purity: string
  total_qty: string
  inward_date: string
  mfg_date: string
  exp_date: string
  sampling_date: string
  release_date: string
}

export type PackQcStickerData = {
  product_name: string
  drum_no: string
  purity: string
  batch_no: string
  mfg_date: string
  retest_date: string
  gross_kg: string
  tare_kg: string
  net_kg: string
}

export function qcStatusIsApproved(status: string) {
  return status === 'approved' || status === 'approved_printed'
}

export function qcStatusLabel(status: string) {
  if (status === 'approved_printed') return 'Printed'
  if (status === 'approved') return 'Approved'
  return status.replaceAll('_', ' ')
}

export function qcStatusBadgeClass(status: string) {
  if (status === 'approved_printed') return 'badge badge-success whitespace-nowrap'
  if (status === 'approved') return 'badge badge-chemist whitespace-nowrap'
  if (status === 'rejected' || status === 'returned_to_vendor') return 'badge badge-danger whitespace-nowrap'
  if (status === 'needs_info') return 'badge badge-pmc whitespace-nowrap'
  return 'badge badge-owner whitespace-nowrap'
}

export function isoToInputDate(value: string | null | undefined) {
  if (!value) return ''
  return value.slice(0, 10)
}

export function formatStickerDmy(iso: string) {
  const d = isoToInputDate(iso)
  if (!d) return ''
  const [y, m, day] = d.split('-')
  if (!y || !m || !day) return d
  return `${day}-${m}-${y.slice(2)}`
}

export function formatStickerMonthYear(iso: string) {
  const d = isoToInputDate(iso)
  if (!d) return ''
  const date = new Date(`${d}T00:00:00`)
  if (Number.isNaN(date.getTime())) return d
  return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }).toUpperCase()
}

export function addYearsIso(iso: string, years: number) {
  const d = isoToInputDate(iso)
  if (!d) return ''
  const date = new Date(`${d}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  date.setFullYear(date.getFullYear() + years)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function logInstrumentType(log: {
  instrument_type?: string | null
  instrument?: { type?: string | null } | string | null
}) {
  if (log.instrument_type) return log.instrument_type
  if (typeof log.instrument === 'string') return log.instrument
  return log.instrument?.type ?? ''
}

/** GC assay % from lab logs (latest GC with a percentage). */
export function purityFromGcPayload(
  logs: Array<{
    instrument_type?: string | null
    instrument?: { type?: string | null } | string | null
    payload?: unknown
  }>,
) {
  for (let i = logs.length - 1; i >= 0; i--) {
    const log = logs[i]
    if (String(logInstrumentType(log)).toLowerCase() !== 'gc') continue
    const payload =
      log.payload && typeof log.payload === 'object'
        ? (log.payload as Record<string, unknown>)
        : {}
    const raw = payload.percentage ?? payload.purity
    if (raw == null || raw === '') continue
    const pct = Number(raw)
    if (Number.isFinite(pct)) return String(pct)
    const text = String(raw).trim().replace(/%/g, '').trim()
    if (text) return text
  }
  return ''
}

export function parseStickerJson<T>(raw: unknown): T | null {
  if (!raw || typeof raw !== 'object') return null
  return raw as T
}

export type PackStickerJob = {
  product_name: string
  purity: string
  batch_no: string
  mfg_date: string
  retest_date: string
  drum_count: string
  tare_kg: string
  total_net_kg: string
  labels: PackQcStickerData[]
}

export function packQtyFromSnapshot(
  snap?: {
    finished_products?: Array<{ qty?: number; requires_qc?: boolean }>
  } | null,
) {
  const all = snap?.finished_products ?? []
  const qc = all.filter((f) => f.requires_qc !== false)
  const list = qc.length ? qc : all
  return list.reduce((sum, f) => sum + (Number(f.qty) || 0), 0)
}

export function roundKg(n: number) {
  return Math.round(n * 1000) / 1000
}

export function generatePackLabels(input: {
  product_name: string
  purity: string
  batch_no: string
  mfg_date: string
  retest_date: string
  total_net_kg: number
  drum_count: number
  tare_kg: number | null
}): PackQcStickerData[] {
  const drums = Math.max(1, Math.round(input.drum_count) || 1)
  const total = Math.max(0, input.total_net_kg)
  const even = drums === 1 ? total : roundKg(total / drums)
  const labels: PackQcStickerData[] = []
  let allocated = 0
  for (let i = 1; i <= drums; i++) {
    const net = i === drums ? roundKg(total - allocated) : even
    allocated = roundKg(allocated + net)
    const tare = input.tare_kg
    const gross =
      tare != null && Number.isFinite(tare) ? roundKg(net + tare) : null
    labels.push({
      product_name: input.product_name,
      drum_no: String(i).padStart(2, '0'),
      purity: input.purity,
      batch_no: input.batch_no,
      mfg_date: input.mfg_date,
      retest_date: input.retest_date,
      gross_kg: gross != null ? String(gross) : '',
      tare_kg: tare != null && Number.isFinite(tare) ? String(tare) : '',
      net_kg: total > 0 ? String(net) : '',
    })
  }
  return labels
}

export function parsePackStickerJob(raw: unknown): PackStickerJob | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const fromLabels = Array.isArray(o.labels)
    ? (o.labels.filter((row) => row && typeof row === 'object') as PackQcStickerData[])
    : []
  const first = fromLabels[0]
  const single =
    !first && (o.product_name || o.batch_no)
      ? (o as unknown as PackQcStickerData)
      : first
  if (!single && fromLabels.length === 0) return null
  const labels = fromLabels.length > 0 ? fromLabels : single ? [single] : []
  return {
    product_name: String(o.product_name || labels[0]?.product_name || ''),
    purity: String(o.purity || labels[0]?.purity || ''),
    batch_no: String(o.batch_no || labels[0]?.batch_no || ''),
    mfg_date: String(o.mfg_date || labels[0]?.mfg_date || ''),
    retest_date: String(o.retest_date || labels[0]?.retest_date || ''),
    drum_count: String(o.drum_count || labels.length || '1'),
    tare_kg: String(o.tare_kg || labels[0]?.tare_kg || ''),
    total_net_kg: String(
      o.total_net_kg ||
        labels.reduce((sum, row) => sum + (Number(row.net_kg) || 0), 0) ||
        '',
    ),
    labels,
  }
}

export function defaultPackDrumCount(totalNetKg: number) {
  if (!(totalNetKg > 0)) return 1
  if (totalNetKg <= 250) return 1
  return Math.max(1, Math.ceil(totalNetKg / 250))
}
