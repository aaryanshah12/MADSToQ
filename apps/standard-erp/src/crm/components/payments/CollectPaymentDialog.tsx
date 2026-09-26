import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { formatCurrency } from '../../lib/schemes'
import {
  availableModesForQuota,
  defaultModeForQuota,
  remainingForMode,
  type CategoryPaymentQuota,
} from '../../lib/paymentBuckets'
import {
  chequeGstPercent,
  isBankMode,
  maxBankGross,
  splitGrossBankAmount,
} from '../../lib/chequeGst'
import {
  CATEGORY_LABELS,
  PAYMENT_MODE_LABELS,
  type InstallmentRecord,
  type PaymentInstrumentDetails,
  type PaymentMode,
} from '../../types/payments'
import { todayISO, type BookingRecord } from '../../types/sales'
import { Button, Field, Input, Select, Textarea } from '../ui/Form'
import { TokenCollectedNote } from './TokenCollectedNote'

function formatDueDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const emptyInstrument = (): PaymentInstrumentDetails => ({
  chequeNumber: '',
  chequeDate: '',
  bankName: '',
  branchName: '',
  upiTxnId: '',
  upiId: '',
  utrNumber: '',
  transferDate: '',
  referenceNo: '',
})

export type CollectPaymentSubmit = {
  installmentId: string
  /** EMI principal */
  amount: number
  /** GST (bank modes); 0 for cash */
  gstAmount: number
  paidOn: string
  mode: PaymentMode
  instrument: PaymentInstrumentDetails
  notes: string
}

function maxCollectable(
  balance: number,
  quota: CategoryPaymentQuota,
  mode: PaymentMode,
): number {
  const cap = remainingForMode(quota, mode)
  if (isBankMode(mode)) {
    return maxBankGross({
      principalRoom: balance,
      chequeRemainingGross: cap > 0 ? cap : Number.POSITIVE_INFINITY,
    })
  }
  return Math.max(0, Math.min(balance, cap || balance))
}

