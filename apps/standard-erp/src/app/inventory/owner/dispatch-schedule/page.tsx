'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@madstoq/ui/erp-page-header'
import { useAuth } from '@/hooks/useAuth'
import { useInventoryFactory } from '@/contexts/InventoryFactoryContext'
import { useToast } from '@/components/providers/ToastProvider'
import { customersApi, dispatchScheduleApi, productionApi, warehouseApi } from '@/lib/api'
import {
  saleStatusBadge,
  saleStatusLabel,
  type DispatchSchedule,
  type FgStockLot,
} from '@/components/inventory/DispatchScheduleShared'
import { DateRangeChip, inDateRange } from '@/components/inventory/DateRangeChip'
import { SortTh } from '@/components/inventory/SortTh'
import { OwnerSaleDetailDialog } from '@/components/inventory/OwnerSaleDetailDialog'
import { EmptyState, useSmartFilter } from '@/components/ui'
import { MobileCard, MobileListToolbar } from '@/components/inventory/MobileList'

type DispatchSort = 'sale' | 'customer' | 'kind' | 'product' | 'qty' | 'rate' | 'status'

function cmpText(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? '').localeCompare(b ?? '', undefined, { numeric: true, sensitivity: 'base' })
}


type Customer = { id: string; name: string }
type Product = {
  id: string
  code: string
  name: string
  kind?: string
  fg_outputs?: unknown[]
  fg_stages?: unknown[]
  outputs?: Array<{ process?: string }>
  stages?: Array<{ process?: string }>
}

function productHasFgProcess(p: Product) {
  if (p.kind === 'fg') return true
  if ((p.fg_outputs?.length ?? 0) > 0 || (p.fg_stages?.length ?? 0) > 0) return true
  const outs = p.outputs ?? []
  const stages = p.stages ?? []
  return outs.some((o) => o.process === 'fg') || stages.some((s) => s.process === 'fg')
}

