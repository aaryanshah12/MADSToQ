import { addLocalMonths } from '../lib/dates'
import {
  missingOtherPaymentLabels,
  type OtherPaymentReceipt,
} from '../lib/otherPayments'
import type { SchemeFormData } from './scheme'
import {
  bookingHasConstruction,
  bookingPlotIds,
  plotsMissingConstruction,
} from './sales'

export type PaymentCategory = 'land' | 'construction'
export type PlanDuration = '6' | '12' | 'custom'
export type InstallmentStatus = 'pending' | 'partial' | 'paid'
export type PaymentMode = 'cash' | 'upi' | 'cheque' | 'neft' | 'other'

export interface PaymentPlanRecord {
  id: string
  bookingId: string
  planDuration: PlanDuration
  /** Land schedule length in months (also used when planDuration === 'custom') */
  customMonths: number
  /** Construction schedule length; defaults to customMonths when omitted */
  constructionMonths?: number
  /** Booking token applied against first installment(s) */
  bookingCredit?: number
  landAmount: number
  constructionAmount: number
  /** First land installment due date */
  startDate: string
  /** First construction installment due date (falls back to after land schedule) */
  constructionStartDate: string
  createdAt: string
  updatedAt: string
}

export interface InstallmentRecord {
  id: string
  planId: string
  bookingId: string
  category: PaymentCategory
  sequence: number
  label: string
  dueDate: string
  amount: number
  paidAmount: number
  status: InstallmentStatus
}

export interface PaymentInstrumentDetails {
  /** Cheque */
  chequeNumber?: string
  chequeDate?: string
  bankName?: string
  branchName?: string
  /** UPI */
  upiTxnId?: string
  upiId?: string
  /** NEFT / RTGS */
  utrNumber?: string
  transferDate?: string
  /** Other / generic */
  referenceNo?: string
}

export interface PaymentReceiptRecord {
  id: string
  bookingId: string
  planId: string
  installmentId: string
  category: PaymentCategory
  /** EMI / plan principal credited */
  amount: number
  /**
   * GST collected on bank modes (cheque/UPI/NEFT/other). 0 for cash.
   * Quota for bank modes counts amount + gstAmount.
   */
  gstAmount?: number
  paidOn: string
  mode: PaymentMode
  /** Short display reference (cheque no / UTR / txn id) */
  reference: string
  /** Mode-specific instrument details */
  instrument?: PaymentInstrumentDetails
  notes: string
  /** Who collected / recorded this payment (logged-in user) */
  collectedByUserId?: string
  collectedByName?: string
  collectedByRole?: string
  createdAt: string
}

/** Build a one-line reference from instrument details for lists. */
export function instrumentReference(
  mode: PaymentMode,
  instrument?: PaymentInstrumentDetails | null,
): string {
  if (!instrument) return ''
  if (mode === 'cheque') return instrument.chequeNumber?.trim() || ''
  if (mode === 'upi') return instrument.upiTxnId?.trim() || ''
  if (mode === 'neft') return instrument.utrNumber?.trim() || ''
  if (mode === 'other') return instrument.referenceNo?.trim() || ''
  return ''
}

export const PLAN_DURATION_LABELS: Record<PlanDuration, string> = {
  '6': '6 months',
  '12': '12 months',
  custom: 'Custom',
}

export const CATEGORY_LABELS: Record<PaymentCategory, string> = {
  land: 'Land payment',
  construction: 'Construction payment',
}

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  cash: 'Cash',
  upi: 'UPI',
  cheque: 'Cheque',
  neft: 'NEFT / RTGS',
  other: 'Other',
}

export function monthsForPlan(
  planDuration: PlanDuration,
  customMonths: number,
): number {
  if (planDuration === '6') return 6
  if (planDuration === '12') return 12
  return Math.max(1, Math.floor(customMonths) || 1)
}

export function addMonths(isoDate: string, months: number): string {
  return addLocalMonths(isoDate, months)
}

/** Split amount into n parts; remainder goes to last installment. */
export function splitAmount(total: number, n: number): number[] {
  if (n <= 0) return []
  const rounded = Math.round(total)
  const base = Math.floor(rounded / n)
  const parts = Array.from({ length: n }, () => base)
  parts[n - 1] += rounded - base * n
  return parts
}

