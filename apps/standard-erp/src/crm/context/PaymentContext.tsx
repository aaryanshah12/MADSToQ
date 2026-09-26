import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type {
  InstallmentRecord,
  InstallmentStatus,
  PaymentInstrumentDetails,
  PaymentMode,
  PaymentPlanRecord,
  PaymentReceiptRecord,
  PlanDuration,
} from '../types/payments'
import {
  buildInstallments,
  instrumentReference,
  monthsForPlan,
} from '../types/payments'
import {
  loadInstallments,
  loadPaymentPlans,
  loadReceipts,
  saveInstallments,
  savePaymentPlans,
  saveReceipts,
} from '../lib/payments'
import { uid } from '../lib/schemes'

interface CreatePlanInput {
  bookingId: string
  planDuration: PlanDuration
  customMonths: number
  /** Construction EMI count; defaults to land months when omitted */
  constructionMonths?: number
  landAmount: number
  constructionAmount: number
  /** Booking token deducted from first installment(s) */
  bookingCredit?: number
  startDate: string
  constructionStartDate?: string
}

interface RecordPaymentInput {
  installmentId: string
  /** EMI principal credited */
  amount: number
  /** GST on bank modes (0 for cash) */
  gstAmount?: number
  paidOn: string
  mode: PaymentMode
  reference?: string
  instrument?: PaymentInstrumentDetails
  notes?: string
  collectedByUserId?: string
  collectedByName?: string
  collectedByRole?: string
}

interface RecordLumpSumInput {
  bookingId: string
  allocations: { installmentId: string; amount: number; gstAmount?: number }[]
  paidOn: string
  mode: PaymentMode
  reference?: string
  instrument?: PaymentInstrumentDetails
  notes?: string
  collectedByUserId?: string
  collectedByName?: string
  collectedByRole?: string
}

interface PaymentContextValue {
  plans: PaymentPlanRecord[]
  installments: InstallmentRecord[]
  receipts: PaymentReceiptRecord[]
  getPlanByBooking: (bookingId: string) => PaymentPlanRecord | undefined
  getInstallmentsByBooking: (bookingId: string) => InstallmentRecord[]
  getReceiptsByBooking: (bookingId: string) => PaymentReceiptRecord[]
  createPlan: (input: CreatePlanInput) => PaymentPlanRecord
  /** Add/replace unpaid construction EMIs without wiping paid land or receipts. */
  ensureConstructionSchedule: (input: CreatePlanInput) => PaymentPlanRecord | null
  deletePlanForBooking: (bookingId: string) => void
  recordPayment: (input: RecordPaymentInput) => PaymentReceiptRecord
  recordLumpSum: (input: RecordLumpSumInput) => PaymentReceiptRecord[]
}

const PaymentContext = createContext<PaymentContextValue | null>(null)

