'use client'

import { Fragment, useMemo, useState, type ReactNode } from 'react'
import RejectReasonSummary from '@/components/inventory/RejectReasonSummary'
import { QcHistoryResultsPanel, useQcSubjectLogs } from '@/components/inventory/QcHistoryResults'
import { Eye, EyeOff } from 'lucide-react'
import { DateRangeChip, inDateRange } from '@/components/inventory/DateRangeChip'
import { MobileCard, MobileListToolbar } from '@/components/inventory/MobileList'
import { EmptyState, SmartFilterBar, useSmartFilter } from '@/components/ui'
import { SortTh } from '@/components/inventory/SortTh'
import { qcStatusIsApproved } from '@/lib/qc-sticker'

export type FgQcHistoryRow = {
  id: string
  batch_no: string
  product_code: string | null
  product_name: string | null
  vessel: string | null
  qc_status: string
  qc_sent_at: string | null
  mfg_date?: string | null
  purity?: number | null
  sticker_printed_at?: string | null
  sticker_data?: unknown
  qc_snapshot?: {
    product_code?: string
    product_name?: string
    vessel?: string | null
    finished_products?: Array<{
      name: string
      qty: number
      unit?: string
      requires_qc?: boolean
    }>
    qc_decision?: { notes?: string | null }
  } | null
}

type QcStatus = 'pending_qc' | 'awaiting_admin' | 'needs_info' | 'approved' | 'approved_printed' | 'rejected'
type SortCol = 'batch' | 'product' | 'vessel' | 'forQc' | 'date' | 'status'

const STATUS_OPTIONS: { id: QcStatus; label: string }[] = [
  { id: 'pending_qc', label: 'Pending lab' },
  { id: 'needs_info', label: 'Needs info' },
  { id: 'awaiting_admin', label: 'Awaiting admin' },
  { id: 'approved', label: 'Approved' },
  { id: 'approved_printed', label: 'Printed' },
  { id: 'rejected', label: 'Rejected' },
]

function statusLabel(status: string) {
  if (status === 'pending_qc') return 'Pending lab'
  if (status === 'needs_info') return 'Needs info'
  if (status === 'awaiting_admin') return 'Awaiting admin'
  if (status === 'approved_printed') return 'Printed'
  if (status === 'approved') return 'Approved'
  if (status === 'rejected') return 'Rejected'
  return status.replace('_', ' ')
}

function statusBadge(status: string) {
  if (status === 'approved_printed') return 'badge-success'
  if (status === 'approved') return 'badge-chemist'
  if (status === 'rejected') return 'badge-danger'
  if (status === 'awaiting_admin') return 'badge-owner'
  if (status === 'needs_info') return 'badge-pmc'
  return 'badge-owner'
}

function finishesForQc(row: FgQcHistoryRow) {
  return (row.qc_snapshot?.finished_products ?? []).filter((f) => f.requires_qc !== false)
}

function productLabel(row: FgQcHistoryRow) {
  return row.product_code || row.qc_snapshot?.product_code || '—'
}

function productName(row: FgQcHistoryRow) {
  return row.product_name || row.qc_snapshot?.product_name || ''
}

function dateLabel(value: string | null | undefined) {
  if (!value) return '—'
  return value.slice(0, 10)
}

function qcNotes(row: FgQcHistoryRow) {
  return row.qc_snapshot?.qc_decision?.notes ?? null
}

type Props = {
  batches: FgQcHistoryRow[]
  loading?: boolean
  error?: string
  emptyMessage?: string
  factoryId?: string
  stage?: 'sfg' | 'fg'
  onPrintSticker?: (row: FgQcHistoryRow) => void
}