/**
 * Deduct credit from the earliest parts (first installment first).
 * Returns adjusted parts and leftover credit.
 */
export function applyCreditToParts(
  parts: number[],
  credit: number,
): { parts: number[]; remainingCredit: number } {
  let left = Math.max(0, Math.round(credit))
  const next = parts.map((part) => {
    if (left <= 0 || part <= 0) return part
    const deduct = Math.min(left, part)
    left -= deduct
    return part - deduct
  })
  return { parts: next, remainingCredit: left }
}

export function buildInstallments(input: {
  planId: string
  bookingId: string
  landAmount: number
  constructionAmount: number
  months: number
  /** Defaults to `months` when omitted */
  constructionMonths?: number
  /** Booking / token amount — deducted from first land EMIs, then construction */
  bookingCredit?: number
  startDate: string
  constructionStartDate?: string
  uid: () => string
}): InstallmentRecord[] {
  const { planId, bookingId, months, startDate, uid } = input
  const constructionMonths = Math.max(
    1,
    Math.floor(input.constructionMonths ?? months) || months,
  )
  const landSplit = applyCreditToParts(
    splitAmount(input.landAmount, months),
    input.bookingCredit ?? 0,
  )
  const constructionSplit = applyCreditToParts(
    splitAmount(input.constructionAmount, constructionMonths),
    landSplit.remainingCredit,
  )
  const constructionStart =
    input.constructionStartDate?.trim() || addMonths(startDate, months)
  const rows: InstallmentRecord[] = []

  landSplit.parts.forEach((amount, i) => {
    if (amount <= 0) return
    rows.push({
      id: uid(),
      planId,
      bookingId,
      category: 'land',
      sequence: i + 1,
      label: `Land EMI ${i + 1}/${months}`,
      dueDate: addMonths(startDate, i),
      amount,
      paidAmount: 0,
      status: 'pending',
    })
  })

  constructionSplit.parts.forEach((amount, i) => {
    if (amount <= 0) return
    rows.push({
      id: uid(),
      planId,
      bookingId,
      category: 'construction',
      sequence: i + 1,
      label: `Construction EMI ${i + 1}/${constructionMonths}`,
      dueDate: addMonths(constructionStart, i),
      amount,
      paidAmount: 0,
      status: 'pending',
    })
  })

  return rows
}

export function categoryTotals(installments: InstallmentRecord[], category: PaymentCategory) {
  const list = installments.filter((i) => i.category === category)
  const due = list.reduce((s, i) => s + i.amount, 0)
  const paid = list.reduce((s, i) => s + i.paidAmount, 0)
  return { due, paid, balance: Math.max(0, due - paid), complete: due > 0 && paid >= due }
}

export function isLandComplete(installments: InstallmentRecord[]): boolean {
  const land = installments.filter((i) => i.category === 'land')
  if (land.length === 0) return true
  return land.every((i) => i.paidAmount >= i.amount)
}

/** Principal-only deal totals (token counted at face value). Prefer `bookingFinancialSummary` in lib/bookingFinance for GST. */
export function bookingPrincipalSummary(
  booking: {
    quotedPrice?: string
    bookingAmount?: string
    landPayment?: { configured?: boolean; totalValue?: number }
    constructionPayment?: { configured?: boolean; totalValue?: number }
  },
  installments: Pick<InstallmentRecord, 'paidAmount'>[],
): { total: number; collected: number; pending: number } {
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

  const token = Math.max(0, Math.round(Number(booking.bookingAmount) || 0))
  const emiPaid = installments.reduce(
    (sum, i) => sum + Math.round(Number(i.paidAmount) || 0),
    0,
  )
  const collected = token + emiPaid
  const pending = Math.max(0, total - collected)
  return { total, collected, pending }
}

/** Full deal paid — prefers EMI schedule (all installments paid). */
export function isDealFullyPaid(
  booking: {
    quotedPrice?: string
    bookingAmount?: string
    landPayment?: { configured?: boolean; totalValue?: number }
    constructionPayment?: {
      included?: boolean
      configured?: boolean
      totalValue?: number
    }
  },
  installments: Pick<
    InstallmentRecord,
    'paidAmount' | 'amount' | 'category'
  >[],
): boolean {
  if (installments.length > 0) {
    return installments.every(
      (i) => Number(i.paidAmount) + 0.001 >= Number(i.amount),
    )
  }

  const { total, pending } = bookingPrincipalSummary(booking, installments)
  return total > 0 && pending === 0
}

