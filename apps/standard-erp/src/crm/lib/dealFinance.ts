import { FIXED_CHEQUE_GST_PERCENT } from '../types/scheme'
import { gstOnPrincipal } from './chequeGst'

/** Cheque share of the split base (A for land, D for construction) must be ≥ 50%. */
export const MIN_CHEQUE_PERCENT = 50

export function clampChequePercent(pct: number): number {
  if (!Number.isFinite(pct)) return MIN_CHEQUE_PERCENT
  return Math.min(100, Math.max(MIN_CHEQUE_PERCENT, pct))
}

export type LandAmountBases = {
  /** Basic + road premium + garden premium (cash/cheque split applies only here) */
  A: number
  /** Always 100% cash — not part of the % split */
  development: number
  /** EMI schedule base = A + development */
  V: number
}

/**
 * Land bases: A = basic + premiums; development stays cash-only; V = A + development.
 * Falls back when older bookings lack premium breakdowns.
 */
export function landAmountBases(land: {
  basicAmount?: number | null
  roadPremiumAmount?: number | null
  gardenPremiumAmount?: number | null
  developmentChargeAmount?: number | null
  totalValue?: number | null
}): LandAmountBases {
  const basic = Math.max(0, Math.round(Number(land.basicAmount) || 0))
  const road = Math.max(0, Math.round(Number(land.roadPremiumAmount) || 0))
  const garden = Math.max(0, Math.round(Number(land.gardenPremiumAmount) || 0))
  const development = Math.max(
    0,
    Math.round(Number(land.developmentChargeAmount) || 0),
  )
  const total = Math.max(0, Math.round(Number(land.totalValue) || 0))

  let A = basic + road + garden
  if (A <= 0 && total > 0) {
    A = Math.max(0, total - development)
  }
  const V = total > 0 ? total : A + development
  return { A, development, V }
}

export type DealPayableSplit = {
  /** Amount the % split applies to (A or D) */
  splitBase: number
  development: number
  /** Cash portion of split base (X or K) */
  cashOnSplit: number
  /** Cheque principal of split base (Y or L) */
  chequeBase: number
  /** Total cash target incl. development when land (Z or K) */
  cashAmount: number
  chequeGst: number
  chequeTotal: number
  chequePercent: number
  cashPercent: number
  /** EMI / plan amount ex-GST (V or D) */
  planAmount: number
  payableTotal: number
}

function payableFromSplitBase(
  splitBase: number,
  developmentCash: number,
  chequePercent: number,
  gstPct = Number(FIXED_CHEQUE_GST_PERCENT) || 5,
): DealPayableSplit {
  const base = Math.max(0, Math.round(splitBase))
  const development = Math.max(0, Math.round(developmentCash))
  const chequePct = clampChequePercent(chequePercent)
  const cashPct = 100 - chequePct
  const chequeBase = Math.round((base * chequePct) / 100)
  const cashOnSplit = Math.max(0, base - chequeBase)
  const cashAmount = cashOnSplit + development
  const chequeGst = gstOnPrincipal(chequeBase, gstPct)
  const chequeTotal = chequeBase + chequeGst
  const planAmount = base + development
  return {
    splitBase: base,
    development,
    cashOnSplit,
    chequeBase,
    cashAmount,
    chequeGst,
    chequeTotal,
    chequePercent: chequePct,
    cashPercent: cashPct,
    planAmount,
    payableTotal: chequeTotal + cashAmount,
  }
}

/** Land: % split on A only; development → cash; EMI base V = A + development. */
export function landCashChequeSplit(
  land: {
    basicAmount?: number | null
    roadPremiumAmount?: number | null
    gardenPremiumAmount?: number | null
    developmentChargeAmount?: number | null
    totalValue?: number | null
  },
  chequePercent: number,
  gstPct = Number(FIXED_CHEQUE_GST_PERCENT) || 5,
): DealPayableSplit {
  const { A, development, V } = landAmountBases(land)
  const split = payableFromSplitBase(A, development, chequePercent, gstPct)
  // Prefer stored totalValue as plan amount when present (matches EMI schedule)
  return { ...split, planAmount: V > 0 ? V : split.planAmount }
}

/** Construction: % split on full D; EMI base = D. */
export function constructionCashChequeSplit(
  totalValue: number,
  chequePercent: number,
  gstPct = Number(FIXED_CHEQUE_GST_PERCENT) || 5,
): DealPayableSplit {
  return payableFromSplitBase(
    Math.max(0, Math.round(totalValue)),
    0,
    chequePercent,
    gstPct,
  )
}