export default function OwnerDispatchSchedulePage() {
  const toast = useToast()
  const { profile, loading: authLoading } = useAuth()
  const { factoryId: ctxFactoryId } = useInventoryFactory()
  const factoryId = ctxFactoryId || profile?.factories?.[0]?.id || ''

  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [stock, setStock] = useState<FgStockLot[]>([])
  const [bpStock, setBpStock] = useState<FgStockLot[]>([])
  const [sales, setSales] = useState<DispatchSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [detailSaleId, setDetailSaleId] = useState<string | null>(null)
  const [sortCol, setSortCol] = useState<DispatchSort>('sale')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const [formOpen, setFormOpen] = useState(false)
  const [kind, setKind] = useState<'fg' | 'byproduct'>('fg')
  const [customerId, setCustomerId] = useState('')
  const [productId, setProductId] = useState('')
  const [byproductName, setByproductName] = useState('')
  const [qty, setQty] = useState('')
  const [rate, setRate] = useState('')
  const [puritySpec, setPuritySpec] = useState('')
  const [clientPo, setClientPo] = useState('')
  const [isDiscounted, setIsDiscounted] = useState(false)
  const [preferred, setPreferred] = useState<string[]>([])

  function resetForm() {
    setKind('fg')
    setCustomerId('')
    setProductId('')
    setByproductName('')
    setQty('')
    setRate('')
    setPuritySpec('')
    setClientPo('')
    setIsDiscounted(false)
    setPreferred([])
  }

  function openForm() {
    resetForm()
    setFormOpen(true)
  }

  function closeForm() {
    if (saving) return
    setFormOpen(false)
  }

  const selectedProduct = products.find((p) => p.id === productId)

  const preferredOptions = useMemo(() => {
    if (!selectedProduct) return []
    const name = selectedProduct.name.toLowerCase()
    const code = selectedProduct.code.toLowerCase()
    return stock.filter((s) => {
      const mat = s.material_type.toLowerCase()
      const match = mat === name || mat === code
      if (!match) return false
      if (isDiscounted) return s.stock_grade === 'rejected'
      return s.stock_grade !== 'rejected'
    })
  }, [stock, selectedProduct, isDiscounted])

  const byproductNames = useMemo(() => {
    const names = new Map<string, number>()
    for (const row of bpStock) {
      const n = row.material_type.trim()
      if (!n) continue
      names.set(n, (names.get(n) ?? 0) + Number(row.tons_remaining || 0))
    }
    return [...names.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [bpStock])

  const reload = useCallback(async () => {
    if (!factoryId) {
      setCustomers([])
      setProducts([])
      setStock([])
      setBpStock([])
      setSales([])
      setLoading(false)
      return
    }
    setLoading(true)
    const [custRes, prodRes, approvedRes, rejectedRes, allStockRes, saleRes] = await Promise.all([
      customersApi.list(factoryId),
      productionApi.listProducts(factoryId),
      warehouseApi.listStock(factoryId, undefined, 'approved', 'fg'),
      warehouseApi.listStock(factoryId, undefined, 'rejected', 'fg'),
      warehouseApi.listStock(factoryId),
      dispatchScheduleApi.list(factoryId),
    ])
    if (custRes.error) toast.error(custRes.error)
    if (prodRes.error) toast.error(prodRes.error)
    if (approvedRes.error) toast.error(approvedRes.error)
    if (rejectedRes.error) toast.error(rejectedRes.error)
    if (allStockRes.error) toast.error(allStockRes.error)
    if (saleRes.error) toast.error(saleRes.error)

    // Management stores Stage I + Stage II on one product (kind often stays sfg).
    // Schedule needs anything with a Stage II (FG) recipe, not only kind=fg rows.
    const fgProducts = ((prodRes.products ?? []) as Product[]).filter(productHasFgProcess)
    setCustomers((custRes.customers ?? []) as Customer[])
    setProducts(fgProducts)
    setStock([
      ...((approvedRes.stock ?? []) as FgStockLot[]),
      ...((rejectedRes.stock ?? []) as FgStockLot[]),
    ])
    setBpStock(
      ((allStockRes.stock ?? []) as FgStockLot[]).filter((r) =>
        /\/BP\//i.test(r.invoice_number),
      ),
    )
    setSales((saleRes.sales ?? []) as DispatchSchedule[])
    setLoading(false)
  }, [factoryId, toast])

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  function togglePreferred(lot: string) {
    setPreferred((prev) =>
      prev.includes(lot) ? prev.filter((x) => x !== lot) : [...prev, lot],
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!factoryId || !customerId) {
      toast.error('Select a customer')
      return
    }
    if (kind === 'fg' && !productId) {
      toast.error('Select customer and finished-goods product')
      return
    }
    if (kind === 'byproduct' && !byproductName) {
      toast.error('Select a byproduct')
      return
    }
    setSaving(true)
    const res = await dispatchScheduleApi.create(
      kind === 'byproduct'
        ? {
            factory_id: factoryId,
            customer_id: customerId,
            schedule_kind: 'byproduct',
            product_name: byproductName,
            qty: Number(qty),
            rate: Number(rate),
            client_po_no: clientPo.trim() || undefined,
          }
        : {
            factory_id: factoryId,
            customer_id: customerId,
            product_id: productId,
            qty: Number(qty),
            rate: Number(rate),
            is_discounted: isDiscounted,
            purity_spec: puritySpec.trim() ? Number(puritySpec) : null,
            client_po_no: clientPo.trim() || undefined,
            preferred_batch_nos: preferred,
          },
    )
    setSaving(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success('Dispatch schedule created')
    resetForm()
    setFormOpen(false)
    await reload()
  }

  const visibleSales = useMemo(
    () =>
      sales.filter((s) =>
        inDateRange(s.created_at || s.invoiced_at || s.dispatched_at, dateFrom, dateTo),
      ),
    [sales, dateFrom, dateTo],
  )

  const filter = useSmartFilter(visibleSales, {
    getSearchText: (s) => [
      s.sale_no,
      s.customer_name,
      s.product_name,
      s.status,
      s.schedule_kind,
    ],
    facets: [
      { key: 'customer', label: 'Customer', getValue: (s) => s.customer_name || '—' },
      { key: 'product', label: 'Product', getValue: (s) => s.product_name },
      {
        key: 'kind',
        label: 'Kind',
        getValue: (s) => (s.schedule_kind === 'byproduct' ? 'Byproduct' : 'Finished goods'),
      },
      {
        key: 'status',
        label: 'Status',
        getValue: (s) => saleStatusLabel(s.status, s.schedule_kind),
      },
    ],
  })

  const sortedSales = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filter.filtered].sort((a, b) => {
      let cmp = 0
      switch (sortCol) {
        case 'customer':
          cmp = cmpText(a.customer_name, b.customer_name)
          break
        case 'kind':
          cmp = cmpText(a.schedule_kind, b.schedule_kind)
          break
        case 'product':
          cmp = cmpText(a.product_name, b.product_name)
          break
        case 'qty':
          cmp = Number(a.qty || 0) - Number(b.qty || 0)
          break
        case 'rate':
          cmp = Number(a.rate || 0) - Number(b.rate || 0)
          break
        case 'status':
          cmp = cmpText(a.status, b.status)
          break
        case 'sale':
        default:
          cmp = cmpText(a.sale_no, b.sale_no)
          break
      }
      return cmp * dir || cmpText(a.sale_no, b.sale_no)
    })
  }, [filter.filtered, sortCol, sortDir])

  function handleSort(col: DispatchSort) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir(col === 'sale' || col === 'qty' || col === 'rate' ? 'desc' : 'asc')
    }
  }

  return (
    <AppLayout>
      <div className="w-full p-4 md:p-8">
        <div className="mb-8 hidden lg:block">
        <PageHeader
          title="Dispatch schedule"
          subtitle="Admin · finished goods go to lab for lots/COA. Byproduct is invoiced next (FIFO stock)."
          accent="owner"
          actions={
            <button
              type="button"
              onClick={openForm}
              className="btn btn-owner gap-2 justify-center whitespace-nowrap"
            >
              <Plus size={15} />
              Create Dispatch
            </button>
          }
        />
        </div>

        <div className="md:hidden">
          {sales.length === 0 && !filter.search ? null : (
            <MobileListToolbar
              filter={filter}
              placeholder="Search sale, customer, product…"
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateChange={(from, to) => {
                setDateFrom(from)
                setDateTo(to)
              }}
              resultCount={sortedSales.length}
              noun={{ one: 'schedule', many: 'schedules' }}
              sortOptions={[
                { col: 'sale', label: 'Sale', kind: 'text' },
                { col: 'customer', label: 'Customer', kind: 'text' },
                { col: 'kind', label: 'Kind', kind: 'text' },
                { col: 'product', label: 'Product', kind: 'text' },
                { col: 'qty', label: 'Qty', kind: 'number' },
                { col: 'rate', label: 'Rate', kind: 'number' },
                { col: 'status', label: 'Status', kind: 'text' },
              ]}
              sortCol={sortCol}
              sortDir={sortDir}
              onSort={handleSort}
            />
          )}
          {sales.length === 0 ? (
            <EmptyState
              className="rounded-xl bg-panel"
              title="No schedules yet"
              description="Use Create Dispatch to add one."
            />
          ) : sortedSales.length === 0 ? (
            <EmptyState
              className="rounded-xl bg-panel"
              title="No schedules match"
              description="Clear search or the date chip to see all."
            />
          ) : (
            <div className="space-y-3">
              {sortedSales.map((s) => (
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
                        {s.qty}
                      </span>
                      <span className="block text-[10px] uppercase tracking-wider text-muted">
                        {s.unit || 'Kg'}
                      </span>
                    </>
                  }
                  rows={[
                    { label: 'Kind', value: s.schedule_kind === 'byproduct' ? 'Byproduct' : 'Finished goods' },
                    { label: 'Rate', value: String(s.rate) },
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
              ))}
            </div>
          )}
        </div>

        <div className="hidden md:block">
        <div className="folder-panel overflow-hidden">
          {sales.length > 0 ? (
            <div className="border-b border-border bg-panel px-4 py-3">
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
                  <SortTh label="Sale" col="sale" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                  <SortTh label="Customer" col="customer" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                  <SortTh label="Kind" col="kind" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                  <SortTh label="Product" col="product" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                  <SortTh label="Qty" col="qty" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                  <SortTh label="Rate" col="rate" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                  <SortTh label="Status" col="status" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr>
                    <td className="text-muted" colSpan={7}>
                      No schedules yet. Use Create Dispatch to add one.
                    </td>
                  </tr>
                ) : visibleSales.length === 0 ? (
                  <tr>
                    <td className="text-muted" colSpan={7}>
                      No schedules in this date range. Clear the Date chip to see all.
                    </td>
                  </tr>
                ) : (
                  sortedSales.map((s) => (
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
                      <td>{s.schedule_kind === 'byproduct' ? 'Byproduct' : 'Finished goods'}</td>
                      <td>{s.product_name}</td>
                      <td>{s.qty}</td>
                      <td>{s.rate}</td>
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
          </div>
        </div>
        </div>
      </div>

      <button
        type="button"
        onClick={openForm}
        className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 inline-flex h-12 items-center gap-2 rounded-full bg-text px-5 text-sm font-medium text-panel shadow-lg lg:hidden"
      >
        <Plus size={18} />
        Create Dispatch
      </button>

      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex bg-black/60 max-md:items-end max-md:overflow-hidden md:justify-end"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeForm()
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-dispatch-title"
            className="flex w-full max-w-2xl flex-col overflow-hidden shadow-2xl max-md:h-auto max-md:max-h-[88dvh] max-md:rounded-t-2xl md:h-full md:border-l md:border-border"
            style={{ background: 'var(--color-panel)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={(e) => void submit(e)} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
              <p className="text-xs uppercase tracking-wider text-muted">Dispatch schedule</p>
              <h2 id="create-dispatch-title" className="mt-0.5 text-lg font-bold text-primary">
                Create Dispatch
              </h2>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-md p-1 text-muted hover:text-primary max-md:-m-2 max-md:p-3"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
          <div className="flex gap-6 border-b border-border">
            {(
              [
                { key: 'fg' as const, label: 'Finished goods' },
                { key: 'byproduct' as const, label: 'Byproduct' },
              ] as const
            ).map((t) => {
              const on = kind === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setKind(t.key)}
                  className={`relative -mb-px pb-2.5 text-sm font-medium ${
                    on ? 'text-owner' : 'text-muted hover:text-primary'
                  }`}
                >
                  {t.label}
                  {on && (
                    <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-owner" />
                  )}
                </button>
              )
            })}
          </div>

          {loading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : (
            <>
              <label className="block text-sm">
                <span className="mb-1 block text-muted">Customer</span>
                <select
                  className="input-field owner-focus"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  required
                >
                  <option value="">Select customer…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              {kind === 'fg' ? (
                <>
              <label className="block text-sm">
                <span className="mb-1 block text-muted">Finished-goods product</span>
                <select
                  className="input-field owner-focus"
                  value={productId}
                  onChange={(e) => {
                    setProductId(e.target.value)
                    setPreferred([])
                  }}
                  required={kind === 'fg'}
                >
                  <option value="">Select product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} · {p.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block text-muted">Qty</span>
                  <input
                    className="input-field owner-focus"
                    type="number"
                    min="0.001"
                    step="any"
                    required
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-muted">
                    {isDiscounted ? 'Discounted rate' : 'Rate'}
                  </span>
                  <input
                    className="input-field owner-focus"
                    type="number"
                    min="0.01"
                    step="any"
                    required
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block text-muted">Purity spec % (optional)</span>
                  <input
                    className="input-field owner-focus"
                    type="number"
                    step="any"
                    min="0"
                    value={puritySpec}
                    onChange={(e) => setPuritySpec(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-muted">Client PO (optional)</span>
                  <input
                    className="input-field owner-focus"
                    value={clientPo}
                    onChange={(e) => setClientPo(e.target.value)}
                  />
                </label>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isDiscounted}
                  onChange={(e) => {
                    setIsDiscounted(e.target.checked)
                    setPreferred([])
                  }}
                />
                Discounted sale (rejected FG)
              </label>

              {selectedProduct && preferredOptions.length > 0 && (
                <div>
                  <p className="mb-2 text-sm text-muted">Preferred lots (optional)</p>
                  <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                    {preferredOptions.map((lot) => {
                      const on = preferred.includes(lot.invoice_number)
                      return (
                        <button
                          key={lot.invoice_number}
                          type="button"
                          className={
                            on
                              ? 'rounded-full border border-owner bg-owner/15 px-2.5 py-0.5 font-mono text-[11px] text-owner'
                              : 'rounded-full border border-border px-2.5 py-0.5 font-mono text-[11px] text-muted'
                          }
                          onClick={() => togglePreferred(lot.invoice_number)}
                        >
                          {lot.invoice_number}
                          {lot.purity != null ? ` · ${lot.purity}%` : ''}
                          {` · ${lot.tons_remaining}`}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
                </>
              ) : (
                <>
              <label className="block text-sm">
                <span className="mb-1 block text-muted">Byproduct</span>
                <select
                  className="input-field owner-focus"
                  value={byproductName}
                  onChange={(e) => setByproductName(e.target.value)}
                  required={kind === 'byproduct'}
                >
                  <option value="">Select byproduct…</option>
                  {byproductNames.map(([name, remaining]) => (
                    <option key={name} value={name}>
                      {name} · {remaining.toFixed(3)} Kg remaining
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block text-muted">Qty</span>
                  <input
                    className="input-field owner-focus"
                    type="number"
                    min="0.001"
                    step="any"
                    required
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-muted">Rate</span>
                  <input
                    className="input-field owner-focus"
                    type="number"
                    min="0.01"
                    step="any"
                    required
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                  />
                </label>
              </div>
              <label className="block text-sm">
                <span className="mb-1 block text-muted">Client PO (optional)</span>
                <input
                  className="input-field owner-focus"
                  value={clientPo}
                  onChange={(e) => setClientPo(e.target.value)}
                />
              </label>
              <p className="text-xs text-muted">
                No lab COA. Accountant invoices next and FIFO byproduct lots are deducted then.
              </p>
                </>
              )}

              {customers.length === 0 && (
                <p className="text-xs text-muted">Add a customer under Management first.</p>
              )}
              {kind === 'fg' && products.length === 0 && (
                <p className="text-xs text-muted">
                  No products with a Stage II (semi → finished) recipe yet. Open Management →
                  Products, select a product, switch to “Semi-finished → finished”, add Stage II
                  outputs, and save.
                </p>
              )}
              {kind === 'byproduct' && byproductNames.length === 0 && (
                <p className="text-xs text-muted">
                  No byproduct lots with remaining warehouse balance.
                </p>
              )}
            </>
          )}

            </div>
              <div className="flex justify-end gap-2 border-t border-border px-4 py-4 sm:px-6 max-md:pb-[max(1rem,env(safe-area-inset-bottom))] max-md:[&>*]:flex-1">
                <button type="button" onClick={closeForm} className="btn btn-ghost" disabled={saving}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    saving ||
                    customers.length === 0 ||
                    (kind === 'fg' && products.length === 0) ||
                    (kind === 'byproduct' && byproductNames.length === 0)
                  }
                  className="btn btn-owner"
                >
                  {saving ? 'Saving…' : 'Create Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {detailSaleId ? (
        <OwnerSaleDetailDialog saleId={detailSaleId} onClose={() => setDetailSaleId(null)} />
      ) : null}
    </AppLayout>
  )
}
