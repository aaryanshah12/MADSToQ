import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { formatCurrency } from '../../lib/schemes'
import {
  allocateLumpSum,
  totalCollectibleForMode,
  type AllocationStopReason,
  type LumpSumAllocation,
  type LumpSumResult,
} from '../../lib/lumpSum'
import {
  availableModesForQuota,
  defaultModeForBookingQuotas,
  modeToBucket,
  type CategoryPaymentQuota,
} from '../../lib/paymentBuckets'
import {
  chequeGstPercent,
  isBankMode,
  splitGrossBankAmount,
} from '../../lib/chequeGst'
import {
  CATEGORY_LABELS,
  PAYMENT_MODE_LABELS,
  type InstallmentRecord,
  type PaymentInstrumentDetails,
  type PaymentMode,
} from '../../types/payments'
import {
  bookingHasConstruction,
  todayISO,
  type BookingRecord,
} from '../../types/sales'
import { Button, Combobox, Field, Input, Select, Textarea } from '../ui/Form'
import { TokenCollectedNote } from './TokenCollectedNote'

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

function emptyAllocationPreview(mode: PaymentMode = 'upi'): LumpSumResult {
  return {
    allocations: [],
    unallocated: 0,
    principalTotal: 0,
    gstTotal: 0,
    grossTotal: 0,
    landStopReason: 'none',
    constructionStopReason: 'none',
    modeBucket: modeToBucket(mode),
  }
}

function formatDueMonth(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m) return iso
  return new Date(y, m - 1, d || 1).toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
  })
}

function categoryQuotaPhrase(
  category: 'land' | 'construction',
  bucket: 'cheque' | 'cash',
) {
  const side = category === 'land' ? 'Land' : 'Construction'
  return bucket === 'cheque'
    ? `${side} cheque quota`
    : `${side} cash quota`
}

function stopCallouts(result: LumpSumResult): string[] {
  if (
    result.landStopReason === 'amount' &&
    result.constructionStopReason === 'amount'
  ) {
    return ['This payment amount is fully applied — later EMIs stay due.']
  }

  const notes: string[] = []
  if (result.landStopReason === 'quota') {
    notes.push(
      `${categoryQuotaPhrase('land', result.modeBucket)} is fully used — further land EMIs are not included in this payment.`,
    )
  } else if (result.landStopReason === 'amount') {
    notes.push('Land EMIs stop here because this payment amount is used up.')
  }
  if (result.constructionStopReason === 'quota') {
    notes.push(
      `${categoryQuotaPhrase('construction', result.modeBucket)} is fully used — further construction EMIs are not included.`,
    )
  } else if (result.constructionStopReason === 'amount') {
    notes.push(
      'Construction EMIs stop here because this payment amount is used up.',
    )
  }
  return notes
}

function coverageSentence(result: LumpSumResult): string {
  const dates = Array.from(
    new Set(result.allocations.map((a) => a.dueDate).filter(Boolean)),
  ).sort()
  if (dates.length === 0) return ''
  const first = formatDueMonth(dates[0])
  const last = formatDueMonth(dates[dates.length - 1])
  const range =
    dates.length === 1 ? first : `from ${first} through ${last}`
  const dues = dates.length === 1 ? '1 due date' : `${dates.length} due dates`
  return `This ${formatCurrency(result.grossTotal)} covers EMIs ${range} (${dues}).`
}

function groupAllocationsByDue(allocations: LumpSumAllocation[]) {
  const map = new Map<string, LumpSumAllocation[]>()
  for (const a of allocations) {
    const key = a.dueDate || 'unknown'
    const list = map.get(key) || []
    list.push(a)
    map.set(key, list)
  }
  return Array.from(map.entries()).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
}

