import { useEffect } from 'react'
import { Link } from '@/crm/router'
import {
  Building2,
  CheckCircle2,
  Circle,
  KeyRound,
  X,
  XCircle,
} from 'lucide-react'
import { formatCurrency } from '../../lib/schemes'
import {
  CATEGORY_LABELS,
  type HandoverAssessment,
  type InstallmentRecord,
  isBookingHandedOver,
} from '../../types/payments'
import {
  normalizeBookingRecord,
  type BookingRecord,
} from '../../types/sales'
import { Button } from '../ui/Form'

type Totals = {
  due: number
  paid: number
  balance: number
  complete: boolean
}

import type { BookingFinanceSummary } from '../../lib/bookingFinance'

function CheckItem({
  ok,
  label,
  detail,
}: {
  ok: boolean
  label: string
  detail?: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
      ) : (
        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
      )}
      <div className="min-w-0">
        <p
          className={`text-sm font-medium ${ok ? 'text-ink' : 'text-ink-muted'}`}
        >
          {label}
        </p>
        {detail ? (
          <p className="mt-0.5 text-[11px] text-ink-faint">{detail}</p>
        ) : null}
      </div>
    </div>
  )
}

function MoneyBlock({
  label,
  totals,
  emptyLabel,
}: {
  label: string
  totals: Totals
  emptyLabel?: string
}) {
  if (totals.due <= 0) {
    return (
      <div className="rounded-xl border border-line bg-surface-2/40 px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          {label}
        </p>
        <p className="mt-1 text-sm text-ink-muted">{emptyLabel || 'No schedule'}</p>
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-line bg-surface-2/40 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          {label}
        </p>
        {totals.complete ? (
          <span className="text-[11px] font-semibold text-success">Paid</span>
        ) : (
          <span className="text-[11px] font-semibold text-warn">
            {formatCurrency(totals.balance)} due
          </span>
        )}
      </div>
      <p className="mt-1 text-sm font-semibold tabular-nums text-ink">
        {formatCurrency(totals.paid)}{' '}
        <span className="font-normal text-ink-faint">
          / {formatCurrency(totals.due)}
        </span>
      </p>
    </div>
  )
}

export function HandoverDetailsPanel({
  booking,
  propertyLabel,
  plotsLabel,
  gate,
  finance,
  land,
  construction,
  hasConstruction,
  installments,
  canHandover,
  canAddConstruction,
  isAdmin,
  onClose,
  onHandover,
  onUndo,
}: {
  booking: BookingRecord
  propertyLabel: string
  plotsLabel: string
  gate: HandoverAssessment
  finance: BookingFinanceSummary
  land: Totals
  construction: Totals
  hasConstruction: boolean
  installments: InstallmentRecord[]
  canHandover: boolean
  canAddConstruction: boolean
  isAdmin: boolean
  onClose: () => void
  onHandover: () => void
  onUndo: () => void
}) {
  const handed = isBookingHandedOver(booking)
  const lines = normalizeBookingRecord(booking).plotLines
  const landInst = installments
    .filter((i) => i.category === 'land')
    .sort((a, b) => a.sequence - b.sequence)
  const constInst = installments
    .filter((i) => i.category === 'construction')
    .sort((a, b) => a.sequence - b.sequence)

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const statusLabel = handed
    ? 'Handed over'
    : gate.ready
      ? 'Ready for handover'
      : gate.blockReason || 'Not ready'

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close details"
        onClick={onClose}
      />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-line bg-surface shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
              Handover details
            </p>
            <h2 className="mt-1 truncate font-display text-xl text-ink">
              {booking.customerName}
            </h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              {booking.bookingCode} · {propertyLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-2"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div
            className={`rounded-xl px-3 py-2.5 text-sm font-medium ${
              handed
                ? 'bg-success-soft/60 text-success'
                : gate.ready
                  ? 'bg-brand-soft/60 text-brand'
                  : 'bg-warn-soft/50 text-warn'
            }`}
          >
            {statusLabel}
          </div>

          <section className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              Client
            </h3>
            <dl className="grid grid-cols-[7rem_1fr] gap-x-2 gap-y-1.5 text-sm">
              <dt className="text-ink-faint">Phone</dt>
              <dd className="text-ink">{booking.customerPhone || '—'}</dd>
              <dt className="text-ink-faint">Sales</dt>
              <dd className="text-ink">{booking.salesPerson || '—'}</dd>
              <dt className="text-ink-faint">Property</dt>
              <dd className="text-ink">{propertyLabel}</dd>
              <dt className="text-ink-faint">Plots</dt>
              <dd className="text-ink">{plotsLabel}</dd>
            </dl>
          </section>

          <section className="space-y-2.5">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              Readiness checklist
            </h3>
            <div className="space-y-2.5 rounded-xl border border-line px-3 py-3">
              <CheckItem
                ok={gate.landPaid}
                label="Land EMIs paid"
                detail={
                  land.due > 0
                    ? `${formatCurrency(land.paid)} / ${formatCurrency(land.due)}`
                    : 'No land schedule'
                }
              />
              <CheckItem
                ok={gate.hasMinConstruction}
                label="Construction configured"
                detail={
                  gate.hasMinConstruction
                    ? 'At least one plot has construction'
                    : 'Required before handover'
                }
              />
              <CheckItem
                ok={gate.constructionPaid}
                label="Construction EMIs paid"
                detail={
                  !gate.hasMinConstruction
                    ? 'Configure construction first'
                    : construction.due > 0
                      ? `${formatCurrency(construction.paid)} / ${formatCurrency(construction.due)}`
                      : 'Create construction schedule'
                }
              />
              <CheckItem
                ok={gate.gstPaid || handed}
                label="GST collected"
                detail={
                  finance.gstTarget > 0
                    ? `${formatCurrency(finance.gstCollected)} / ${formatCurrency(finance.gstTarget)}`
                    : 'No cheque GST on this deal'
                }
              />
              <CheckItem
                ok={gate.ready || handed}
                label={handed ? 'Handover completed' : 'Ready to hand over'}
                detail={
                  gate.suggestMoreConstruction && !handed
                    ? 'Extra plots can still add construction (optional)'
                    : undefined
                }
              />
            </div>
            {gate.blockReason && !handed ? (
              <p className="flex items-start gap-2 text-xs text-warn">
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {gate.blockReason}
              </p>
            ) : null}
          </section>

          {lines.length > 0 ? (
            <section className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                Plots
              </h3>
              <ul className="divide-y divide-line rounded-xl border border-line">
                {lines.map((line) => {
                  const configured = Boolean(
                    line.constructionPayment?.configured,
                  )
                  const plotName = line.landPayment?.plotNumber
                    ? `Plot ${line.landPayment.plotNumber}`
                    : line.constructionPayment?.plotNumber
                      ? `Plot ${line.constructionPayment.plotNumber}`
                      : 'Plot'
                  return (
                    <li
                      key={line.plotId}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-ink">{plotName}</p>
                        {configured && line.constructionPayment?.unitType ? (
                          <p className="text-[11px] text-ink-faint">
                            {line.constructionPayment.unitType}
                            {line.constructionPayment.totalValue
                              ? ` · ${formatCurrency(line.constructionPayment.totalValue)}`
                              : ''}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                          configured
                            ? 'bg-success-soft text-success'
                            : 'bg-surface-2 text-ink-muted'
                        }`}
                      >
                        {configured ? 'Construction' : 'Land only'}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}

          <section className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              Payments
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <MoneyBlock label="Land" totals={land} />
              <MoneyBlock
                label="Construction"
                totals={construction}
                emptyLabel={
                  hasConstruction ? 'No schedule yet' : 'Not configured'
                }
              />
            </div>
            <div className="rounded-xl border border-line px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                Deal total
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
                {formatCurrency(finance.total)}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                <span className="text-success">
                  {formatCurrency(finance.collected)} collected
                </span>
                {' · '}
                <span className="text-warn">
                  {formatCurrency(finance.pending)} due
                </span>
              </p>
            </div>
          </section>

          {(landInst.length > 0 || constInst.length > 0) && (
            <section className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                EMI snapshot
              </h3>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-line">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-surface-2 text-[10px] uppercase tracking-wide text-ink-faint">
                    <tr>
                      <th className="px-3 py-2 font-semibold">EMI</th>
                      <th className="px-3 py-2 font-semibold">Due</th>
                      <th className="px-3 py-2 font-semibold text-right">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...landInst, ...constInst].map((i) => {
                      const paid = i.paidAmount >= i.amount
                      const partial =
                        i.paidAmount > 0 && i.paidAmount < i.amount
                      return (
                        <tr key={i.id} className="border-t border-line">
                          <td className="px-3 py-1.5">
                            <span className="text-ink">{i.label}</span>
                            <span className="ml-1 text-ink-faint">
                              ({CATEGORY_LABELS[i.category]})
                            </span>
                          </td>
                          <td className="px-3 py-1.5 tabular-nums text-ink-muted">
                            {i.dueDate}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            {paid ? (
                              <span className="text-success">Paid</span>
                            ) : partial ? (
                              <span className="text-warn">
                                {formatCurrency(i.amount - i.paidAmount)} left
                              </span>
                            ) : (
                              <span className="text-ink-muted">
                                {formatCurrency(i.amount)}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {handed ? (
            <section className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                Handover record
              </h3>
              <dl className="grid grid-cols-[7rem_1fr] gap-x-2 gap-y-1.5 rounded-xl border border-line px-3 py-3 text-sm">
                <dt className="text-ink-faint">Date</dt>
                <dd className="text-ink">{booking.handoverDate || '—'}</dd>
                <dt className="text-ink-faint">By</dt>
                <dd className="text-ink">{booking.handoverByName || '—'}</dd>
                <dt className="text-ink-faint">Notes</dt>
                <dd className="text-ink">{booking.handoverNote || '—'}</dd>
              </dl>
            </section>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-line px-5 py-3">
          {canHandover && gate.ready && !handed && (
            <Button type="button" size="sm" onClick={onHandover}>
              <KeyRound className="h-3.5 w-3.5" />
              Hand over
            </Button>
          )}
          {canAddConstruction &&
            !handed &&
            (gate.requireConstructionConfig || gate.suggestMoreConstruction) && (
              <Link to="/bookings">
                <Button
                  type="button"
                  size="sm"
                  variant={
                    gate.requireConstructionConfig ? 'primary' : 'outline'
                  }
                >
                  <Building2 className="h-3.5 w-3.5" />
                  {gate.requireConstructionConfig
                    ? 'Configure'
                    : 'Add construction'}
                </Button>
              </Link>
            )}
          {isAdmin && handed && (
            <Button type="button" size="sm" variant="outline" onClick={onUndo}>
              Undo handover
            </Button>
          )}
          <Link to="/bookings">
            <Button type="button" size="sm" variant="ghost">
              Booking
            </Button>
          </Link>
          <Link to="/payments">
            <Button type="button" size="sm" variant="ghost">
              Payments
            </Button>
          </Link>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </aside>
    </div>
  )
}