function landSchedulePaid(
  installments: Pick<InstallmentRecord, 'paidAmount' | 'amount' | 'category'>[],
): boolean {
  const land = installments.filter((i) => i.category === 'land')
  if (land.length === 0) return false
  return land.every(
    (i) => Number(i.paidAmount) + 0.001 >= Number(i.amount),
  )
}

function constructionSchedulePaid(
  installments: Pick<InstallmentRecord, 'paidAmount' | 'amount' | 'category'>[],
): boolean {
  const rows = installments.filter((i) => i.category === 'construction')
  if (rows.length === 0) return false
  return rows.every(
    (i) => Number(i.paidAmount) + 0.001 >= Number(i.amount),
  )
}

export type HandoverOtherContext = {
  scheme: Pick<
    SchemeFormData,
    | 'clubDepositAmount'
    | 'oneTimeMaintenanceRate'
    | 'totalPhases'
    | 'currentPhase'
    | 'runningMaintenanceRates'
    | 'runningMaintenanceMonths'
  >
  /** plotId → SBU sq.yd */
  plotSbuById: Record<string, string | number>
  /** plotId → display label */
  plotLabelById?: Record<string, string>
  otherReceipts: OtherPaymentReceipt[]
}

export type HandoverAssessment = {
  ready: boolean
  landPaid: boolean
  hasMinConstruction: boolean
  constructionPaid: boolean
  /** Other dues (club / one-time / running current phase) paid for all plots */
  otherPaid: boolean
  /** Cheque GST on the deal has been collected */
  gstPaid: boolean
  /** Must configure construction before handover can unlock */
  requireConstructionConfig: boolean
  /** Optional: more plots can still get construction */
  suggestMoreConstruction: boolean
  missingConstructionPlotIds: string[]
  blockReason: string | null
}

/**
 * Handover rules:
 * - Land EMIs must be paid
 * - At least one plot must have construction configured + construction EMIs paid
 * - Single-plot: that plot must have construction (no land-only handover)
 * - Multi-plot: min 1 construction; remaining plots may stay land-only (optional configure)
 * - Cheque GST on the deal must be collected (principal + GST)
 * - Club deposit, one-time maintenance, and running maintenance (scheme current phase)
 *   must be paid for every plot when scheme rates apply
 */
export function assessHandover(
  booking: {
    id?: string
    status?: string
    handoverAt?: string | null
    plotId?: string
    plotIds?: string[] | null
    plotLines?: {
      plotId: string
      constructionPayment?: { configured?: boolean }
      landPayment?: { sbuAreaSqYards?: string; plotNumber?: string }
    }[] | null
    constructionPayment?: {
      included?: boolean
      configured?: boolean
      totalValue?: number
    } | null
  },
  installments: Pick<
    InstallmentRecord,
    'paidAmount' | 'amount' | 'category'
  >[],
  other?: HandoverOtherContext | null,
  gstPending = 0,
): HandoverAssessment {
  const missing = plotsMissingConstruction(booking)
  const missingIds = missing.map((l) => l.plotId)
  const hasMinConstruction = bookingHasConstruction(booking)
  const landPaid = landSchedulePaid(installments)
  const constructionPaid = constructionSchedulePaid(installments)
  const plotCount = Math.max(1, bookingPlotIds(booking).length)

  const gstDue = Math.max(0, Math.round(gstPending || 0))
  const base = {
    landPaid,
    hasMinConstruction,
    constructionPaid,
    otherPaid: false,
    gstPaid: gstDue <= 0,
    missingConstructionPlotIds: missingIds,
    requireConstructionConfig: false,
    suggestMoreConstruction: false,
    blockReason: null as string | null,
    ready: false,
  }

  if (booking.status === 'cancelled' || isBookingHandedOver(booking)) {
    return base
  }

  if (!landPaid) {
    return base
  }

  if (!hasMinConstruction) {
    return {
      ...base,
      requireConstructionConfig: true,
      suggestMoreConstruction: missingIds.length > 0,
      blockReason:
        plotCount <= 1
          ? 'Land paid — configure construction before handover.'
          : 'Land paid — configure construction on at least one plot before handover.',
    }
  }

  if (!constructionPaid) {
    const constRows = installments.filter((i) => i.category === 'construction')
    return {
      ...base,
      suggestMoreConstruction: missingIds.length > 0,
      blockReason:
        constRows.length === 0
          ? 'Land paid — create construction payment schedule before handover.'
          : 'Land paid — construction EMIs still pending.',
    }
  }

  const otherBlock = other ? otherPaymentsBlockReason(booking, other) : null
  if (otherBlock) {
    return {
      ...base,
      otherPaid: false,
      suggestMoreConstruction: missingIds.length > 0,
      blockReason: otherBlock,
    }
  }

  if (gstDue > 0) {
    return {
      ...base,
      otherPaid: true,
      gstPaid: false,
      suggestMoreConstruction: missingIds.length > 0,
      blockReason: 'GST collection still pending.',
    }
  }

  return {
    ...base,
    otherPaid: true,
    gstPaid: true,
    ready: true,
    suggestMoreConstruction: missingIds.length > 0,
    blockReason: null,
  }
}