function partialStatusText(
  a: LumpSumAllocation,
  stopReason: AllocationStopReason,
  bucket: 'cheque' | 'cash',
): string {
  const stillDue = Math.max(0, a.balanceBefore - a.amount)
  if (a.limitedBy === 'quota' || stopReason === 'quota') {
    return `Partial — ${categoryQuotaPhrase(a.category, bucket).toLowerCase()} finished${
      stillDue > 0 ? ` · ${formatCurrency(stillDue)} still due on this EMI later` : ''
    }`
  }
  return `Partial — amount used up${
    stillDue > 0 ? ` · ${formatCurrency(stillDue)} still due on this EMI later` : ''
  }`
}
export type LumpSumCollectSubmit = {
  bookingId: string
  allocations: { installmentId: string; amount: number; gstAmount: number }[]
  /** Gross amount collected (principal + GST) */
  amount: number
  paidOn: string
  mode: PaymentMode
  instrument: PaymentInstrumentDetails
  notes: string
}

type BookingOption = {
  booking: BookingRecord
  propertyLabel: string
  installments: InstallmentRecord[]
  landQuota: CategoryPaymentQuota
  constructionQuota: CategoryPaymentQuota
}

export function LumpSumCollectDialog({
  open,
  onClose,
  onSubmit,
  options,
  initialBookingId,
  scopeInstallmentIds,
  collectedByLabel,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (input: LumpSumCollectSubmit) => void
  options: BookingOption[]
  initialBookingId?: string
  /** When set from a due row, only these EMIs (e.g. land + construction that day) */
  scopeInstallmentIds?: string[]
  collectedByLabel?: string
}) {
  const [clientKey, setClientKey] = useState('')
  const [bookingId, setBookingId] = useState('')

  const scopeSet = useMemo(() => {
    if (!scopeInstallmentIds?.length) return null
    return new Set(scopeInstallmentIds)
  }, [scopeInstallmentIds])

  const scopedOptions = useMemo(() => {
    if (!scopeSet) return options
    return options
      .map((o) => ({
        ...o,
        installments: o.installments.filter((i) => scopeSet.has(i.id)),
      }))
      .filter((o) => o.installments.some((i) => i.paidAmount < i.amount))
  }, [options, scopeSet])

  const dueScoped = Boolean(scopeSet)

  const clientOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const o of scopedOptions) {
      const name = o.booking.customerName.trim() || 'Unknown'
      const key = name.toLowerCase()
      if (!map.has(key)) map.set(key, name)
    }
    return Array.from(map.entries())
      .map(([key, name]) => ({ key, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [scopedOptions])

  const bookingsForClient = useMemo(() => {
    if (!clientKey) return []
    return scopedOptions
      .filter(
        (o) =>
          (o.booking.customerName.trim() || 'Unknown').toLowerCase() ===
          clientKey,
      )
      .sort((a, b) =>
        a.booking.bookingCode.localeCompare(b.booking.bookingCode),
      )
  }, [scopedOptions, clientKey])

  const selected = scopedOptions.find((o) => o.booking.id === bookingId)

  const duePrincipal = useMemo(() => {
    if (!selected) return 0
    return selected.installments.reduce(
      (s, i) => s + Math.max(0, Math.round(i.amount) - Math.round(i.paidAmount)),
      0,
    )
  }, [selected])

  const combinedModes = useMemo(() => {
    if (!selected) return [] as PaymentMode[]
    const landModes = availableModesForQuota(selected.landQuota)
    const constModes = availableModesForQuota(selected.constructionQuota)
    const set = new Set<PaymentMode>([...landModes, ...constModes])
    return (['upi', 'cheque', 'neft', 'cash', 'other'] as PaymentMode[]).filter(
      (m) =>
        set.has(m) &&
        totalCollectibleForMode({
          mode: m,
          installments: selected.installments,
          landQuota: selected.landQuota,
          constructionQuota: selected.constructionQuota,
        }) > 0,
    )
  }, [selected])

  const [mode, setMode] = useState<PaymentMode>('upi')
  const [amount, setAmount] = useState('')
  const [paidOn, setPaidOn] = useState(todayISO())
  const [instrument, setInstrument] =
    useState<PaymentInstrumentDetails>(emptyInstrument)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const maxForMode = useMemo(() => {
    if (!selected) return 0
    return totalCollectibleForMode({
      mode,
      installments: selected.installments,
      landQuota: selected.landQuota,
      constructionQuota: selected.constructionQuota,
    })
  }, [selected, mode])

  const allocationPreview = useMemo(() => {
    if (!selected) return emptyAllocationPreview(mode)
    const pay = Math.round(Number(amount) || 0)
    if (pay <= 0) return emptyAllocationPreview(mode)
    return allocateLumpSum({
      amount: pay,
      mode,
      installments: selected.installments,
      landQuota: selected.landQuota,
      constructionQuota: selected.constructionQuota,
    })
  }, [selected, amount, mode])

  const allocatedTotal = allocationPreview.grossTotal
  const bank = isBankMode(mode)
  const gstPct = chequeGstPercent()
  const enteredAmount = Math.round(Number(amount) || 0)
  const amountExceedsQuota =
    enteredAmount > 0 &&
    allocatedTotal > 0 &&
    (allocationPreview.unallocated > 0 || enteredAmount > allocatedTotal)
  const leftoverAmount = Math.max(
    0,
    allocationPreview.unallocated > 0
      ? allocationPreview.unallocated
      : enteredAmount - allocatedTotal,
  )
  const quotaBucketLabel =
    modeToBucket(mode) === 'cheque'
      ? 'cheque / UPI / NEFT quota'
      : 'cash quota'
  const allocationGroups = useMemo(
    () => groupAllocationsByDue(allocationPreview.allocations),
    [allocationPreview.allocations],
  )
  const allocationCallouts = useMemo(
    () => stopCallouts(allocationPreview),
    [allocationPreview],
  )
  const coverageText = useMemo(
    () => coverageSentence(allocationPreview),
    [allocationPreview],
  )
  const applyAllocatableAmount = () => {
    if (allocatedTotal > 0) setAmount(String(allocatedTotal))
    setError(null)
  }

  const patchInstrument = (patch: Partial<PaymentInstrumentDetails>) => {
    setInstrument((prev) => ({ ...prev, ...patch }))
  }

  const applyBookingDefaults = (opt: BookingOption | undefined) => {
    if (!opt) {
      setAmount('')
      return
    }
    const nextMode = defaultModeForBookingQuotas(
      opt.landQuota,
      opt.constructionQuota,
    )
    setMode(nextMode)
    const max = totalCollectibleForMode({
      mode: nextMode,
      installments: opt.installments,
      landQuota: opt.landQuota,
      constructionQuota: opt.constructionQuota,
    })
    setAmount(max > 0 ? String(max) : '')
  }

  useEffect(() => {
    if (!open) return
    const list = scopedOptions
    const preferred =
      (initialBookingId &&
        list.some((o) => o.booking.id === initialBookingId) &&
        initialBookingId) ||
      list[0]?.booking.id ||
      ''
    const opt = list.find((o) => o.booking.id === preferred)
    const nextClient = opt
      ? (opt.booking.customerName.trim() || 'Unknown').toLowerCase()
      : clientOptions[0]?.key || ''
    const nextBooking =
      opt?.booking.id ||
      list.find(
        (o) =>
          (o.booking.customerName.trim() || 'Unknown').toLowerCase() ===
          nextClient,
      )?.booking.id ||
      ''
    setClientKey(nextClient)
    setBookingId(nextBooking)
    const today = todayISO()
    setPaidOn(today)
    setInstrument({
      ...emptyInstrument(),
      chequeDate: today,
      transferDate: today,
    })
    setNotes('')
    setError(null)
    applyBookingDefaults(list.find((o) => o.booking.id === nextBooking))
    // Only re-seed when the dialog opens — not when parent recomputes options
    // (that was overwriting the amount the user typed).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [open])

  useEffect(() => {
    if (!open || !selected) return
    if (!combinedModes.includes(mode) && combinedModes[0]) {
      // Mode no longer allowed — switch mode only; keep the typed amount
      setMode(combinedModes[0])
    }
  }, [combinedModes, mode, open, selected])

  if (!open) return null

  const handleClientChange = (key: string) => {
    setClientKey(key)
    const first = scopedOptions.find(
      (o) =>
        (o.booking.customerName.trim() || 'Unknown').toLowerCase() === key,
    )
    const nextId = first?.booking.id || ''
    setBookingId(nextId)
    applyBookingDefaults(first)
    setError(null)
  }

  const handleBookingChange = (id: string) => {
    setBookingId(id)
    applyBookingDefaults(scopedOptions.find((o) => o.booking.id === id))
    setError(null)
  }

  const handleModeChange = (next: PaymentMode) => {
    setMode(next)
    if (!selected) return
    const max = totalCollectibleForMode({
      mode: next,
      installments: selected.installments,
      landQuota: selected.landQuota,
      constructionQuota: selected.constructionQuota,
    })
    setAmount(max > 0 ? String(max) : '')
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
    if (!clientKey) {
      setError('Select a client')
      return
    }
    if (!selected) {
      setError('Select a booking')
      return
    }
    const pay = Math.round(Number(amount))
    if (!Number.isFinite(pay) || pay <= 0) {
      setError('Enter a valid payment amount')
      return
    }
    if (!allocationPreview.allocations.length || allocatedTotal <= 0) {
      setError(
        modeToBucket(mode) === 'cheque'
          ? `Nothing left on ${quotaBucketLabel} for this mode — try cash, or wait until more cheque quota is available`
          : 'Nothing left to collect in this mode',
      )
      return
    }
    const instrumentError = validateInstrument()
    if (instrumentError) {
      setError(instrumentError)
      return
    }
    setError(null)
    // Always record what quotas allow (may be less than typed amount)
    onSubmit({
      bookingId: selected.booking.id,
      allocations: allocationPreview.allocations.map((a) => ({
        installmentId: a.installmentId,
        amount: a.amount,
        gstAmount: a.gstAmount,
      })),
      amount:
        allocationPreview.unallocated === 0 && pay === allocatedTotal
          ? pay
          : allocatedTotal,
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

  const showConstructionQuota = selected
    ? selected.constructionQuota.configured ||
      selected.constructionQuota.baseTotal > 0 ||
      selected.installments.some((i) => i.category === 'construction') ||
      bookingHasConstruction(selected.booking)
    : false

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-xl sm:rounded-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
              {dueScoped ? 'Collect due' : 'Collect lump sum'}
            </p>
            <h2 className="mt-1 font-display text-2xl text-ink">
              {selected?.booking.customerName || 'One payment, many EMIs'}
            </h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              {selected
                ? `${selected.booking.bookingCode} · ${selected.propertyLabel}`
                : 'Applied by due date — land then construction on the same day.'}
            </p>
            {dueScoped && selected ? (
              <p className="mt-1 text-xs text-ink-faint">
                {selected.installments
                  .filter((i) => i.paidAmount < i.amount)
                  .map((i) => i.label)
                  .join(' + ')}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            {dueScoped ? (
              <>
                <p className="text-[11px] uppercase tracking-wide text-ink-faint">
                  EMI balance
                </p>
                <p className="text-lg font-semibold tabular-nums text-warn">
                  {formatCurrency(duePrincipal)}
                </p>
              </>
            ) : null}
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            {selected && (
              <div className="border-b border-line">
                {Number(selected.booking.bookingAmount) > 0 ? (
                  <div className="border-b border-line px-5 py-2.5">
                    <TokenCollectedNote
                      amount={Number(selected.booking.bookingAmount) || 0}
                      mode={selected.booking.bookingAmountMode}
                      compact
                    />
                  </div>
                ) : null}
                <QuotaRow
                  label="Land"
                  quota={selected.landQuota}
                  paidLabel="Land fully paid"
                />
                {showConstructionQuota && (
                  <QuotaRow
                    label="Construction"
                    quota={selected.constructionQuota}
                    paidLabel="Construction fully paid"
                    emptyLabel={
                      selected.constructionQuota.baseTotal <= 0
                        ? 'Create construction schedule to collect'
                        : undefined
                    }
                  />
                )}
              </div>
            )}

            <div className="space-y-4 px-5 py-4">
          <Field
            label="Client name"
            required
            hint="Type a name to filter the list"
          >
            <Combobox
              value={clientKey}
              onChange={handleClientChange}
              options={clientOptions.map((c) => ({
                value: c.key,
                label: c.name,
              }))}
              placeholder="Type client name…"
              emptyMessage="No clients match"
              disabled={clientOptions.length === 0 || dueScoped}
            />
          </Field>

          <Field label="Booking" required>
            <Select
              value={bookingId}
              onChange={(e) => handleBookingChange(e.target.value)}
              disabled={
                !clientKey || bookingsForClient.length === 0 || dueScoped
              }
            >
              {bookingsForClient.length === 0 && (
                <option value="">No bookings for this client</option>
              )}
              {bookingsForClient.map((o) => (
                <option key={o.booking.id} value={o.booking.id}>
                  {o.booking.bookingCode} · {o.propertyLabel}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Mode" required>
            <Select
              value={mode}
              onChange={(e) => handleModeChange(e.target.value as PaymentMode)}
              disabled={!selected}
            >
              {combinedModes.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_MODE_LABELS[m]}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label={
              bank
                ? `Lump sum amount (₹) · incl. ${gstPct}% GST`
                : 'Lump sum amount (₹)'
            }
            required
            hint={
              bank
                ? 'Bank modes: enter what the client pays; EMI gets the amount after GST'
                : 'Cash — no GST'
            }
          >
            <Input
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value)
                setError(null)
              }}
              autoFocus
              disabled={!selected}
            />
            <div className="mt-1.5 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md bg-surface-2 px-2 py-1 text-[11px] font-semibold text-ink-muted hover:text-ink disabled:opacity-40"
                disabled={!selected || maxForMode <= 0}
                onClick={() => setAmount(String(maxForMode))}
              >
                Max {formatCurrency(maxForMode)}
              </button>
            </div>
            {amountExceedsQuota ? (
              <div className="mt-2 rounded-xl border border-warn/30 bg-warn-soft/80 px-3 py-2.5 text-xs leading-relaxed text-ink">
                <p className="font-semibold text-ink">
                  Only {formatCurrency(allocatedTotal)} can be collected via{' '}
                  {PAYMENT_MODE_LABELS[mode]} right now
                </p>
                <p className="mt-1 text-ink-muted">
                  You entered {formatCurrency(enteredAmount)}. Land + construction{' '}
                  {quotaBucketLabel} (incl. GST where applicable) covers{' '}
                  {formatCurrency(allocatedTotal)}. The remaining{' '}
                  {formatCurrency(leftoverAmount)} needs cash, or more cheque
                  quota later.
                </p>
                <button
                  type="button"
                  className="mt-2 rounded-lg bg-ink px-2.5 py-1.5 text-[11px] font-semibold text-canvas hover:opacity-90"
                  onClick={applyAllocatableAmount}
                >
                  Use {formatCurrency(allocatedTotal)} instead
                </button>
              </div>
            ) : null}
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
              <Input
                value={collectedByLabel}
                readOnly
                className="bg-surface-2"
              />
            </Field>
          )}

          {mode === 'cheque' && (
            <div className="space-y-4 rounded-xl border border-line bg-surface-2/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Cheque details
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Cheque number" required>
                  <Input
                    value={instrument.chequeNumber || ''}
                    onChange={(e) =>
                      patchInstrument({ chequeNumber: e.target.value })
                    }
                    placeholder="e.g. 123456"
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
                <Field label="Bank name" required>
                  <Input
                    value={instrument.bankName || ''}
                    onChange={(e) =>
                      patchInstrument({ bankName: e.target.value })
                    }
                  />
                </Field>
                <Field label="Branch">
                  <Input
                    value={instrument.branchName || ''}
                    onChange={(e) =>
                      patchInstrument({ branchName: e.target.value })
                    }
                  />
                </Field>
              </div>
            </div>
          )}

          {mode === 'upi' && (
            <div className="space-y-4 rounded-xl border border-line bg-surface-2/40 p-3">
              <Field label="UPI transaction ID" required>
                <Input
                  value={instrument.upiTxnId || ''}
                  onChange={(e) =>
                    patchInstrument({ upiTxnId: e.target.value })
                  }
                />
              </Field>
              <Field label="UPI ID (optional)">
                <Input
                  value={instrument.upiId || ''}
                  onChange={(e) => patchInstrument({ upiId: e.target.value })}
                />
              </Field>
            </div>
          )}

          {mode === 'neft' && (
            <div className="space-y-4 rounded-xl border border-line bg-surface-2/40 p-3">
              <Field label="UTR / reference" required>
                <Input
                  value={instrument.utrNumber || ''}
                  onChange={(e) =>
                    patchInstrument({ utrNumber: e.target.value })
                  }
                />
              </Field>
              <Field label="Transfer date">
                <Input
                  type="date"
                  value={instrument.transferDate || ''}
                  onChange={(e) =>
                    patchInstrument({ transferDate: e.target.value })
                  }
                />
              </Field>
            </div>
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
              placeholder="Optional"
            />
          </Field>

          {allocationPreview.allocations.length > 0 && (
            <div className="rounded-xl border border-line bg-surface-2/40 p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                    What this payment covers
                  </p>
                  {coverageText ? (
                    <p className="mt-1 text-sm font-medium leading-snug text-ink">
                      {coverageText}
                    </p>
                  ) : null}
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-ink">
                  {formatCurrency(allocatedTotal)}
                </p>
              </div>

              <div
                className={`mb-3 grid gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs sm:text-sm ${
                  amountExceedsQuota
                    ? bank
                      ? 'grid-cols-2 sm:grid-cols-4'
                      : 'grid-cols-3'
                    : bank
                      ? 'grid-cols-3'
                      : 'grid-cols-2'
                }`}
              >
                {amountExceedsQuota ? (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                      You entered
                    </p>
                    <p className="mt-0.5 font-semibold tabular-nums text-ink-muted line-through">
                      {formatCurrency(enteredAmount)}
                    </p>
                  </div>
                ) : null}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                    Pays EMIs
                  </p>
                  <p className="mt-0.5 font-semibold tabular-nums text-ink">
                    {formatCurrency(allocationPreview.principalTotal)}
                  </p>
                </div>
                {bank ? (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                      GST {gstPct}%
                    </p>
                    <p className="mt-0.5 font-semibold tabular-nums text-ink">
                      {formatCurrency(allocationPreview.gstTotal)}
                    </p>
                  </div>
                ) : null}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                    Will collect
                  </p>
                  <p className="mt-0.5 font-semibold tabular-nums text-ink">
                    {formatCurrency(allocationPreview.grossTotal)}
                  </p>
                </div>
              </div>

              {allocationCallouts.length > 0 ? (
                <div className="mb-3 space-y-1.5">
                  {allocationCallouts.map((note) => (
                    <p
                      key={note}
                      className="rounded-lg bg-warn-soft/70 px-2.5 py-2 text-xs leading-relaxed text-ink"
                    >
                      {note}
                    </p>
                  ))}
                </div>
              ) : null}

              <div className="space-y-2.5">
                {allocationGroups.map(([dueDate, rows]) => (
                  <div
                    key={dueDate}
                    className="overflow-hidden rounded-lg border border-line bg-surface"
                  >
                    <p className="border-b border-line bg-surface-2/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                      Due {formatDueMonth(dueDate)}
                    </p>
                    <ul className="divide-y divide-line">
                      {rows.map((a) => {
                        const partial =
                          a.balanceBefore > 0 && a.amount < a.balanceBefore
                        const stopReason =
                          a.category === 'land'
                            ? allocationPreview.landStopReason
                            : allocationPreview.constructionStopReason
                        return (
                          <li
                            key={a.installmentId}
                            className="flex items-start justify-between gap-3 px-3 py-2 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-ink">
                                {CATEGORY_LABELS[a.category]}
                                <span className="font-normal text-ink-muted">
                                  {' '}
                                  · {a.label}
                                </span>
                              </p>
                              <p
                                className={`mt-0.5 text-[11px] leading-snug ${
                                  partial ? 'text-warn' : 'text-ink-faint'
                                }`}
                              >
                                {partial
                                  ? partialStatusText(
                                      a,
                                      stopReason,
                                      allocationPreview.modeBucket,
                                    )
                                  : 'Paid in full'}
                              </p>
                            </div>
                            <span className="shrink-0 tabular-nums font-semibold text-ink">
                              {formatCurrency(a.amount)}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>

              <p className="mt-3 text-[11px] text-ink-faint">
                Earliest dues first. Same day: land, then construction.
              </p>

              {amountExceedsQuota ? (
                <p className="mt-2 rounded-lg bg-warn-soft/70 px-2.5 py-2 text-xs leading-relaxed text-ink">
                  {formatCurrency(leftoverAmount)} of your entry won’t be
                  recorded in this payment — {quotaBucketLabel} is full for the
                  rest. You can still record {formatCurrency(allocatedTotal)}{' '}
                  now.
                </p>
              ) : null}
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2 border-t border-line bg-surface px-5 py-4">
            {amountExceedsQuota ? (
              <p className="text-[11px] leading-snug text-ink-muted">
                Recording {formatCurrency(allocatedTotal)} of{' '}
                {formatCurrency(enteredAmount)} entered
              </p>
            ) : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!selected || allocatedTotal <= 0}
              >
                Record{' '}
                {allocatedTotal > 0
                  ? formatCurrency(allocatedTotal)
                  : 'lump sum'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function QuotaRow({
  label,
  quota,
  paidLabel,
  emptyLabel,
}: {
  label: string
  quota: CategoryPaymentQuota
  paidLabel: string
  emptyLabel?: string
}) {
  const fullyPaid =
    quota.unpaidBalance <= 0 &&
    quota.chequeRemaining <= 0 &&
    quota.cashRemaining <= 0 &&
    quota.baseTotal > 0
  const noSchedule = quota.baseTotal <= 0

  if (noSchedule) {
    return (
      <div className="border-t border-line bg-surface px-4 py-3 first:border-t-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          {label}
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          {emptyLabel || 'Not configured'}
        </p>
      </div>
    )
  }

  if (fullyPaid) {
    return (
      <div className="border-t border-line bg-surface px-4 py-3 first:border-t-0">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            {label}
          </p>
          <p className="text-sm font-medium text-success">{paidLabel}</p>
        </div>
      </div>
    )
  }

  const chequeLeft = splitGrossBankAmount(quota.chequeRemaining)

  return (
    <div className="grid grid-cols-2 gap-px border-t border-line bg-line first:border-t-0">
      <div className="bg-surface px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          {label} cheque left
        </p>
        <p className="mt-1 text-sm font-semibold tabular-nums text-ink">
          {formatCurrency(chequeLeft.principal)}
          <span className="font-normal text-ink-muted"> excl. GST</span>
        </p>
        <p className="mt-0.5 text-sm font-semibold tabular-nums text-ink">
          + {formatCurrency(chequeLeft.gst)}
          <span className="font-normal text-ink-muted"> GST</span>
        </p>
        <p className="mt-0.5 text-[11px] tabular-nums text-ink-faint">
          of {formatCurrency(quota.chequeBaseTarget)} excl. GST +{' '}
          {formatCurrency(quota.chequeGstTarget)} GST · {quota.chequePercent}%
        </p>
      </div>
      <div className="bg-surface px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          {label} cash left
        </p>
        <p className="mt-1 text-sm font-semibold tabular-nums text-ink">
          {formatCurrency(quota.cashRemaining)}
        </p>
        <p className="mt-0.5 text-[11px] tabular-nums text-ink-faint">
          of {formatCurrency(quota.cashTarget)} · {quota.cashPercent}%
        </p>
      </div>
    </div>
  )
}
