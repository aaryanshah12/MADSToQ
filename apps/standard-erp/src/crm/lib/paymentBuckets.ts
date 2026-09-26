import {
  FIXED_CHEQUE_GST_PERCENT,
  normalizePaymentPlans,
  type SchemePaymentPlan,
} from '../types/scheme'
import type {
  InstallmentRecord,
  PaymentCategory,
  PaymentMode,
  PaymentReceiptRecord,
} from '../types/payments'
import type { BookingRecord, BookingTokenMode } from '../types/sales'
import { receiptQuotaAmount, splitGrossBankAmount } from './chequeGst'
import {
  clampChequePercent,
  constructionCashChequeSplit,
  landCashChequeSplit,
  type DealPayableSplit,
} from './dealFinance'

/** How much of the booking token counts toward land cheque/cash quotas. */
export function tokenQuotaSeed(booking: {
  bookingAmount?: string | number | null
  bookingAmountMode?: BookingTokenMode | null
}): { cheque: number; cash: number } {
  const amount = Math.max(0, Math.round(Number(booking.bookingAmount) || 0))
  const mode = booking.bookingAmountMode
  if (amount <= 0 || (mode !== 'cash' && mode !== 'cheque')) {
    return { cheque: 0, cash: 0 }
  }
  if (mode === 'cash') {
    return { cheque: 0, cash: amount }
  }
  // Cheque / bank: booking amount is GST-inclusive take
  const { gross } = splitGrossBankAmount(amount)
  return { cheque: gross, cash: 0 }
}

/**
 * Token amount that reduces EMI principal (toward the deal).
 * Cash token → full amount. Cheque token → GST-inclusive take peeled to principal only.
 */
export function tokenEmiCredit(booking: {
  bookingAmount?: string | number | null
  bookingAmountMode?: BookingTokenMode | null
}): number {
  const amount = Math.max(0, Math.round(Number(booking.bookingAmount) || 0))
  if (amount <= 0) return 0
  if (booking.bookingAmountMode === 'cheque') {
    return splitGrossBankAmount(amount).principal
  }
  return amount
}

export type PaymentBucket = 'cheque' | 'cash'

/** Bank / instrument modes attract GST (cheque quota). Only pure cash is non-GST. */
export function modeToBucket(mode: PaymentMode): PaymentBucket {
  return mode === 'cash' ? 'cash' : 'cheque'
}

export function availableModesForQuota(
  quota: CategoryPaymentQuota,
): PaymentMode[] {
  const modes: PaymentMode[] = []
  if (quota.chequeRemaining > 0) {
    modes.push('cheque', 'upi', 'neft', 'other')
  }
  if (quota.cashRemaining > 0) {
    modes.push('cash')
  }
  // Quotas exhausted but EMI still due (rounding) — allow any mode
  if (modes.length === 0 && quota.unpaidBalance > 0) {
    return ['cash', 'upi', 'cheque', 'neft', 'other']
  }
  return modes
}

export function defaultModeForQuota(quota: CategoryPaymentQuota): PaymentMode {
  if (quota.chequeRemaining > 0) return 'upi'
  if (quota.cashRemaining > 0) return 'cash'
  if (quota.unpaidBalance > 0) return 'upi'
  return 'upi'
}

export function resolveChequePercent(
  booking: BookingRecord,
  category: PaymentCategory,
  schemePlans: SchemePaymentPlan[],
): number {
  if (category === 'land') {
    if (booking.landPaymentPlanCustom && booking.landPaymentPlanOverride) {
      const n = Number(booking.landPaymentPlanOverride.chequePaymentPercent)
      if (Number.isFinite(n)) return clampChequePercent(n)
    }
    const plan =
      schemePlans.find((p) => p.id === booking.landPaymentPlanId) ||
      schemePlans.find((p) => p.id === booking.paymentPlanId) ||
      schemePlans[0]
    const n = Number(plan?.chequePaymentPercent)
    return Number.isFinite(n) ? clampChequePercent(n) : clampChequePercent(50)
  }

  if (
    booking.constructionPaymentPlanCustom &&
    booking.constructionPaymentPlanOverride
  ) {
    const n = Number(
      booking.constructionPaymentPlanOverride.chequePaymentPercent,
    )
    if (Number.isFinite(n)) return clampChequePercent(n)
  }
  const plan =
    schemePlans.find((p) => p.id === booking.constructionPaymentPlanId) ||
    schemePlans[0]
  const n = Number(plan?.chequePaymentPercent)
  return Number.isFinite(n) ? clampChequePercent(n) : clampChequePercent(50)
}

