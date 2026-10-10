'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { IndianRupee } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@madstoq/ui/erp-page-header'
import { useAuth } from '@/hooks/useAuth'
import { useInventoryFactory } from '@/contexts/InventoryFactoryContext'
import { useToast } from '@/components/providers/ToastProvider'
import { dispatchScheduleApi } from '@/lib/api'
import { LedgerKindTabs } from '@/components/inventory/LedgerKindTabs'
import {
  saleStatusBadge,
  saleStatusLabel,
  type DispatchSchedule,
} from '@/components/inventory/DispatchScheduleShared'
import { EmptyState, SmartFilterBar, TableSkeleton, useSmartFilter } from '@/components/ui'
import { DateRangeChip, inDateRange } from '@/components/inventory/DateRangeChip'
import { SortTh } from '@/components/inventory/SortTh'
import { OwnerSaleDetailDialog } from '@/components/inventory/OwnerSaleDetailDialog'
import { MobileCard, MobileListToolbar, MobileTabs } from '@/components/inventory/MobileList'

type SalesTab = 'invoices' | 'pending'
type InvoiceSort = 'date' | 'customer' | 'product' | 'qty' | 'amount' | 'sale'

const SALES_TABS: Array<{ key: SalesTab; label: string }> = [
  { key: 'invoices', label: 'Invoices' },
  { key: 'pending', label: 'Pending invoice' },
]

function isBilled(s: DispatchSchedule) {
  return s.status === 'invoiced' || s.status === 'dispatched' || Boolean(s.tally_invoice_no)
}

function isPendingInvoice(s: DispatchSchedule) {
  if (s.schedule_kind === 'byproduct') return s.status === 'instructed'
  return s.status === 'allocated' || s.status === 'coa_issued'
}

function lineAmount(s: DispatchSchedule) {
  return Number(s.qty || 0) * Number(s.rate || 0)
}

function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

function formatQty(n: number, unit = 'Kg') {
  const v = Number(n) || 0
  const text = Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  return `${text} ${unit}`
}

function formatWhen(value: string | null | undefined) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function billedAt(s: DispatchSchedule) {
  return s.invoiced_at || s.dispatched_at || s.created_at || null
}

function cmpText(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? '').localeCompare(b ?? '', undefined, { numeric: true, sensitivity: 'base' })
}