export function PaymentProvider({ children }: { children: ReactNode }) {
  const [plans, setPlans] = useState<PaymentPlanRecord[]>([])
  const [installments, setInstallments] = useState<InstallmentRecord[]>([])
  const [receipts, setReceipts] = useState<PaymentReceiptRecord[]>([])

  useEffect(() => {
    setPlans(loadPaymentPlans())
    setInstallments(loadInstallments())
    setReceipts(loadReceipts())
  }, [])

  const getPlanByBooking = useCallback(
    (bookingId: string) => plans.find((p) => p.bookingId === bookingId),
    [plans],
  )

  const getInstallmentsByBooking = useCallback(
    (bookingId: string) =>
      installments
        .filter((i) => i.bookingId === bookingId)
        .sort((a, b) => {
          if (a.category !== b.category) {
            return a.category === 'land' ? -1 : 1
          }
          return a.sequence - b.sequence
        }),
    [installments],
  )

  const getReceiptsByBooking = useCallback(
    (bookingId: string) =>
      receipts
        .filter((r) => r.bookingId === bookingId)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    [receipts],
  )

  const createPlan = useCallback(
    (input: CreatePlanInput): PaymentPlanRecord => {
      const now = new Date().toISOString()
      const months = monthsForPlan(input.planDuration, input.customMonths)
      const constructionMonths = Math.max(
        1,
        Math.floor(input.constructionMonths ?? months) || months,
      )
      const constructionStartDate =
        input.constructionStartDate?.trim() || ''
      const plan: PaymentPlanRecord = {
        id: uid(),
        bookingId: input.bookingId,
        planDuration: input.planDuration,
        customMonths: months,
        constructionMonths,
        landAmount: input.landAmount,
        constructionAmount: input.constructionAmount,
        bookingCredit: input.bookingCredit ?? 0,
        startDate: input.startDate,
        constructionStartDate,
        createdAt: now,
        updatedAt: now,
      }

      const nextInstallments = buildInstallments({
        planId: plan.id,
        bookingId: input.bookingId,
        landAmount: input.landAmount,
        constructionAmount: input.constructionAmount,
        months,
        constructionMonths,
        bookingCredit: input.bookingCredit ?? 0,
        startDate: input.startDate,
        constructionStartDate: constructionStartDate || undefined,
        uid,
      })

      const nextPlans = [
        plan,
        ...plans.filter((p) => p.bookingId !== input.bookingId),
      ]
      const nextInst = [
        ...nextInstallments,
        ...installments.filter((i) => i.bookingId !== input.bookingId),
      ]
      const nextReceipts = receipts.filter(
        (r) => r.bookingId !== input.bookingId,
      )

      setPlans(nextPlans)
      setInstallments(nextInst)
      setReceipts(nextReceipts)
      savePaymentPlans(nextPlans)
      saveInstallments(nextInst)
      saveReceipts(nextReceipts)
      return plan
    },
    [installments, plans, receipts],
  )

  const ensureConstructionSchedule = useCallback(
    (input: CreatePlanInput): PaymentPlanRecord | null => {
      const constructionAmount = Math.max(
        0,
        Math.round(Number(input.constructionAmount) || 0),
      )
      const bookingInst = installments.filter(
        (i) => i.bookingId === input.bookingId,
      )
      const hasAnyPaid = bookingInst.some((i) => i.paidAmount > 0)
      const constructionPaid = bookingInst.some(
        (i) => i.category === 'construction' && i.paidAmount > 0,
      )

      // Nothing paid yet — safe to rebuild the full plan
      if (!hasAnyPaid) {
        if (constructionAmount <= 0 && input.landAmount <= 0) return null
        return createPlan(input)
      }

      // Construction already collected — don't rewrite those EMIs
      if (constructionPaid) return null

      const months = monthsForPlan(input.planDuration, input.customMonths)
      const constructionMonths = Math.max(
        1,
        Math.floor(input.constructionMonths ?? months) || months,
      )
      const constructionStartDate =
        input.constructionStartDate?.trim() || input.startDate
      const now = new Date().toISOString()

      const existingPlan = plans.find((p) => p.bookingId === input.bookingId)
      const plan: PaymentPlanRecord = existingPlan
        ? {
            ...existingPlan,
            constructionMonths,
            constructionAmount,
            landAmount: input.landAmount || existingPlan.landAmount,
            constructionStartDate,
            updatedAt: now,
          }
        : {
            id: uid(),
            bookingId: input.bookingId,
            planDuration: input.planDuration,
            customMonths: months,
            constructionMonths,
            landAmount: input.landAmount,
            constructionAmount,
            bookingCredit: input.bookingCredit ?? 0,
            startDate: input.startDate,
            constructionStartDate,
            createdAt: now,
            updatedAt: now,
          }

      const landRows = bookingInst.filter((i) => i.category === 'land')
      const constructionRows =
        constructionAmount > 0
          ? buildInstallments({
              planId: plan.id,
              bookingId: input.bookingId,
              landAmount: 0,
              constructionAmount,
              months: 1,
              constructionMonths,
              // Token already applied on land when payments started
              bookingCredit: 0,
              startDate: input.startDate,
              constructionStartDate,
              uid,
            }).filter((i) => i.category === 'construction')
          : []

      const nextInst = [
        ...landRows.map((i) => ({ ...i, planId: plan.id })),
        ...constructionRows,
        ...installments.filter((i) => i.bookingId !== input.bookingId),
      ]
      const nextPlans = [
        plan,
        ...plans.filter((p) => p.bookingId !== input.bookingId),
      ]

      setPlans(nextPlans)
      setInstallments(nextInst)
      savePaymentPlans(nextPlans)
      saveInstallments(nextInst)
      return plan
    },
    [createPlan, installments, plans],
  )

  const deletePlanForBooking = useCallback(
    (bookingId: string) => {
      const nextPlans = plans.filter((p) => p.bookingId !== bookingId)
      const nextInst = installments.filter((i) => i.bookingId !== bookingId)
      const nextReceipts = receipts.filter((r) => r.bookingId !== bookingId)
      setPlans(nextPlans)
      setInstallments(nextInst)
      setReceipts(nextReceipts)
      savePaymentPlans(nextPlans)
      saveInstallments(nextInst)
      saveReceipts(nextReceipts)
    },
    [installments, plans, receipts],
  )

  const recordPayment = useCallback(
    (input: RecordPaymentInput): PaymentReceiptRecord => {
      const installment = installments.find((i) => i.id === input.installmentId)
      if (!installment) throw new Error('Installment not found')

      const remaining = Math.max(0, installment.amount - installment.paidAmount)
      const pay = Math.min(input.amount, remaining)
      if (pay <= 0) throw new Error('Nothing due on this installment')

      const paidAmount = installment.paidAmount + pay
      const status: InstallmentStatus =
        paidAmount >= installment.amount
          ? 'paid'
          : paidAmount > 0
            ? 'partial'
            : 'pending'

      const nextInst = installments.map((i) =>
        i.id === installment.id ? { ...i, paidAmount, status } : i,
      )

      const instrument = input.instrument
      const reference =
        input.reference?.trim() ||
        instrumentReference(input.mode, instrument) ||
        ''

      const receipt: PaymentReceiptRecord = {
        id: uid(),
        bookingId: installment.bookingId,
        planId: installment.planId,
        installmentId: installment.id,
        category: installment.category,
        amount: pay,
        gstAmount: Math.max(0, Math.round(Number(input.gstAmount) || 0)),
        paidOn: input.paidOn,
        mode: input.mode,
        reference,
        instrument: instrument || undefined,
        notes: input.notes?.trim() || '',
        collectedByUserId: input.collectedByUserId,
        collectedByName: input.collectedByName,
        collectedByRole: input.collectedByRole,
        createdAt: new Date().toISOString(),
      }

      const nextReceipts = [receipt, ...receipts]
      setInstallments(nextInst)
      setReceipts(nextReceipts)
      saveInstallments(nextInst)
      saveReceipts(nextReceipts)
      return receipt
    },
    [installments, receipts],
  )

  const recordLumpSum = useCallback(
    (input: RecordLumpSumInput): PaymentReceiptRecord[] => {
      if (!input.allocations.length) {
        throw new Error('Nothing to allocate')
      }

      let nextInst = [...installments]
      const newReceipts: PaymentReceiptRecord[] = []
      const createdAt = new Date().toISOString()
      const noteBase = input.notes?.trim() || ''
      const lumpNote = noteBase
        ? `Lump sum · ${noteBase}`
        : 'Lump sum payment'

      const instrument = input.instrument
      const reference =
        input.reference?.trim() ||
        instrumentReference(input.mode, instrument) ||
        ''

      for (const alloc of input.allocations) {
        const pay = Math.round(alloc.amount)
        if (pay <= 0) continue

        const installment = nextInst.find((i) => i.id === alloc.installmentId)
        if (!installment || installment.bookingId !== input.bookingId) {
          throw new Error('Installment not found for this booking')
        }

        const remaining = Math.max(
          0,
          installment.amount - installment.paidAmount,
        )
        const applied = Math.min(pay, remaining)
        if (applied <= 0) {
          throw new Error(`Nothing due on ${installment.label}`)
        }

        const paidAmount = installment.paidAmount + applied
        const status: InstallmentStatus =
          paidAmount >= installment.amount
            ? 'paid'
            : paidAmount > 0
              ? 'partial'
              : 'pending'

        nextInst = nextInst.map((i) =>
          i.id === installment.id ? { ...i, paidAmount, status } : i,
        )

        newReceipts.push({
          id: uid(),
          bookingId: installment.bookingId,
          planId: installment.planId,
          installmentId: installment.id,
          category: installment.category,
          amount: applied,
          gstAmount: Math.max(0, Math.round(Number(alloc.gstAmount) || 0)),
          paidOn: input.paidOn,
          mode: input.mode,
          reference,
          instrument: instrument || undefined,
          notes: lumpNote,
          collectedByUserId: input.collectedByUserId,
          collectedByName: input.collectedByName,
          collectedByRole: input.collectedByRole,
          createdAt,
        })
      }

      if (!newReceipts.length) throw new Error('Nothing to allocate')

      const nextReceipts = [...newReceipts, ...receipts]
      setInstallments(nextInst)
      setReceipts(nextReceipts)
      saveInstallments(nextInst)
      saveReceipts(nextReceipts)
      return newReceipts
    },
    [installments, receipts],
  )

  const value = useMemo(
    () => ({
      plans,
      installments,
      receipts,
      getPlanByBooking,
      getInstallmentsByBooking,
      getReceiptsByBooking,
      createPlan,
      ensureConstructionSchedule,
      deletePlanForBooking,
      recordPayment,
      recordLumpSum,
    }),
    [
      plans,
      installments,
      receipts,
      getPlanByBooking,
      getInstallmentsByBooking,
      getReceiptsByBooking,
      createPlan,
      ensureConstructionSchedule,
      deletePlanForBooking,
      recordPayment,
      recordLumpSum,
    ],
  )

  return (
    <PaymentContext.Provider value={value}>{children}</PaymentContext.Provider>
  )
}

export function usePayments() {
  const ctx = useContext(PaymentContext)
  if (!ctx) throw new Error('usePayments must be used within PaymentProvider')
  return ctx
}
