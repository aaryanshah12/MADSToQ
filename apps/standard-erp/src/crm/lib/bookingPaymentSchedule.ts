import { normalizePaymentPlans } from '../types/scheme'
import { applyCreditToParts, splitAmount } from '../types/payments'
import type { BookingRecord } from '../types/sales'
import { tokenEmiCredit } from './paymentBuckets'

type SchemePlanSource = {
  paymentPlans?: unknown
  paymentPlanMonths?: string
  chequePaymentPercent?: string
  chequeGstPercent?: string
} | null

export type BookingScheduleInput = {
  bookingId: string
  planDuration: 'custom'
  customMonths: number
  constructionMonths: number
  landAmount: number
  constructionAmount: number
  /** Booking token — deducted from first land EMI(s), then construction */
  bookingCredit: number
  startDate: string
  constructionStartDate?: string
}

/** Gross land/construction totals (before booking credit). */
export function scheduleGrossAmounts(booking: {
  landPayment?: { configured?: boolean; totalValue?: number }
  constructionPayment?: { configured?: boolean; totalValue?: number }
}): { landAmount: number; constructionAmount: number } {
  const landAmount =
    booking.landPayment?.configured && booking.landPayment.totalValue
      ? Math.max(0, Number(booking.landPayment.totalValue) || 0)
      : 0
  const constructionAmount =
    booking.constructionPayment?.configured &&
    booking.constructionPayment.totalValue
      ? Math.max(0, Number(booking.constructionPayment.totalValue) || 0)
      : 0
  return { landAmount, constructionAmount }
}

/** @deprecated Use scheduleGrossAmounts + bookingCredit instead */
export function scheduleAmountsAfterToken(booking: {
  bookingAmount?: string
  bookingAmountMode?: 'cash' | 'cheque' | null
  landPayment?: { configured?: boolean; totalValue?: number }
  constructionPayment?: { configured?: boolean; totalValue?: number }
}): { landAmount: number; constructionAmount: number } {
  const { landAmount, constructionAmount } = scheduleGrossAmounts(booking)
  let tokenLeft = tokenEmiCredit(booking)
  const landDeduct = Math.min(tokenLeft, landAmount)
  tokenLeft -= landDeduct
  return {
    landAmount: Math.max(0, landAmount - landDeduct),
    constructionAmount: Math.max(0, constructionAmount - tokenLeft),
  }
}

function schemePlans(scheme?: SchemePlanSource) {
  if (!scheme) return []
  return normalizePaymentPlans({
    paymentPlans: (scheme.paymentPlans as never) ?? [],
    paymentPlanMonths: scheme.paymentPlanMonths ?? '12',
    chequePaymentPercent: scheme.chequePaymentPercent ?? '50',
    chequeGstPercent: scheme.chequeGstPercent ?? '5',
  })
}

export function resolveLandPlanMonths(
  booking: BookingRecord,
  scheme?: SchemePlanSource,
): number {
  if (booking.landPaymentPlanCustom && booking.landPaymentPlanOverride?.months) {
    const n = Number(booking.landPaymentPlanOverride.months)
    if (Number.isFinite(n) && n >= 1) return Math.floor(n)
  }
  const plans = schemePlans(scheme)
  const planId = booking.landPaymentPlanId || booking.paymentPlanId
  const plan = plans.find((p) => p.id === planId) || plans[0]
  const n = Number(plan?.months)
  if (Number.isFinite(n) && n >= 1) return Math.floor(n)
  return 12
}

export function resolveConstructionPlanMonths(
  booking: BookingRecord,
  scheme?: SchemePlanSource,
): number {
  if (
    booking.constructionPaymentPlanCustom &&
    booking.constructionPaymentPlanOverride?.months
  ) {
    const n = Number(booking.constructionPaymentPlanOverride.months)
    if (Number.isFinite(n) && n >= 1) return Math.floor(n)
  }
  const plans = schemePlans(scheme)
  const planId = booking.constructionPaymentPlanId
  const plan = planId ? plans.find((p) => p.id === planId) : undefined
  const n = Number(plan?.months)
  if (Number.isFinite(n) && n >= 1) return Math.floor(n)
  return resolveLandPlanMonths(booking, scheme)
}

