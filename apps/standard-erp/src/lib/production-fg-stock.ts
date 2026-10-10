/** GC assay % from lab QC logs (most recent GC with a percentage). */
export function purityFromGcLogs(
  logs: Array<{ instrument: { type: string } | string; payload: unknown }>,
): number | null {
  for (const log of logs) {
    const type = typeof log.instrument === 'string' ? log.instrument : log.instrument?.type
    if (type !== 'gc') continue
    const payload =
      log.payload && typeof log.payload === 'object'
        ? (log.payload as Record<string, unknown>)
        : {}
    const pct = Number(payload.percentage)
    if (Number.isFinite(pct)) return pct
  }
  return null
}

export function totalFinishedQty(
  outputs: Array<{ qty: number; isComputed?: boolean }>,
): number {
  const computed = outputs.filter((o) => o.isComputed && o.qty > 0)
  if (computed.length === 1) return computed[0].qty
  return outputs.reduce((s, o) => s + (Number(o.qty) || 0), 0)
}

export type WarehouseOutputSplit = {
  /** Qty for the main batch lot (QC’d finish). */
  mainQty: number
  /** Outputs marked as byproduct — separate warehouse lots. */
  byproducts: Array<{ name: string; qty: number }>
}

/** Prefer explicit is_byproduct; legacy fallback = Requires QC off. */
export function outputIsByproduct(o: {
  isByproduct?: boolean
  requiresQc?: boolean
}): boolean {
  if (o.isByproduct === true) return true
  if (o.isByproduct === false) return false
  return o.requiresQc === false
}

/**
 * Main finish = computed total or sum of non-byproduct physical outputs.
 * Byproducts = non-computed outputs flagged is_byproduct (separate warehouse lots).
 */
export function splitWarehouseOutputs(
  outputs: Array<{
    name: string
    qty: number
    isComputed?: boolean
    requiresQc?: boolean
    isByproduct?: boolean
  }>,
): WarehouseOutputSplit {
  const computed = outputs.filter((o) => o.isComputed && Number(o.qty) > 0)
  const physical = outputs.filter((o) => !o.isComputed && Number(o.qty) > 0)

  const byproducts = physical
    .filter((o) => outputIsByproduct(o))
    .map((o) => ({ name: o.name.trim() || 'By-product', qty: Number(o.qty) }))
  const mainPhysical = physical.filter((o) => !outputIsByproduct(o))

  const mainQty =
    computed.length === 1
      ? Number(computed[0].qty)
      : mainPhysical.reduce((s, o) => s + Number(o.qty), 0)

  return { mainQty, byproducts }
}

/** Unique warehouse lot no for a byproduct of a production batch. e.g. 2/AFC/26-27/BP/NABR */
export function byproductLotNumber(batchNo: string, outputName: string, index: number): string {
  const withoutLabel = outputName
    .trim()
    .replace(/\bby[-\s]?products?\b/gi, '')
    .trim()
  const slug =
    withoutLabel
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '')
      .slice(0, 8) || `BP${index + 1}`
  return `${batchNo.trim()}/BP/${slug}`
}

export function warehouseFgNotes(params: {
  batchNo: string
  mfgDate: string | null
  purity: number | null
  totalQty: number
  chemist: string | null
  vessel: string | null
  productCode: string
  productName: string
  rejected?: boolean
  byproduct?: boolean
}): string {
  const kindLabel = params.byproduct
    ? params.rejected
      ? 'REJECTED by-product'
      : 'By-product'
    : params.rejected
      ? `REJECTED SFG ${params.productCode} ${params.productName}`.trim()
      : `SFG production ${params.productCode} ${params.productName}`.trim()
  const parts = [
    kindLabel,
    `batch ${params.batchNo}`,
    params.mfgDate ? `mfg ${params.mfgDate}` : null,
    params.purity != null && !params.byproduct ? `purity ${params.purity}%` : null,
    `qty ${params.totalQty.toFixed(3)} Kg`,
    params.chemist ? `chemist ${params.chemist}` : null,
    params.vessel ? `vessel ${params.vessel}` : null,
  ].filter(Boolean)
  return parts.join(' · ')
}
