import type { InstallmentRecord, PaymentMode } from '../types/payments'
import type { CategoryPaymentQuota } from './paymentBuckets'
import { modeToBucket, remainingForMode } from './paymentBuckets'
import {
  chequeGstPercent,
  distributeGst,
  grossFromPrincipal,
  isBankMode,
  maxPrincipalForGrossCap,
  splitGrossBankAmount,
} from './chequeGst'

export type AllocationStopReason = 'none' | 'amount' | 'quota'

export type LumpSumAllocation = {
  installmentId: string
  label: string
  category: InstallmentRecord['category']
  dueDate: string
  /** EMI principal credited */
  amount: number
  /** GST on this allocation (bank modes only) */
  gstAmount: number
  balanceBefore: number
  /** Why this line stopped short of the full EMI balance (if partial) */
  limitedBy: 'none' | 'amount' | 'quota'
}

export type LumpSumResult = {
  allocations: LumpSumAllocation[]
  /** Sum of EMI principals */
  principalTotal: number
  /** Sum of GST */
  gstTotal: number
  /** What the client pays (principal + GST) */
  grossTotal: number
  /** Unallocated portion of the input amount (gross for bank, principal for cash) */
  unallocated: number
  landStopReason: AllocationStopReason
  constructionStopReason: AllocationStopReason
  modeBucket: 'cheque' | 'cash'
}

type AllocDraft = Omit<LumpSumAllocation, 'gstAmount'>

type BudgetResult = {
  allocations: AllocDraft[]
  landStopReason: AllocationStopReason
  constructionStopReason: AllocationStopReason
}

function emptyResult(mode: PaymentMode): LumpSumResult {
  return {
    allocations: [],
    principalTotal: 0,
    gstTotal: 0,
    grossTotal: 0,
    unallocated: 0,
    landStopReason: 'none',
    constructionStopReason: 'none',
    modeBucket: modeToBucket(mode),
  }
}

function bucketCap(quota: CategoryPaymentQuota, mode: PaymentMode): number {
  const rem = remainingForMode(quota, mode)
  if (
    rem <= 0 &&
    quota.chequeRemaining <= 0 &&
    quota.cashRemaining <= 0
  ) {
    return Number.POSITIVE_INFINITY
  }
  return rem
}

function sortedInstallments(installments: InstallmentRecord[]) {
  return [...installments].sort((a, b) => {
    if (a.dueDate !== b.dueDate) {
      return a.dueDate < b.dueDate ? -1 : 1
    }
    if (a.category !== b.category) {
      return a.category === 'land' ? -1 : 1
    }
    return a.sequence - b.sequence
  })
}

function resolveCategoryStop(
  category: InstallmentRecord['category'],
  allocations: AllocDraft[],
  installments: InstallmentRecord[],
  paidMap: Map<string, number>,
  leftPrincipal: number,
  capLeft: number,
  quotaWasHit: boolean,
): AllocationStopReason {
  const unpaidLeft = installments.some((inst) => {
    if (inst.category !== category) return false
    const paid = paidMap.get(inst.id) || 0
    return Math.round(inst.amount) - Math.round(paid) > 0
  })
  const last = [...allocations].reverse().find((a) => a.category === category)
  const lastPartial = last && last.amount < last.balanceBefore

  if (!unpaidLeft && !lastPartial) return 'none'
  if (quotaWasHit || (lastPartial && last.limitedBy === 'quota') || capLeft <= 0) {
    return 'quota'
  }
  if (leftPrincipal <= 0 || (lastPartial && last.limitedBy === 'amount')) {
    return 'amount'
  }
  if (unpaidLeft) {
    // Skipped remaining EMIs because quota was already 0
    return quotaWasHit || capLeft <= 0 ? 'quota' : 'amount'
  }
  return 'none'
}

