import { useMemo, useState } from 'react'
import { Link } from '@/crm/router'
import {
  Building2,
  KeyRound,
  Search,
  Undo2,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useBookings } from '../context/BookingContext'
import { useOtherPayments } from '../context/OtherPaymentContext'
import { usePayments } from '../context/PaymentContext'
import { usePlots } from '../context/PlotContext'
import { useSchemes } from '../context/SchemeContext'
import { HandoverDialog } from '../components/booking/HandoverDialog'
import { HandoverDetailsPanel } from '../components/booking/HandoverDetailsPanel'
import { Button, Input } from '../components/ui/Form'
import { buildHandoverOtherContext } from '../lib/handoverOther'
import { formatCurrency } from '../lib/schemes'
import {
  assessHandover,
  categoryTotals,
  isBookingHandedOver,
  type HandoverAssessment,
} from '../types/payments'
import {
  bookingFinancialSummary,
  type BookingFinanceSummary,
} from '../lib/bookingFinance'
import {
  bookingHasConstruction,
  bookingPlotIds,
  canAddConstructionToBooking,
  normalizeBookingRecord,
  type BookingRecord,
} from '../types/sales'

type HandoverTab = 'ready' | 'needs' | 'done'

type HandoverRow = {
  booking: BookingRecord
  gate: HandoverAssessment
  finance: BookingFinanceSummary
  land: { due: number; paid: number; balance: number; complete: boolean }
  construction: {
    due: number
    paid: number
    balance: number
    complete: boolean
  }
  hasConstruction: boolean
  canAddConstruction: boolean
}

