import { useMemo, useState } from 'react'
import { Search, WalletCards } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useBookings } from '../context/BookingContext'
import { useOtherPayments } from '../context/OtherPaymentContext'
import { usePlots } from '../context/PlotContext'
import { useSchemes } from '../context/SchemeContext'
import {
  CollectOtherPaymentDialog,
  type CollectOtherPaymentSubmit,
} from '../components/payments/CollectOtherPaymentDialog'
import { Button, Input, Select } from '../components/ui/Form'
import { formatCurrency, formatNumber } from '../lib/schemes'
import {
  buildPlotOtherDues,
  type OtherPaymentDue,
} from '../lib/otherPayments'
import { USER_ROLE_LABELS } from '../types/auth'
import { bookingPlotIds } from '../types/sales'
import { normalizeScheme } from '../lib/pricing'

type FilterKey = 'unpaid' | 'paid' | 'all'

type Row = {
  key: string
  bookingId: string
  bookingCode: string
  clientName: string
  schemeId: string
  schemeName: string
  plotId: string
  plotLabel: string
  sbuAreaSqYards: string
  currentPhase: number
  dues: OtherPaymentDue[]
  unpaidCount: number
  allPaid: boolean
}

export function OtherPaymentsPage() {
  const { user } = useAuth()
  const { bookings } = useBookings()
  const { plots } = usePlots()
  const { schemes, getScheme } = useSchemes()
  const { receipts, recordOtherPayment } = useOtherPayments()
  const canCollect = user?.role !== 'sales'

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterKey>('unpaid')
  const [schemeFilter, setSchemeFilter] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [collectRow, setCollectRow] = useState<Row | null>(null)

  const flash = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2800)
  }

  const rows = useMemo(() => {
    const out: Row[] = []
    for (const booking of bookings) {
      if (booking.status === 'cancelled') continue
      const schemeRaw = getScheme(booking.schemeId)
      if (!schemeRaw) continue
      const scheme = normalizeScheme(schemeRaw)
      const plotIds = bookingPlotIds(booking)
      for (const plotId of plotIds) {
        const plot = plots.find((p) => p.id === plotId)
        const line = booking.plotLines?.find((l) => l.plotId === plotId)
        const sbu =
          plot?.sbuAreaSqYards ||
          line?.landPayment?.sbuAreaSqYards ||
          ''
        const plotLabel = plot
          ? `Plot ${plot.plotNumber}`
          : line?.landPayment?.plotNumber
            ? `Plot ${line.landPayment.plotNumber}`
            : plotId.slice(0, 8)
        const dues = buildPlotOtherDues({
          bookingId: booking.id,
          plotId,
          sbuAreaSqYards: sbu,
          scheme,
          receipts,
        })
        if (dues.length === 0) continue
        const unpaidCount = dues.filter((d) => !d.paid && d.principal > 0).length
        out.push({
          key: `${booking.id}:${plotId}`,
          bookingId: booking.id,
          bookingCode: booking.bookingCode,
          clientName: booking.customerName || '—',
          schemeId: booking.schemeId,
          schemeName: scheme.schemeName || scheme.schemeCode || '—',
          plotId,
          plotLabel,
          sbuAreaSqYards: String(sbu || ''),
          currentPhase: Number(scheme.currentPhase) || 1,
          dues,
          unpaidCount,
          allPaid: unpaidCount === 0,
        })
      }
    }
    return out.sort((a, b) => {
      if (a.unpaidCount !== b.unpaidCount) return b.unpaidCount - a.unpaidCount
      return a.clientName.localeCompare(b.clientName)
    })
  }, [bookings, getScheme, plots, receipts])

  const schemeScoped = useMemo(() => {
    if (!schemeFilter) return rows
    return rows.filter((r) => r.schemeId === schemeFilter)
  }, [rows, schemeFilter])

  const filterCounts = useMemo(
    () => ({
      unpaid: schemeScoped.filter((r) => !r.allPaid).length,
      paid: schemeScoped.filter((r) => r.allPaid).length,
      all: schemeScoped.length,
    }),
    [schemeScoped],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return schemeScoped.filter((r) => {
      if (filter === 'unpaid' && r.allPaid) return false
      if (filter === 'paid' && !r.allPaid) return false
      if (!q) return true
      return (
        r.clientName.toLowerCase().includes(q) ||
        r.bookingCode.toLowerCase().includes(q) ||
        r.plotLabel.toLowerCase().includes(q) ||
        r.schemeName.toLowerCase().includes(q)
      )
    })
  }, [schemeScoped, filter, query])

  const handleCollect = (input: CollectOtherPaymentSubmit) => {
    if (!collectRow || !user) return
    try {
      recordOtherPayment({
        bookingId: collectRow.bookingId,
        plotId: collectRow.plotId,
        schemeId: collectRow.schemeId,
        kind: input.kind,
        phase: input.phase,
        months: input.months,
        principal: input.principal,
        gstAmount: input.gstAmount,
        mode: input.mode,
        paidOn: input.paidOn,
        instrument: input.instrument,
        notes: input.notes,
        collectedByUserId: user.id,
        collectedByName: user.name,
        collectedByRole: USER_ROLE_LABELS[user.role],
      })
      setCollectRow(null)
      flash('Other payment recorded')
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Could not record payment')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
            Collections
          </p>
          <h1 className="mt-1 font-display text-3xl text-ink">Other payments</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Club deposit, one-time maintenance, and running maintenance (current
            phase) per plot. Required before handover.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            className="inline-flex max-w-full overflow-x-auto rounded-xl bg-surface-2 p-1"
            role="tablist"
            aria-label="Payment status"
          >
            {(
              [
                { id: 'unpaid' as const, label: 'Unpaid', count: filterCounts.unpaid },
                { id: 'paid' as const, label: 'Fully paid', count: filterCounts.paid },
                { id: 'all' as const, label: 'All', count: filterCounts.all },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={filter === tab.id}
                onClick={() => setFilter(tab.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  filter === tab.id
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {tab.label}
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] tabular-nums ${
                    filter === tab.id
                      ? 'bg-surface-2 text-ink-muted'
                      : 'bg-surface text-ink-faint'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-xl sm:flex-row sm:items-center sm:justify-end">
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
              <Input
                className="h-9 pl-9 text-xs"
                placeholder="Search client, booking, plot…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search"
              />
            </div>
            <div className="w-full sm:w-[11.5rem] sm:shrink-0">
              <Select
                value={schemeFilter}
                onChange={(e) => setSchemeFilter(e.target.value)}
                className="h-9 text-xs"
                aria-label="Filter by scheme"
              >
                <option value="">All schemes</option>
                {schemes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.schemeName || s.schemeCode}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-6 py-16 text-center">
          <WalletCards className="mx-auto h-10 w-10 text-ink-faint" />
          <p className="mt-3 text-sm font-medium text-ink">No other payments</p>
          <p className="mt-1 text-sm text-ink-muted">
            Set club / maintenance rates on the scheme, then book plots to see
            dues here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface-2/80 text-xs uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-4 py-3 font-semibold">Client</th>
                  <th className="px-4 py-3 font-semibold">Booking / plot</th>
                  <th className="px-4 py-3 font-semibold">SBU</th>
                  <th className="px-4 py-3 font-semibold">Dues</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-surface">
                {filtered.map((row) => (
                  <tr key={row.key} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{row.clientName}</p>
                      <p className="text-xs text-ink-muted">{row.schemeName}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{row.bookingCode}</p>
                      <p className="text-xs text-ink-muted">
                        {row.plotLabel} · phase {row.currentPhase}
                      </p>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-ink-muted">
                      {row.sbuAreaSqYards
                        ? `${formatNumber(row.sbuAreaSqYards)} sq.yd`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <ul className="space-y-1">
                        {row.dues.map((d) => (
                          <li
                            key={`${d.kind}-${d.phase ?? ''}`}
                            className="flex flex-wrap items-baseline justify-between gap-2 text-xs sm:text-sm"
                          >
                            <span className="text-ink-muted">{d.label}</span>
                            <span
                              className={`tabular-nums font-medium ${
                                d.paid ? 'text-success' : 'text-ink'
                              }`}
                            >
                              {formatCurrency(d.gross)}
                              {d.paid ? ' · paid' : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-4 py-3">
                      {row.allPaid ? (
                        <span className="rounded-md bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">
                          Complete
                        </span>
                      ) : (
                        <span className="rounded-md bg-warn-soft px-2 py-0.5 text-[11px] font-semibold text-warn">
                          {row.unpaidCount} pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canCollect && !row.allPaid ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setCollectRow(row)}
                        >
                          Collect
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {canCollect && collectRow && (
        <CollectOtherPaymentDialog
          open
          onClose={() => setCollectRow(null)}
          onSubmit={handleCollect}
          dues={collectRow.dues}
          clientName={collectRow.clientName}
          bookingCode={collectRow.bookingCode}
          plotLabel={collectRow.plotLabel}
          sbuAreaSqYards={collectRow.sbuAreaSqYards}
          collectedByLabel={
            user
              ? `${user.name} · ${USER_ROLE_LABELS[user.role]}`
              : undefined
          }
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-canvas shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