export default function OwnerSalesPage() {
  const toast = useToast()
  const { profile, loading: authLoading } = useAuth()
  const { factoryId: ctxFactoryId } = useInventoryFactory()
  const factoryId = ctxFactoryId || profile?.factories?.[0]?.id || ''
  const [sales, setSales] = useState<DispatchSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<SalesTab>('invoices')
  const [sortCol, setSortCol] = useState<InvoiceSort>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [detailSaleId, setDetailSaleId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!factoryId) {
      setSales([])
      setLoading(false)
      return
    }
    setLoading(true)
    const res = await dispatchScheduleApi.list(factoryId)
    if (res.error) toast.error(res.error)
    setSales((res.sales ?? []) as DispatchSchedule[])
    setLoading(false)
  }, [factoryId, toast])

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  const billed = useMemo(() => sales.filter(isBilled), [sales])
  const pending = useMemo(() => sales.filter(isPendingInvoice), [sales])
  const billedInRange = useMemo(
    () => billed.filter((s) => inDateRange(billedAt(s), dateFrom, dateTo)),
    [billed, dateFrom, dateTo],
  )

  const pendingFilter = useSmartFilter(pending, {
    getSearchText: (s) => [
      s.sale_no,
      s.customer_name,
      s.product_name,
      s.product_code,
      s.status,
    ],
    facets: [
      { key: 'customer', label: 'Customer', getValue: (s) => s.customer_name || '—' },
      { key: 'product', label: 'Product', getValue: (s) => s.product_name },
      {
        key: 'kind',
        label: 'Kind',
        getValue: (s) => (s.schedule_kind === 'byproduct' ? 'Byproduct' : 'Finished goods'),
      },
    ],
  })

  const invoiceFilter = useSmartFilter(billedInRange, {
    getSearchText: (s) => [
      s.sale_no,
      s.tally_invoice_no,
      s.customer_name,
      s.product_name,
      s.product_code,
      s.client_po_no,
      s.vehicle_no,
      s.status,
    ],
    facets: [
      { key: 'customer', label: 'Customer', getValue: (s) => s.customer_name || '—' },
      { key: 'product', label: 'Product', getValue: (s) => s.product_name },
      {
        key: 'kind',
        label: 'Kind',
        getValue: (s) => (s.schedule_kind === 'byproduct' ? 'Byproduct' : 'Finished goods'),
      },
      { key: 'status', label: 'Status', getValue: (s) => saleStatusLabel(s.status, s.schedule_kind) },
    ],
  })

  const sortedInvoices = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...invoiceFilter.filtered].sort((a, b) => {
      let cmp = 0
      switch (sortCol) {
        case 'customer':
          cmp = cmpText(a.customer_name, b.customer_name)
          break
        case 'product':
          cmp = cmpText(a.product_name, b.product_name)
          break
        case 'qty':
          cmp = Number(a.qty || 0) - Number(b.qty || 0)
          break
        case 'amount':
          cmp = lineAmount(a) - lineAmount(b)
          break
        case 'sale':
          cmp = cmpText(a.sale_no, b.sale_no)
          break
        case 'date':
        default:
          cmp = cmpText(billedAt(a), billedAt(b))
          break
      }
      return cmp * dir || cmpText(a.sale_no, b.sale_no)
    })
  }, [invoiceFilter.filtered, sortCol, sortDir])

  function handleSort(col: InvoiceSort) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir(col === 'customer' || col === 'product' || col === 'sale' ? 'asc' : 'desc')
    }
  }

  const billedQty = useMemo(() => billed.reduce((sum, s) => sum + Number(s.qty || 0), 0), [billed])
  const billedTotal = useMemo(() => billed.reduce((sum, s) => sum + lineAmount(s), 0), [billed])

  const invoiceTotal = sortedInvoices.reduce((sum, s) => sum + lineAmount(s), 0)

  function saleCard(s: DispatchSchedule) {
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
            <span className="block text-base font-medium tabular-nums text-owner">
              {formatInr(lineAmount(s))}
            </span>
            <span className="block text-[10px] uppercase tracking-wider text-muted">
              {formatQty(Number(s.qty), s.unit)}
            </span>
          </>
        }
        rows={[
          { label: 'Invoice', value: s.tally_invoice_no || '—' },
          { label: 'Kind', value: s.schedule_kind === 'byproduct' ? 'Byproduct' : 'Finished goods' },
        ]}
        footer={
          <button
            type="button"
            onClick={() => setDetailSaleId(s.id)}
            className="btn w-full border border-owner bg-owner text-white"
          >
            View sale
          </button>
        }
      />
    )
  }

  return (
    <AppLayout>
      <div className="w-full p-4 md:p-8">
        <div className="mb-8 hidden lg:block">
        <PageHeader
          title="Sales"
          subtitle="Owner · billed and ready-to-invoice dispatches"
          accent="owner"
        />
        </div>

        <div className="mb-4 hidden grid-cols-2 gap-3 md:grid lg:grid-cols-3">
          <button
            type="button"
            onClick={() => setTab('invoices')}
            className="rounded-xl border border-border bg-[var(--color-panel)] px-4 py-3 text-left"
          >
            <p className="text-[11px] uppercase tracking-wider text-muted">Billed</p>
            <p className="mt-1 text-lg font-semibold text-primary">{formatInr(billedTotal)}</p>
            <p className="text-xs text-muted">{billed.length} invoice{billed.length === 1 ? '' : 's'}</p>
          </button>
          <button
            type="button"
            onClick={() => setTab('invoices')}
            className="rounded-xl border border-border bg-[var(--color-panel)] px-4 py-3 text-left"
          >
            <p className="text-[11px] uppercase tracking-wider text-muted">Qty billed</p>
            <p className="mt-1 text-lg font-semibold text-primary">{formatQty(billedQty)}</p>
            <p className="text-xs text-muted">Finished goods + byproduct</p>
          </button>
          <button
            type="button"
            onClick={() => setTab('pending')}
            className="rounded-xl border border-border bg-[var(--color-panel)] px-4 py-3 text-left"
          >
            <p className="text-[11px] uppercase tracking-wider text-muted">Pending invoice</p>
            <p className="mt-1 text-lg font-semibold text-primary">{pending.length}</p>
            <p className="text-xs text-muted">COA done / byproduct ready</p>
          </button>
        </div>

        <div className="md:hidden">
          <MobileTabs
            ariaLabel="Sales"
            active={tab}
            onChange={setTab}
            tabs={[
              { key: 'invoices', label: 'Invoices' },
              { key: 'pending', label: 'Pending' },
            ]}
          />
          {loading ? (
            <p className="py-4 text-sm text-muted">Loading…</p>
          ) : tab === 'invoices' ? (
            <>
              <MobileListToolbar
                filter={invoiceFilter}
                placeholder="Search sale, invoice, customer…"
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateChange={(from, to) => {
                  setDateFrom(from)
                  setDateTo(to)
                }}
                resultCount={sortedInvoices.length}
                noun={{ one: 'invoice', many: 'invoices' }}
                sortOptions={[
                  { col: 'sale', label: 'Sale', kind: 'text' },
                  { col: 'date', label: 'Date', kind: 'date' },
                  { col: 'customer', label: 'Customer', kind: 'text' },
                  { col: 'product', label: 'Product', kind: 'text' },
                  { col: 'qty', label: 'Qty', kind: 'number' },
                  { col: 'amount', label: 'Amount', kind: 'number' },
                ]}
                sortCol={sortCol}
                sortDir={sortDir}
                onSort={handleSort}
              />
              {sortedInvoices.length === 0 ? (
                <EmptyState
                  className="rounded-xl bg-panel"
                  icon={<IndianRupee size={28} strokeWidth={1.5} />}
                  title={billed.length === 0 ? 'No billed dispatches yet' : 'No invoices in this view'}
                  description={
                    billed.length === 0
                      ? 'When the accountant records a Tally invoice, it appears here.'
                      : 'Try a different search or clear the filter chips.'
                  }
                />
              ) : (
                <div className="space-y-3">{sortedInvoices.map(saleCard)}</div>
              )}
            </>
          ) : (
            <>
              <MobileListToolbar
                filter={pendingFilter}
                placeholder="Search sale, customer, product…"
                resultCount={pendingFilter.filtered.length}
                noun={{ one: 'sale', many: 'sales' }}
                sortOptions={[
                  { col: 'sale', label: 'Sale', kind: 'text' },
                  { col: 'customer', label: 'Customer', kind: 'text' },
                  { col: 'product', label: 'Product', kind: 'text' },
                  { col: 'qty', label: 'Qty', kind: 'number' },
                  { col: 'amount', label: 'Amount', kind: 'number' },
                ]}
                sortCol={sortCol}
                sortDir={sortDir}
                onSort={handleSort}
              />
              {pending.length === 0 ? (
                <EmptyState
                  className="rounded-xl bg-panel"
                  icon={<IndianRupee size={28} strokeWidth={1.5} />}
                  title="Nothing waiting for invoice"
                  description="FG after COA and byproduct after create show here until the accountant records Tally."
                />
              ) : pendingFilter.filtered.length === 0 ? (
                <EmptyState className="rounded-xl bg-panel" title="No sales match" />
              ) : (
                <div className="space-y-3">{pendingFilter.filtered.map(saleCard)}</div>
              )}
            </>
          )}
        </div>

        <div className="hidden md:block">
        <LedgerKindTabs tab={tab} onChange={setTab} tabs={SALES_TABS}>
          {tab === 'invoices' && !loading && (
            <SmartFilterBar
              filter={invoiceFilter}
              placeholder="Search sale, invoice, customer, product, PO…"
              accent="owner"
              chipExtras={
                <DateRangeChip
                  from={dateFrom}
                  to={dateTo}
                  onChange={(nextFrom, nextTo) => {
                    setDateFrom(nextFrom)
                    setDateTo(nextTo)
                  }}
                />
              }
            />
          )}

          <div className="overflow-x-auto">
            {tab === 'invoices' && (
              <table className="data-table min-w-[820px]">
                <thead>
                  <tr>
                    <SortTh label="Sale" col="sale" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                    <th>Invoice</th>
                    <SortTh label="Date" col="date" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                    <SortTh label="Customer" col="customer" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                    <SortTh label="Product" col="product" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                    <SortTh label="Qty" col="qty" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                    <SortTh label="Amount" col="amount" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <TableSkeleton columns={8} rows={5} />
                  ) : sortedInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-0">
                        <EmptyState
                          icon={<IndianRupee size={28} strokeWidth={1.5} />}
                          title={billed.length === 0 ? 'No billed dispatches yet' : 'No invoices in this view'}
                          description={
                            billed.length === 0
                              ? 'When the accountant records a Tally invoice, it appears here.'
                              : 'Try a different search or clear the filter chips.'
                          }
                        />
                      </td>
                    </tr>
                  ) : (
                    sortedInvoices.map((s) => (
                      <tr
                        key={s.id}
                        className="border-b border-border/60 last:border-0 hover:bg-owner/[0.03]"
                      >
                        <td className="font-medium">
                          <button
                            type="button"
                            onClick={() => setDetailSaleId(s.id)}
                            className="text-primary hover:underline"
                          >
                            {s.sale_no}
                          </button>
                        </td>
                        <td>
                          {s.tally_invoice_no ? (
                            <button
                              type="button"
                              onClick={() => setDetailSaleId(s.id)}
                              className="text-primary hover:underline"
                            >
                              {s.tally_invoice_no}
                            </button>
                          ) : (
                            '—'
                          )}
                          {s.client_po_no ? (
                            <div className="text-xs text-muted">PO {s.client_po_no}</div>
                          ) : null}
                        </td>
                        <td>{formatWhen(billedAt(s))}</td>
                        <td>{s.customer_name ?? '—'}</td>
                        <td>
                          <div>{s.product_name}</div>
                          <div className="text-xs text-muted">
                            {s.schedule_kind === 'byproduct' ? 'Byproduct' : 'Finished goods'}
                            {s.is_discounted ? ' · Discounted' : ''}
                          </div>
                        </td>
                        <td>{formatQty(Number(s.qty), s.unit)}</td>
                        <td>
                          <div className="font-medium">{formatInr(lineAmount(s))}</div>
                          <div className="text-xs text-muted">{formatInr(Number(s.rate))} / {s.unit || 'Kg'}</div>
                        </td>
                        <td>
                          <span className={`badge ${saleStatusBadge(s.status)}`}>
                            {saleStatusLabel(s.status, s.schedule_kind)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {!loading && sortedInvoices.length > 0 && (
                  <tfoot>
                    <tr>
                      <td colSpan={5} className="text-muted">
                        {sortedInvoices.length} invoice{sortedInvoices.length === 1 ? '' : 's'}
                      </td>
                      <td>{formatQty(sortedInvoices.reduce((sum, s) => sum + Number(s.qty || 0), 0))}</td>
                      <td className="font-medium">{formatInr(invoiceTotal)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            )}

            {tab === 'pending' && (
              <table className="data-table min-w-[720px]">
                <thead>
                  <tr>
                    <th>Sale</th>
                    <th>Customer</th>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <TableSkeleton columns={6} rows={4} />
                  ) : pending.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-0">
                        <EmptyState
                          icon={<IndianRupee size={28} strokeWidth={1.5} />}
                          title="Nothing waiting for invoice"
                          description="FG after COA and byproduct after create show here until the accountant records Tally."
                        />
                      </td>
                    </tr>
                  ) : (
                    pending.map((s) => (
                      <tr
                        key={s.id}
                        className="border-b border-border/60 last:border-0 hover:bg-owner/[0.03]"
                      >
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
                        <td>
                          <div>{s.product_name}</div>
                          <div className="text-xs text-muted">
                            {s.schedule_kind === 'byproduct' ? 'Byproduct' : 'Finished goods'}
                          </div>
                        </td>
                        <td>{formatQty(Number(s.qty), s.unit)}</td>
                        <td className="font-medium">{formatInr(lineAmount(s))}</td>
                        <td>
                          <span className={`badge ${saleStatusBadge(s.status)}`}>
                            {saleStatusLabel(s.status, s.schedule_kind)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </LedgerKindTabs>
        </div>
      </div>
      {detailSaleId ? (
        <OwnerSaleDetailDialog saleId={detailSaleId} onClose={() => setDetailSaleId(null)} />
      ) : null}
    </AppLayout>
  )
}