export function HandoverPage() {
  const { user } = useAuth()
  const { bookings, updateBooking } = useBookings()
  const { getInstallmentsByBooking, installments, receipts } = usePayments()
  const { receipts: otherReceipts } = useOtherPayments()
  const { schemes, getScheme } = useSchemes()
  const { plots } = usePlots()

  const canHandover = user?.role === 'admin' || user?.role === 'accountant'
  const isAdmin = user?.role === 'admin'

  const [tab, setTab] = useState<HandoverTab>('ready')
  const [query, setQuery] = useState('')
  const [flashMsg, setFlashMsg] = useState<string | null>(null)
  const [handoverBookingId, setHandoverBookingId] = useState<string | null>(
    null,
  )
  const [detailsBookingId, setDetailsBookingId] = useState<string | null>(null)

  const flash = (msg: string) => {
    setFlashMsg(msg)
    window.setTimeout(() => setFlashMsg(null), 3200)
  }

  const schemeName = (id: string) =>
    schemes.find((s) => s.id === id)?.schemeName || '—'

  const plotsLabel = (b: BookingRecord) => {
    const ids = bookingPlotIds(b)
    if (!ids.length) return '—'
    return ids
      .map((id) => {
        const p = plots.find((x) => x.id === id)
        return p ? `Plot ${p.plotNumber}` : '—'
      })
      .join(', ')
  }

  const rows = useMemo((): HandoverRow[] => {
    return bookings
      .filter((b) => b.status !== 'cancelled')
      .map((b) => {
        const inst = getInstallmentsByBooking(b.id)
        const other = buildHandoverOtherContext(
          b,
          getScheme(b.schemeId),
          plots,
          otherReceipts,
        )
        const finance = bookingFinancialSummary(
          b,
          inst,
          receipts,
          getScheme(b.schemeId),
        )
        const gate = assessHandover(b, inst, other, finance.gstPending)
        return {
          booking: b,
          gate,
          finance,
          land: categoryTotals(inst, 'land'),
          construction: categoryTotals(inst, 'construction'),
          hasConstruction: bookingHasConstruction(b),
          canAddConstruction: canAddConstructionToBooking(b),
        }
      })
      .sort((a, b) =>
        a.booking.customerName.localeCompare(b.booking.customerName),
      )
  }, [
    bookings,
    getInstallmentsByBooking,
    getScheme,
    installments,
    otherReceipts,
    plots,
    receipts,
  ])

  const readyRows = useMemo(
    () =>
      rows.filter(
        (r) => r.gate.ready && !isBookingHandedOver(r.booking),
      ),
    [rows],
  )
  const needsRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          !isBookingHandedOver(r.booking) &&
          !r.gate.ready &&
          (r.gate.landPaid ||
            r.gate.requireConstructionConfig ||
            r.gate.blockReason),
      ),
    [rows],
  )
  const doneRows = useMemo(
    () => rows.filter((r) => isBookingHandedOver(r.booking)),
    [rows],
  )

  const activeRows =
    tab === 'ready' ? readyRows : tab === 'needs' ? needsRows : doneRows

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return activeRows
    return activeRows.filter(({ booking: b }) => {
      const hay = [
        b.customerName,
        b.customerPhone,
        b.bookingCode,
        b.salesPerson,
        schemeName(b.schemeId),
        plotsLabel(b),
        ...normalizeBookingRecord(b).plotLines.map((l) =>
          String(l.constructionPayment?.unitType || ''),
        ),
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [activeRows, query, plots, schemes])

  const handoverBooking = handoverBookingId
    ? bookings.find((b) => b.id === handoverBookingId)
    : undefined

  const detailsRow = detailsBookingId
    ? rows.find((r) => r.booking.id === detailsBookingId)
    : undefined

  const confirmHandover = (input: { handoverDate: string; note: string }) => {
    if (!handoverBookingId || !user) return
    const booking = bookings.find((b) => b.id === handoverBookingId)
    if (!booking) return
    const gate = assessHandover(
      booking,
      getInstallmentsByBooking(booking.id),
      buildHandoverOtherContext(
        booking,
        getScheme(booking.schemeId),
        plots,
        otherReceipts,
      ),
      bookingFinancialSummary(
        booking,
        getInstallmentsByBooking(booking.id),
        receipts,
        getScheme(booking.schemeId),
      ).gstPending,
    )
    if (!gate.ready) {
      flash(
        gate.blockReason ||
          'Complete land, construction, GST, and other payments before handover',
      )
      setHandoverBookingId(null)
      return
    }
    updateBooking(handoverBookingId, {
      status: 'completed',
      handoverAt: new Date().toISOString(),
      handoverDate: input.handoverDate,
      handoverById: user.id,
      handoverByName: user.name,
      handoverNote: input.note,
    })
    setHandoverBookingId(null)
    flash('Plot handed over — booking completed, plot sold')
    setTab('done')
  }

  const undoHandover = (id: string) => {
    if (!isAdmin) {
      flash('Only admin can undo handover')
      return
    }
    if (
      !window.confirm(
        'Undo handover? Booking returns to Booked and plot(s) to booked status.',
      )
    ) {
      return
    }
    updateBooking(id, {
      status: 'booked',
      handoverAt: null,
      handoverDate: null,
      handoverById: null,
      handoverByName: '',
      handoverNote: '',
    })
    flash('Handover undone')
    setTab('ready')
  }

  const tabs: { id: HandoverTab; label: string; count: number }[] = [
    { id: 'ready', label: 'Ready', count: readyRows.length },
    { id: 'needs', label: 'Needs action', count: needsRows.length },
    { id: 'done', label: 'Handed over', count: doneRows.length },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
            Possession
          </p>
          <h1 className="mt-1 font-display text-3xl tracking-tight text-ink">
            Handover
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Track plot handover — ready deals, construction gaps, and completed
            handovers in one place.
          </p>
        </div>
      </div>

      {flashMsg && (
        <div className="rounded-xl border border-brand/30 bg-brand-soft/40 px-4 py-2.5 text-sm text-ink">
          {flashMsg}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            className="inline-flex rounded-xl bg-surface-2 p-1"
            role="tablist"
            aria-label="Handover queue"
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  tab === t.id
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {t.label}
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] tabular-nums ${
                    tab === t.id
                      ? 'bg-surface-2 text-ink-muted'
                      : 'bg-surface text-ink-faint'
                  }`}
                >
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          <div className="relative min-w-[220px] flex-1 sm:max-w-xs sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search client, booking, plot…"
              className="h-9 pl-9 text-xs"
            />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl bg-brand-soft/40 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
              Ready now
            </p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-ink">
              {readyRows.length}
            </p>
          </div>
          <div className="rounded-xl bg-surface-2 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
              Needs action
            </p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-ink">
              {needsRows.length}
            </p>
          </div>
          <div className="rounded-xl bg-success-soft/50 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
              Handed over
            </p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-ink">
              {doneRows.length}
            </p>
          </div>
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
          <KeyRound className="mx-auto h-8 w-8 text-ink-faint" />
          <p className="mt-3 text-sm font-semibold text-ink">
            {tab === 'ready'
              ? 'No deals ready for handover'
              : tab === 'needs'
                ? 'Nothing waiting on construction or payments'
                : 'No handovers recorded yet'}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {tab === 'ready'
              ? 'When land + min construction are paid, bookings appear here.'
              : tab === 'needs'
                ? 'Land-paid deals missing construction (or with unpaid construction) show here.'
                : 'Completed handovers will list here with who / when / notes.'}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link to="/bookings">
              <Button type="button" variant="outline" size="sm">
                Bookings
              </Button>
            </Link>
            <Link to="/payments">
              <Button type="button" variant="outline" size="sm">
                Pending Payments
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-2/60 text-[11px] uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Client</th>
                  <th className="px-3 py-2.5 font-semibold">Property</th>
                  <th className="px-3 py-2.5 font-semibold">Land</th>
                  <th className="px-3 py-2.5 font-semibold">Construction</th>
                  <th className="px-3 py-2.5 font-semibold">Deal</th>
                  <th className="px-3 py-2.5 font-semibold">GST</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const { booking: b, gate, finance, land, construction } = row
                  const handed = isBookingHandedOver(b)
                  return (
                    <tr
                      key={b.id}
                      className="border-b border-line last:border-0 hover:bg-surface-2/40"
                    >
                      <td className="px-3 py-2.5 align-top">
                        <div className="font-semibold text-ink">
                          {b.customerName}
                        </div>
                        <div className="text-[11px] text-ink-muted">
                          <span className="font-mono text-ink-faint">
                            {b.bookingCode}
                          </span>
                          {b.customerPhone ? ` · ${b.customerPhone}` : ''}
                        </div>
                        {b.salesPerson ? (
                          <div className="text-[11px] text-ink-faint">
                            Sales · {b.salesPerson}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 align-top text-xs text-ink-muted">
                        <div className="font-medium text-ink">
                          {schemeName(b.schemeId)}
                        </div>
                        <div>{plotsLabel(b)}</div>
                      </td>
                      <td className="px-3 py-2.5 align-top text-xs">
                        {land.due <= 0 ? (
                          <span className="text-ink-faint">No schedule</span>
                        ) : land.complete ? (
                          <span className="font-semibold text-success">
                            Paid
                          </span>
                        ) : (
                          <span className="text-warn">
                            {formatCurrency(land.balance)} due
                          </span>
                        )}
                        {land.due > 0 ? (
                          <div className="text-[11px] tabular-nums text-ink-faint">
                            {formatCurrency(land.paid)} /{' '}
                            {formatCurrency(land.due)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 align-top text-xs">
                        {!row.hasConstruction ? (
                          <span className="font-semibold text-warn">
                            Not configured
                          </span>
                        ) : construction.due <= 0 ? (
                          <span className="text-ink-faint">No schedule</span>
                        ) : construction.complete ? (
                          <span className="font-semibold text-success">
                            Paid
                          </span>
                        ) : (
                          <span className="text-warn">
                            {formatCurrency(construction.balance)} due
                          </span>
                        )}
                        {row.hasConstruction && construction.due > 0 ? (
                          <div className="text-[11px] tabular-nums text-ink-faint">
                            {formatCurrency(construction.paid)} /{' '}
                            {formatCurrency(construction.due)}
                          </div>
                        ) : null}
                        {row.canAddConstruction && gate.suggestMoreConstruction ? (
                          <div className="text-[11px] text-ink-faint">
                            More plots optional
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 align-top text-xs tabular-nums">
                        <div className="font-semibold text-ink">
                          {formatCurrency(finance.total)}
                        </div>
                        <div className="text-[11px] text-ink-faint">
                          <span className="text-success">
                            {formatCurrency(finance.collected)}
                          </span>
                          {' · '}
                          <span className="text-warn">
                            {formatCurrency(finance.pending)} due
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 align-top text-xs tabular-nums">
                        {finance.gstTarget > 0 || finance.gstCollected > 0 ? (
                          <>
                            <div className="font-semibold text-ink">
                              {formatCurrency(finance.gstCollected)}
                            </div>
                            <div className="text-[11px] text-ink-faint">
                              of {formatCurrency(finance.gstTarget)}
                            </div>
                            {finance.gstPending > 0 ? (
                              <div className="text-[11px] font-semibold text-warn">
                                {formatCurrency(finance.gstPending)} due
                              </div>
                            ) : (
                              <div className="text-[11px] font-semibold text-success">
                                Collected
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-ink-faint">No GST</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top text-xs">
                        {handed ? (
                          <div>
                            <span className="rounded-md bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">
                              Handed over
                            </span>
                            <div className="mt-1 text-[11px] text-ink-muted">
                              {b.handoverDate || '—'}
                              {b.handoverByName
                                ? ` · ${b.handoverByName}`
                                : ''}
                            </div>
                            {b.handoverNote ? (
                              <div className="mt-0.5 text-[11px] text-ink-faint">
                                {b.handoverNote}
                              </div>
                            ) : null}
                          </div>
                        ) : gate.ready ? (
                          <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">
                            Ready
                          </span>
                        ) : gate.requireConstructionConfig ? (
                          <span className="rounded-md bg-warn-soft px-2 py-0.5 text-[11px] font-semibold text-warn">
                            Configure construction
                          </span>
                        ) : gate.blockReason ? (
                          <span className="text-ink-muted">
                            {gate.blockReason.replace(/^Land paid — /, '')}
                          </span>
                        ) : gate.landPaid ? (
                          <span className="text-ink-muted">In progress</span>
                        ) : (
                          <span className="text-ink-faint">Land pending</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setDetailsBookingId(b.id)}
                          >
                            Details
                          </Button>
                          {canHandover && gate.ready && !handed && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => setHandoverBookingId(b.id)}
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                              Hand over
                            </Button>
                          )}
                          {row.canAddConstruction &&
                            !handed &&
                            (gate.requireConstructionConfig ||
                              gate.suggestMoreConstruction) && (
                              <Link to="/bookings">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={
                                    gate.requireConstructionConfig
                                      ? 'primary'
                                      : 'outline'
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
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => undoHandover(b.id)}
                            >
                              <Undo2 className="h-3.5 w-3.5" />
                              Undo
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detailsRow && (
        <HandoverDetailsPanel
          booking={detailsRow.booking}
          propertyLabel={schemeName(detailsRow.booking.schemeId)}
          plotsLabel={plotsLabel(detailsRow.booking)}
          gate={detailsRow.gate}
          finance={detailsRow.finance}
          land={detailsRow.land}
          construction={detailsRow.construction}
          hasConstruction={detailsRow.hasConstruction}
          installments={getInstallmentsByBooking(detailsRow.booking.id)}
          canHandover={canHandover}
          canAddConstruction={detailsRow.canAddConstruction}
          isAdmin={isAdmin}
          onClose={() => setDetailsBookingId(null)}
          onHandover={() => {
            setDetailsBookingId(null)
            setHandoverBookingId(detailsRow.booking.id)
          }}
          onUndo={() => {
            setDetailsBookingId(null)
            undoHandover(detailsRow.booking.id)
          }}
        />
      )}

      {handoverBooking && user && (
        <HandoverDialog
          booking={handoverBooking}
          propertyLabel={`${schemeName(handoverBooking.schemeId)} · ${plotsLabel(handoverBooking)}`}
          actorName={user.name}
          onClose={() => setHandoverBookingId(null)}
          onConfirm={confirmHandover}
        />
      )}
    </div>
  )
}