export type CategoryPaymentQuota = {
  category: PaymentCategory
  chequePercent: number
  cashPercent: number
  /**
   * Cheque / UPI / NEFT target including 5% GST on cheque base.
   * This is what must be collected through bank modes.
   */
  chequeTarget: number
  /** Cheque base only (ex-GST), for display */
  chequeBaseTarget: number
  cashTarget: number
  /** GST expected on full cheque base */
  chequeGstTarget: number
  /** Bank-mode collections (principal + GST) */
  chequeCollected: number
  cashCollected: number
  /** Remaining bank quota incl. GST (used for collection caps) */
  chequeRemaining: number
  /** Remaining cheque principal ex-GST (UI) */
  chequeBaseRemaining: number
  cashRemaining: number
  baseTotal: number
  /** Unpaid EMI balance for this category (0 when fully paid / no schedule) */
  unpaidBalance: number
  /** Deal configured for this category (land always; construction when set) */
  configured: boolean
}

export function buildCategoryPaymentQuota(
  category: PaymentCategory,
  baseTotal: number,
  chequePercent: number,
  receipts: PaymentReceiptRecord[],
  opts?: {
    unpaidBalance?: number
    configured?: boolean
    /** When true and unpaid is 0, clear leftover quota from rounding */
    scheduleExists?: boolean
    /** Booking token already collected toward this category's quotas */
    tokenCheque?: number
    tokenCash?: number
    /**
     * Prefer precomputed land/construction payable split (A+dev / D).
     * When omitted, construction-style full-amount split is used.
     */
    payableSplit?: DealPayableSplit
  },
): CategoryPaymentQuota {
  const gstPct = Number(FIXED_CHEQUE_GST_PERCENT) || 5
  const split =
    opts?.payableSplit ??
    constructionCashChequeSplit(
      Math.max(0, Math.round(baseTotal)),
      chequePercent,
      gstPct,
    )
  const chequeBaseTarget = Math.round(split.chequeBase)
  const chequeGstTarget = Math.round(split.chequeGst)
  // Bank quota includes GST — matches booking payable cheque line
  const chequeTarget = Math.round(split.chequeTotal)
  const cashTarget = Math.round(split.cashAmount)
  let chequeCollected = Math.max(0, Math.round(opts?.tokenCheque ?? 0))
  let cashCollected = Math.max(0, Math.round(opts?.tokenCash ?? 0))
  for (const r of receipts) {
    if (r.category !== category) continue
    const amt = receiptQuotaAmount(r)
    if (modeToBucket(r.mode) === 'cheque') chequeCollected += amt
    else cashCollected += amt
  }
  let chequeRemaining = Math.max(0, chequeTarget - chequeCollected)
  let cashRemaining = Math.max(0, cashTarget - cashCollected)
  const unpaidBalance = Math.max(0, Math.round(opts?.unpaidBalance ?? 0))

  // Fully paid EMIs — clear phantom leftovers (GST should already ride with bank pays)
  if (opts?.scheduleExists && unpaidBalance <= 0) {
    chequeRemaining = 0
    cashRemaining = 0
  }

  const chequeBaseRemaining =
    chequeRemaining <= 0
      ? 0
      : Math.max(0, splitGrossBankAmount(chequeRemaining).principal)

  return {
    category,
    chequePercent: split.chequePercent,
    cashPercent: split.cashPercent,
    chequeTarget,
    chequeBaseTarget,
    cashTarget,
    chequeGstTarget,
    chequeCollected,
    cashCollected,
    chequeRemaining,
    chequeBaseRemaining,
    cashRemaining,
    baseTotal: Math.round(split.planAmount || baseTotal),
    unpaidBalance,
    configured: Boolean(opts?.configured),
  }
}

