import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { PaymentInstrumentDetails, PaymentMode } from '../types/payments'
import {
  loadOtherPaymentReceipts,
  saveOtherPaymentReceipts,
  type OtherPaymentKind,
  type OtherPaymentReceipt,
} from '../lib/otherPayments'
import { uid } from '../lib/schemes'

export type RecordOtherPaymentInput = {
  bookingId: string
  plotId: string
  schemeId: string
  kind: OtherPaymentKind
  phase?: number | null
  months?: number | null
  principal: number
  gstAmount?: number
  mode: PaymentMode
  paidOn: string
  instrument?: PaymentInstrumentDetails
  notes?: string
  collectedByUserId?: string
  collectedByName?: string
  collectedByRole?: string
}

interface OtherPaymentContextValue {
  receipts: OtherPaymentReceipt[]
  getReceiptsByBooking: (bookingId: string) => OtherPaymentReceipt[]
  recordOtherPayment: (input: RecordOtherPaymentInput) => OtherPaymentReceipt
  deleteOtherPayment: (id: string) => void
}

const OtherPaymentContext = createContext<OtherPaymentContextValue | null>(null)

export function OtherPaymentProvider({ children }: { children: ReactNode }) {
  const [receipts, setReceipts] = useState<OtherPaymentReceipt[]>([])

  useEffect(() => {
    setReceipts(loadOtherPaymentReceipts())
  }, [])

  const persist = useCallback((next: OtherPaymentReceipt[]) => {
    setReceipts(next)
    saveOtherPaymentReceipts(next)
  }, [])

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

  const recordOtherPayment = useCallback(
    (input: RecordOtherPaymentInput): OtherPaymentReceipt => {
      const principal = Math.max(0, Math.round(Number(input.principal) || 0))
      if (principal <= 0) throw new Error('Nothing to collect')
      const gstAmount = Math.max(0, Math.round(Number(input.gstAmount) || 0))
      const phase =
        input.kind === 'runningMaintenance'
          ? Math.max(1, Math.floor(Number(input.phase) || 1))
          : null
      const months =
        input.kind === 'runningMaintenance'
          ? Math.max(1, Math.floor(Number(input.months) || 12))
          : null

      const duplicate = receipts.find((r) => {
        if (r.bookingId !== input.bookingId || r.plotId !== input.plotId) {
          return false
        }
        if (r.kind !== input.kind) return false
        if (input.kind === 'runningMaintenance') {
          return Number(r.phase) === Number(phase)
        }
        return true
      })
      if (duplicate) {
        throw new Error('This other payment is already collected for this plot')
      }

      const row: OtherPaymentReceipt = {
        id: uid(),
        bookingId: input.bookingId,
        plotId: input.plotId,
        schemeId: input.schemeId,
        kind: input.kind,
        phase,
        months,
        principal,
        gstAmount,
        mode: input.mode,
        paidOn: input.paidOn,
        instrument: input.instrument,
        notes: input.notes?.trim() || '',
        collectedByUserId: input.collectedByUserId,
        collectedByName: input.collectedByName,
        collectedByRole: input.collectedByRole,
        createdAt: new Date().toISOString(),
      }
      persist([row, ...receipts])
      return row
    },
    [persist, receipts],
  )

  const deleteOtherPayment = useCallback(
    (id: string) => {
      persist(receipts.filter((r) => r.id !== id))
    },
    [persist, receipts],
  )

  const value = useMemo(
    () => ({
      receipts,
      getReceiptsByBooking,
      recordOtherPayment,
      deleteOtherPayment,
    }),
    [receipts, getReceiptsByBooking, recordOtherPayment, deleteOtherPayment],
  )

  return (
    <OtherPaymentContext.Provider value={value}>
      {children}
    </OtherPaymentContext.Provider>
  )
}

export function useOtherPayments() {
  const ctx = useContext(OtherPaymentContext)
  if (!ctx) {
    throw new Error('useOtherPayments must be used within OtherPaymentProvider')
  }
  return ctx
}
