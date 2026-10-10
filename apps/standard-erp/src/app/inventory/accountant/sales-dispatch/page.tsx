'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@madstoq/ui/erp-page-header'
import { useAuth } from '@/hooks/useAuth'
import { useInventoryFactory } from '@/contexts/InventoryFactoryContext'
import { useToast } from '@/components/providers/ToastProvider'
import { dispatchScheduleApi } from '@/lib/api'
import {
  saleStatusBadge,
  saleStatusLabel,
  type DispatchSchedule,
} from '@/components/inventory/DispatchScheduleShared'
import { DateRangeChip, inDateRange } from '@/components/inventory/DateRangeChip'
import { AccountantInvoiceDrawer, AccountantSaleDetailDialog } from '@/components/inventory/OwnerSaleDetailDialog'
import { EmptyState, SkeletonText, useSmartFilter } from '@/components/ui'
import { MobileCard, MobileListToolbar, MobileTabs } from '@/components/inventory/MobileList'

function isPendingInvoice(s: DispatchSchedule) {
  if (s.schedule_kind === 'byproduct') return s.status === 'instructed'
  return s.status === 'allocated' || s.status === 'coa_issued'
}

type SortCol = 'sale' | 'customer' | 'product' | 'qty' | 'status'

export default function AccountantSalesDispatchPage() {
  const toast = useToast()
  const { profile, loading: authLoading } = useAuth()
  const { factoryId: ctxFactoryId } = useInventoryFactory()
  const factoryId = ctxFactoryId || profile?.factories?.[0]?.id || ''
  const [sales, setSales] = useState<DispatchSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'pending' | 'done'>('pending')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortCol, setSortCol] = useState<SortCol>('sale')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [detailSaleId, setDetailSaleId] = useState<string | null>(null)
  const [invoiceSaleId, setInvoiceSaleId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!factoryId) {
      setSales([])
      setLoading(false)
      return
    }
    setLoading(true)
    const res = await dispatchScheduleApi.list(factoryId, undefined, { for: 'accountant' })
    if (res.error) toast.error(res.error)
    setSales((res.sales ?? []) as DispatchSchedule[])
    setLoading(false)
  }, [factoryId, toast])

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  const pending = useMemo(() => sales.filter(isPendingInvoice), [sales])
  const done = useMemo(
    () => sales.filter((s) => s.status === 'invoiced' || s.status === 'dispatched'),
    [sales],
  )
  const tabRows = tab === 'pending' ? pending : done

  const filter = useSmartFilter(tabRows, {
    getSearchText: (s) => [s.sale_no, s.customer_name, s.product_name, s.status],
    facets: [
      { key: 'customer', label: 'Customer', getValue: (s) => s.customer_name?.trim() || 'Unknown' },
      { key: 'product', label: 'Product', getValue: (s) => s.product_name },
    ],
  })

  const rows = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filter.filtered]
      .filter((s) => inDateRange(s.created_at || s.invoiced_at || s.dispatched_at, dateFrom, dateTo))
      .sort((a, b) => {
        let cmp = 0
        switch (sortCol) {
          case 'customer':
            cmp = (a.customer_name ?? '').localeCompare(b.customer_name ?? '')
            break
          case 'product':
            cmp = a.product_name.localeCompare(b.product_name)
            break
          case 'qty':
            cmp = Number(a.qty) - Number(b.qty)
            break
          case 'status':
            cmp = a.status.localeCompare(b.status)
            break
          case 'sale':
          default:
            cmp = a.sale_no.localeCompare(b.sale_no)
            break
        }
        return cmp * dir || a.sale_no.localeCompare(b.sale_no)
      })
  }, [filter.filtered, dateFrom, dateTo, sortCol, sortDir])

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir(col === 'qty' || col === 'sale' ? 'desc' : 'asc')
    }
  }

  function renderCard(s: DispatchSchedule) {
    return (
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
        title={s.customer_name ?? '—'}
        subtitle={s.product_name}
        aside={
          <>
            <span className="block text-base font-medium tabular-nums text-pmc">
              {s.qty} {s.unit}
            </span>
            <span className="block text-[10px] uppercase tracking-wider text-muted">Qty</span>
          </>
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
            {tab === 'pending' ? (
              <button
                type="button"
                onClick={() => setInvoiceSaleId(s.id)}
                className="btn min-w-0 flex-1 border border-pmc bg-pmc px-3 text-white"
              >
                Add details
              </button>
            ) : null}
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
            title="Dispatch schedule"
            subtitle="Accountant · Tally invoice # and vehicle #"
            accent="accountant"
          />
        </div>

        <div className="md:hidden">
          <MobileTabs
            ariaLabel="Dispatch queue"
            active={tab}
            onChange={setTab}
            tabs={[
              { key: 'pending', label: 'Pending' },
              { key: 'done', label: 'Done' },
            ]}
          />
          {loading ? (
            <SkeletonText lines={4} className="rounded-xl bg-panel p-6" />
          ) : (
            <>
              <MobileListToolbar
                filter={filter}
                placeholder="Search sale, customer, product…"
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateChange={(from, to) => {
                  setDateFrom(from)
                  setDateTo(to)
                }}
                resultCount={rows.length}
                noun={{ one: 'schedule', many: 'schedules' }}
                sortOptions={[
                  { col: 'sale', label: 'Sale', kind: 'text' },
                  { col: 'customer', label: 'Customer', kind: 'text' },
                  { col: 'product', label: 'Product', kind: 'text' },
                  { col: 'qty', label: 'Qty', kind: 'number' },
                  { col: 'status', label: 'Status', kind: 'text' },
                ]}
                sortCol={sortCol}
                sortDir={sortDir}
                onSort={handleSort}
              />
              {tabRows.length === 0 ? (
                <EmptyState
                  className="rounded-xl bg-panel"
                  title={
                    tab === 'pending'
                      ? 'No schedules waiting for invoice.'
                      : 'No invoiced or dispatched schedules yet.'
                  }
                />
              ) : rows.length === 0 ? (
                <EmptyState
                  className="rounded-xl bg-panel"
                  title="No schedules in this date range."
                  description="Clear the date filter to see all."
                />
              ) : (
                <div className="space-y-3">{rows.map(renderCard)}</div>
              )}
            </>
          )}
        </div>

        <div className="hidden md:block">
        <div className="folder-tabs" role="tablist" aria-label="Dispatch queue">
          {(
            [
              { key: 'pending' as const, label: 'Pending' },
              { key: 'done' as const, label: 'Done' },
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
          {sales.length > 0 ? (
            <div className="border-b border-border px-4 py-3">
              <DateRangeChip
                from={dateFrom}
                to={dateTo}
                onChange={(from, to) => {
                  setDateFrom(from)
                  setDateTo(to)
                }}
              />
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="data-table min-w-[720px]">
              <thead>
                <tr>
                  <th>Sale</th>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="text-muted" colSpan={6}>
                      Loading…
                    </td>
                  </tr>
                ) : tabRows.length === 0 ? (
                  <tr>
                    <td className="text-muted" colSpan={6}>
                      {tab === 'pending'
                        ? 'No schedules waiting for invoice.'
                        : 'No invoiced or dispatched schedules yet.'}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td className="text-muted" colSpan={6}>
                      No schedules in this date range. Clear the Date chip to see all.
                    </td>
                  </tr>
                ) : (
                  rows.map((s) => (
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
                      <td>{s.customer_name ?? '—'}</td>
                      <td>{s.product_name}</td>
                      <td>
                        {s.qty} {s.unit}
                      </td>
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
                          {tab === 'pending' ? (
                            <button
                              type="button"
                              onClick={() => setInvoiceSaleId(s.id)}
                              className="inline-flex rounded-full bg-pmc px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                            >
                              Add details
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
        </div>
      </div>
      {detailSaleId ? (
        <AccountantSaleDetailDialog
          saleId={detailSaleId}
          onClose={() => setDetailSaleId(null)}
        />
      ) : null}
      {invoiceSaleId ? (
        <AccountantInvoiceDrawer
          saleId={invoiceSaleId}
          onClose={() => setInvoiceSaleId(null)}
          onSaved={() => void reload()}
        />
      ) : null}
    </AppLayout>
  )
}