export function expectedInstallmentCounts(input: {
  landAmount: number
  constructionAmount: number
  customMonths: number
  constructionMonths: number
  bookingCredit: number
}): {
  land: number
  construction: number
  landDue: number
  constructionDue: number
  landParts: number[]
  constructionParts: number[]
} {
  const landSplit = applyCreditToParts(
    splitAmount(input.landAmount, input.customMonths),
    input.bookingCredit,
  )
  const constructionSplit = applyCreditToParts(
    splitAmount(input.constructionAmount, input.constructionMonths),
    landSplit.remainingCredit,
  )
  const landParts = landSplit.parts.filter((p) => p > 0)
  const constructionParts = constructionSplit.parts.filter((p) => p > 0)
  return {
    land: landParts.length,
    construction: constructionParts.length,
    landDue: landParts.reduce((s, p) => s + p, 0),
    constructionDue: constructionParts.reduce((s, p) => s + p, 0),
    landParts,
    constructionParts,
  }
}

/**
 * Build createPlan input from a saved booking.
 * Returns null if there is nothing to schedule.
 */
export function buildScheduleInputFromBooking(
  booking: BookingRecord,
  scheme?: SchemePlanSource,
): BookingScheduleInput | null {
  const startDate = booking.landInstallmentDueDate?.trim()
  if (!startDate) return null

  const { landAmount, constructionAmount } = scheduleGrossAmounts(booking)
  if (landAmount <= 0 && constructionAmount <= 0) return null

  const landMonths = resolveLandPlanMonths(booking, scheme)
  const constructionIncluded =
    Boolean(booking.constructionPayment?.configured) && constructionAmount > 0
  const constructionMonths = constructionIncluded
    ? resolveConstructionPlanMonths(booking, scheme)
    : landMonths
  const bookingCredit = tokenEmiCredit(booking)

  const expected = expectedInstallmentCounts({
    landAmount,
    constructionAmount,
    customMonths: landMonths,
    constructionMonths,
    bookingCredit,
  })
  if (expected.landDue <= 0 && expected.constructionDue <= 0) return null

  return {
    bookingId: booking.id,
    planDuration: 'custom',
    customMonths: landMonths,
    constructionMonths,
    landAmount,
    constructionAmount,
    bookingCredit,
    startDate,
    constructionStartDate: constructionIncluded ? startDate : undefined,
  }
}

/** Whether unpaid schedule matches the booking's plans + booking credit. */
export function scheduleMatchesBooking(
  booking: BookingRecord,
  scheme: SchemePlanSource | undefined,
  installments: {
    category: string
    sequence: number
    amount: number
    paidAmount: number
  }[],
): boolean {
  const input = buildScheduleInputFromBooking(booking, scheme)
  if (!input) return installments.length === 0

  const expected = expectedInstallmentCounts(input)
  const land = installments
    .filter((i) => i.category === 'land')
    .sort((a, b) => a.sequence - b.sequence)
  const construction = installments
    .filter((i) => i.category === 'construction')
    .sort((a, b) => a.sequence - b.sequence)

  if (
    land.length !== expected.land ||
    construction.length !== expected.construction
  ) {
    return false
  }

  // Compare each EMI amount so equal-split (old) schedules don't pass when
  // booking credit should reduce the first installment.
  for (let i = 0; i < expected.landParts.length; i++) {
    if (land[i]?.amount !== expected.landParts[i]) return false
  }
  for (let i = 0; i < expected.constructionParts.length; i++) {
    if (construction[i]?.amount !== expected.constructionParts[i]) return false
  }
  return true
}
