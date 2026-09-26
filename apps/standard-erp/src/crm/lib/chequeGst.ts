import { FIXED_CHEQUE_GST_PERCENT } from '../types/scheme'
import type { PaymentMode, PaymentReceiptRecord } from '../types/payments'

/** Fixed GST % on cheque / UPI / NEFT share (not on cash). */
export function chequeGstPercent(): number {
  const n = Number(FIXED_CHEQUE_GST_PERCENT)
  return Number.isFinite(n) && n >= 0 ? n : 5
}

export function isBankMode(mode: PaymentMode): boolean {
  return mode !== 'cash'
}

/** GST on an EMI / plan principal paid via bank mode. */
export function gstOnPrincipal(
  principal: number,
  gstPct = chequeGstPercent(),
): number {
  const p = Math.max(0, Math.round(principal))
  if (p <= 0 || gstPct <= 0) return 0
  return Math.round((p * gstPct) / 100)
}

/** Gross (what client pays) for a bank-mode principal. */
export function grossFromPrincipal(
  principal: number,
  gstPct = chequeGstPercent(),
): number {
  const p = Math.max(0, Math.round(principal))
  return p + gstOnPrincipal(p, gstPct)
}

/**
 * Peel GST-inclusive bank amount into principal + GST.
 * Picks the largest principal where principal + round(GST%) ≤ gross,
 * so Max = grossFromPrincipal(EMI) peels back to the full EMI (no ₹1 drift).
 */
export function splitGrossBankAmount(
  gross: number,
  gstPct = chequeGstPercent(),
): { principal: number; gst: number; gross: number } {
  const g = Math.max(0, Math.round(gross))
  if (g <= 0) return { principal: 0, gst: 0, gross: 0 }
  if (gstPct <= 0) return { principal: g, gst: 0, gross: g }

  // Seed near the theoretical ex-GST value, then walk to the true inverse of grossFromPrincipal
  let principal = Math.round((g * 100) / (100 + gstPct))
  while (principal > 0 && grossFromPrincipal(principal, gstPct) > g) {
    principal -= 1
  }
  while (grossFromPrincipal(principal + 1, gstPct) <= g) {
    principal += 1
  }

  const gst = g - principal
  return { principal, gst, gross: g }
}

/** Largest principal whose bank gross (principal + GST) fits in a gross cap. */
export function maxPrincipalForGrossCap(
  capGross: number,
  gstPct = chequeGstPercent(),
): number {
  if (!Number.isFinite(capGross) || capGross === Number.POSITIVE_INFINITY) {
    return Number.POSITIVE_INFINITY
  }
  const g = Math.max(0, Math.round(capGross))
  if (g <= 0) return 0
  return splitGrossBankAmount(g, gstPct).principal
}

/** Max GST-inclusive amount for EMI principal room + cheque quota. */
export function maxBankGross(input: {
  principalRoom: number
  chequeRemainingGross: number
  gstPct?: number
}): number {
  const gstPct = input.gstPct ?? chequeGstPercent()
  const fromEmi = grossFromPrincipal(
    Math.max(0, Math.round(input.principalRoom)),
    gstPct,
  )
  const fromQuota = Math.max(0, Math.round(input.chequeRemainingGross))
  return Math.min(fromEmi, fromQuota)
}

/** Amount that counts toward cheque/cash quota for a receipt. */
export function receiptQuotaAmount(receipt: {
  amount: number
  gstAmount?: number | null
  mode: PaymentMode
}): number {
  const principal = Math.round(Number(receipt.amount) || 0)
  const gst = Math.round(Number(receipt.gstAmount) || 0)
  if (isBankMode(receipt.mode)) return principal + gst
  return principal
}

/** Total money received on a receipt (EMI principal + GST). */
export function receiptGrossAmount(receipt: {
  amount: number
  gstAmount?: number | null
}): number {
  return (
    Math.round(Number(receipt.amount) || 0) +
    Math.round(Number(receipt.gstAmount) || 0)
  )
}

/** Spread GST across principal allocations so sum(gst) === totalGst. */
export function distributeGst(
  principals: number[],
  totalGst: number,
): number[] {
  const n = principals.length
  if (n === 0) return []
  const gstTotal = Math.max(0, Math.round(totalGst))
  if (gstTotal <= 0) return principals.map(() => 0)

  const principalSum = principals.reduce((s, p) => s + Math.max(0, p), 0)
  if (principalSum <= 0) {
    const out = principals.map(() => 0)
    out[0] = gstTotal
    return out
  }

  const out = principals.map((p) =>
    Math.floor((Math.max(0, p) * gstTotal) / principalSum),
  )
  let allocated = out.reduce((s, g) => s + g, 0)
  let i = 0
  while (allocated < gstTotal && i < n * 2) {
    const idx = i % n
    if (principals[idx] > 0) {
      out[idx] += 1
      allocated += 1
    }
    i += 1
  }
  return out
}

export function sumReceiptQuota(
  receipts: PaymentReceiptRecord[],
  bucket: 'cheque' | 'cash',
): number {
  return receipts.reduce((s, r) => {
    const isBank = isBankMode(r.mode)
    if (bucket === 'cheque' && !isBank) return s
    if (bucket === 'cash' && isBank) return s
    return s + receiptQuotaAmount(r)
  }, 0)
}
