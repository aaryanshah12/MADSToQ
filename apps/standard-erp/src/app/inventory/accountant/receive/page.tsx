'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@madstoq/ui/erp-page-header'
import { useAuth } from '@/hooks/useAuth'
import { useInventoryFactory } from '@/contexts/InventoryFactoryContext'
import { procurementApi } from '@/lib/api'
import {
  receiptCountsAsApprovedQty,
  receiptCountsAsPendingQty,
  receiptCountsAsRejectedHoldQty,
} from '@/lib/procurement-receipt'
import { EmptyState, SkeletonPanel, SkeletonText, SmartFilterBar, useSmartFilter } from '@/components/ui'
import { DateRangeChip, inDateRange } from '@/components/inventory/DateRangeChip'
import { SortTh } from '@/components/inventory/SortTh'
import { MobileCard, MobileListToolbar, MobileTabs } from '@/components/inventory/MobileList'
import { useToast } from '@/components/providers/ToastProvider'
import { RecordArrivalForm } from '@/app/inventory/accountant/receive/[poId]/page'
import { MgmtDrawer } from '@/components/inventory/MgmtDrawer'
import ProcurementReceiptsBrowser, {
  type ProcurementReceiptRow,
} from '@/components/inventory/ProcurementReceiptsBrowser'

type ProcurementOrder = {
  id: string
  po_number: string
  supplier_name: string
  material_type: string
  qty: number | null
  unit: string
  price_per_unit?: number | null
  delivery_date: string | null
  status: string
}

type PoRow = ProcurementOrder & {
  orderedQty: number
  approvedQty: number
  pendingQcQty: number
  rejectedHoldQty: number
  remainingQty: number
}

type SortCol = 'po' | 'vendor' | 'material' | 'qty' | 'price' | 'remaining'

function round3(n: number) {
  return Math.round(n * 1000) / 1000
}

function ProgressChip({
  ordered,
  pending,
  approved,
  rejectedHold,
  unit,
}: {
  ordered: number
  pending: number
  approved: number
  rejectedHold: number
  unit: string
}) {
  const recorded = round3(approved + pending + rejectedHold)
  return (
    <div className="space-y-1.5">
      <div className="inline-flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-layer-sm px-2.5 py-1 font-mono text-[11px] text-primary">
        <span>
          {recorded} / {ordered} {unit}
        </span>
        <span className="text-muted">recorded</span>
      </div>
      <div className="flex flex-wrap gap-1.5 text-[11px]">
        {approved > 0 && (
          <span className="rounded border border-chemist/30 bg-chemist/10 px-1.5 py-0.5 text-chemist">
            {approved} approved
          </span>
        )}
        {pending > 0 && (
          <span className="rounded border border-pmc/30 bg-pmc/10 px-1.5 py-0.5 text-pmc">
            {pending} pending QC
          </span>
        )}
        {rejectedHold > 0 && (
          <span className="rounded border border-red-300/60 bg-red-500/10 px-1.5 py-0.5 text-red-600">
            {rejectedHold} rejected — send back to free qty
          </span>
        )}
        {ordered - recorded > 1e-9 && (
          <span className="rounded border border-border px-1.5 py-0.5 text-muted">
            {round3(ordered - recorded)} still due
          </span>
        )}
      </div>
    </div>
  )
}

function MobileProgress({
  ordered,
  pending,
  approved,
  rejectedHold,
  unit,
}: {
  ordered: number
  pending: number
  approved: number
  rejectedHold: number
  unit: string
}) {
  const recorded = round3(approved + pending + rejectedHold)
  return (
    <div className="space-y-1.5">
      <p className="text-xs tabular-nums text-primary">
        {recorded} / {ordered} {unit} <span className="text-muted">recorded</span>
      </p>
      <div className="flex flex-wrap gap-1.5 text-[11px]">
        {approved > 0 && (
          <span className="rounded border border-chemist/30 bg-chemist/10 px-1.5 py-0.5 text-chemist">
            {approved} approved
          </span>
        )}
        {pending > 0 && (
          <span className="rounded border border-pmc/30 bg-pmc/10 px-1.5 py-0.5 text-pmc">
            {pending} pending QC
          </span>
        )}
        {rejectedHold > 0 && (
          <span className="rounded border border-red-300/60 bg-red-500/10 px-1.5 py-0.5 text-red-600">
            {rejectedHold} rejected — send back to free qty
          </span>
        )}
        {ordered - recorded > 1e-9 && (
          <span className="rounded border border-border px-1.5 py-0.5 text-muted">
            {round3(ordered - recorded)} still due
          </span>
        )}
      </div>
    </div>
  )
}

