'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@madstoq/ui/erp-page-header'
import { useAuth } from '@/hooks/useAuth'
import { useInventoryFactory } from '@/contexts/InventoryFactoryContext'
import { procurementApi } from '@/lib/api'
import { LIST_PAGE_SIZE } from '@/lib/list-page'
import { ClipboardList, FileText, Info, Mail, Plus, X } from 'lucide-react'
import { EmptyState, ListPager, SkeletonText, SmartFilterBar, StatusBadge, useSmartFilter } from '@/components/ui'
import { DateRangeChip, inDateRange } from '@/components/inventory/DateRangeChip'
import { SortTh } from '@/components/inventory/SortTh'
import { MobileCard, MobileListToolbar, MobileTabs } from '@/components/inventory/MobileList'
import { MgmtDrawer } from '@/components/inventory/MgmtDrawer'
import ProcurementReceiptsBrowser, {
  type ProcurementReceiptRow,
} from '@/components/inventory/ProcurementReceiptsBrowser'
import { viewProcurementPoPdf } from '@/lib/procurement-po-print'
import { poLinesLabel } from '@/lib/procurement-po-format'
import { GeneratePoForm } from '@/app/inventory/owner/procurement/generate/[id]/page'

type MaterialRequest = {
  id: string
  material_type: string
  qty: number | null
  unit: string
  needed_by_date: string | null
  notes: string | null
  status: string
}

type ProcurementOrder = {
  id: string
  po_number: string
  supplier_name: string
  material_type: string
  qty: number | null
  unit: string
  price_per_unit?: number | null
  hsn_code?: string | null
  line_remarks?: string | null
  status: string
  po_date?: string | null
  delivery_date: string | null
  payment_terms?: string | null
  quality_ref?: string | null
  coa_required: boolean
  special_instructions?: string | null
  bill_to?: string | null
  ship_to?: string | null
  vendor_email?: string | null
  lines?: unknown
  cgst_rate?: number | null
  sgst_rate?: number | null
  notes?: string | null
  shared_with?: string[]
  shared_at?: string | null
}

type ProcurementTab = 'requests' | 'orders' | 'receipts'
type OrderSortCol = 'po' | 'vendor' | 'material' | 'qty' | 'delivery' | 'status'
type RequestSortCol = 'material' | 'qty' | 'needed_by' | 'notes'


function cmpText(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? '').localeCompare(b ?? '', undefined, { numeric: true, sensitivity: 'base' })
}

