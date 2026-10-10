'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@madstoq/ui/erp-page-header'
import { useAuth } from '@/hooks/useAuth'
import { useInventoryFactory } from '@/contexts/InventoryFactoryContext'
import { useToast } from '@/components/providers/ToastProvider'
import { SkeletonPanel, SmartFilterBar, EmptyState, useSmartFilter } from '@/components/ui'
import { dispatchScheduleApi } from '@/lib/api'
import {
  saleStatusBadge,
  saleStatusLabel,
  type DispatchSchedule,
} from '@/components/inventory/DispatchScheduleShared'
import { DateRangeChip, inDateRange } from '@/components/inventory/DateRangeChip'
import { SortTh, cmpStr, nextSortDir } from '@/components/inventory/SortTh'
import {
  AccountantSaleDetailDialog,
  LabAllocateDrawer,
} from '@/components/inventory/OwnerSaleDetailDialog'
import { MobileCard, MobileListToolbar, MobileTabs } from '@/components/inventory/MobileList'

type CoaTab = 'pending' | 'history'
type CoaSort = 'sale' | 'product' | 'qty' | 'status' | 'coa'

const HISTORY_STATUSES = 'coa_issued,invoiced,dispatched'

function historyDate(s: DispatchSchedule) {
  return s.coa_issued_at || s.created_at || s.invoiced_at || s.dispatched_at
}

