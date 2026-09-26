import { splitGrossBankAmount } from './chequeGst'
import { quotaForBookingCategory, tokenEmiCredit } from './paymentBuckets'
import type {
  InstallmentRecord,
  PaymentReceiptRecord,
} from '../types/payments'
import type { BookingRecord } from '../types/sales'

export type BookingFinanceSummary = {
  /** Deal principal (land + construction), excluding GST */
  total: number
  /** Principal collected: token (ex-GST) + EMI paid */
  collected: number
  principalPending: number
  gstTarget: number
  gstCollected: number
  gstPending: number
  /** Unpaid deal principal only — GST is tracked separately */
  pending: number
}

export const EMPTY_BOOKING_FINANCE: BookingFinanceSummary = {
  total: 0,
  collected: 0,
  principalPending: 0,
  gstTarget: 0,
  gstCollected: 0,
  gstPending: 0,
  pending: 0,
}

type SchemePlanSource = {
  paymentPlans?: unknown
  paymentPlanMonths?: string
  chequePaymentPercent?: string
  chequeGstPercent?: string
} | null

function tokenGstAmount(booking: {
  bookingAmount?: string | number | null
  bookingAmountMode?: 'cash' | 'cheque' | null
}): number {
  const amount = Math.max(0, Math.round(Number(booking.bookingAmount) || 0))
  if (amount <= 0 || booking.bookingAmountMode !== 'cheque') return 0
  return splitGrossBankAmount(amount).gst
}

/**
 * Principal vs GST ledgers for a booking.
 * Due = unpaid EMI principal only. GST is a separate column.
 */
export function bookingFinancialSummary(
  booking: Pick<
    BookingRecord,
    | 'id'
    | 'quotedPrice'
    | 'bookingAmount'
    | 'bookingAmountMode'
    | 'landPayment'
    | 'constructionPayment'
    | 'landPaymentPlanId'
    | 'paymentPlanId'
    | 'landPaymentPlanCustom'
    | 'landPaymentPlanOverride'
    | 'constructionPaymentPlanId'
    | 'constructionPaymentPlanCustom'
    | 'constructionPaymentPlanOverride'
    | 'plotLines'
  >,
  installments: Pick<
    InstallmentRecord,
    'bookingId' | 'category' | 'amount' | 'paidAmount'
  >[],
  receipts: Pick<
    PaymentReceiptRecord,
    'bookingId' | 'category' | 'gstAmount' | 'mode' | 'amount'
  >[] = [],
  scheme?: SchemePlanSource,
): BookingFinanceSummary {
  const land =
    booking.landPayment?.configured && booking.landPayment.totalValue
      ? Math.round(Number(booking.landPayment.totalValue) || 0)
      : 0
  const construction =
    booking.constructionPayment?.configured &&
    booking.constructionPayment.totalValue
      ? Math.round(Number(booking.constructionPayment.totalValue) || 0)
      : 0
  const fromConfig = land + construction
  const quoted = Math.round(Number(booking.quotedPrice) || 0)
  const total = fromConfig > 0 ? fromConfig : Math.max(0, quoted)

  const tokenPrincipal = tokenEmiCredit(booking)
  const bookingInst = installments.filter((i) => i.bookingId === booking.id)
  const emiPaid = bookingInst.reduce(
    (sum, i) => sum + Math.round(Number(i.paidAmount) || 0),
    0,
  )
  const collected = tokenPrincipal + emiPaid
  const principalPending = Math.max(0, total - collected)

  const bookingReceipts = receipts.filter((r) => r.bookingId === booking.id)
  const gstCollected =
    tokenGstAmount(booking) +
    bookingReceipts.reduce(
      (sum, r) => sum + Math.max(0, Math.round(Number(r.gstAmount) || 0)),
      0,
    )

  const landQuota = quotaForBookingCategory(
    booking as BookingRecord,
    'land',
    bookingInst as InstallmentRecord[],
    bookingReceipts as PaymentReceiptRecord[],
    scheme,
  )
  const constructionQuota = quotaForBookingCategory(
    booking as BookingRecord,
    'construction',
    bookingInst as InstallmentRecord[],
    bookingReceipts as PaymentReceiptRecord[],
    scheme,
  )
  const gstTarget =
    (landQuota.configured ? landQuota.chequeGstTarget : 0) +
    (constructionQuota.configured ? constructionQuota.chequeGstTarget : 0)

  const remainingChequeGross =
    (landQuota.configured ? landQuota.chequeRemaining : 0) +
    (constructionQuota.configured ? constructionQuota.chequeRemaining : 0)
  // Remaining bank take is GST-inclusive (e.g. ₹1050 owed, ₹1000 paid → ₹50 left).
  // GST still due is the GST slice of that leftover, not "fully collected".
  const gstLeftOnCheque =
    remainingChequeGross > 0
      ? splitGrossBankAmount(remainingChequeGross).gst
      : 0
  const gstShortfall = Math.max(
    0,
    Math.round(gstTarget) - Math.round(gstCollected),
  )
  const gstPending = Math.max(gstLeftOnCheque, gstShortfall)

  return {
    total,
    collected,
    principalPending,
    gstTarget: Math.round(gstTarget),
    gstCollected: Math.round(gstCollected),
    gstPending,
    pending: principalPending,
  }
}