function titleCase(value: string | null | undefined) {
  if (!value) return '—'
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatPoDate(value: string | null | undefined) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  if (value.includes('T')) {
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  return value
}

function DetailField({
  label,
  children,
  wide,
}: {
  label: string
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <div className="mb-1 text-xs uppercase tracking-wider text-muted">{label}</div>
      <div className="whitespace-pre-wrap text-sm font-medium text-primary">{children}</div>
    </div>
  )
}

export function ProcurementWorkbench({
  accent = 'owner',
  listHref = '/inventory/owner/procurement',
}: {
  accent?: 'owner' | 'accountant'
  listHref?: string
}) {
  const { profile, loading: authLoading } = useAuth()
  const { factoryId: ctxFactoryId } = useInventoryFactory()
  const [requests, setRequests] = useState<MaterialRequest[]>([])
  const [orders, setOrders] = useState<ProcurementOrder[]>([])
  const [receipts, setReceipts] = useState<ProcurementReceiptRow[]>([])
  const [requestTotal, setRequestTotal] = useState(0)
  const [orderTotal, setOrderTotal] = useState(0)
  const [receiptTotal, setReceiptTotal] = useState(0)
  const [listPage, setListPage] = useState({ requests: 1, orders: 1, receipts: 1 })
  const [paging, setPaging] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [emailingId, setEmailingId] = useState<string | null>(null)
  const [pdfingId, setPdfingId] = useState<string | null>(null)
  const [emailMsg, setEmailMsg] = useState('')
  const [tab, setTab] = useState<ProcurementTab>('requests')
  const [detailOrder, setDetailOrder] = useState<ProcurementOrder | null>(null)
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const [generateId, setGenerateId] = useState<string | null>(null)
  const [orderSortCol, setOrderSortCol] = useState<OrderSortCol>('po')
  const [orderSortDir, setOrderSortDir] = useState<'asc' | 'desc'>('desc')
  const [requestSortCol, setRequestSortCol] = useState<RequestSortCol>('needed_by')
  const [requestSortDir, setRequestSortDir] = useState<'asc' | 'desc'>('asc')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const factoryId = ctxFactoryId || profile?.factories?.[0]?.id || ''

  async function reload() {
    if (!factoryId) {
      setRequests([])
      setOrders([])
      setReceipts([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    const pageOpts = { page: 1, page_size: LIST_PAGE_SIZE, from: dateFrom || undefined, to: dateTo || undefined }
    const [reqRes, ordRes, recRes] = await Promise.all([
      procurementApi.listRequests(factoryId, 'pending', pageOpts),
      procurementApi.listOrders(factoryId, pageOpts),
      procurementApi.listReceipts(factoryId, undefined, pageOpts),
    ])
    if (reqRes.error || ordRes.error || recRes.error) {
      setError(reqRes.error || ordRes.error || recRes.error)
    }
    setRequests((reqRes.requests ?? []) as MaterialRequest[])
    setOrders((ordRes.orders ?? []) as ProcurementOrder[])
    setReceipts((recRes.receipts ?? []) as ProcurementReceiptRow[])
    setRequestTotal(Number(reqRes.total ?? reqRes.requests?.length ?? 0))
    setOrderTotal(Number(ordRes.total ?? ordRes.orders?.length ?? 0))
    setReceiptTotal(Number(recRes.total ?? recRes.receipts?.length ?? 0))
    setListPage({ requests: 1, orders: 1, receipts: 1 })
    setLoading(false)
  }

  const requestFilter = useSmartFilter(
    useMemo(
      () => requests.filter((r) => inDateRange(r.needed_by_date, dateFrom, dateTo)),
      [requests, dateFrom, dateTo],
    ),
    {
      getSearchText: (r) => [r.material_type, r.notes, r.needed_by_date, r.status],
      facets: [{ key: 'material', label: 'Material', getValue: (r) => r.material_type }],
    },
  )

  const orderFilter = useSmartFilter(
    useMemo(
      () => orders.filter((o) => inDateRange(o.po_date || o.delivery_date, dateFrom, dateTo)),
      [orders, dateFrom, dateTo],
    ),
    {
    getSearchText: (o) => [
      o.po_number,
      o.supplier_name,
      poLinesLabel(o.lines, o.material_type),
      o.status,
      o.hsn_code,
    ],
    facets: [
      { key: 'vendor', label: 'Vendor', getValue: (o) => o.supplier_name },
      { key: 'material', label: 'Material', getValue: (o) => poLinesLabel(o.lines, o.material_type) },
      { key: 'status', label: 'Status', getValue: (o) => o.status },
    ],
  })

  const sortedRequests = useMemo(() => {
    const dir = requestSortDir === 'asc' ? 1 : -1
    const rows = requestFilter.filtered
    return [...rows].sort((a, b) => {
      let cmp = 0
      switch (requestSortCol) {
        case 'qty':
          cmp = (a.qty ?? -1) - (b.qty ?? -1)
          break
        case 'needed_by':
          cmp = cmpText(a.needed_by_date, b.needed_by_date)
          break
        case 'notes':
          cmp = cmpText(a.notes, b.notes)
          break
        case 'material':
        default:
          cmp = cmpText(a.material_type, b.material_type)
          break
      }
      return cmp * dir || cmpText(a.material_type, b.material_type)
    })
  }, [requestFilter.filtered, requestSortCol, requestSortDir])

  const sortedOrders = useMemo(() => {
    const dir = orderSortDir === 'asc' ? 1 : -1
    return [...orderFilter.filtered].sort((a, b) => {
      let cmp = 0
      switch (orderSortCol) {
        case 'vendor':
          cmp = cmpText(a.supplier_name, b.supplier_name)
          break
        case 'material':
          cmp = cmpText(poLinesLabel(a.lines, a.material_type), poLinesLabel(b.lines, b.material_type))
          break
        case 'qty':
          cmp = (a.qty ?? -1) - (b.qty ?? -1)
          break
        case 'delivery':
          cmp = cmpText(a.delivery_date, b.delivery_date)
          break
        case 'status':
          cmp = cmpText(a.status, b.status)
          break
        case 'po':
        default:
          cmp = cmpText(a.po_number, b.po_number)
          break
      }
      return cmp * dir || cmpText(a.po_number, b.po_number)
    })
  }, [orderFilter.filtered, orderSortCol, orderSortDir])

  function handleOrderSort(col: OrderSortCol) {
    if (orderSortCol === col) {
      setOrderSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setOrderSortCol(col)
      setOrderSortDir(col === 'qty' || col === 'delivery' || col === 'po' ? 'desc' : 'asc')
    }
  }

  function handleRequestSort(col: RequestSortCol) {
    if (requestSortCol === col) {
      setRequestSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setRequestSortCol(col)
      setRequestSortDir(col === 'qty' || col === 'needed_by' ? 'desc' : 'asc')
    }
  }

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, factoryId, dateFrom, dateTo])

  async function openProcurementPage(next: number) {
    if (!factoryId || paging || next < 1) return
    setPaging(true)
    const pageOpts = { page: next, page_size: LIST_PAGE_SIZE, from: dateFrom || undefined, to: dateTo || undefined }
    if (tab === 'requests') {
      const res = await procurementApi.listRequests(factoryId, 'pending', pageOpts)
      setRequests((res.requests ?? []) as MaterialRequest[])
      setRequestTotal(Number(res.total ?? requestTotal))
      setListPage((prev) => ({ ...prev, requests: next }))
    } else if (tab === 'orders') {
      const res = await procurementApi.listOrders(factoryId, pageOpts)
      setOrders((res.orders ?? []) as ProcurementOrder[])
      setOrderTotal(Number(res.total ?? orderTotal))
      setListPage((prev) => ({ ...prev, orders: next }))
    } else {
      const res = await procurementApi.listReceipts(factoryId, undefined, pageOpts)
      setReceipts((res.receipts ?? []) as ProcurementReceiptRow[])
      setReceiptTotal(Number(res.total ?? receiptTotal))
      setListPage((prev) => ({ ...prev, receipts: next }))
    }
    setPaging(false)
  }

  async function emailOrder(order: ProcurementOrder) {
    setEmailingId(order.id)
    setEmailMsg('')
    setError('')
    const result = await procurementApi.emailPo({
      order_id: order.id,
      to_email: order.vendor_email || undefined,
    })
    setEmailingId(null)
    if (result.error) {
      setError(result.error)
      return
    }
    setTab('orders')
    setEmailMsg(
      result.email_sent
        ? `Emailed ${order.po_number} to ${result.emailed_to}`
        : result.email_dev_logged
          ? `Dev: logged email for ${order.po_number} → ${result.emailed_to}`
          : `Email attempted for ${order.po_number}`,
    )
    await reload()
  }

  async function viewPdf(order: ProcurementOrder) {
    setPdfingId(order.id)
    setError('')
    try {
      await viewProcurementPoPdf(order.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open PDF')
    }
    setPdfingId(null)
  }

  function detailValue(value: string | number | boolean | null | undefined) {
    if (value == null || value === '') return '—'
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    return String(value)
  }

  const emailedVendor = detailOrder ? (detailOrder.shared_with ?? []).includes('vendor') : false
  const accentBtn = accent === 'accountant' ? 'btn-pmc' : 'btn-owner'
  const accentSolid =
    accent === 'accountant'
      ? 'border border-pmc bg-pmc text-white'
      : 'border border-owner bg-owner text-white'
  const accentQty = accent === 'accountant' ? 'text-pmc' : 'text-owner'
  const filterAccent = accent === 'accountant' ? 'pmc' : 'owner'
  const accentLink = accent === 'accountant' ? 'text-pmc hover:underline' : 'text-owner hover:underline'
  const accentOutline =
    accent === 'accountant'
      ? 'border border-pmc text-pmc hover:bg-pmc/10'
      : 'border border-owner text-owner hover:bg-owner/10'
  const accentFill = accent === 'accountant' ? 'bg-pmc' : 'bg-owner'

  return (
    <AppLayout>
      <div className="w-full p-4 md:p-8">
        <div className="mb-8 hidden lg:block">
        <PageHeader
          title="Procurement"
          subtitle="Chemist requests or create a PO directly — vendor, terms, then generate"
          accent={accent}
          actions={
            <button
              type="button"
              onClick={() => setGenerateId('new')}
              className={`btn ${accentBtn} gap-2 justify-center whitespace-nowrap`}
            >
              <Plus size={15} />
              Create PO
            </button>
          }
        />
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}
        {emailMsg && (
          <div role="status" className="alert-info flex items-start gap-3 rounded-xl px-4 py-3">
            <span className="alert-info-icon mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg" aria-hidden="true">
              <Info size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="alert-info-title text-sm font-semibold">Email sent</div>
              <div className="alert-info-body text-sm">{emailMsg}</div>
            </div>
            <button
              type="button"
              onClick={() => setEmailMsg('')}
              className="rounded-md p-1 text-muted hover:bg-white/50 hover:text-primary"
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="md:hidden">
          <MobileTabs
            ariaLabel="Procurement"
            active={tab}
            onChange={setTab}
            tabs={[
              { key: 'requests', label: 'Requests' },
              { key: 'orders', label: 'Purchase orders' },
              { key: 'receipts', label: 'Receipts' },
            ]}
          />
          {loading ? (
            <SkeletonText lines={4} className="rounded-xl bg-panel p-6" />
          ) : tab === 'requests' ? (
            <>
              <MobileListToolbar
                filter={requestFilter}
                placeholder="Search material…"
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateChange={(from, to) => {
                  setDateFrom(from)
                  setDateTo(to)
                }}
                resultCount={sortedRequests.length}
                noun={{ one: 'request', many: 'requests' }}
                sortOptions={[
                  { col: 'material', label: 'Material', kind: 'text' },
                  { col: 'qty', label: 'Qty', kind: 'number' },
                  { col: 'needed_by', label: 'Needed by', kind: 'date' },
                ]}
                sortCol={requestSortCol}
                sortDir={requestSortDir}
                onSort={handleRequestSort}
              />
              {requests.length === 0 ? (
                <EmptyState
                  className="rounded-xl bg-panel"
                  icon={<ClipboardList size={28} strokeWidth={1.5} />}
                  title="No pending requests"
                  description="Use Create PO, or wait for a chemist to raise a material request."
                />
              ) : sortedRequests.length === 0 ? (
                <EmptyState className="rounded-xl bg-panel" title="No requests match" />
              ) : (
                <div className="space-y-3">
                  {sortedRequests.map((r) => (
                    <MobileCard
                      key={r.id}
                      title={r.material_type}
                      aside={
                        <>
                          <span className={`block text-base font-medium tabular-nums ${accentQty}`}>
                            {r.qty ?? '—'} {r.unit}
                          </span>
                          <span className="block text-[10px] uppercase tracking-wider text-muted">Qty</span>
                        </>
                      }
                      rows={[
                        { label: 'Needed by', value: r.needed_by_date ?? '—' },
                        { label: 'Notes', value: r.notes || '—' },
                      ]}
                      footer={
                        <button
                          type="button"
                          onClick={() => setGenerateId(r.id)}
                          className={`btn w-full ${accentSolid}`}
                        >
                          Generate PO
                        </button>
                      }
                    />
                  ))}
                </div>
              )}
            </>
          ) : tab === 'orders' ? (
            <>
              <MobileListToolbar
                filter={orderFilter}
                placeholder="Search PO, vendor, material…"
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateChange={(from, to) => {
                  setDateFrom(from)
                  setDateTo(to)
                }}
                resultCount={sortedOrders.length}
                noun={{ one: 'PO', many: 'POs' }}
                sortOptions={[
                  { col: 'po', label: 'PO', kind: 'text' },
                  { col: 'vendor', label: 'Vendor', kind: 'text' },
                  { col: 'material', label: 'Material', kind: 'text' },
                  { col: 'qty', label: 'Qty', kind: 'number' },
                  { col: 'delivery', label: 'Delivery', kind: 'date' },
                  { col: 'status', label: 'Status', kind: 'text' },
                ]}
                sortCol={orderSortCol}
                sortDir={orderSortDir}
                onSort={handleOrderSort}
              />
              {orders.length === 0 ? (
                <EmptyState
                  className="rounded-xl bg-panel"
                  icon={<FileText size={28} strokeWidth={1.5} />}
                  title="No purchase orders yet"
                  description="Generated POs will be listed here with vendor, quantity and status."
                />
              ) : sortedOrders.length === 0 ? (
                <EmptyState className="rounded-xl bg-panel" title="No POs match" />
              ) : (
                <div className="space-y-3">
                  {sortedOrders.map((o) => {
                    const emailed = (o.shared_with ?? []).includes('vendor')
                    const isOpen = expandedOrderId === o.id
                    return (
                      <MobileCard
                        key={o.id}
                        id={o.po_number}
                        title={o.supplier_name}
                        subtitle={poLinesLabel(o.lines, o.material_type)}
                        aside={<StatusBadge status={o.status} />}
                        rows={[
                          { label: 'Qty', value: o.qty != null ? `${o.qty} ${o.unit}` : '—' },
                          { label: 'Delivery', value: o.delivery_date ?? '—' },
                        ]}
                        expanded={isOpen}
                        onToggleExpand={() => setExpandedOrderId(isOpen ? null : o.id)}
                        details={
                          <dl className="space-y-1.5 text-xs">
                            {(
                              [
                                [
                                  'Price / unit',
                                  o.price_per_unit != null
                                    ? `₹${o.price_per_unit}/${o.unit}`
                                    : '—',
                                ],
                                ['HSN', o.hsn_code || '—'],
                                ['PO date', formatPoDate(o.po_date)],
                                ['Payment', o.payment_terms || '—'],
                                ['COA', o.coa_required ? 'Yes' : 'No'],
                                ['Vendor email', o.vendor_email || '—'],
                                [
                                  'Emailed',
                                  emailed
                                    ? `Yes${o.shared_at ? ` · ${formatPoDate(o.shared_at)}` : ''}`
                                    : 'Not yet',
                                ],
                              ] as const
                            ).map(([label, value]) => (
                              <div key={label} className="flex items-baseline justify-between gap-4">
                                <dt className="text-muted">{label}</dt>
                                <dd className="min-w-0 text-right text-primary">{value}</dd>
                              </div>
                            ))}
                            {o.notes ? (
                              <p className="pt-1 text-muted">{o.notes}</p>
                            ) : null}
                          </dl>
                        }
                        footer={
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={pdfingId === o.id}
                              onClick={() => void viewPdf(o)}
                              className="btn min-w-0 flex-1 border border-text bg-panel px-2 text-sm leading-tight text-primary disabled:opacity-40"
                            >
                              {pdfingId === o.id ? 'Opening…' : 'PDF'}
                            </button>
                            <button
                              type="button"
                              disabled={emailingId === o.id || !o.vendor_email}
                              onClick={() => void emailOrder(o)}
                              className={`btn min-w-0 flex-1 whitespace-normal ${accentSolid} px-2 text-sm leading-tight disabled:opacity-40`}
                            >
                              {emailingId === o.id
                                ? 'Sending…'
                                : emailed
                                  ? 'Resend'
                                  : 'Email'}
                            </button>
                          </div>
                        }
                      />
                    )
                  })}
                </div>
              )}
            </>
          ) : (
              <ProcurementReceiptsBrowser receipts={receipts} loading={loading} accent={accent} />
          )}
        </div>

        <div className="hidden md:block">
        <div>
          <div className="folder-tabs" role="tablist" aria-label="Procurement">
            {([
              { id: 'requests', label: 'Pending material requests' },
              { id: 'orders', label: 'Purchase orders' },
              { id: 'receipts', label: 'Goods receipts' },
            ] as const).map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`procurement-tab-${item.id}`}
                aria-selected={tab === item.id}
                aria-controls={`procurement-panel-${item.id}`}
                className={tab === item.id ? 'folder-tab is-active' : 'folder-tab'}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === 'requests' && (
            <section
              id="procurement-panel-requests"
              role="tabpanel"
              aria-labelledby="procurement-tab-requests"
              className="folder-panel overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
                <p className="text-xs text-muted">From chemist — generate PO (vendor, delivery, terms)</p>
                {requests.length > 0 ? (
                  <DateRangeChip
                    from={dateFrom}
                    to={dateTo}
                    onChange={(from, to) => {
                      setDateFrom(from)
                      setDateTo(to)
                    }}
                  />
                ) : null}
              </div>
              {loading ? (
                <SkeletonText lines={4} className="p-6" />
              ) : requests.length === 0 ? (
                <EmptyState
                  icon={<ClipboardList size={28} strokeWidth={1.5} />}
                  title="No pending requests"
                  description="Use Create PO above, or wait for a chemist to raise a material request."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <SortTh label="Material" col="material" sortCol={requestSortCol} sortDir={requestSortDir} onSort={handleRequestSort} accent={filterAccent} />
                        <SortTh label="Qty" col="qty" sortCol={requestSortCol} sortDir={requestSortDir} onSort={handleRequestSort} accent={filterAccent} />
                        <SortTh label="Needed by" col="needed_by" sortCol={requestSortCol} sortDir={requestSortDir} onSort={handleRequestSort} accent={filterAccent} />
                        <SortTh label="Notes" col="notes" sortCol={requestSortCol} sortDir={requestSortDir} onSort={handleRequestSort} accent={filterAccent} />
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRequests.map((r) => (
                        <tr key={r.id} className="border-b border-border/60">
                          <td className="px-4 py-3 text-primary">{r.material_type}</td>
                          <td className="px-4 py-3 text-primary">
                            {r.qty ?? '—'} {r.unit}
                          </td>
                          <td className="px-4 py-3 text-muted">{r.needed_by_date ?? '—'}</td>
                          <td className="px-4 py-3 text-muted max-w-[200px] truncate">{r.notes || '—'}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setGenerateId(r.id)}
                              className={`inline-flex rounded-lg ${accentFill} px-3 py-1.5 text-xs font-medium text-white hover:opacity-90`}
                            >
                              Generate PO
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {tab === 'orders' && (
            <section
              id="procurement-panel-orders"
              role="tabpanel"
              aria-labelledby="procurement-tab-orders"
              className="folder-panel overflow-hidden"
            >
              {loading ? (
                <SkeletonText lines={4} className="p-6" />
              ) : orders.length === 0 ? (
                <EmptyState
                  icon={<FileText size={28} strokeWidth={1.5} />}
                  title="No purchase orders yet"
                  description="Generated POs will be listed here with vendor, quantity and status."
                />
              ) : (
                <>
                  <SmartFilterBar
                    filter={orderFilter}
                    placeholder="Search PO, vendor, material…"
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
                  {orderFilter.filtered.length === 0 ? (
                    <EmptyState title="No POs match" description="Try a different search or clear the filter chips." />
                  ) : (
                    <div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <SortTh label="PO" col="po" sortCol={orderSortCol} sortDir={orderSortDir} onSort={handleOrderSort} accent={filterAccent} />
                            <SortTh label="Vendor" col="vendor" sortCol={orderSortCol} sortDir={orderSortDir} onSort={handleOrderSort} accent={filterAccent} />
                            <SortTh label="Material" col="material" sortCol={orderSortCol} sortDir={orderSortDir} onSort={handleOrderSort} accent={filterAccent} />
                            <SortTh label="Qty" col="qty" sortCol={orderSortCol} sortDir={orderSortDir} onSort={handleOrderSort} accent={filterAccent} />
                            <SortTh label="Delivery" col="delivery" sortCol={orderSortCol} sortDir={orderSortDir} onSort={handleOrderSort} accent={filterAccent} />
                            <SortTh label="Status" col="status" sortCol={orderSortCol} sortDir={orderSortDir} onSort={handleOrderSort} accent={filterAccent} />
                            <th className="px-4 py-3" />
                          </tr>
                        </thead>
                        <tbody>
                          {sortedOrders.map((o) => {
                            const emailed = (o.shared_with ?? []).includes('vendor')
                            return (
                              <tr key={o.id} className="border-b border-border/60">
                                <td className="px-4 py-3">
                                  <button
                                    type="button"
                                    onClick={() => setDetailOrder(o)}
                                    className={`text-left font-mono text-xs font-medium ${accentLink}`}
                                  >
                                    {o.po_number}
                                  </button>
                                </td>
                                <td className="px-4 py-3 text-primary">{o.supplier_name}</td>
                                <td className="px-4 py-3 text-primary">{poLinesLabel(o.lines, o.material_type)}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-muted">
                                  {o.qty != null ? `${o.qty} ${o.unit}` : '—'}
                                </td>
                                <td className="px-4 py-3 text-muted">{o.delivery_date ?? '—'}</td>
                                <td className="px-4 py-3 text-muted">{titleCase(o.status)}</td>
                                <td className="px-4 py-3 text-right">
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      disabled={pdfingId === o.id}
                                      onClick={() => void viewPdf(o)}
                                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-layer-sm disabled:opacity-40"
                                      title="View PDF"
                                    >
                                      <FileText size={13} />
                                      {pdfingId === o.id ? 'Opening…' : 'PDF'}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={emailingId === o.id || !o.vendor_email}
                                      onClick={() => void emailOrder(o)}
                                      className={`inline-flex w-[6.75rem] items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium disabled:opacity-40 ${accentOutline}`}
                                      title={!o.vendor_email ? 'Add vendor email first' : emailed ? 'Send again' : 'Email vendor'}
                                    >
                                      <Mail size={13} />
                                      {emailingId === o.id ? 'Sending…' : emailed ? 'Resend' : 'Email'}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {tab === 'receipts' && (
            <section
              id="procurement-panel-receipts"
              role="tabpanel"
              aria-labelledby="procurement-tab-receipts"
              className="folder-panel overflow-hidden"
            >
              <ProcurementReceiptsBrowser
                receipts={receipts}
                loading={loading}
                accent={accent}
              />
            </section>
          )}
          {!loading && (
            <div className="mt-4 flex justify-center">
              <ListPager
                page={listPage[tab]}
                total={tab === 'requests' ? requestTotal : tab === 'orders' ? orderTotal : receiptTotal}
                disabled={paging}
                onPage={(next) => void openProcurementPage(next)}
              />
            </div>
          )}
        </div>
        </div>
      </div>

      {!generateId && (
      <button
        type="button"
        onClick={() => setGenerateId('new')}
        className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 inline-flex h-12 items-center gap-2 rounded-full bg-text px-5 text-sm font-medium text-panel shadow-lg lg:hidden"
      >
        <Plus size={18} />
        Create PO
      </button>
      )}

      {detailOrder && (
        <MgmtDrawer
          eyebrow="Purchase order"
          title={detailOrder.po_number}
          onClose={() => setDetailOrder(null)}
          size="lg"
          footer={
            <>
              <button type="button" onClick={() => setDetailOrder(null)} className="btn btn-ghost">
                Close
              </button>
              <button
                type="button"
                disabled={pdfingId === detailOrder.id}
                onClick={() => void viewPdf(detailOrder)}
                className="btn btn-ghost gap-1"
              >
                <FileText size={13} />
                {pdfingId === detailOrder.id ? 'Opening…' : 'View PDF'}
              </button>
              <button
                type="button"
                disabled={emailingId === detailOrder.id || !detailOrder.vendor_email}
                onClick={() => void emailOrder(detailOrder)}
                className={`btn gap-1 disabled:opacity-40 ${accentBtn}`}
              >
                <Mail size={13} />
                {emailingId === detailOrder.id ? 'Sending…' : emailedVendor ? 'Resend' : 'Email vendor'}
              </button>
            </>
          }
        >
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <DetailField label="Vendor">{detailValue(detailOrder.supplier_name)}</DetailField>
                <DetailField label="Material">{detailValue(poLinesLabel(detailOrder.lines, detailOrder.material_type))}</DetailField>
                <DetailField label="Qty">
                  {detailOrder.qty != null ? `${detailOrder.qty} ${detailOrder.unit}` : '—'}
                </DetailField>
                <DetailField label="Price / unit">
                  {detailOrder.price_per_unit != null
                    ? `₹${detailOrder.price_per_unit}/${detailOrder.unit}`
                    : '—'}
                </DetailField>
                <DetailField label="HSN code">{detailValue(detailOrder.hsn_code)}</DetailField>
                <DetailField label="PO date">{formatPoDate(detailOrder.po_date)}</DetailField>
                <DetailField label="Delivery date">{formatPoDate(detailOrder.delivery_date)}</DetailField>
                <DetailField label="Status">
                  <StatusBadge status={titleCase(detailOrder.status)} />
                </DetailField>
                <DetailField label="COA required">{detailOrder.coa_required ? 'Yes' : 'No'}</DetailField>
                <DetailField label="Payment terms" wide>
                  {detailValue(detailOrder.payment_terms)}
                </DetailField>
                <DetailField label="Quality ref">{detailValue(detailOrder.quality_ref)}</DetailField>
                <DetailField label="CGST %">{detailValue(detailOrder.cgst_rate)}</DetailField>
                <DetailField label="SGST %">{detailValue(detailOrder.sgst_rate)}</DetailField>
                <DetailField label="Vendor email">{detailValue(detailOrder.vendor_email)}</DetailField>
                <DetailField label="Emailed">
                  {emailedVendor
                    ? `Yes · ${formatPoDate(detailOrder.shared_at)}`
                    : 'Not yet'}
                </DetailField>
                <DetailField label="Bill to" wide>
                  {detailValue(detailOrder.bill_to)}
                </DetailField>
                <DetailField label="Ship to" wide>
                  {detailValue(detailOrder.ship_to)}
                </DetailField>
                {detailOrder.line_remarks ? (
                  <DetailField label="Line remarks" wide>
                    {detailOrder.line_remarks}
                  </DetailField>
                ) : null}
                {detailOrder.special_instructions ? (
                  <DetailField label="Special instructions" wide>
                    {detailOrder.special_instructions}
                  </DetailField>
                ) : null}
                {detailOrder.notes ? (
                  <DetailField label="Notes" wide>
                    {detailOrder.notes}
                  </DetailField>
                ) : null}
              </div>
        </MgmtDrawer>
      )}
      {generateId && (
        <div
          className="fixed inset-0 z-50 flex bg-black/60 max-md:items-end max-md:overflow-hidden md:justify-end"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setGenerateId(null)
              void reload()
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-po-title"
            className="flex w-full max-w-2xl flex-col overflow-hidden shadow-2xl max-md:h-auto max-md:max-h-[88dvh] max-md:rounded-t-2xl md:h-full md:border-l md:border-border"
            style={{ background: 'var(--color-panel)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
              <GeneratePoForm
                requestId={generateId}
                listHref={listHref}
                accent={accent}
                onClose={() => {
                  setGenerateId(null)
                  void reload()
                }}
              />
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

export default function OwnerProcurementPage() {
  return <ProcurementWorkbench />
}
