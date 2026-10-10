'use client'

import { Fragment, useMemo, useState } from 'react'
import RejectReasonSummary from '@/components/inventory/RejectReasonSummary'
import { QcHistoryResultsPanel, useQcSubjectLogs } from '@/components/inventory/QcHistoryResults'
import { Eye, EyeOff } from 'lucide-react'
import { DateRangeChip, inDateRange } from '@/components/inventory/DateRangeChip'
import { MobileCard, MobileListToolbar } from '@/components/inventory/MobileList'
import { SortTh } from '@/components/inventory/SortTh'
import { EmptyState, SmartFilterBar, useSmartFilter } from '@/components/ui'
import { receiptIsQcApproved } from '@/lib/procurement-receipt'

export type ProcurementReceiptRow = {
  id: string
  receipt_number: string
  po_number: string | null
  material_type: string
  vendor_name: string
  received_qty: number
  unit: string
  received_price_per_unit: number
  accepted_price_per_unit?: number | null
  debit_note_ref?: string | null
  return_date?: string | null
  return_vehicle_number?: string | null
  return_notes?: string | null
  status: string
  received_date: string | null
  qc_notes: string | null
  qc_at?: string | null
  sticker_printed_at?: string | null
  sticker_data?: unknown
}

type ReceiptStatus =
  | 'pending_qc'
  | 'awaiting_admin'
  | 'needs_info'
  | 'approved'
  | 'approved_printed'
  | 'rejected'
  | 'returned_to_vendor'
type SortCol = 'receipt' | 'po' | 'vendor' | 'material' | 'qty' | 'price' | 'date' | 'status'
export type ReceiptsBrowserAccent = 'accountant' | 'owner' | 'chemist'

const STATUS_OPTIONS: { id: ReceiptStatus; label: string }[] = [
  { id: 'pending_qc', label: 'Pending lab' },
  { id: 'needs_info', label: 'Needs info' },
  { id: 'awaiting_admin', label: 'Awaiting admin' },
  { id: 'approved', label: 'Approved' },
  { id: 'approved_printed', label: 'Printed' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'returned_to_vendor', label: 'Returned' },
]

function statusLabel(status: string) {
  if (status === 'pending_qc') return 'Pending lab'
  if (status === 'needs_info') return 'Needs info'
  if (status === 'awaiting_admin') return 'Awaiting admin'
  if (status === 'approved_printed') return 'Printed'
  if (status === 'approved') return 'Approved'
  if (status === 'rejected') return 'Rejected'
  if (status === 'returned_to_vendor') return 'Returned'
  return status.replace('_', ' ')
}

function statusBadge(status: string) {
  if (status === 'approved_printed') return 'badge-success'
  if (status === 'approved') return 'badge-chemist'
  if (status === 'rejected' || status === 'returned_to_vendor') return 'badge-danger'
  if (status === 'awaiting_admin') return 'badge-owner'
  if (status === 'needs_info') return 'badge-pmc'
  return 'badge-owner'
}

function isConcession(r: ProcurementReceiptRow) {
  return (r.status === 'approved' || r.status === 'approved_printed') && r.accepted_price_per_unit != null
}

function priceLabel(r: ProcurementReceiptRow) {
  if (isConcession(r)) {
    return `₹${r.accepted_price_per_unit}/${r.unit}`
  }
  return `₹${r.received_price_per_unit}/${r.unit}`
}


type Props = {
  receipts: ProcurementReceiptRow[]
  loading?: boolean
  error?: string
  accent?: ReceiptsBrowserAccent
  emptyMessage?: string
  factoryId?: string
  onPrintSticker?: (row: ProcurementReceiptRow) => void
}

