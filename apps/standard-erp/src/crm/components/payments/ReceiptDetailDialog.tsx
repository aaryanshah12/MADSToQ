import { X } from 'lucide-react'
import { formatCurrency } from '../../lib/schemes'
import {
  CATEGORY_LABELS,
  PAYMENT_MODE_LABELS,
  type InstallmentRecord,
  type PaymentInstrumentDetails,
  type PaymentReceiptRecord,
} from '../../types/payments'
import type { BookingRecord } from '../../types/sales'
import { Button } from '../ui/Form'

function formatDueDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value?.trim()) return null
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className="text-sm font-medium text-ink sm:text-right">{value}</dd>
    </div>
  )
}

function instrumentRows(
  mode: PaymentReceiptRecord['mode'],
  instrument?: PaymentInstrumentDetails,
): Array<{ label: string; value?: string }> {
  if (!instrument) return []
  if (mode === 'cheque') {
    return [
      { label: 'Cheque number', value: instrument.chequeNumber },
      {
        label: 'Cheque date',
        value: instrument.chequeDate
          ? formatDueDate(instrument.chequeDate)
          : undefined,
      },
      { label: 'Bank', value: instrument.bankName },
      { label: 'Branch', value: instrument.branchName },
    ]
  }
  if (mode === 'upi') {
    return [
      { label: 'UPI transaction ID', value: instrument.upiTxnId },
      { label: 'Payer UPI ID', value: instrument.upiId },
    ]
  }
  if (mode === 'neft') {
    return [
      { label: 'UTR number', value: instrument.utrNumber },
      {
        label: 'Transfer date',
        value: instrument.transferDate
          ? formatDueDate(instrument.transferDate)
          : undefined,
      },
      { label: 'Bank', value: instrument.bankName },
    ]
  }
  if (mode === 'other') {
    return [
      { label: 'Reference number', value: instrument.referenceNo },
      { label: 'Bank / source', value: instrument.bankName },
    ]
  }
  return []
}

export function ReceiptDetailDialog({
  open,
  onClose,
  receipt,
  booking,
  installment,
  propertyLabel,
}: {
  open: boolean
  onClose: () => void
  receipt: PaymentReceiptRecord
  booking: BookingRecord
  installment?: InstallmentRecord
  propertyLabel: string
}) {
  if (!open) return null

  const details = instrumentRows(receipt.mode, receipt.instrument)
  const gst = Math.round(Number(receipt.gstAmount) || 0)
  const gross = Math.round(Number(receipt.amount) || 0) + gst

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
              Payment receipt
            </p>
            <h2 className="mt-1 font-display text-2xl text-ink">
              {formatCurrency(gross)}
            </h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              {PAYMENT_MODE_LABELS[receipt.mode]} ·{' '}
              {formatDueDate(receipt.paidOn)}
              {gst > 0
                ? ` · EMI ${formatCurrency(receipt.amount)} + GST ${formatCurrency(gst)}`
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

        <div className="space-y-5 px-5 py-4">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Client
            </h3>
            <dl className="mt-2 space-y-2">
              <DetailRow label="Name" value={booking.customerName} />
              <DetailRow label="Booking" value={booking.bookingCode} />
              <DetailRow label="Phone" value={booking.customerPhone || '—'} />
              <DetailRow label="Property" value={propertyLabel} />
              <DetailRow
                label="Sales person"
                value={booking.salesPerson || '—'}
              />
              <DetailRow
                label="Collected by"
                value={
                  receipt.collectedByName
                    ? `${receipt.collectedByName}${
                        receipt.collectedByRole
                          ? ` · ${receipt.collectedByRole}`
                          : ''
                      }`
                    : undefined
                }
              />
            </dl>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Installment
            </h3>
            <dl className="mt-2 space-y-2">
              <DetailRow
                label="EMI"
                value={installment?.label || 'Installment'}
              />
              <DetailRow
                label="Category"
                value={CATEGORY_LABELS[receipt.category]}
              />
              <DetailRow
                label="Due date"
                value={
                  installment?.dueDate
                    ? formatDueDate(installment.dueDate)
                    : undefined
                }
              />
              <DetailRow
                label="Toward EMI"
                value={formatCurrency(receipt.amount)}
              />
              {gst > 0 ? (
                <DetailRow label="GST" value={formatCurrency(gst)} />
              ) : null}
              <DetailRow
                label="Total collected"
                value={formatCurrency(gross)}
              />
            </dl>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Payment
            </h3>
            <dl className="mt-2 space-y-2">
              <DetailRow
                label="Mode"
                value={PAYMENT_MODE_LABELS[receipt.mode]}
              />
              <DetailRow
                label="Paid on"
                value={formatDueDate(receipt.paidOn)}
              />
              {receipt.reference ? (
                <DetailRow label="Reference" value={receipt.reference} />
              ) : null}
              {details.map((row) => (
                <DetailRow
                  key={row.label}
                  label={row.label}
                  value={row.value}
                />
              ))}
              {receipt.notes ? (
                <DetailRow label="Notes" value={receipt.notes} />
              ) : null}
            </dl>
          </section>

          <div className="pt-1">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
