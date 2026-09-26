import { browserStorage } from './storage'
import type { PaymentInstrumentDetails, PaymentMode } from '../types/payments'
import {
  normalizeCurrentPhase,
  normalizePhaseCount,
  normalizeRunningMaintenanceMonths,
  normalizeRunningMaintenanceRates,
  RUNNING_MAINTENANCE_GST_PERCENT,
  type SchemeFormData,
} from '../types/scheme'
import { gstOnPrincipal, grossFromPrincipal } from './chequeGst'

export type OtherPaymentKind =
  | 'clubDeposit'
  | 'oneTimeMaintenance'
  | 'runningMaintenance'

export const OTHER_PAYMENT_KIND_LABELS: Record<OtherPaymentKind, string> = {
  clubDeposit: 'Club deposit',
  oneTimeMaintenance: 'One-time maintenance',
  runningMaintenance: 'Running maintenance',
}

export type OtherPaymentReceipt = {
  id: string
  bookingId: string
  plotId: string
  schemeId: string
  kind: OtherPaymentKind
  /** Set for runningMaintenance */
  phase?: number | null
  /** Months collected for running maintenance (SBU × rate × months) */
  months?: number | null
  /** EMI / deposit principal (ex-GST) */
  principal: number
  /** GST on running maintenance only */
  gstAmount: number
  mode: PaymentMode
  paidOn: string
  instrument?: PaymentInstrumentDetails
  notes?: string
  collectedByUserId?: string
  collectedByName?: string
  collectedByRole?: string
  createdAt: string
}

export type OtherPaymentDue = {
  kind: OtherPaymentKind
  phase?: number
  /** Running: months in this due (scheme default; collect may override) */
  months?: number
  /** Running: ₹ / month / sq.yd */
  ratePerMonth?: number
  label: string
  principal: number
  gstAmount: number
  gross: number
  /** cash | cheque bucket */
  modeBucket: 'cash' | 'cheque'
  paid: boolean
  receipt?: OtherPaymentReceipt
}

const OTHER_KEY = 'plotcrm.otherPayments.v1'

