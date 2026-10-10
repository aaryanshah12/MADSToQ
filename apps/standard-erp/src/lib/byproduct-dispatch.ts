import { getInvoiceRemaining, queryStockBalance, parseStockKind } from '@madstoq/database'

export function isByproductLotNo(invoiceNumber: string) {
  return invoiceNumber.includes('/BP/')
}

export function parseScheduleKind(value: unknown): 'fg' | 'byproduct' {
  return String(value || '').toLowerCase() === 'byproduct' ? 'byproduct' : 'fg'
}

export type ByproductFifoLine = { invoiceNumber: string; qty: number }

/** Oldest remaining /BP/ lots first for this material, until qty is filled. */
export async function fifoByproductLines(params: {
  factoryId: string
  materialName: string
  qty: number
}): Promise<{ lines: ByproductFifoLine[] } | { error: string }> {
  const need = Number(params.qty)
  if (!Number.isFinite(need) || need <= 0) {
    return { error: 'Quantity must be greater than zero' }
  }

  const name = params.materialName.trim().toLowerCase()
  const balances = await queryStockBalance({ factoryIds: [params.factoryId] })
  const rows = balances
    .filter((b) => b.tons_remaining > 1e-9)
    .filter((b) => parseStockKind(b.stock_kind) === 'byproduct' || isByproductLotNo(b.invoice_number))
    .filter((b) => b.material_type.toLowerCase() === name)
    .sort((a, b) => {
      const da = a.entry_date.getTime()
      const db = b.entry_date.getTime()
      if (da !== db) return da - db
      return a.invoice_number.localeCompare(b.invoice_number)
    })

  let left = need
  const lines: ByproductFifoLine[] = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    if (left <= 1e-9) break
    const isLastTake = i === rows.length - 1 || left <= row.tons_remaining + 1e-9
    const take = isLastTake && left <= row.tons_remaining + 1e-9
      ? left
      : Math.min(row.tons_remaining, left)
    if (take > 1e-9) {
      lines.push({
        invoiceNumber: row.invoice_number,
        qty: Number(take.toFixed(3)),
      })
      left -= take
    }
  }

  if (left > 1e-6) {
    const have = need - left
    return {
      error: `Only ${have.toFixed(3)} Kg of ${params.materialName} byproduct remaining (need ${need.toFixed(3)} Kg)`,
    }
  }

  for (const line of lines) {
    const remaining = await getInvoiceRemaining(line.invoiceNumber)
    if (remaining == null || line.qty > remaining + 1e-9) {
      return {
        error: `Only ${(remaining ?? 0).toFixed(3)} remaining on ${line.invoiceNumber}`,
      }
    }
  }

  const total = lines.reduce((s, l) => s + l.qty, 0)
  if (Math.abs(total - need) > 0.001) {
    return { error: `FIFO qty (${total}) must equal scheduled qty (${need})` }
  }

  return { lines }
}
