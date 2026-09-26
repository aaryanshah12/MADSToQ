import { AlertCircle, Lock, X } from 'lucide-react'
import { formatCurrency } from '../../lib/schemes'
import {
  CATEGORY_LABELS,
  PAYMENT_MODE_LABELS,
  categoryTotals,
  type InstallmentRecord,
  type PaymentReceiptRecord,
} from '../../types/payments'
import type { BookingRecord } from '../../types/sales'
import { Button } from '../ui/Form'
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

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value?.trim()) return null
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className="text-sm font-medium text-ink sm:text-right">{value}</dd>
    </div>
  )
}

export type DueDetailPart = {
  installment: InstallmentRecord
  balance: number
  locked: boolean
}

export function DueDetailDialog({
  open,
  onClose,
  booking,
  propertyLabel,
  dueDate,
  parts,
  balance,
  collectibleBalance,
  overdue,
  overdueDays,
  installments,
  receipts,
  canCollect,
  onCollect,
}: {
  open: boolean
  onClose: () => void
  booking: BookingRecord
  propertyLabel: string
  dueDate: string
  parts: DueDetailPart[]
  balance: number
  collectibleBalance: number
  overdue: boolean
  overdueDays: number
  installments: InstallmentRecord[]
  receipts: PaymentReceiptRecord[]
  canCollect?: boolean
  onCollect?: () => void
}) {
  if (!open) return null

  const land = categoryTotals(installments, 'land')
  const construction = categoryTotals(installments, 'construction')

  const statusLabel = (() => {
    if (overdue && collectibleBalance > 0) {
      return `${overdueDays}d overdue`
    }
    if (parts.every((p) => p.locked)) return 'Locked'
    if (collectibleBalance > 0 && !overdue) return 'Due'
    return 'Upcoming'
  })()

  const sortedInstallments = [...installments].sort((a, b) => {
    if (a.category !== b.category) {
      return a.category === 'land' ? -1 : 1
    }
    return a.sequence - b.sequence
  })

  const sortedReceipts = [...receipts].sort((a, b) =>
    b.paidOn.localeCompare(a.paidOn),
  )

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
              Pending payment
            </p>
            <h2 className="mt-1 font-display text-2xl text-ink">
              {formatCurrency(
                collectibleBalance > 0 ? collectibleBalance : balance,
              )}
            </h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              Due {formatDueDate(dueDate)} · {statusLabel}
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
          {(overdue && collectibleBalance > 0) || parts.some((p) => p.locked) ? (
            <div
              className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm ${
                overdue && collectibleBalance > 0
                  ? 'bg-danger/10 text-danger'
                  : 'bg-surface-2 text-ink-muted'
              }`}
            >
              {overdue && collectibleBalance > 0 ? (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <Lock className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <p>
                {overdue && collectibleBalance > 0
                  ? `This installment is ${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue.`
                  : 'This installment is locked.'}
              </p>
            </div>
          ) : null}

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Client
            </h3>
            <dl className="mt-2 space-y-2">
              <DetailRow label="Name" value={booking.customerName} />
              <DetailRow label="Booking" value={booking.bookingCode} />
              <DetailRow label="Phone" value={booking.customerPhone || '—'} />
              <DetailRow label="Email" value={booking.customerEmail || undefined} />
              <DetailRow label="Property" value={propertyLabel} />
              <DetailRow
                label="Sales person"
                value={booking.salesPerson || '—'}
              />
              <DetailRow
                label="Channel"
                value={
                  booking.viaBroker
                    ? `Broker · ${booking.broker?.fullName || '—'}`
                    : 'Direct'
                }
              />
              <DetailRow
                label="Status"
                value={booking.status}
              />
            </dl>
          </section>

          <TokenCollectedNote
            amount={Number(booking.bookingAmount) || 0}
            mode={booking.bookingAmountMode}
          />

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Due on this date
            </h3>
            <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
              {parts.map((part) => (
                <li
                  key={part.installment.id}
                  className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm"
                >
                  <div>
                    <p className="font-medium text-ink">
                      {part.installment.label}
                    </p>
                    <p className="text-[11px] text-ink-muted">
                      {CATEGORY_LABELS[part.installment.category]} · EMI{' '}
                      {formatCurrency(part.installment.amount)} · paid{' '}
                      {formatCurrency(part.installment.paidAmount)}
                    </p>
                    {part.locked && (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-ink-faint">
                        <Lock className="h-3 w-3" /> Locked
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums text-warn">
                    {formatCurrency(part.balance)}
                  </p>
                </li>
              ))}
            </ul>
            {balance > collectibleBalance && (
              <p className="mt-2 text-xs text-ink-muted">
                Collectible now {formatCurrency(collectibleBalance)} ·{' '}
                {formatCurrency(balance - collectibleBalance)} locked
              </p>
            )}
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Collection progress
            </h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl bg-surface-2/60 px-3 py-2.5 text-sm">
                <p className="text-[11px] font-semibold uppercase text-ink-faint">
                  Land
                </p>
                <p className="mt-1 tabular-nums font-semibold text-ink">
                  {formatCurrency(land.paid)}
                  <span className="font-normal text-ink-muted">
                    {' '}
                    / {formatCurrency(land.due)}
                  </span>
                </p>
              </div>
              <div className="rounded-xl bg-surface-2/60 px-3 py-2.5 text-sm">
                <p className="text-[11px] font-semibold uppercase text-ink-faint">
                  Construction
                </p>
                <p className="mt-1 tabular-nums font-semibold text-ink">
                  {formatCurrency(construction.paid)}
                  <span className="font-normal text-ink-muted">
                    {' '}
                    / {formatCurrency(construction.due)}
                  </span>
                </p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Full EMI schedule
            </h3>
            {sortedInstallments.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">No schedule yet.</p>
            ) : (
              <ul className="mt-2 max-h-48 divide-y divide-line overflow-y-auto rounded-xl border border-line">
                {sortedInstallments.map((inst) => {
                  const bal = Math.max(0, inst.amount - inst.paidAmount)
                  const paid = bal <= 0
                  return (
                    <li
                      key={inst.id}
                      className="flex items-start justify-between gap-3 px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium text-ink">{inst.label}</p>
                        <p className="text-[11px] text-ink-muted">
                          {CATEGORY_LABELS[inst.category]} · due{' '}
                          {formatDueDate(inst.dueDate)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="tabular-nums font-semibold text-ink">
                          {formatCurrency(inst.amount)}
                        </p>
                        <p
                          className={`text-[11px] ${
                            paid ? 'text-success' : 'text-warn'
                          }`}
                        >
                          {paid ? 'Paid' : `Bal ${formatCurrency(bal)}`}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Receipts ({sortedReceipts.length})
            </h3>
            {sortedReceipts.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">
                No payments collected yet on this booking.
              </p>
            ) : (
              <ul className="mt-2 max-h-40 divide-y divide-line overflow-y-auto rounded-xl border border-line">
                {sortedReceipts.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-start justify-between gap-2 px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium text-ink">
                        {formatCurrency(
                          Math.round(Number(r.amount) || 0) +
                            Math.round(Number(r.gstAmount) || 0),
                        )}{' '}
                        · {PAYMENT_MODE_LABELS[r.mode]}
                        {Math.round(Number(r.gstAmount) || 0) > 0
                          ? ` · GST ${formatCurrency(Math.round(Number(r.gstAmount) || 0))}`
                          : ''}
                      </p>
                      <p className="text-[11px] text-ink-muted">
                        {formatDueDate(r.paidOn)} ·{' '}
                        {CATEGORY_LABELS[r.category]}
                        {r.collectedByName
                          ? ` · ${r.collectedByName}`
                          : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="flex flex-wrap gap-2 pt-1">
            {canCollect && onCollect && collectibleBalance > 0 && (
              <Button type="button" onClick={onCollect}>
                Collect
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