/** Allocate a principal budget across EMIs; bank modes burn gross (principal+GST) from quotas. */
function allocatePrincipalBudget(input: {
  principalBudget: number
  mode: PaymentMode
  installments: InstallmentRecord[]
  landQuota: CategoryPaymentQuota
  constructionQuota: CategoryPaymentQuota
}): BudgetResult {
  const gstPct = chequeGstPercent()
  const bank = isBankMode(input.mode)
  let leftPrincipal = Math.max(0, Math.round(input.principalBudget))
  if (leftPrincipal <= 0) {
    return {
      allocations: [],
      landStopReason: 'none',
      constructionStopReason: 'none',
    }
  }

  let landCap = bucketCap(input.landQuota, input.mode)
  let constructionCap = bucketCap(input.constructionQuota, input.mode)
  let landQuotaHit = false
  let constructionQuotaHit = false

  const sorted = sortedInstallments(input.installments)
  const allocations: AllocDraft[] = []
  const paidMap = new Map(sorted.map((i) => [i.id, i.paidAmount]))

  for (const inst of sorted) {
    if (leftPrincipal <= 0) break
    const paid = paidMap.get(inst.id) || 0
    const balance = Math.max(0, Math.round(inst.amount) - Math.round(paid))
    if (balance <= 0) continue

    const isLand = inst.category === 'land'
    const cap = isLand ? landCap : constructionCap
    if (cap <= 0) {
      if (isLand) landQuotaHit = true
      else constructionQuotaHit = true
      continue
    }

    const maxPrincipalFromCap = bank
      ? maxPrincipalForGrossCap(cap, gstPct)
      : Math.floor(cap)

    const pay = Math.min(balance, leftPrincipal, maxPrincipalFromCap)
    if (pay <= 0) {
      if (maxPrincipalFromCap <= 0) {
        if (isLand) landQuotaHit = true
        else constructionQuotaHit = true
      }
      continue
    }

    let limitedBy: LumpSumAllocation['limitedBy'] = 'none'
    if (pay < balance) {
      // Binding constraint: whichever min() equalled pay first by priority
      if (pay === maxPrincipalFromCap && maxPrincipalFromCap <= leftPrincipal) {
        limitedBy = 'quota'
        if (isLand) landQuotaHit = true
        else constructionQuotaHit = true
      } else {
        limitedBy = 'amount'
      }
    }

    const cost = bank ? grossFromPrincipal(pay, gstPct) : pay

    allocations.push({
      installmentId: inst.id,
      label: inst.label,
      category: inst.category,
      dueDate: inst.dueDate,
      amount: pay,
      balanceBefore: balance,
      limitedBy,
    })
    leftPrincipal -= pay
    paidMap.set(inst.id, paid + pay)
    if (isLand) {
      landCap -= cost
      if (landCap <= 0) landQuotaHit = true
    } else {
      constructionCap -= cost
      if (constructionCap <= 0) constructionQuotaHit = true
    }
  }

  return {
    allocations,
    landStopReason: resolveCategoryStop(
      'land',
      allocations,
      input.installments,
      paidMap,
      leftPrincipal,
      landCap,
      landQuotaHit,
    ),
    constructionStopReason: resolveCategoryStop(
      'construction',
      allocations,
      input.installments,
      paidMap,
      leftPrincipal,
      constructionCap,
      constructionQuotaHit,
    ),
  }
}

function withGstAmounts(
  allocations: AllocDraft[],
  gstTotal: number,
): LumpSumAllocation[] {
  const gstParts = distributeGst(
    allocations.map((a) => a.amount),
    gstTotal,
  )
  return allocations.map((a, i) => ({
    ...a,
    gstAmount: gstParts[i] || 0,
  }))
}

/**
 * Spread a lump-sum across unpaid EMIs by due date (oldest first).
 * Same due date: land before construction.
 *
 * Cash: `amount` is principal (no GST).
 * Bank modes: `amount` is GST-inclusive; EMI gets principal only; GST is separate.
 */
export function allocateLumpSum(input: {
  amount: number
  mode: PaymentMode
  installments: InstallmentRecord[]
  landQuota: CategoryPaymentQuota
  constructionQuota: CategoryPaymentQuota
}): LumpSumResult {
  const gstPct = chequeGstPercent()
  const bank = isBankMode(input.mode)
  const modeBucket = modeToBucket(input.mode)
  const raw = Math.max(0, Math.round(input.amount))
  if (raw <= 0) return emptyResult(input.mode)

  const peeled = bank
    ? splitGrossBankAmount(raw, gstPct)
    : { principal: raw, gst: 0, gross: raw }

  const budget = allocatePrincipalBudget({
    principalBudget: peeled.principal,
    mode: input.mode,
    installments: input.installments,
    landQuota: input.landQuota,
    constructionQuota: input.constructionQuota,
  })

  const principalTotal = budget.allocations.reduce((s, a) => s + a.amount, 0)
  const fullyApplied = principalTotal === peeled.principal

  // When the full peeled principal is applied, GST must match the user's entered
  // take exactly (avoid per-line round(GST) drift rewriting ₹15,75,000 → ₹15,74,997).
  const gstTotal = bank
    ? fullyApplied
      ? peeled.gst
      : budget.allocations.reduce(
          (s, a) => s + (grossFromPrincipal(a.amount, gstPct) - a.amount),
          0,
        )
    : 0

  const allocations = withGstAmounts(budget.allocations, gstTotal)
  const allocatedGst = allocations.reduce((s, a) => s + a.gstAmount, 0)
  const grossTotal = bank
    ? fullyApplied
      ? raw
      : principalTotal + allocatedGst
    : principalTotal
  const unallocated = bank
    ? Math.max(0, raw - grossTotal)
    : Math.max(0, raw - principalTotal)

  return {
    allocations,
    principalTotal,
    gstTotal: allocatedGst,
    grossTotal,
    unallocated,
    landStopReason: budget.landStopReason,
    constructionStopReason: budget.constructionStopReason,
    modeBucket,
  }
}

/** Max amount the client can pay in this mode (gross for bank, principal for cash). */
export function totalCollectibleForMode(input: {
  mode: PaymentMode
  installments: InstallmentRecord[]
  landQuota: CategoryPaymentQuota
  constructionQuota: CategoryPaymentQuota
}): number {
  const bank = isBankMode(input.mode)
  const gstPct = chequeGstPercent()
  const raw = allocatePrincipalBudget({
    principalBudget: Number.MAX_SAFE_INTEGER,
    mode: input.mode,
    installments: input.installments,
    landQuota: input.landQuota,
    constructionQuota: input.constructionQuota,
  })
  if (!bank) {
    return raw.allocations.reduce((s, a) => s + a.amount, 0)
  }
  return raw.allocations.reduce(
    (s, a) => s + grossFromPrincipal(a.amount, gstPct),
    0,
  )
}