function configuredCategoryTotal(
  booking: BookingRecord,
  category: PaymentCategory,
): number {
  if (category === 'land') {
    return Math.max(0, Math.round(Number(booking.landPayment?.totalValue) || 0))
  }
  return Math.max(
    0,
    Math.round(Number(booking.constructionPayment?.totalValue) || 0),
  )
}

function categoryConfigured(
  booking: BookingRecord,
  category: PaymentCategory,
): boolean {
  if (category === 'land') {
    return (
      Boolean(booking.landPayment?.configured) ||
      configuredCategoryTotal(booking, 'land') > 0
    )
  }
  if (Array.isArray(booking.plotLines) && booking.plotLines.length > 0) {
    return booking.plotLines.some((l) => l.constructionPayment?.configured)
  }
  return Boolean(booking.constructionPayment?.configured)
}

export function quotaForBookingCategory(
  booking: BookingRecord,
  category: PaymentCategory,
  installments: InstallmentRecord[],
  receipts: PaymentReceiptRecord[],
  scheme?: {
    paymentPlans?: unknown
    paymentPlanMonths?: string
    chequePaymentPercent?: string
    chequeGstPercent?: string
  } | null,
): CategoryPaymentQuota {
  const plans = scheme
    ? normalizePaymentPlans({
        paymentPlans: (scheme.paymentPlans as never) ?? [],
        paymentPlanMonths: scheme.paymentPlanMonths ?? '12',
        chequePaymentPercent: scheme.chequePaymentPercent ?? '50',
        chequeGstPercent: scheme.chequeGstPercent ?? '5',
      })
    : []
  const chequePercent = resolveChequePercent(booking, category, plans)
  const categoryInstallments = installments.filter(
    (i) => i.bookingId === booking.id && i.category === category,
  )
  const scheduleTotal = categoryInstallments.reduce(
    (s, i) => s + (Number(i.amount) || 0),
    0,
  )
  const unpaidBalance = categoryInstallments.reduce(
    (s, i) =>
      s + Math.max(0, Math.round(Number(i.amount) || 0) - Math.round(Number(i.paidAmount) || 0)),
    0,
  )
  const configuredTotal = configuredCategoryTotal(booking, category)
  const configured = categoryConfigured(booking, category)
  // Match booking payable preview (plan amount / totalValue), not EMI schedule
  // after token — schedule is lower by booking credit and caused cheque/cash mismatch.
  const baseTotal =
    configured && configuredTotal > 0
      ? configuredTotal
      : scheduleTotal > 0
        ? scheduleTotal
        : 0
  const gstPct = Number(FIXED_CHEQUE_GST_PERCENT) || 5
  const payableSplit =
    category === 'land' && booking.landPayment
      ? landCashChequeSplit(booking.landPayment, chequePercent, gstPct)
      : constructionCashChequeSplit(baseTotal, chequePercent, gstPct)
  const bookingReceipts = receipts.filter((r) => r.bookingId === booking.id)
  // Token is taken at booking against land only (cash → Z, cheque GST-incl → Y)
  const token =
    category === 'land' ? tokenQuotaSeed(booking) : { cheque: 0, cash: 0 }
  return buildCategoryPaymentQuota(
    category,
    baseTotal,
    chequePercent,
    bookingReceipts,
    {
      unpaidBalance,
      configured,
      scheduleExists: scheduleTotal > 0,
      tokenCheque: token.cheque,
      tokenCash: token.cash,
      payableSplit,
    },
  )
}

export function remainingForMode(
  quota: CategoryPaymentQuota,
  mode: PaymentMode,
): number {
  return modeToBucket(mode) === 'cheque'
    ? quota.chequeRemaining
    : quota.cashRemaining
}

/** Prefer a mode that still has collectible quota across land + construction. */
export function defaultModeForBookingQuotas(
  landQuota: CategoryPaymentQuota,
  constructionQuota: CategoryPaymentQuota,
): PaymentMode {
  if (landQuota.unpaidBalance > 0) {
    return defaultModeForQuota(landQuota)
  }
  if (constructionQuota.unpaidBalance > 0 || constructionQuota.baseTotal > 0) {
    return defaultModeForQuota(constructionQuota)
  }
  return defaultModeForQuota(landQuota)
}
