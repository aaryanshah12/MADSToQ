import { browserStorage } from './storage'
import type {
  InstallmentRecord,
  PaymentPlanRecord,
  PaymentReceiptRecord,
} from '../types/payments'

const PLAN_KEY = 'plotcrm.paymentPlans.v1'
const INST_KEY = 'plotcrm.installments.v1'
const RCPT_KEY = 'plotcrm.paymentReceipts.v1'

function load<T>(key: string): T[] {
  try {
    const raw = browserStorage()?.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as T[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function loadPaymentPlans(): PaymentPlanRecord[] {
  return load<PaymentPlanRecord>(PLAN_KEY).map((p) => ({
    ...p,
    constructionStartDate: p.constructionStartDate ?? '',
  }))
}

export function savePaymentPlans(rows: PaymentPlanRecord[]): void {
  browserStorage()?.setItem(PLAN_KEY, JSON.stringify(rows))
}

export function loadInstallments(): InstallmentRecord[] {
  return load(INST_KEY)
}

export function saveInstallments(rows: InstallmentRecord[]): void {
  browserStorage()?.setItem(INST_KEY, JSON.stringify(rows))
}

export function loadReceipts(): PaymentReceiptRecord[] {
  return load<PaymentReceiptRecord>(RCPT_KEY).map((r) => ({
    ...r,
    gstAmount: Math.max(0, Math.round(Number(r.gstAmount) || 0)),
  }))
}

export function saveReceipts(rows: PaymentReceiptRecord[]): void {
  browserStorage()?.setItem(RCPT_KEY, JSON.stringify(rows))
}