export function CollectPaymentDialog({
  open,
  onClose,
  onSubmit,
  booking,
  installment,
  balance,
  propertyLabel,
  overdueDays = 0,
  quota,
  collectedByLabel,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (input: CollectPaymentSubmit) => void
  booking: BookingRecord
  installment: InstallmentRecord
  balance: number
  propertyLabel: string
  overdueDays?: number
  quota: CategoryPaymentQuota
  collectedByLabel?: string
}) {
  const modes = useMemo(() => availableModesForQuota(quota), [quota])
  const [mode, setMode] = useState<PaymentMode>(() =>
    defaultModeForQuota(quota),
  )
  const [amount, setAmount] = useState('')
  const [paidOn, setPaidOn] = useState(todayISO())
  const [instrument, setInstrument] =
    useState<PaymentInstrumentDetails>(emptyInstrument)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const gstPct = chequeGstPercent()
  const bank = isBankMode(mode)
  const payableMax = maxCollectable(balance, quota, mode)
  const entered = Math.round(Number(amount) || 0)
  const split = bank
    ? splitGrossBankAmount(entered, gstPct)
    : { principal: entered, gst: 0, gross: entered }

  const patchInstrument = (patch: Partial<PaymentInstrumentDetails>) => {
    setInstrument((prev) => ({ ...prev, ...patch }))
  }

  useEffect(() => {
    if (!open) return
    const nextMode = modes.includes(defaultModeForQuota(quota))
      ? defaultModeForQuota(quota)
      : modes[0] || 'cash'
    const nextMax = maxCollectable(balance, quota, nextMode)
    const today = todayISO()
    setMode(nextMode)
    setAmount(nextMax > 0 ? String(nextMax) : '')
    setPaidOn(today)
    setInstrument({
      ...emptyInstrument(),
      chequeDate: today,
      transferDate: today,
    })
    setNotes('')
    setError(null)
  }, [open, balance, installment.id, quota, modes])

  useEffect(() => {
    if (!open) return
    if (!modes.includes(mode)) {
      const next = modes[0] || 'cash'
      setMode(next)
      const nextMax = maxCollectable(balance, quota, next)
      setAmount(nextMax > 0 ? String(nextMax) : '')
    }
  }, [modes, mode, open, quota, balance])

  if (!open) return null

  const chequeDone = quota.chequeRemaining <= 0
  const chequeLeft = splitGrossBankAmount(quota.chequeRemaining)
  const cashDone = quota.cashRemaining <= 0

  const handleModeChange = (next: PaymentMode) => {
    setMode(next)
    const nextMax = maxCollectable(balance, quota, next)
    setAmount(nextMax > 0 ? String(nextMax) : '')
    setError(null)
  }

  const validateInstrument = (): string | null => {
    if (mode === 'cash') return null
    if (mode === 'cheque') {
      if (!instrument.chequeNumber?.trim()) return 'Enter cheque number'
      if (!instrument.chequeDate?.trim()) return 'Enter cheque date'
      if (!instrument.bankName?.trim()) return 'Enter bank name'
      return null
    }
    if (mode === 'upi') {
      if (!instrument.upiTxnId?.trim()) return 'Enter UPI transaction ID'
      return null
    }
    if (mode === 'neft') {
      if (!instrument.utrNumber?.trim()) return 'Enter UTR / reference number'
      return null
    }
    if (mode === 'other') {
      if (!instrument.referenceNo?.trim()) return 'Enter payment reference'
      return null
    }
    return null
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!Number.isFinite(entered) || entered <= 0) {
      setError('Enter a valid payment amount')
      return
    }
    if (entered > payableMax) {
        setError(
        bank
          ? `Max for this mode is ${formatCurrency(payableMax)} (EMI + ${gstPct}% GST, cheque quota)`
          : `Amount can’t exceed ${formatCurrency(payableMax)}`,
      )
      return
    }
    if (split.principal > balance) {
      setError(
        `EMI credit can’t exceed installment balance ${formatCurrency(balance)}`,
      )
      return
    }
    const instrumentError = validateInstrument()
    if (instrumentError) {
      setError(instrumentError)
      return
    }
    setError(null)
    onSubmit({
      installmentId: installment.id,
      amount: split.principal,
      gstAmount: split.gst,
      paidOn,
      mode,
      instrument:
        mode === 'cash'
          ? {}
          : {
              chequeNumber: instrument.chequeNumber?.trim(),
              chequeDate: instrument.chequeDate?.trim(),
              bankName: instrument.bankName?.trim(),
              branchName: instrument.branchName?.trim(),
              upiTxnId: instrument.upiTxnId?.trim(),
              upiId: instrument.upiId?.trim(),
              utrNumber: instrument.utrNumber?.trim(),
              transferDate: instrument.transferDate?.trim(),
              referenceNo: instrument.referenceNo?.trim(),
            },
      notes,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-line bg-surface shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
              Collect payment
            </p>
            <h2 className="mt-1 font-display text-2xl text-ink">
              {booking.customerName}
            </h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              {booking.bookingCode} · {propertyLabel}
            </p>
            <p className="mt-1 text-xs text-ink-faint">
              {installment.label} · {CATEGORY_LABELS[installment.category]} · due{' '}
              {formatDueDate(installment.dueDate)}
              {overdueDays > 0 && (
                <span className="ml-1 font-semibold text-danger">
                  · {overdueDays}d overdue
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-2"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <p className="text-[11px] uppercase tracking-wide text-ink-faint">
              EMI balance
            </p>
            <p className="text-lg font-semibold tabular-nums text-warn">
              {formatCurrency(balance)}
            </p>
          </div>
        </div>

        {Number(booking.bookingAmount) > 0 ? (
          <div className="border-b border-line px-5 py-2.5">
            <TokenCollectedNote
              amount={Number(booking.bookingAmount) || 0}
              mode={booking.bookingAmountMode}
              compact
            />
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-px border-b border-line bg-line">
          <div className="bg-surface px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              Cheque / UPI / NEFT · {quota.chequePercent}%
            </p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-ink">
              {formatCurrency(chequeLeft.principal)}
              <span className="font-normal text-ink-muted"> excl. GST</span>
            </p>
            <p className="text-sm font-semibold tabular-nums text-ink">
              + {formatCurrency(chequeLeft.gst)}
              <span className="font-normal text-ink-muted"> GST</span>
            </p>
            <p className="text-[11px] text-ink-faint">
              of {formatCurrency(quota.chequeBaseTarget)} excl. GST +{' '}
              {formatCurrency(quota.chequeGstTarget)} GST
              {chequeDone ? ' · complete' : ''}
            </p>
          </div>
          <div className="bg-surface px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              Cash · {quota.cashPercent}%
            </p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-ink">
              {formatCurrency(quota.cashRemaining)}
              <span className="font-normal text-ink-muted"> left</span>
            </p>
            <p className="text-[11px] text-ink-faint">
              of {formatCurrency(quota.cashTarget)}
              {cashDone ? ' · complete' : ''}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <Field label="Mode" required>
            <Select
              value={mode}
              onChange={(e) => handleModeChange(e.target.value as PaymentMode)}
            >
              {modes.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_MODE_LABELS[m]}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label={
              bank
                ? `Amount to collect (₹) · incl. ${gstPct}% GST`
                : 'Amount (₹)'
            }
            required
            hint={
              bank
                ? 'Bank modes: enter what the client pays (EMI + GST)'
                : 'Cash — no GST'
            }
          >
            <Input
              type="number"
              min="1"
              max={payableMax}
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
            <div className="mt-1.5 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md bg-surface-2 px-2 py-1 text-[11px] font-semibold text-ink-muted hover:text-ink"
                onClick={() => setAmount(String(payableMax))}
              >
                Max {formatCurrency(payableMax)}
              </button>
              {payableMax >= 2 && (
                <button
                  type="button"
                  className="rounded-md bg-surface-2 px-2 py-1 text-[11px] font-semibold text-ink-muted hover:text-ink"
                  onClick={() =>
                    setAmount(String(Math.floor(payableMax / 2)))
                  }
                >
                  Half
                </button>
              )}
            </div>
            {entered > 0 && (
              <div className="mt-2 rounded-lg bg-surface-2/70 px-3 py-2 text-xs text-ink-muted">
                <div className="flex justify-between gap-2">
                  <span>Toward EMI</span>
                  <span className="tabular-nums font-medium text-ink">
                    {formatCurrency(split.principal)}
                  </span>
                </div>
                {bank && (
                  <div className="mt-1 flex justify-between gap-2">
                    <span>GST {gstPct}%</span>
                    <span className="tabular-nums font-medium text-ink">
                      {formatCurrency(split.gst)}
                    </span>
                  </div>
                )}
                <div className="mt-1 flex justify-between gap-2 border-t border-line pt-1 font-semibold text-ink">
                  <span>Take</span>
                  <span className="tabular-nums">
                    {formatCurrency(entered)}
                  </span>
                </div>
              </div>
            )}
          </Field>

          <Field label="Paid on" required>
            <Input
              type="date"
              value={paidOn}
              onChange={(e) => setPaidOn(e.target.value)}
            />
          </Field>

          {collectedByLabel && (
            <Field label="Collected by" hint="From signed-in user">
              <Input value={collectedByLabel} disabled readOnly />
            </Field>
          )}

          {mode === 'cheque' && (
            <>
              <Field label="Cheque number" required>
                <Input
                  value={instrument.chequeNumber}
                  onChange={(e) =>
                    patchInstrument({ chequeNumber: e.target.value })
                  }
                />
              </Field>
              <Field label="Cheque date" required>
                <Input
                  type="date"
                  value={instrument.chequeDate}
                  onChange={(e) =>
                    patchInstrument({ chequeDate: e.target.value })
                  }
                />
              </Field>
              <Field label="Bank name" required>
                <Input
                  value={instrument.bankName}
                  onChange={(e) =>
                    patchInstrument({ bankName: e.target.value })
                  }
                />
              </Field>
              <Field label="Branch">
                <Input
                  value={instrument.branchName}
                  onChange={(e) =>
                    patchInstrument({ branchName: e.target.value })
                  }
                />
              </Field>
            </>
          )}

          {mode === 'upi' && (
            <>
              <Field label="UPI transaction ID" required>
                <Input
                  value={instrument.upiTxnId}
                  onChange={(e) =>
                    patchInstrument({ upiTxnId: e.target.value })
                  }
                />
              </Field>
              <Field label="Payer UPI ID">
                <Input
                  value={instrument.upiId}
                  onChange={(e) => patchInstrument({ upiId: e.target.value })}
                />
              </Field>
            </>
          )}

          {mode === 'neft' && (
            <>
              <Field label="UTR / reference" required>
                <Input
                  value={instrument.utrNumber}
                  onChange={(e) =>
                    patchInstrument({ utrNumber: e.target.value })
                  }
                />
              </Field>
              <Field label="Transfer date">
                <Input
                  type="date"
                  value={instrument.transferDate}
                  onChange={(e) =>
                    patchInstrument({ transferDate: e.target.value })
                  }
                />
              </Field>
              <Field label="Bank">
                <Input
                  value={instrument.bankName}
                  onChange={(e) =>
                    patchInstrument({ bankName: e.target.value })
                  }
                />
              </Field>
            </>
          )}

          {mode === 'other' && (
            <>
              <Field label="Reference number" required>
                <Input
                  value={instrument.referenceNo}
                  onChange={(e) =>
                    patchInstrument({ referenceNo: e.target.value })
                  }
                />
              </Field>
              <Field label="Bank / source">
                <Input
                  value={instrument.bankName}
                  onChange={(e) =>
                    patchInstrument({ bankName: e.target.value })
                  }
                />
              </Field>
            </>
          )}

          <Field label="Notes">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              rows={2}
            />
          </Field>

          {error && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={split.principal <= 0}>
              Record {entered > 0 ? formatCurrency(entered) : 'payment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