function loadRows(): OtherPaymentReceipt[] {
  try {
    const raw = browserStorage()?.getItem(OTHER_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as OtherPaymentReceipt[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function loadOtherPaymentReceipts(): OtherPaymentReceipt[] {
  return loadRows().map((r) => ({
    ...r,
    principal: Math.max(0, Math.round(Number(r.principal) || 0)),
    gstAmount: Math.max(0, Math.round(Number(r.gstAmount) || 0)),
    phase: r.phase != null ? Math.floor(Number(r.phase) || 0) : null,
    months:
      r.months != null && Number(r.months) > 0
        ? Math.floor(Number(r.months))
        : null,
  }))
}

export function saveOtherPaymentReceipts(rows: OtherPaymentReceipt[]): void {
  browserStorage()?.setItem(OTHER_KEY, JSON.stringify(rows))
}

export function runningMaintenanceGstPercent(): number {
  const n = Number(RUNNING_MAINTENANCE_GST_PERCENT)
  return Number.isFinite(n) && n >= 0 ? n : 18
}

export function clubDepositPrincipal(scheme: {
  clubDepositAmount?: string | null
}): number {
  return Math.max(0, Math.round(Number(scheme.clubDepositAmount) || 0))
}

export function oneTimeMaintenancePrincipal(
  scheme: { oneTimeMaintenanceRate?: string | null },
  sbuAreaSqYards: number | string,
): number {
  const rate = Math.max(0, Number(scheme.oneTimeMaintenanceRate) || 0)
  const sbu = Math.max(0, Number(sbuAreaSqYards) || 0)
  return Math.max(0, Math.round(rate * sbu))
}

export function normalizeRunningMonths(raw: string | number | undefined): number {
  const n = Math.floor(Number(raw) || 0)
  if (!Number.isFinite(n) || n < 1) return 12
  return Math.min(120, n)
}

/**
 * Running maintenance principal:
 * ₹/month/sq.yd × SBU × months (e.g. 3 × 3532 × 12).
 */
export function runningMaintenancePrincipal(
  scheme: {
    totalPhases?: string | null
    runningMaintenanceRates?: string[] | null
    runningMaintenanceMonths?: string[] | null
  },
  sbuAreaSqYards: number | string,
  phase: number,
  monthsOverride?: number | null,
): number {
  const total = normalizePhaseCount(scheme.totalPhases ?? undefined)
  const rates = normalizeRunningMaintenanceRates(
    scheme.runningMaintenanceRates ?? undefined,
    total,
  )
  const monthsArr = normalizeRunningMaintenanceMonths(
    scheme.runningMaintenanceMonths ?? undefined,
    total,
  )
  const p = normalizeCurrentPhase(phase, total)
  const rate = Math.max(0, Number(rates[p - 1]) || 0)
  const months =
    monthsOverride != null && monthsOverride > 0
      ? normalizeRunningMonths(monthsOverride)
      : normalizeRunningMonths(monthsArr[p - 1])
  const sbu = Math.max(0, Number(sbuAreaSqYards) || 0)
  return Math.max(0, Math.round(rate * sbu * months))
}

export function runningMaintenanceRateForPhase(
  scheme: {
    totalPhases?: string | null
    runningMaintenanceRates?: string[] | null
  },
  phase: number,
): number {
  const total = normalizePhaseCount(scheme.totalPhases ?? undefined)
  const rates = normalizeRunningMaintenanceRates(
    scheme.runningMaintenanceRates ?? undefined,
    total,
  )
  const p = normalizeCurrentPhase(phase, total)
  return Math.max(0, Number(rates[p - 1]) || 0)
}

export function runningMaintenanceMonthsForPhase(
  scheme: {
    totalPhases?: string | null
    runningMaintenanceMonths?: string[] | null
  },
  phase: number,
): number {
  const total = normalizePhaseCount(scheme.totalPhases ?? undefined)
  const months = normalizeRunningMaintenanceMonths(
    scheme.runningMaintenanceMonths ?? undefined,
    total,
  )
  const p = normalizeCurrentPhase(phase, total)
  return normalizeRunningMonths(months[p - 1])
}

/** Compute running principal from explicit rate × SBU × months. */
export function runningMaintenanceAmount(
  ratePerMonth: number | string,
  sbuAreaSqYards: number | string,
  months: number | string,
): number {
  const rate = Math.max(0, Number(ratePerMonth) || 0)
  const sbu = Math.max(0, Number(sbuAreaSqYards) || 0)
  const m = normalizeRunningMonths(months)
  return Math.max(0, Math.round(rate * sbu * m))
}

export function schemeCurrentPhase(scheme: {
  totalPhases?: string | null
  currentPhase?: string | null
}): number {
  const total = normalizePhaseCount(scheme.totalPhases ?? undefined)
  return normalizeCurrentPhase(scheme.currentPhase ?? undefined, total)
}

export function findOtherReceipt(
  receipts: OtherPaymentReceipt[],
  input: {
    bookingId: string
    plotId: string
    kind: OtherPaymentKind
    phase?: number | null
  },
): OtherPaymentReceipt | undefined {
  return receipts.find((r) => {
    if (r.bookingId !== input.bookingId) return false
    if (r.plotId !== input.plotId) return false
    if (r.kind !== input.kind) return false
    if (input.kind === 'runningMaintenance') {
      return Number(r.phase) === Number(input.phase)
    }
    return true
  })
}

export function isOtherDuePaid(
  receipts: OtherPaymentReceipt[],
  input: {
    bookingId: string
    plotId: string
    kind: OtherPaymentKind
    phase?: number | null
  },
): boolean {
  return Boolean(findOtherReceipt(receipts, input))
}

type SchemeOtherSlice = Pick<
  SchemeFormData,
  | 'clubDepositAmount'
  | 'oneTimeMaintenanceRate'
  | 'totalPhases'
  | 'currentPhase'
  | 'runningMaintenanceRates'
  | 'runningMaintenanceMonths'
>

/** Build club + one-time + current-phase running dues for one plot. */
export function buildPlotOtherDues(input: {
  bookingId: string
  plotId: string
  sbuAreaSqYards: number | string
  scheme: SchemeOtherSlice
  receipts: OtherPaymentReceipt[]
}): OtherPaymentDue[] {
  const { bookingId, plotId, sbuAreaSqYards, scheme, receipts } = input
  const phase = schemeCurrentPhase(scheme)
  const gstPct = runningMaintenanceGstPercent()
  const months = runningMaintenanceMonthsForPhase(scheme, phase)
  const ratePerMonth = runningMaintenanceRateForPhase(scheme, phase)

  const clubP = clubDepositPrincipal(scheme)
  const oneP = oneTimeMaintenancePrincipal(scheme, sbuAreaSqYards)
  const runP = runningMaintenancePrincipal(scheme, sbuAreaSqYards, phase, months)

  const clubReceipt = findOtherReceipt(receipts, {
    bookingId,
    plotId,
    kind: 'clubDeposit',
  })
  const oneReceipt = findOtherReceipt(receipts, {
    bookingId,
    plotId,
    kind: 'oneTimeMaintenance',
  })
  const runReceipt = findOtherReceipt(receipts, {
    bookingId,
    plotId,
    kind: 'runningMaintenance',
    phase,
  })

  const dues: OtherPaymentDue[] = []

  if (clubP > 0 || clubReceipt) {
    dues.push({
      kind: 'clubDeposit',
      label: OTHER_PAYMENT_KIND_LABELS.clubDeposit,
      principal: clubP,
      gstAmount: 0,
      gross: clubP,
      modeBucket: 'cash',
      paid: Boolean(clubReceipt),
      receipt: clubReceipt,
    })
  }

  if (oneP > 0 || oneReceipt) {
    dues.push({
      kind: 'oneTimeMaintenance',
      label: OTHER_PAYMENT_KIND_LABELS.oneTimeMaintenance,
      principal: oneP,
      gstAmount: 0,
      gross: oneP,
      modeBucket: 'cash',
      paid: Boolean(oneReceipt),
      receipt: oneReceipt,
    })
  }

  if (runP > 0 || runReceipt) {
    const gst = gstOnPrincipal(runP, gstPct)
    const collectedMonths = runReceipt?.months ?? months
    dues.push({
      kind: 'runningMaintenance',
      phase,
      months: collectedMonths,
      ratePerMonth,
      label: `${OTHER_PAYMENT_KIND_LABELS.runningMaintenance} · phase ${phase} · ${collectedMonths} mo`,
      principal: runReceipt ? runReceipt.principal : runP,
      gstAmount: runReceipt ? runReceipt.gstAmount : gst,
      gross: runReceipt
        ? runReceipt.principal + runReceipt.gstAmount
        : grossFromPrincipal(runP, gstPct),
      modeBucket: 'cheque',
      paid: Boolean(runReceipt),
      receipt: runReceipt,
    })
  }

  return dues
}

/** Missing other-payment labels for handover (current phase). */
export function missingOtherPaymentLabels(input: {
  bookingId: string
  plotId: string
  plotLabel?: string
  sbuAreaSqYards: number | string
  scheme: SchemeOtherSlice
  receipts: OtherPaymentReceipt[]
}): string[] {
  return buildPlotOtherDues(input)
    .filter((d) => !d.paid && d.principal > 0)
    .map((d) =>
      input.plotLabel ? `${d.label} (${input.plotLabel})` : d.label,
    )
}

export function allowedModesForOtherKind(kind: OtherPaymentKind): PaymentMode[] {
  if (kind === 'runningMaintenance') {
    return ['upi', 'cheque', 'neft', 'other']
  }
  return ['cash']
}