export default function LabCoaQueuePage() {
  const toast = useToast()
  const { profile, loading: authLoading } = useAuth()
  const { factoryId: ctxFactoryId } = useInventoryFactory()
  const factoryId = ctxFactoryId || profile?.factories?.[0]?.id || ''
  const [tab, setTab] = useState<CoaTab>('pending')
  const [queue, setQueue] = useState<DispatchSchedule[]>([])
  const [history, setHistory] = useState<DispatchSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [detailSaleId, setDetailSaleId] = useState<string | null>(null)
  const [allocateSaleId, setAllocateSaleId] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortCol, setSortCol] = useState<CoaSort>('sale')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const reloadQueue = useCallback(async () => {
    if (!factoryId) {
      setQueue([])
      setLoading(false)
      return
    }
    setLoading(true)
    const res = await dispatchScheduleApi.list(factoryId, undefined, { for: 'lab' })
    if (res.error) toast.error(res.error)
    setQueue((res.sales ?? []) as DispatchSchedule[])
    setLoading(false)
  }, [factoryId, toast])

  const reloadHistory = useCallback(async () => {
    if (!factoryId) {
      setHistory([])
      setHistoryLoading(false)
      return
    }
    setHistoryLoading(true)
    const res = await dispatchScheduleApi.list(factoryId, HISTORY_STATUSES, { for: 'lab' })
    if (res.error) toast.error(res.error)
    setHistory((res.sales ?? []) as DispatchSchedule[])
    setHistoryLoaded(true)
    setHistoryLoading(false)
  }, [factoryId, toast])

  useEffect(() => {
    if (authLoading) return
    void reloadQueue()
  }, [authLoading, reloadQueue])

  useEffect(() => {
    if (tab !== 'history' || !factoryId || historyLoaded) return
    void reloadHistory()
  }, [tab, factoryId, historyLoaded, reloadHistory])

  const source = tab === 'pending' ? queue : history
  const filter = useSmartFilter(source, {
    getSearchText: (s) => [
      s.sale_no,
      s.product_name,
      s.product_code,
      saleStatusLabel(s.status, s.schedule_kind),
      s.coa_no,
    ],
    facets: [
      { key: 'product', label: 'Product', getValue: (s) => s.product_name },
      {
        key: 'status',
        label: 'Status',
        getValue: (s) => s.status,
        formatValue: (id) => saleStatusLabel(id),
      },
    ],
  })

  const visible = useMemo(() => {
    const dated = filter.filtered.filter((s) =>
      inDateRange(tab === 'history' ? historyDate(s) : s.created_at, dateFrom, dateTo),
    )
    const dir = sortDir === 'asc' ? 1 : -1
    return [...dated].sort((a, b) => {
      let cmp = 0
      switch (sortCol) {
        case 'product':
          cmp = cmpStr(a.product_name, b.product_name)
          break
        case 'qty':
          cmp = Number(a.qty) - Number(b.qty)
          break
        case 'status':
          cmp = cmpStr(a.status, b.status)
          break
        case 'coa':
          cmp = cmpStr(historyDate(a), historyDate(b))
          break
        case 'sale':
        default:
          cmp = cmpStr(a.sale_no, b.sale_no)
          break
      }
      return cmp * dir || cmpStr(a.sale_no, b.sale_no)
    })
  }, [filter.filtered, dateFrom, dateTo, sortCol, sortDir, tab])

  function handleSort(col: CoaSort) {
    const next = nextSortDir(col, sortCol, sortDir, ['sale', 'qty', 'coa'])
    setSortCol(next.col)
    setSortDir(next.dir)
  }

  const busy = tab === 'pending' ? loading : historyLoading

  return (
    <AppLayout>
      <div className="w-full p-4 md:p-8">
        <div className="mb-8 hidden lg:block">
        <PageHeader
          title="Dispatch COA"
          subtitle="Lab · allocate finished-goods lots, enter the Tally invoice and drum count, and generate the COA."
          accent="chemist"
        />
        </div>

        <div className="md:hidden">
          <MobileTabs
            ariaLabel="Dispatch COA"
            active={tab}
            onChange={setTab}
            tabs={[
              { key: 'pending', label: 'Pending' },
              { key: 'history', label: 'History' },
            ]}
          />
          {busy ? (
            <p className="py-4 text-sm text-muted">Loading…</p>
          ) : (
            <>
              <MobileListToolbar
                filter={filter}
                placeholder="Search sale, product, status…"
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateChange={(from, to) => {
                  setDateFrom(from)
                  setDateTo(to)
                }}
                resultCount={visible.length}
                noun={{ one: 'schedule', many: 'schedules' }}
                sortOptions={[
                  { col: 'sale', label: 'Sale', kind: 'text' },
                  { col: 'product', label: 'Product', kind: 'text' },
                  { col: 'qty', label: 'Qty', kind: 'number' },
                  { col: 'status', label: 'Status', kind: 'text' },
                  ...(tab === 'history'
                    ? ([{ col: 'coa' as const, label: 'COA issued', kind: 'date' as const }] )
                    : []),
                ]}
                sortCol={sortCol}
                sortDir={sortDir}
                onSort={handleSort}
              />
              {source.length === 0 ? (
                <EmptyState
                  className="rounded-xl bg-panel"
                  title={
                    tab === 'pending'
                      ? 'No schedules waiting for lot allocation.'
                      : 'No issued COAs yet.'
                  }
                />
              ) : visible.length === 0 ? (
                <EmptyState
                  className="rounded-xl bg-panel"
                  title="No schedules match your search or filter."
                />
              ) : (
                <div className="space-y-3">
                  {visible.map((s) => (
                    <MobileCard
                      key={s.id}
                      id={
                        <span className="flex items-center justify-between gap-3">
                          <span className="min-w-0 truncate">{s.sale_no}</span>
                          <span className={`badge shrink-0 ${saleStatusBadge(s.status)}`}>
                            {saleStatusLabel(s.status, s.schedule_kind)}
                          </span>
                        </span>
                      }
                      title={s.product_name}
                      aside={
                        <>
                          <span className="block text-base font-medium tabular-nums text-chemist">
                            {s.qty} {s.unit}
                          </span>
                          <span className="block text-[10px] uppercase tracking-wider text-muted">Qty</span>
                        </>
                      }
                      rows={
                        tab === 'history'
                          ? [{ label: 'COA issued', value: s.coa_issued_at ? s.coa_issued_at.slice(0, 10) : '—' }]
                          : undefined
                      }
                      footer={
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setDetailSaleId(s.id)}
                            className="btn min-w-0 flex-1 border border-text bg-panel px-3 text-primary"
                          >
                            View sale
                          </button>
                          {tab === 'pending' && s.status === 'instructed' ? (
                            <button
                              type="button"
                              onClick={() => setAllocateSaleId(s.id)}
                              className="btn min-w-0 flex-1 border border-pmc bg-pmc px-3 text-white"
                            >
                              Allocate & COA
                            </button>
                          ) : null}
                        </div>
                      }
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="hidden md:block">
        <div className="folder-tabs" role="tablist" aria-label="Dispatch COA">
          {(
            [
              { key: 'pending' as const, label: 'Pending' },
              { key: 'history' as const, label: 'History' },
            ] as const
          ).map((t) => {
            const on = tab === t.key
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t.key)}
                className={on ? 'folder-tab is-active' : 'folder-tab'}
              >
                {t.label}
              </button>
            )
          })}
        </div>
        <section className="folder-panel overflow-hidden">
          {busy ? (
            <div className="p-4">
              <SkeletonPanel />
            </div>
          ) : source.length === 0 ? (
            <p className="p-4 text-sm text-muted">
              {tab === 'pending'
                ? 'No schedules waiting for lot allocation.'
                : 'No issued COAs yet.'}
            </p>
          ) : (
            <>
              <SmartFilterBar
                filter={filter}
                placeholder="Search sale, product, status…"
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
              {visible.length === 0 ? (
                <p className="p-4 text-sm text-muted">No schedules match your search or filter.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table min-w-[720px]">
                    <thead>
                      <tr>
                        <SortTh
                          label="Sale"
                          col="sale"
                          sortCol={sortCol}
                          sortDir={sortDir}
                          onSort={handleSort}
                          accent="chemist"
                        />
                        <SortTh
                          label="Product"
                          col="product"
                          sortCol={sortCol}
                          sortDir={sortDir}
                          onSort={handleSort}
                          accent="chemist"
                        />
                        <SortTh
                          label="Qty"
                          col="qty"
                          sortCol={sortCol}
                          sortDir={sortDir}
                          onSort={handleSort}
                          accent="chemist"
                        />
                        {tab === 'history' ? (
                          <SortTh
                            label="COA issued"
                            col="coa"
                            sortCol={sortCol}
                            sortDir={sortDir}
                            onSort={handleSort}
                            accent="chemist"
                          />
                        ) : null}
                        <SortTh
                          label="Status"
                          col="status"
                          sortCol={sortCol}
                          sortDir={sortDir}
                          onSort={handleSort}
                          accent="chemist"
                        />
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((s) => (
                        <tr key={s.id} className="border-b border-border/60 last:border-0">
                          <td className="font-medium">
                            <button
                              type="button"
                              onClick={() => setDetailSaleId(s.id)}
                              className="text-primary hover:underline"
                            >
                              {s.sale_no}
                            </button>
                          </td>
                          <td>{s.product_name}</td>
                          <td>
                            {s.qty} {s.unit}
                          </td>
                          {tab === 'history' ? (
                            <td className="text-muted">
                              {s.coa_issued_at ? s.coa_issued_at.slice(0, 10) : '—'}
                            </td>
                          ) : null}
                          <td>
                            <span className={`badge ${saleStatusBadge(s.status)}`}>
                              {saleStatusLabel(s.status, s.schedule_kind)}
                            </span>
                          </td>
                          <td>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setDetailSaleId(s.id)}
                                className="inline-flex rounded-full border border-border bg-panel px-3 py-1.5 text-xs font-medium text-primary hover:bg-layer-sm"
                              >
                                View sale
                              </button>
                              {tab === 'pending' && s.status === 'instructed' ? (
                                <button
                                  type="button"
                                  onClick={() => setAllocateSaleId(s.id)}
                                  className="inline-flex rounded-full bg-pmc px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                                >
                                  Allocate & COA
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
        </div>
      </div>
      {detailSaleId ? (
        <AccountantSaleDetailDialog
          saleId={detailSaleId}
          hideCommercial
          onClose={() => setDetailSaleId(null)}
        />
      ) : null}
      {allocateSaleId ? (
        <LabAllocateDrawer
          saleId={allocateSaleId}
          factoryId={factoryId}
          onClose={() => setAllocateSaleId(null)}
          onSaved={() => {
            void reloadQueue()
            if (historyLoaded) void reloadHistory()
          }}
        />
      ) : null}
    </AppLayout>
  )
}