export default function ProcurementReceiptsBrowser({
  receipts,
  loading = false,
  error = '',
  accent = 'accountant',
  emptyMessage = 'No receipts yet.',
  factoryId,
  onPrintSticker,
}: Props) {
  const filterAccent = accent === 'accountant' ? 'pmc' : accent
  const showPrice = accent !== 'chemist'
  const results = useQcSubjectLogs(factoryId, factoryId ? 'rm' : undefined)
  const [sortCol, setSortCol] = useState<SortCol>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir(col === 'date' || col === 'qty' || col === 'price' ? 'desc' : 'asc')
    }
  }

  const filter = useSmartFilter(receipts, {
    getSearchText: (r) => [
      r.receipt_number,
      r.po_number,
      r.vendor_name,
      r.material_type,
      r.qc_notes,
      r.debit_note_ref,
      r.return_vehicle_number,
      statusLabel(r.status),
    ],
    facets: [
      { key: 'vendor', label: 'Vendor', getValue: (r) => r.vendor_name?.trim() || 'Unknown' },
      { key: 'material', label: 'Material', getValue: (r) => r.material_type?.trim() || 'Unknown' },
      {
        key: 'status',
        label: 'Status',
        getValue: (r) => r.status,
        formatValue: statusLabel,
        options: STATUS_OPTIONS,
      },
    ],
  })

  const filtered = useMemo(() => {
    let rows = filter.filtered.filter((r) => inDateRange(r.received_date, dateFrom, dateTo))
    const dir = sortDir === 'asc' ? 1 : -1
    rows = [...rows].sort((a, b) => {
      let cmp = 0
      switch (sortCol) {
        case 'receipt':
          cmp = a.receipt_number.localeCompare(b.receipt_number)
          break
        case 'po':
          cmp = (a.po_number ?? '').localeCompare(b.po_number ?? '')
          break
        case 'vendor':
          cmp = a.vendor_name.localeCompare(b.vendor_name)
          break
        case 'material':
          cmp = a.material_type.localeCompare(b.material_type)
          break
        case 'qty':
          cmp = Number(a.received_qty) - Number(b.received_qty)
          break
        case 'price':
          cmp = Number(a.received_price_per_unit) - Number(b.received_price_per_unit)
          break
        case 'status':
          cmp = a.status.localeCompare(b.status)
          break
        case 'date':
        default:
          cmp = (a.received_date ?? '').localeCompare(b.received_date ?? '')
          break
      }
      return cmp * dir
    })
    return rows
  }, [filter.filtered, sortCol, sortDir, dateFrom, dateTo])

  const sortOptions = useMemo((): MobileSortOption<SortCol>[] => {
    const opts: MobileSortOption<SortCol>[] = [
      { col: 'date', label: 'Date', kind: 'date' },
      { col: 'receipt', label: 'Lot / GRN', kind: 'text' },
      { col: 'po', label: 'PO', kind: 'text' },
      { col: 'vendor', label: 'Vendor', kind: 'text' },
      { col: 'material', label: 'Material', kind: 'text' },
      { col: 'qty', label: 'Qty', kind: 'number' },
    ]
    if (showPrice) opts.push({ col: 'price', label: 'Price', kind: 'number' })
    opts.push({ col: 'status', label: 'Status', kind: 'text' })
    return opts
  }, [showPrice])

  return (
    <div>
      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}
      {loading ? (
        <p className="p-6 text-sm text-muted">Loading…</p>
      ) : receipts.length === 0 ? (
        <>
          <EmptyState className="rounded-xl bg-panel md:hidden" title={emptyMessage} />
          <p className="hidden p-6 text-sm text-muted md:block">{emptyMessage}</p>
        </>
      ) : (
        <>
          <div className="md:hidden">
            <MobileListToolbar
              filter={filter}
              placeholder="Search receipt, PO, vendor…"
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateChange={(from, to) => {
                setDateFrom(from)
                setDateTo(to)
              }}
              resultCount={filtered.length}
              noun={{ one: 'receipt', many: 'receipts' }}
              sortOptions={sortOptions}
              sortCol={sortCol}
              sortDir={sortDir}
              onSort={handleSort}
            />
            {filtered.length === 0 ? (
              <EmptyState
                className="rounded-xl bg-panel"
                title="No receipts match"
                description="Try a different search, status, or date range."
              />
            ) : (
              <div className="space-y-3">
                {filtered.map((r) => {
                  const isOpen = results.expandedId === r.id
                  const logsBusy = results.loadingId === r.id
                  const rows: { label: string; value: React.ReactNode }[] = [
                    { label: 'PO', value: r.po_number ?? '—' },
                    { label: 'Date', value: r.received_date ?? '—' },
                  ]
                  if (showPrice) {
                    rows.push({
                      label: 'Price / unit',
                      value: isConcession(r) ? (
                        <span>
                          {priceLabel(r)}{' '}
                          <span className="text-muted line-through">₹{r.received_price_per_unit}</span>
                        </span>
                      ) : (
                        priceLabel(r)
                      ),
                    })
                  }
                  if (r.status === 'rejected' || r.status === 'returned_to_vendor' || isConcession(r)) {
                    if (r.qc_notes) {
                      rows.push({
                        label: 'QC',
                        value: <RejectReasonSummary qcNotes={r.qc_notes} />,
                      })
                    }
                    if (isConcession(r) && r.debit_note_ref) {
                      rows.push({ label: 'DN/CN', value: r.debit_note_ref })
                    }
                    if (r.status === 'returned_to_vendor') {
                      rows.push({
                        label: 'Returned',
                        value: `${r.return_date ?? '—'}${r.return_vehicle_number ? ` · ${r.return_vehicle_number}` : ''}`,
                      })
                    }
                  }
                  return (
                    <MobileCard
                      key={r.id}
                      id={
                        <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                          <span className="min-w-0 truncate">{r.receipt_number}</span>
                          <span className={`badge shrink-0 whitespace-nowrap ${isConcession(r) ? 'badge-chemist' : statusBadge(r.status)}`}>
                            {isConcession(r) ? 'Approved · discount' : statusLabel(r.status)}
                          </span>
                        </span>
                      }
                      title={r.vendor_name}
                      subtitle={r.material_type}
                      aside={
                        <>
                          <span className="block text-base font-medium tabular-nums text-pmc">
                            {r.received_qty} {r.unit}
                          </span>
                          <span className="block text-[10px] uppercase tracking-wider text-muted">Qty</span>
                        </>
                      }
                      rows={rows}
                      footer={
                        results.enabled || (onPrintSticker && receiptIsQcApproved(r.status)) ? (
                          <div className="space-y-3">
                            {onPrintSticker && receiptIsQcApproved(r.status) ? (
                              <button
                                type="button"
                                className="btn w-full border border-text bg-panel text-primary"
                                onClick={() => onPrintSticker(r)}
                              >
                                {r.status === 'approved_printed' ? 'Reprint' : 'Print'}
                              </button>
                            ) : null}
                            {results.enabled ? (
                              <>
                            <button
                              type="button"
                              className="btn w-full border border-text bg-panel text-primary"
                              onClick={() => void results.toggle(r.id)}
                            >
                              {isOpen ? 'Hide QC results' : 'View QC results'}
                            </button>
                            {isOpen ? (
                              <QcHistoryResultsPanel logs={results.logsById[r.id]} loading={logsBusy} />
                            ) : null}
                              </>
                            ) : null}
                          </div>
                        ) : undefined
                      }
                    />
                  )
                })}
              </div>
            )}
          </div>
          <div className="hidden md:block">
          <SmartFilterBar
            filter={filter}
            placeholder="Search receipt, PO, vendor, material…"
            accent={filterAccent}
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
          {filtered.length === 0 ? (
            <p className="p-6 text-sm text-muted">No receipts match your search or filter.</p>
          ) : (
          <div className="table-panel">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <SortTh label="Lot / GRN" col="receipt" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent={filterAccent} />
                  <SortTh label="PO" col="po" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent={filterAccent} />
                  <SortTh label="Vendor" col="vendor" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent={filterAccent} />
                  <SortTh label="Material" col="material" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent={filterAccent} />
                  <SortTh label="Qty" col="qty" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent={filterAccent} />
                  {showPrice && (
                    <SortTh label="Price / unit" col="price" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent={filterAccent} />
                  )}
                  <SortTh label="Date" col="date" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent={filterAccent} />
                  <SortTh label="Status" col="status" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent={filterAccent} />
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
                {filtered.map((r) => {
                  const isOpen = results.expandedId === r.id
                  const logsBusy = results.loadingId === r.id
                  const colSpan = 8 + (showPrice ? 1 : 0) + (results.enabled ? 1 : 0)
                  return (
                    <Fragment key={r.id}>
                    <tr className={`border-b border-border/60 ${isOpen ? 'bg-chemist/[0.05]' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs text-primary">{r.receipt_number}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">{r.po_number ?? '—'}</td>
                    <td className="px-4 py-3 text-primary">{r.vendor_name}</td>
                    <td className="px-4 py-3 text-muted">{r.material_type}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {r.received_qty} {r.unit}
                    </td>
                    {showPrice && (
                      <td className="px-4 py-3 whitespace-nowrap text-muted">
                        {isConcession(r) ? (
                          <span>
                            ₹{r.accepted_price_per_unit}/{r.unit}
                            <span className="ml-1 text-[11px] text-muted line-through">
                              ₹{r.received_price_per_unit}
                            </span>
                          </span>
                        ) : (
                          <>
                            ₹{r.received_price_per_unit}/{r.unit}
                          </>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 text-muted">{r.received_date ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`badge whitespace-nowrap ${isConcession(r) ? 'badge-chemist' : statusBadge(r.status)}`}>
                        {isConcession(r) ? 'Approved · discount' : statusLabel(r.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-muted">
                      {r.status === 'rejected' ||
                      r.status === 'returned_to_vendor' ||
                      isConcession(r) ? (
                        <div className="space-y-1.5">
                          {r.qc_notes ? <RejectReasonSummary qcNotes={r.qc_notes} /> : null}
                          {isConcession(r) && r.debit_note_ref ? (
                            <p className="text-[11px] text-muted">DN/CN {r.debit_note_ref}</p>
                          ) : null}
                          {r.status === 'returned_to_vendor' ? (
                            <p className="text-[11px] text-muted">
                              Returned {r.return_date ?? '—'}
                              {r.return_vehicle_number ? ` · ${r.return_vehicle_number}` : ''}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs">—</span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        {onPrintSticker && receiptIsQcApproved(r.status) ? (
                          <button
                            type="button"
                            className="btn h-8 shrink-0 whitespace-nowrap border border-text bg-panel px-3 text-xs text-primary"
                            onClick={() => onPrintSticker(r)}
                          >
                            {r.status === 'approved_printed' ? 'Reprint' : 'Print'}
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
                          onClick={() => void results.toggle(r.id)}
                        >
                          {isOpen ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    ) : null}
                      </div>
                    </td>
                  </tr>
                    {results.enabled && isOpen ? (
                      <tr className="border-b border-border/60 bg-surface/40">
                        <td colSpan={colSpan} className="px-4 py-4">
                          <QcHistoryResultsPanel
                            logs={results.logsById[r.id]}
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
          </div>
          )}
          </div>
        </>
      )}
    </div>
  )
}
