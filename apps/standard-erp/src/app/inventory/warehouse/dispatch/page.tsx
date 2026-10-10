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
import { SortTh, cmpNum, cmpStr, nextSortDir } from '@/components/inventory/SortTh'
import { EmptyState, useSmartFilter } from '@/components/ui'
import { MobileCard, MobileListToolbar } from '@/components/inventory/MobileList'
import {
  AccountantSaleDetailDialog,
  WarehouseConfirmDispatchDrawer,
} from '@/components/inventory/OwnerSaleDetailDialog'

export default function WarehouseDispatchPage() {
  const toast = useToast()
  const { profile, loading: authLoading } = useAuth()
  const { factoryId: ctxFactoryId } = useInventoryFactory()
  const factoryId = ctxFactoryId || profile?.factories?.[0]?.id || ''
  const [sales, setSales] = useState<DispatchSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [sortCol, setSortCol] = useState<'sale' | 'product' | 'vehicle' | 'qty' | 'status'>('sale')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [detailSaleId, setDetailSaleId] = useState<string | null>(null)
  const [confirmSaleId, setConfirmSaleId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!factoryId) {
      setSales([])
      setLoading(false)
      return
    }
    setLoading(true)
    const res = await dispatchScheduleApi.list(factoryId, 'invoiced')
    if (res.error) toast.error(res.error)
    setSales((res.sales ?? []) as DispatchSchedule[])
    setLoading(false)
  }, [factoryId, toast])

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  const filter = useSmartFilter(sales, {
    getSearchText: (s) => [
      s.sale_no,
      s.customer_name,
      s.product_name,
      s.product_code,
      s.vehicle_no,
      saleStatusLabel(s.status, s.schedule_kind),
    ],
    facets: [
      { key: 'product', label: 'Product', getValue: (s) => s.product_name || s.product_code },
      { key: 'vehicle', label: 'Vehicle', getValue: (s) => s.vehicle_no || '—' },
      {
        key: 'status',
        label: 'Status',
        getValue: (s) => s.status,
        formatValue: (id) => saleStatusLabel(id),
      },
    ],
  })

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filter.filtered].sort((a, b) => {
      let cmp = 0
      switch (sortCol) {
        case 'product':
          cmp = cmpStr(a.product_name, b.product_name)
          break
        case 'vehicle':
          cmp = cmpStr(a.vehicle_no, b.vehicle_no)
          break
        case 'qty':
          cmp = cmpNum(a.qty, b.qty)
          break
        case 'status':
          cmp = cmpStr(a.status, b.status)
          break
        case 'sale':
        default:
          cmp = cmpStr(a.sale_no, b.sale_no)
          break
      }
      return cmp * dir || cmpStr(a.sale_no, b.sale_no)
    })
  }, [filter.filtered, sortCol, sortDir])

  function handleSort(col: typeof sortCol) {
    const next = nextSortDir(col, sortCol, sortDir, ['qty', 'sale'])
    setSortCol(next.col)
    setSortDir(next.dir)
  }

  return (
    <AppLayout>
      <div className="w-full p-4 md:p-8">
        <div className="hidden lg:block">
          <PageHeader
            title="Dispatch"
            subtitle="Warehouse · confirm lots loaded on the vehicle"
            accent="accountant"
          />
        </div>
        <div className="md:hidden">
          <MobileListToolbar
            filter={filter}
            placeholder="Search sale, product, vehicle…"
            resultCount={sorted.length}
            noun={{ one: 'load', many: 'loads' }}
            sortOptions={[
              { col: 'sale', label: 'Sale', kind: 'text' },
              { col: 'product', label: 'Product', kind: 'text' },
              { col: 'vehicle', label: 'Vehicle', kind: 'text' },
              { col: 'qty', label: 'Qty', kind: 'number' },
              { col: 'status', label: 'Status', kind: 'text' },
            ]}
            sortCol={sortCol}
            sortDir={sortDir}
            onSort={handleSort}
          />
          {loading ? (
            <p className="py-4 text-sm text-muted">Loading…</p>
          ) : sales.length === 0 ? (
            <EmptyState className="rounded-xl bg-panel" title="No loads waiting for confirmation." />
          ) : sorted.length === 0 ? (
            <EmptyState className="rounded-xl bg-panel" title="No loads match your search or filter." />
          ) : (
            <div className="space-y-3">
              {sorted.map((s) => (
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
                  subtitle={`Vehicle ${s.vehicle_no || '—'}`}
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
                      <button
                        type="button"
                        onClick={() => setConfirmSaleId(s.id)}
                        className="btn min-w-0 flex-1 border border-pmc bg-pmc px-3 text-white"
                      >
                        Confirm
                      </button>
                    </div>
                  }
                />
              ))}
            </div>
          )}
        </div>
        <div className="hidden md:block">
        <div className="table-panel">
          <div className="overflow-x-auto">
            <table className="data-table min-w-[40rem]">
              <thead>
                <tr>
                  <SortTh label="Sale" col="sale" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Product" col="product" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Vehicle" col="vehicle" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Qty" col="qty" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Status" col="status" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
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
                ) : sales.length === 0 ? (
                  <tr>
                    <td className="text-muted" colSpan={6}>
                      No loads waiting for confirmation.
                    </td>
                  </tr>
                ) : (
                  sorted.map((s) => (
                    <tr key={s.id}>
                      <td className="font-mono text-xs">
                        <button
                          type="button"
                          onClick={() => setDetailSaleId(s.id)}
                          className="text-pmc hover:underline"
                        >
                          {s.sale_no}
                        </button>
                      </td>
                      <td>{s.product_name}</td>
                      <td className="font-mono text-xs">{s.vehicle_no || '—'}</td>
                      <td className="tabular-nums">
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
                          <button
                            type="button"
                            onClick={() => setConfirmSaleId(s.id)}
                            className="inline-flex rounded-full bg-pmc px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                          >
                            Confirm
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      </div>
      {detailSaleId ? (
        <AccountantSaleDetailDialog
          saleId={detailSaleId}
          hideCommercial
          onClose={() => setDetailSaleId(null)}
        />
      ) : null}
      {confirmSaleId ? (
        <WarehouseConfirmDispatchDrawer
          saleId={confirmSaleId}
          onClose={() => setConfirmSaleId(null)}
          onSaved={() => void reload()}
        />
      ) : null}
    </AppLayout>
  )
}