export default function FgQcBatchesBrowser({
  batches,
  loading = false,
  error = '',
  emptyMessage = 'No SFG QC batches yet.',
  factoryId,
  stage = 'sfg',
  onPrintSticker,
}: Props) {
  const results = useQcSubjectLogs(factoryId, factoryId ? stage : undefined)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortCol, setSortCol] = useState<SortCol>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir(col === 'date' ? 'desc' : 'asc')
    }
  }

  const filter = useSmartFilter(batches, {
    getSearchText: (b) => [
      b.batch_no,
      productLabel(b),
      productName(b),
      b.vessel,
      finishesForQc(b).map((f) => f.name).join(' '),
      statusLabel(b.qc_status),
      qcNotes(b),
    ],
    facets: [
      { key: 'product', label: 'Product', getValue: (b) => productLabel(b) },
      {
        key: 'status',
        label: 'Status',
        getValue: (b) => b.qc_status,
        formatValue: statusLabel,
        options: STATUS_OPTIONS,
      },
    ],
  })

  const filtered = useMemo(() => {
    let rows = filter.filtered.filter((b) => inDateRange(b.qc_sent_at || b.mfg_date, dateFrom, dateTo))

    const dir = sortDir === 'asc' ? 1 : -1
    rows = [...rows].sort((a, b) => {
      let cmp = 0
      switch (sortCol) {
        case 'batch':
          cmp = a.batch_no.localeCompare(b.batch_no)
          break
        case 'product':
          cmp = productLabel(a).localeCompare(productLabel(b))
          break
        case 'vessel':
          cmp = (a.vessel ?? '').localeCompare(b.vessel ?? '')
          break
        case 'forQc':
          cmp = finishesForQc(a)
            .map((f) => f.name)
            .join(', ')
            .localeCompare(finishesForQc(b).map((f) => f.name).join(', '))
          break
        case 'status':
          cmp = a.qc_status.localeCompare(b.qc_status)
          break
        case 'date':
        default:
          cmp = (a.qc_sent_at ?? a.mfg_date ?? '').localeCompare(b.qc_sent_at ?? b.mfg_date ?? '')
          break
      }
      return cmp * dir
    })
    return rows
  }, [filter.filtered, sortCol, sortDir, dateFrom, dateTo])

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <p className="p-6 text-sm text-muted">Loading…</p>
      ) : batches.length === 0 ? (
        <>
          <EmptyState className="rounded-xl bg-panel md:hidden" title={emptyMessage} />
          <p className="hidden p-6 text-sm text-muted md:block">{emptyMessage}</p>
        </>
      ) : (
        <>
          <div className="md:hidden">
            <MobileListToolbar
              filter={filter}
              placeholder="Search batch, product, vessel…"
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateChange={(from, to) => {
                setDateFrom(from)
                setDateTo(to)
              }}
              resultCount={filtered.length}
              noun={{ one: 'batch', many: 'batches' }}
              sortOptions={[
                { col: 'batch', label: 'Batch', kind: 'text' },
                { col: 'product', label: 'Product', kind: 'text' },
                { col: 'vessel', label: 'Vessel', kind: 'text' },
                { col: 'forQc', label: 'For QC', kind: 'text' },
                { col: 'date', label: 'Sent', kind: 'date' },
                { col: 'status', label: 'Status', kind: 'text' },
              ]}
              sortCol={sortCol}
              sortDir={sortDir}
              onSort={handleSort}
            />
            {filtered.length === 0 ? (
              <EmptyState
                className="rounded-xl bg-panel"
                title="No batches match"
                description="Try a different search, status, or date range."
              />
            ) : (
              <div className="space-y-3">
                {filtered.map((b) => {
                  const finished = finishesForQc(b)
                  const notes = qcNotes(b)
                  const isOpen = results.expandedId === b.id
                  const logsBusy = results.loadingId === b.id
                  const rows: { label: string; value: ReactNode }[] = [
                    { label: 'Vessel', value: b.vessel || b.qc_snapshot?.vessel || '—' },
                    { label: 'Sent', value: dateLabel(b.qc_sent_at || b.mfg_date) },
                    {
                      label: 'For QC',
                      value:
                        finished.length === 0
                          ? '—'
                          : finished.map((f) => f.name).join(', '),
                    },
                  ]
                  if (b.qc_status === 'rejected' && notes) {
                    rows.push({
                      label: 'QC',
                      value: <RejectReasonSummary qcNotes={notes} />,
                    })
                  }
                  return (
                    <MobileCard
                      key={b.id}
                      id={
                        <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                          <span className="min-w-0 truncate">{b.batch_no}</span>
                          <span className={`badge shrink-0 whitespace-nowrap ${statusBadge(b.qc_status)}`}>
                            {statusLabel(b.qc_status)}
                          </span>
                        </span>
                      }
                      title={productName(b) || productLabel(b)}
                      subtitle={productName(b) ? productLabel(b) : undefined}
                      footer={
                        results.enabled || (onPrintSticker && qcStatusIsApproved(b.qc_status)) ? (
                          <div className="space-y-3">
                            {onPrintSticker && qcStatusIsApproved(b.qc_status) ? (
                              <button
                                type="button"
                                className="btn w-full border border-text bg-panel text-primary"
                                onClick={() => onPrintSticker(b)}
                              >
                                {b.qc_status === 'approved_printed' ? 'Reprint' : 'Generate'}
                              </button>
                            ) : null}
                            {results.enabled ? (
                              <>
                            <button
                              type="button"
                              className="btn w-full border border-text bg-panel text-primary"
                              onClick={() => void results.toggle(b.id)}
                            >
                              {isOpen ? 'Hide QC results' : 'View QC results'}
                            </button>
                            {isOpen ? (
                              <QcHistoryResultsPanel
                                logs={results.logsById[b.id]}
                                loading={logsBusy}
                              />
                            ) : null}
                              </>
                            ) : null}
                          </div>
                        ) : undefined
                      }
                      rows={rows}
                    />
                  )
                })}
              </div>
            )}
          </div>

          <div className="hidden md:block">
      <SmartFilterBar
        filter={filter}
        placeholder="Search batch, product, vessel…"
        accent="chemist"
        chipExtras={
          <DateRangeChip
            from={dateFrom}
            to={dateTo}
            onChange={(from, to) => {
              setDateFrom(from)
              setDateTo(to)
            }}
          />
        }
      />

      <section className="card overflow-hidden">
        {filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted">No batches match your search or filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <SortTh label="Batch" col="batch" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="chemist" />
                  <SortTh label="Product" col="product" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="chemist" />
                  <SortTh label="Vessel" col="vessel" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="chemist" />
                  <SortTh label="For QC" col="forQc" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="chemist" />
                  <SortTh label="Sent" col="date" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="chemist" />
                  <SortTh label="Status" col="status" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="chemist" />
                  <th className="px-4 py-3 font-mono text-xs uppercase tracking-wider text-muted">
                    QC reason
                  </th>
                  {results.enabled ? (
                    <th className="whitespace-nowrap px-2 py-3 text-right font-mono text-xs uppercase tracking-wider text-muted">
                      <span className="sr-only">Results</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => {
                  const finished = finishesForQc(b)
                  const notes = qcNotes(b)
                  const isOpen = results.expandedId === b.id
                  const logsBusy = results.loadingId === b.id
                  return (
                    <Fragment key={b.id}>
                    <tr className={`border-b border-border/60 ${isOpen ? 'bg-chemist/[0.05]' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs text-primary">{b.batch_no}</td>
                      <td className="px-4 py-3 text-muted">
                        {productLabel(b)}
                        {productName(b) ? (
                          <span className="block text-[11px] text-muted/80">{productName(b)}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-muted">{b.vessel || b.qc_snapshot?.vessel || '—'}</td>
                      <td className="max-w-[16rem] px-4 py-3">
                        {finished.length === 0 ? (
                          <span className="text-[11px] text-muted">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {finished.map((f, i) => (
                              <span
                                key={`${f.name}-${i}`}
                                className="inline-flex max-w-full truncate rounded-md bg-chemist/10 px-1.5 py-0.5 text-[11px] font-medium text-chemist"
                                title={`${f.name}: ${Number(f.qty).toFixed(3)} ${f.unit || 'Kg'}`}
                              >
                                {f.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted">{dateLabel(b.qc_sent_at || b.mfg_date)}</td>
                      <td className="px-4 py-3">
                        <span className={`badge whitespace-nowrap ${statusBadge(b.qc_status)}`}>
                          {statusLabel(b.qc_status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-muted">
                        {b.qc_status === 'rejected' && notes ? (
                          <RejectReasonSummary qcNotes={notes} />
                        ) : (
                          <span className="text-xs">—</span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                        {onPrintSticker && qcStatusIsApproved(b.qc_status) ? (
                          <button
                            type="button"
                            className="btn h-8 shrink-0 whitespace-nowrap border border-text bg-panel px-3 text-xs text-primary"
                            onClick={() => onPrintSticker(b)}
                          >
                            {b.qc_status === 'approved_printed' ? 'Reprint' : 'Generate'}
                          </button>
                        ) : null}
                      {results.enabled ? (
                          <button
                            type="button"
                            aria-label={isOpen ? 'Hide results' : 'View results'}
                            aria-expanded={isOpen}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${
                              isOpen
                                ? 'bg-chemist/15 text-chemist'
                                : 'text-muted hover:bg-layer-sm hover:text-chemist'
                            }`}
                            onClick={() => void results.toggle(b.id)}
                          >
                            {isOpen ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                      ) : null}
                        </div>
                      </td>
                    </tr>
                    {results.enabled && isOpen ? (
                      <tr className="border-b border-border/60 bg-surface/40">
                        <td colSpan={8} className="px-4 py-4">
                          <QcHistoryResultsPanel
                            logs={results.logsById[b.id]}
                            loading={logsBusy}
                          />
                        </td>
                      </tr>
                    ) : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
          </div>
        </>
      )}
    </div>
  )
}
