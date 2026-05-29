/** Sum of (qty × unit price) for BOM / batch lines. */
export function sumLineCosts(
  lines: { qty: number; unit_price: number }[]
): number {
  return lines.reduce((sum, l) => sum + Number(l.qty || 0) * Number(l.unit_price || 0), 0)
}

/** Product template unit price from recipe (qty per 1 product unit). */
export function productUnitPriceFromRecipe(
  lines: { qty: number; unit_price: number }[]
): number {
  return sumLineCosts(lines)
}

/** Total batch cost: Σ (recipe qty × batch size × frozen unit price). */
export function batchTotalCost(
  lines: { qty: number; unit_price: number }[],
  batchSize: number
): number {
  const size = batchSize > 0 ? batchSize : 1
  return sumLineCosts(lines.map((l) => ({ qty: l.qty * size, unit_price: l.unit_price })))
}

/** Per-unit product price for the batch: total cost ÷ batch size. */
export function batchUnitPrice(
  lines: { qty: number; unit_price: number }[],
  batchSize: number
): number {
  const size = batchSize > 0 ? batchSize : 1
  return batchTotalCost(lines, size) / size
}

/** Recompute unit_price from frozen lines (fixes legacy rows that stored total cost). */
export function normalizeBatchesUnitPrices<
  B extends { id: string; batch_size: number; unit_price: number },
  L extends { batch_id: string; qty: number; unit_price: number },
>(batches: B[], batchLines: L[]): B[] {
  const linesByBatch = new Map<string, L[]>()
  for (const line of batchLines) {
    const list = linesByBatch.get(line.batch_id) ?? []
    list.push(line)
    linesByBatch.set(line.batch_id, list)
  }
  return batches.map((batch) => {
    const lines = linesByBatch.get(batch.id)
    if (!lines?.length) return batch
    const unit = batchUnitPrice(
      lines.map((l) => ({ qty: l.qty, unit_price: l.unit_price })),
      batch.batch_size
    )
    return { ...batch, unit_price: unit }
  })
}
