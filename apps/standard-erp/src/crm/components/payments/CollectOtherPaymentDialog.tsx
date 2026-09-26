import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { formatCurrency, formatNumber } from '../../lib/schemes'
import {
  allowedModesForOtherKind,
  normalizeRunningMonths,
  runningMaintenanceAmount,
  runningMaintenanceGstPercent,
  type OtherPaymentDue,
  type OtherPaymentKind,
} from '../../lib/otherPayments'
import { RUNNING_MAINTENANCE_MONTH_OPTIONS } from '../../types/scheme'
import {
  PAYMENT_MODE_LABELS,
  type PaymentInstrumentDetails,
  type PaymentMode,
} from '../../types/payments'
import { todayISO } from '../../types/sales'
import { gstOnPrincipal, grossFromPrincipal } from '../../lib/chequeGst'
import { Button, Field, Input, Select, Textarea } from '../ui/Form'

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

export type CollectOtherPaymentSubmit = {
  kind: OtherPaymentKind
  phase?: number | null
  months?: number | null
  principal: number
  gstAmount: number
  mode: PaymentMode
  paidOn: string
  instrument: PaymentInstrumentDetails
  notes: string
}

export function CollectOtherPaymentDialog({
  open,
  onClose,
  onSubmit,
  dues,
  clientName,
  bookingCode,
  plotLabel,
  sbuAreaSqYards,
  collectedByLabel,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (input: CollectOtherPaymentSubmit) => void
  dues: OtherPaymentDue[]
  clientName: string
  bookingCode: string
  plotLabel: string
  sbuAreaSqYards: string
  collectedByLabel?: string
}) {
  const unpaid = useMemo(() => dues.filter((d) => !d.paid && d.principal > 0), [dues])
  const [kindKey, setKindKey] = useState('')
  const [months, setMonths] = useState(12)
  const [mode, setMode] = useState<PaymentMode>('cash')
  const [paidOn, setPaidOn] = useState(todayISO())
  const [instrument, setInstrument] =
    useState<PaymentInstrumentDetails>(emptyInstrument)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const selected = unpaid.find((d) => {
    const key =
      d.kind === 'runningMaintenance'
        ? `${d.kind}:${d.phase ?? ''}`
        : d.kind
    return key === kindKey
  })

  const modes = selected ? allowedModesForOtherKind(selected.kind) : []
  const gstPct = runningMaintenanceGstPercent()

  const isRunning = selected?.kind === 'runningMaintenance'
  const principal = isRunning
    ? runningMaintenanceAmount(
        selected.ratePerMonth ?? 0,
        sbuAreaSqYards,
        months,
      )
    : selected?.principal ?? 0
  const gstAmount = isRunning ? gstOnPrincipal(principal, gstPct) : 0
  const gross = isRunning
    ? grossFromPrincipal(principal, gstPct)
    : selected?.gross ?? 0

  useEffect(() => {
    if (!open) return
    const first = unpaid[0]
    const key = first
      ? first.kind === 'runningMaintenance'
        ? `${first.kind}:${first.phase ?? ''}`
        : first.kind
      : ''
    setKindKey(key)
    setMonths(normalizeRunningMonths(first?.months ?? 12))
    setMode(
      first
        ? allowedModesForOtherKind(first.kind)[0] || 'cash'
        : 'cash',
    )
    const today = todayISO()
    setPaidOn(today)
    setInstrument({ ...emptyInstrument(), chequeDate: today, transferDate: today })
    setNotes('')
    setError(null)
  }, [open, unpaid])

  useEffect(() => {
    if (!selected) return
    const allowed = allowedModesForOtherKind(selected.kind)
    if (!allowed.includes(mode)) setMode(allowed[0] || 'cash')
    if (selected.kind === 'runningMaintenance') {
      setMonths(normalizeRunningMonths(selected.months ?? 12))
    }
  }, [selected?.kind, selected?.phase, selected?.months])

  const monthOptions = useMemo(() => {
    const set = new Set<number>([...RUNNING_MAINTENANCE_MONTH_OPTIONS])
    if (selected?.months) set.add(normalizeRunningMonths(selected.months))
    set.add(months)
    return Array.from(set).sort((a, b) => a - b)
  }, [selected?.months, months])

  if (!open) return null

  const patchInstrument = (patch: Partial<PaymentInstrumentDetails>) => {
    setInstrument((prev) => ({ ...prev, ...patch }))
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
    if (!selected) {
      setError('Select a due to collect')
      return
    }
    if (isRunning && principal <= 0) {
      setError('Running maintenance amount is zero — check rate, SBU, and months')
      return
    }
    const instrumentError = validateInstrument()
    if (instrumentError) {
      setError(instrumentError)
      return
    }
    setError(null)
    onSubmit({
      kind: selected.kind,
      phase: selected.phase ?? null,
      months: isRunning ? months : null,
      principal,
      gstAmount,
      mode,
      paidOn,
      instrument: mode === 'cash' ? {} : instrument,
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
              Collect other payment
            </p>
            <h2 className="mt-1 font-display text-2xl text-ink">{clientName}</h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              {bookingCode} · {plotLabel}
              {sbuAreaSqYards
                ? ` · ${formatNumber(sbuAreaSqYards)} sq.yd`
                : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          {unpaid.length === 0 ? (
            <p className="rounded-xl bg-success-soft/50 px-4 py-3 text-sm text-ink">
              All other payments for this plot are collected.
            </p>
          ) : (
            <>
              <Field label="Due" required>
                <Select
                  value={kindKey}
                  onChange={(e) => setKindKey(e.target.value)}
                >
                  {unpaid.map((d) => {
                    const key =
                      d.kind === 'runningMaintenance'
                        ? `${d.kind}:${d.phase ?? ''}`
                        : d.kind
                    return (
                      <option key={key} value={key}>
                        {d.label} · {formatCurrency(d.gross)}
                      </option>
                    )
                  })}
                </Select>
              </Field>

              {isRunning && (
                <Field
                  label="Collect for"
                  hint={`₹${formatNumber(selected.ratePerMonth ?? 0)} / mo / sq.yd × ${formatNumber(sbuAreaSqYards || 0)} sq.yd × months`}
                  required
                >
                  <Select
                    value={String(months)}
                    onChange={(e) =>
                      setMonths(normalizeRunningMonths(e.target.value))
                    }
                  >
                    {monthOptions.map((m) => (
                      <option key={m} value={String(m)}>
                        {m} months
                        {m === 12 ? ' (1 year)' : m === 24 ? ' (2 years)' : ''}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}

              {selected && (
                <div className="rounded-xl border border-line bg-surface-2/50 px-4 py-3 text-sm">
                  {isRunning && (
                    <p className="mb-2 text-[11px] text-ink-faint">
                      {formatNumber(sbuAreaSqYards || 0)} sq.yd × ₹
                      {formatNumber(selected.ratePerMonth ?? 0)} × {months} mo
                    </p>
                  )}
                  <div className="flex justify-between gap-2">
                    <span className="text-ink-muted">Principal</span>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(principal)}
                    </span>
                  </div>
                  {gstAmount > 0 && (
                    <div className="mt-1 flex justify-between gap-2">
                      <span className="text-ink-muted">
                        GST {gstPct}%
                      </span>
                      <span className="font-semibold tabular-nums">
                        {formatCurrency(gstAmount)}
                      </span>
                    </div>
                  )}
                  <div className="mt-1.5 flex justify-between gap-2 border-t border-line pt-1.5 font-semibold">
                    <span>Collect</span>
                    <span className="tabular-nums">
                      {formatCurrency(gross)}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-ink-faint">
                    {selected.modeBucket === 'cash'
                      ? 'Cash only — no GST'
                      : `Cheque / UPI / NEFT only · ${gstPct}% GST`}
                  </p>
                </div>
              )}

              <Field label="Mode" required>
                <Select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as PaymentMode)}
                >
                  {modes.map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_MODE_LABELS[m]}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Paid on" required>
                <Input
                  type="date"
                  value={paidOn}
                  onChange={(e) => setPaidOn(e.target.value)}
                />
              </Field>

              {collectedByLabel && (
                <Field label="Collected by">
                  <Input
                    value={collectedByLabel}
                    readOnly
                    className="bg-surface-2"
                  />
                </Field>
              )}

              {mode === 'cheque' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Cheque number" required>
                    <Input
                      value={instrument.chequeNumber || ''}
                      onChange={(e) =>
                        patchInstrument({ chequeNumber: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Cheque date" required>
                    <Input
                      type="date"
                      value={instrument.chequeDate || ''}
                      onChange={(e) =>
                        patchInstrument({ chequeDate: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Bank name" required className="sm:col-span-2">
                    <Input
                      value={instrument.bankName || ''}
                      onChange={(e) =>
                        patchInstrument({ bankName: e.target.value })
                      }
                    />
                  </Field>
                </div>
              )}

              {mode === 'upi' && (
                <Field label="UPI transaction ID" required>
                  <Input
                    value={instrument.upiTxnId || ''}
                    onChange={(e) =>
                      patchInstrument({ upiTxnId: e.target.value })
                    }
                  />
                </Field>
              )}

              {mode === 'neft' && (
                <Field label="UTR / reference" required>
                  <Input
                    value={instrument.utrNumber || ''}
                    onChange={(e) =>
                      patchInstrument({ utrNumber: e.target.value })
                    }
                  />
                </Field>
              )}

              {mode === 'other' && (
                <Field label="Reference" required>
                  <Input
                    value={instrument.referenceNo || ''}
                    onChange={(e) =>
                      patchInstrument({ referenceNo: e.target.value })
                    }
                  />
                </Field>
              )}

              <Field label="Notes">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </Field>
            </>
          )}

          {error && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!selected || principal <= 0}>
              Record {selected ? formatCurrency(gross) : 'payment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