export function otherPaymentsBlockReason(
  booking: {
    id?: string
    plotId?: string
    plotIds?: string[] | null
    plotLines?: {
      plotId: string
      landPayment?: { sbuAreaSqYards?: string; plotNumber?: string }
    }[] | null
  },
  other: HandoverOtherContext,
): string | null {
  const bookingId = booking.id || ''
  if (!bookingId) return null
  const plotIds = bookingPlotIds(booking)
  const missing: string[] = []
  for (const plotId of plotIds) {
    const line = booking.plotLines?.find((l) => l.plotId === plotId)
    const sbu =
      other.plotSbuById[plotId] ?? line?.landPayment?.sbuAreaSqYards ?? 0
    const plotLabel =
      other.plotLabelById?.[plotId] ||
      (line?.landPayment?.plotNumber
        ? `Plot ${line.landPayment.plotNumber}`
        : undefined)
    missing.push(
      ...missingOtherPaymentLabels({
        bookingId,
        plotId,
        plotLabel,
        sbuAreaSqYards: sbu,
        scheme: other.scheme,
        receipts: other.otherReceipts,
      }),
    )
  }
  if (missing.length === 0) return null
  return `Other payments pending: ${missing.slice(0, 3).join('; ')}${
    missing.length > 3 ? '…' : ''
  }`
}

export function isBookingHandedOver(booking: {
  handoverAt?: string | null
}): boolean {
  return Boolean(booking.handoverAt)
}

/** Land + min 1 construction paid; not cancelled; not yet handed over. */
export function isHandoverReady(
  booking: {
    id?: string
    status?: string
    handoverAt?: string | null
    plotId?: string
    plotIds?: string[] | null
    plotLines?: {
      plotId: string
      constructionPayment?: { configured?: boolean }
      landPayment?: { sbuAreaSqYards?: string; plotNumber?: string }
    }[] | null
    quotedPrice?: string
    bookingAmount?: string
    landPayment?: { configured?: boolean; totalValue?: number }
    constructionPayment?: {
      included?: boolean
      configured?: boolean
      totalValue?: number
    } | null
  },
  installments: Pick<
    InstallmentRecord,
    'paidAmount' | 'amount' | 'category'
  >[],
  other?: HandoverOtherContext | null,
  gstPending = 0,
): boolean {
  return assessHandover(booking, installments, other, gstPending).ready
}

/** Land schedule complete but handover still blocked — explain why. */
export function handoverBlockReason(
  booking: {
    id?: string
    status?: string
    handoverAt?: string | null
    plotId?: string
    plotIds?: string[] | null
    plotLines?: {
      plotId: string
      constructionPayment?: { configured?: boolean }
      landPayment?: { sbuAreaSqYards?: string; plotNumber?: string }
    }[] | null
    constructionPayment?: {
      included?: boolean
      configured?: boolean
      totalValue?: number
    } | null
  },
  installments: Pick<
    InstallmentRecord,
    'paidAmount' | 'amount' | 'category'
  >[],
  other?: HandoverOtherContext | null,
  gstPending = 0,
): string | null {
  const gate = assessHandover(booking, installments, other, gstPending)
  if (!gate.landPaid || gate.ready) return null
  return gate.blockReason
}
