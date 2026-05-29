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

/** Batch unit price: recipe qty × batch_size × frozen unit prices. */
export function batchUnitPrice(
  lines: { qty: number; unit_price: number }[],
  batchSize: number
): number {
  const size = batchSize > 0 ? batchSize : 1
  return sumLineCosts(lines.map((l) => ({ qty: l.qty * size, unit_price: l.unit_price })))
}