function PoTable({
  rows,
  mode,
  sortCol,
  sortDir,
  onSort,
  onRecord,
  onViewReceipt,
}: {
  rows: PoRow[]
  mode: 'ready' | 'waiting'
  sortCol: SortCol
  sortDir: 'asc' | 'desc'
  onSort: (col: SortCol) => void
  onRecord: (poId: string) => void
  onViewReceipt: (poNumber: string) => void
}) {
  if (rows.length === 0) {
    return (
      <p className="p-6 text-sm text-muted">
                  {mode === 'ready'
          ? 'Nothing left to record right now.'
          : 'No receipts waiting on QC or rejected lots holding qty.'}
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <SortTh label="PO" col="po" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
            <SortTh label="Vendor" col="vendor" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
            <SortTh label="Material" col="material" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
            <SortTh label="Qty" col="qty" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
            <SortTh label="Price / unit" col="price" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
            <SortTh label="Progress" col="remaining" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => {
            const partial =
              o.approvedQty > 0 || o.pendingQcQty > 0 || o.rejectedHoldQty > 0
            return (
              <tr key={o.id} className="border-b border-border/60">
                <td className="px-4 py-3 align-top font-mono text-xs text-primary">
                  {o.po_number}
                  <span className="mt-1 block capitalize text-muted">{o.status}</span>
                </td>
                <td className="px-4 py-3 align-top text-primary">{o.supplier_name}</td>
                <td className="px-4 py-3 align-top text-muted">{o.material_type}</td>
                <td className="px-4 py-3 align-top whitespace-nowrap text-muted">
                  {o.orderedQty} {o.unit}
                </td>
                <td className="px-4 py-3 align-top whitespace-nowrap text-muted">
                  {o.price_per_unit != null ? `₹${o.price_per_unit}/${o.unit}` : '—'}
                </td>
                <td className="px-4 py-3 align-top">
                  <ProgressChip
                    ordered={o.orderedQty}
                    pending={o.pendingQcQty}
                    approved={o.approvedQty}
                    rejectedHold={o.rejectedHoldQty}
                    unit={o.unit}
                  />
                </td>
                <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                  {mode === 'waiting' ? (
                    <button
                      type="button"
                      onClick={() => onViewReceipt(o.po_number)}
                      className="inline-flex rounded-lg border border-pmc/40 px-3 py-1.5 text-xs font-medium text-pmc hover:bg-pmc/10"
                    >
                      View receipt
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onRecord(o.id)}
                      className="inline-flex rounded-lg bg-pmc px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                    >
                      {partial ? 'Record more' : 'Record arrival'}
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function AccountantReceiveListPage() {
  const toast = useToast()
  const { profile, loading: authLoading } = useAuth()
  const { factoryId: ctxFactoryId } = useInventoryFactory()
  const factoryId = ctxFactoryId || profile?.factories?.[0]?.id || ''
  const [rows, setRows] = useState<PoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortCol, setSortCol] = useState<SortCol>('remaining')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [queueFilter, setQueueFilter] = useState<'all' | 'ready' | 'waiting'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [receivePoId, setReceivePoId] = useState<string | null>(null)
  const [receiptPoNumber, setReceiptPoNumber] = useState<string | null>(null)
  const [receiptRows, setReceiptRows] = useState<ProcurementReceiptRow[]>([])

  const reload = useCallback(async () => {
      if (authLoading) return
      if (!factoryId) {
        setRows([])
        setLoading(false)
        return
      }
      setLoading(true)
      setError('')
      const [ordRes, recRes] = await Promise.all([
        procurementApi.listOrders(factoryId),
        procurementApi.listReceipts(factoryId),
      ])
      if (ordRes.error || recRes.error) {
        setError(ordRes.error || recRes.error)
      }

      const receipts = (recRes.receipts ?? []) as (ProcurementReceiptRow & { po_id: string })[]
      setReceiptRows(receipts)
      const byPo = new Map<
        string,
        { approved: number; pending: number; rejectedHold: number }
      >()
      for (const r of receipts) {
        const cur = byPo.get(r.po_id) ?? { approved: 0, pending: 0, rejectedHold: 0 }
        if (receiptCountsAsApprovedQty(r.status)) cur.approved += Number(r.received_qty) || 0
        else if (receiptCountsAsPendingQty(r.status)) cur.pending += Number(r.received_qty) || 0
        else if (receiptCountsAsRejectedHoldQty(r.status)) {
          cur.rejectedHold += Number(r.received_qty) || 0
        }
        byPo.set(r.po_id, cur)
      }

      const open = ((ordRes.orders ?? []) as ProcurementOrder[]).filter(
        (o) => o.status === 'issued' || o.status === 'partial',
      )

      setRows(
        open.map((o) => {
          const orderedQty = Number(o.qty) || 0
          const tallies = byPo.get(o.id) ?? { approved: 0, pending: 0, rejectedHold: 0 }
          const recorded = tallies.approved + tallies.pending + tallies.rejectedHold
          return {
            ...o,
            orderedQty: round3(orderedQty),
            approvedQty: round3(tallies.approved),
            pendingQcQty: round3(tallies.pending),
            rejectedHoldQty: round3(tallies.rejectedHold),
            remainingQty: round3(Math.max(0, orderedQty - recorded)),
          }
        }),
      )
      setLoading(false)
  }, [authLoading, factoryId])

  useEffect(() => {
    void reload()
  }, [reload])

  const filter = useSmartFilter(rows, {
    getSearchText: (r) => [r.po_number, r.supplier_name, r.material_type, r.status],
    facets: [
      { key: 'vendor', label: 'Vendor', getValue: (r) => r.supplier_name },
      { key: 'material', label: 'Material', getValue: (r) => r.material_type },
    ],
  })

  const filteredRows = useMemo(() => {
    let list = filter.filtered.filter((r) => inDateRange(r.delivery_date, dateFrom, dateTo))
    const dir = sortDir === 'asc' ? 1 : -1
    list = [...list].sort((a, b) => {
      let cmp = 0
      switch (sortCol) {
        case 'vendor':
          cmp = a.supplier_name.localeCompare(b.supplier_name)
          break
        case 'material':
          cmp = a.material_type.localeCompare(b.material_type)
          break
        case 'qty':
          cmp = a.orderedQty - b.orderedQty
          break
        case 'price':
          cmp = Number(a.price_per_unit ?? -1) - Number(b.price_per_unit ?? -1)
          break
        case 'po':
          cmp = a.po_number.localeCompare(b.po_number)
          break
        case 'remaining':
        default:
          cmp = a.remainingQty - b.remainingQty
          break
      }
      return cmp * dir || a.po_number.localeCompare(b.po_number)
    })
    return list
  }, [filter.filtered, sortCol, sortDir, dateFrom, dateTo])

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir(col === 'remaining' || col === 'price' || col === 'qty' ? 'desc' : 'asc')
    }
  }

  const ready = useMemo(
    () => filteredRows.filter((r) => r.remainingQty > 1e-9),
    [filteredRows],
  )
  const waiting = useMemo(
    () =>
      filteredRows.filter(
        (r) => r.remainingQty <= 1e-9 && (r.pendingQcQty > 0 || r.rejectedHoldQty > 0),
      ),
    [filteredRows],
  )

  const mobileRows = queueFilter === 'ready' ? ready : queueFilter === 'waiting' ? waiting : [...ready, ...waiting]

  function renderPoCard(o: PoRow, mode: 'ready' | 'waiting') {
    const partial = o.approvedQty > 0 || o.pendingQcQty > 0 || o.rejectedHoldQty > 0
    return (
      <MobileCard
        key={o.id}
        id={
          <span className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate">{o.po_number}</span>
            <span className="badge badge-muted shrink-0 capitalize">{o.status}</span>
          </span>
        }
        title={o.supplier_name}
        subtitle={o.material_type}
        aside={
          <>
            <span className="block text-base font-medium tabular-nums text-pmc">
              {o.remainingQty} {o.unit}
            </span>
            <span className="block text-[10px] uppercase tracking-wider text-muted">Due</span>
          </>
        }
        rows={[
          {
            label: 'Price / unit',
            value: o.price_per_unit != null ? `₹${o.price_per_unit}/${o.unit}` : '—',
          },
          { label: 'Ordered', value: `${o.orderedQty} ${o.unit}` },
        ]}
        footer={
          <div className="space-y-3">
            <MobileProgress
              ordered={o.orderedQty}
              pending={o.pendingQcQty}
              approved={o.approvedQty}
              rejectedHold={o.rejectedHoldQty}
              unit={o.unit}
            />
            {mode === 'waiting' ? (
              <button
                type="button"
                onClick={() => setReceiptPoNumber(o.po_number)}
                className="btn w-full border border-text bg-panel text-primary"
              >
                View receipt
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setReceivePoId(o.id)}
                className="btn w-full border border-pmc bg-pmc text-white"
              >
                {partial ? 'Record more' : 'Record arrival'}
              </button>
            )}
          </div>
        }
      />
    )
  }

  return (
    <AppLayout>
      <div className="w-full p-4 md:p-8">
        <div className="mb-8 hidden lg:block">
          <PageHeader
            title="Receive against PO"
            subtitle="Record arrival here · chemist QC creates stock later"
            accent="accountant"
          />
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="md:hidden">
          {loading ? (
            <SkeletonText lines={4} className="rounded-xl bg-panel p-6" />
          ) : rows.length === 0 ? (
            <div className="rounded-xl bg-panel">
              <EmptyState
                title="No open purchase orders"
                description="POs generated by the owner will appear here, ready to receive against."
              />
            </div>
          ) : (
            <>
              <MobileTabs
                ariaLabel="Receive queues"
                active={queueFilter}
                onChange={setQueueFilter}
                tabs={[
                  { key: 'all', label: 'All' },
                  { key: 'ready', label: 'Ready' },
                  { key: 'waiting', label: 'Waiting' },
                ]}
              />
              <MobileListToolbar
                filter={filter}
                placeholder="Search PO, vendor, material…"
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateChange={(from, to) => {
                  setDateFrom(from)
                  setDateTo(to)
                }}
                resultCount={mobileRows.length}
                noun={{ one: 'PO', many: 'POs' }}
                sortOptions={[
                  { col: 'remaining', label: 'Due', kind: 'number' },
                  { col: 'po', label: 'PO', kind: 'text' },
                  { col: 'vendor', label: 'Vendor', kind: 'text' },
                  { col: 'material', label: 'Material', kind: 'text' },
                  { col: 'qty', label: 'Qty', kind: 'number' },
                  { col: 'price', label: 'Price', kind: 'number' },
                ]}
                sortCol={sortCol}
                sortDir={sortDir}
                onSort={handleSort}
              />
              {mobileRows.length === 0 ? (
                <div className="rounded-xl bg-panel">
                  <EmptyState
                    title={
                      queueFilter === 'waiting'
                        ? 'Nothing waiting on QC'
                        : queueFilter === 'ready'
                          ? 'Nothing left to record'
                          : 'No POs match your search'
                    }
                    description={
                      queueFilter === 'waiting'
                        ? 'No receipts waiting on QC or rejected lots holding qty.'
                        : queueFilter === 'ready'
                          ? 'Nothing left to record right now.'
                          : 'Try a different purchase order number, vendor or material.'
                    }
                  />
                </div>
              ) : queueFilter === 'all' ? (
                <>
                  {ready.length > 0 ? (
                    <div className="space-y-3">
                      {waiting.length > 0 ? (
                        <p className="px-1 text-xs text-muted">Ready to receive</p>
                      ) : null}
                      {ready.map((o) => renderPoCard(o, 'ready'))}
                    </div>
                  ) : null}
                  {waiting.length > 0 ? (
                    <div className={`space-y-3 ${ready.length > 0 ? 'mt-6' : ''}`}>
                      {ready.length > 0 ? (
                        <p className="px-1 text-xs text-muted">Waiting on QC / return</p>
                      ) : null}
                      {waiting.map((o) => renderPoCard(o, 'waiting'))}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="space-y-3">
                  {mobileRows.map((o) => renderPoCard(o, queueFilter))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="hidden space-y-8 md:block">
        {!loading && rows.length > 0 && (
          <div className="card overflow-hidden">
            <SmartFilterBar
              filter={filter}
              placeholder="Search PO, vendor, material…"
              accent="pmc"
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
            <div className="flex flex-wrap gap-2 border-t border-border/70 px-4 py-3">
              {[
                { id: 'all' as const, label: 'All queues' },
                { id: 'ready' as const, label: 'Ready to receive' },
                { id: 'waiting' as const, label: 'Waiting on QC / return' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setQueueFilter(f.id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                    queueFilter === f.id
                      ? 'border-pmc bg-pmc/15 text-pmc'
                      : 'border-border text-muted hover:bg-layer-sm'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <SkeletonPanel />
        ) : rows.length === 0 ? (
          <EmptyState
            className="card"
            title="No open purchase orders"
            description="POs generated by the owner will appear here, ready to receive against."
          />
        ) : filteredRows.length === 0 ? (
          <EmptyState
            className="card"
            title="No POs match your search"
            description="Try a different purchase order number, vendor or material."
          />
        ) : (
          <>
            {(queueFilter === 'all' || queueFilter === 'ready') && (
              <section className="card overflow-hidden">
                <div className="border-b border-border px-4 py-3">
                  <h2 className="font-display text-lg text-primary">Ready to receive</h2>
                  <p className="text-xs text-muted">
                    Qty still left to record ({ready.length})
                  </p>
                </div>
                <PoTable
                  rows={ready}
                  mode="ready"
                  sortCol={sortCol}
                  sortDir={sortDir}
                  onSort={handleSort}
                  onRecord={setReceivePoId}
                  onViewReceipt={setReceiptPoNumber}
                />
              </section>
            )}

            {(queueFilter === 'all' || queueFilter === 'waiting') && (
              <section className="card overflow-hidden">
                <div className="border-b border-border px-4 py-3">
                  <h2 className="font-display text-lg text-primary">Waiting on QC / return</h2>
                  <p className="text-xs text-muted">
                    Full qty recorded — pending QC, or rejected lots still on site ({waiting.length})
                  </p>
                </div>
                <PoTable
                  rows={waiting}
                  mode="waiting"
                  sortCol={sortCol}
                  sortDir={sortDir}
                  onSort={handleSort}
                  onRecord={setReceivePoId}
                  onViewReceipt={setReceiptPoNumber}
                />
              </section>
            )}
          </>
        )}
        </div>
        {receivePoId ? (
          <RecordArrivalForm
            poId={receivePoId}
            onClose={() => {
              setReceivePoId(null)
              void reload()
            }}
            onSaved={(receipt) => {
              toast.success(`Sent for QC · ${receipt.receipt_number}`)
            }}
          />
        ) : null}
        {receiptPoNumber ? (
          <MgmtDrawer
            size="lg"
            eyebrow="Receive"
            title={`Receipts · ${receiptPoNumber}`}
            onClose={() => setReceiptPoNumber(null)}
            footer={
              <button type="button" className="btn btn-ghost" onClick={() => setReceiptPoNumber(null)}>
                Close
              </button>
            }
          >
            <ProcurementReceiptsBrowser
              receipts={receiptRows.filter((r) => r.po_number === receiptPoNumber)}
              loading={false}
              error=""
              accent="accountant"
            />
          </MgmtDrawer>
        ) : null}
      </div>
    </AppLayout>
  )
}
