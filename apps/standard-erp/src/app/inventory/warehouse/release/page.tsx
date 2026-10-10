'use client'

import { Fragment, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { EmptyState, SkeletonPanel, SmartFilterBar, useSmartFilter } from '@/components/ui'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@madstoq/ui/erp-page-header'
import { useAuth } from '@/hooks/useAuth'
import { useInventoryFactory } from '@/contexts/InventoryFactoryContext'
import { useToast } from '@/components/providers/ToastProvider'
import { warehouseApi } from '@/lib/api'
import { SortTh, cmpNum, cmpStr, nextSortDir } from '@/components/inventory/SortTh'
import { DateRangeChip, inDateRange } from '@/components/inventory/DateRangeChip'
import { MobileCard, MobileListToolbar, MobileTabs } from '@/components/inventory/MobileList'

type IssueRequest = {
  id: string
  material_type: string
  qty: number
  qty_released: number
  unit: string
  needed_by_date: string | null
  notes: string | null
  status: string
  stock_grade?: string
  stock_kind?: string
}

type StockLot = {
  invoice_number: string
  material_type: string
  tons_remaining: number
  supplier_name: string | null
  entry_date: string | null
  purity: number | null
}

type ReleaseRow = {
  id: string
  request_id: string
  invoice_number: string
  qty: number
  material_type: string
  unit: string
  released_at: string | null
  supplier_name: string | null
  purity: number | null
  released_by_name: string | null
  needed_by_date: string | null
}

function formatReleasedAt(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function lotsKey(r: { material_type: string; stock_grade?: string; stock_kind?: string }) {
  return `${r.stock_kind || 'rm'}:${r.stock_grade === 'rejected' ? 'rejected' : 'approved'}:${r.material_type}`
}

export default function WarehouseReleasePage() {
  return (
    <Suspense fallback={<SkeletonPanel className="m-4 md:m-8" />}>
      <WarehouseReleasePageInner />
    </Suspense>
  )
}

function WarehouseReleasePageInner() {
  const { profile, loading: authLoading } = useAuth()
  const toast = useToast()
  const { factoryId: ctxFactoryId } = useInventoryFactory()
  const factoryId = ctxFactoryId || profile?.factories?.[0]?.id || ''
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<'pending' | 'history'>(
    searchParams.get('tab') === 'history' ? 'history' : 'pending',
  )
  const [requests, setRequests] = useState<IssueRequest[]>([])
  const [history, setHistory] = useState<ReleaseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [lotsByMaterial, setLotsByMaterial] = useState<Record<string, StockLot[]>>({})
  const [lotsLoading, setLotsLoading] = useState<string | null>(null)
  const [qtyByInvoice, setQtyByInvoice] = useState<Record<string, string>>({})
  const [actingId, setActingId] = useState<string | null>(null)
  const [pendingSort, setPendingSort] = useState<
    'material' | 'requested' | 'released' | 'needed' | 'status'
  >('material')
  const [pendingDir, setPendingDir] = useState<'asc' | 'desc'>('asc')
  const [histSort, setHistSort] = useState<
    'released' | 'material' | 'lot' | 'supplier' | 'purity' | 'qty' | 'by'
  >('released')
  const [histDir, setHistDir] = useState<'asc' | 'desc'>('desc')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const reload = useCallback(async () => {
    if (!factoryId) {
      setRequests([])
      setHistory([])
      setLoading(false)
      return
    }
    setLoading(true)
    if (tab === 'pending') {
      const data = await warehouseApi.listRequests(factoryId, 'open')
      if (data.error) toast.error(data.error)
      setRequests((data.requests ?? []) as IssueRequest[])
    } else {
      const data = await warehouseApi.listReleases(factoryId)
      if (data.error) toast.error(data.error)
      setHistory((data.releases ?? []) as ReleaseRow[])
    }
    setLoading(false)
  }, [factoryId, tab, toast])

  useEffect(() => {
    if (authLoading) return
    setExpandedId(null)
    void reload()
  }, [authLoading, reload])

  const pendingFilter = useSmartFilter(requests, {
    getSearchText: (r) => [r.material_type, r.status, r.notes, r.stock_grade, r.stock_kind],
    facets: [
      { key: 'material', label: 'Material', getValue: (r) => r.material_type },
      {
        key: 'status',
        label: 'Status',
        getValue: (r) => r.status,
      },
    ],
  })

  const sortedRequests = useMemo(() => {
    const dir = pendingDir === 'asc' ? 1 : -1
    const rows = pendingFilter.filtered.filter((r) => inDateRange(r.needed_by_date, dateFrom, dateTo))
    return [...rows].sort((a, b) => {
      let cmp = 0
      switch (pendingSort) {
        case 'requested':
          cmp = cmpNum(a.qty, b.qty)
          break
        case 'released':
          cmp = cmpNum(a.qty_released, b.qty_released)
          break
        case 'needed':
          cmp = cmpStr(a.needed_by_date, b.needed_by_date)
          break
        case 'status':
          cmp = cmpStr(a.status, b.status)
          break
        case 'material':
        default:
          cmp = cmpStr(a.material_type, b.material_type)
          break
      }
      return cmp * dir || cmpStr(a.material_type, b.material_type)
    })
  }, [pendingFilter.filtered, pendingSort, pendingDir, dateFrom, dateTo])

  const histFilter = useSmartFilter(history, {
    getSearchText: (r) => [
      r.material_type,
      r.invoice_number,
      r.supplier_name,
      r.released_by_name,
      r.unit,
      r.purity != null ? String(r.purity) : '',
      formatReleasedAt(r.released_at),
    ],
    facets: [
      { key: 'material', label: 'Material', getValue: (r) => r.material_type },
      { key: 'supplier', label: 'Supplier', getValue: (r) => r.supplier_name || '—' },
    ],
  })

  const sortedHistory = useMemo(() => {
    const dir = histDir === 'asc' ? 1 : -1
    const rows = histFilter.filtered.filter((r) => inDateRange(r.released_at, dateFrom, dateTo))
    return [...rows].sort((a, b) => {
      let cmp = 0
      switch (histSort) {
        case 'material':
          cmp = cmpStr(a.material_type, b.material_type)
          break
        case 'lot':
          cmp = cmpStr(a.invoice_number, b.invoice_number)
          break
        case 'supplier':
          cmp = cmpStr(a.supplier_name, b.supplier_name)
          break
        case 'purity':
          cmp = cmpNum(a.purity, b.purity)
          break
        case 'qty':
          cmp = cmpNum(a.qty, b.qty)
          break
        case 'by':
          cmp = cmpStr(a.released_by_name, b.released_by_name)
          break
        case 'released':
        default:
          cmp = cmpStr(a.released_at, b.released_at)
          break
      }
      return cmp * dir || cmpStr(a.invoice_number, b.invoice_number)
    })
  }, [histFilter.filtered, dateFrom, dateTo, histSort, histDir])

  function handlePendingSort(col: typeof pendingSort) {
    const next = nextSortDir(col, pendingSort, pendingDir, ['requested', 'released', 'needed'])
    setPendingSort(next.col)
    setPendingDir(next.dir)
  }

  function handleHistSort(col: typeof histSort) {
    const next = nextSortDir(col, histSort, histDir, ['released', 'purity', 'qty'])
    setHistSort(next.col)
    setHistDir(next.dir)
  }

  async function ensureLots(r: IssueRequest) {
    const key = lotsKey(r)
    if (lotsByMaterial[key]) return
    setLotsLoading(key)
    const grade = r.stock_grade === 'rejected' ? 'rejected' : 'approved'
    const kind = r.stock_kind === 'sfg' ? 'sfg' : 'rm'
    const data = await warehouseApi.listStock(factoryId, r.material_type, grade, kind)
    if (data.error) {
      toast.error(data.error)
      setLotsByMaterial((prev) => ({ ...prev, [key]: [] }))
    } else {
      setLotsByMaterial((prev) => ({
        ...prev,
        [key]: (data.stock ?? []) as StockLot[],
      }))
    }
    setLotsLoading(null)
  }

  async function toggleExpand(r: IssueRequest) {
    if (expandedId === r.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(r.id)
    setQtyByInvoice({})
    await ensureLots(r)
  }

  async function release(r: IssueRequest) {
    const key = lotsKey(r)
    const lots = lotsByMaterial[key] ?? []
    const lines = lots
      .map((lot) => ({
        invoice_number: lot.invoice_number,
        qty: Number(qtyByInvoice[lot.invoice_number] || 0),
      }))
      .filter((l) => l.qty > 0)

    if (lines.length === 0) {
      toast.error('Enter qty against at least one lot')
      return
    }

    setActingId(r.id)
    const result = await warehouseApi.release({
      request_id: r.id,
      lines,
    })
    setActingId(null)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Material released')
    setExpandedId(null)
    setQtyByInvoice({})
    setLotsByMaterial((prev) => {
      const next = { ...prev }
      delete next[lotsKey(r)]
      return next
    })
    await reload()
  }

  return (
    <AppLayout>
      <div className="w-full p-4 md:p-8">
        <div className="hidden lg:block">
          <PageHeader
            title="Release queue"
            subtitle="Warehouse · allocate lots against plant requests"
            accent="accountant"
          />
        </div>

        <MobileTabs
          ariaLabel="Release queue"
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'pending', label: 'Pending release' },
            { key: 'history', label: 'History' },
          ]}
        />
        <div className="hidden md:block">
        <div className="folder-tabs" role="tablist" aria-label="Release queue">
          {(
            [
              { key: 'pending' as const, label: 'Pending release' },
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
        </div>
        <section className="folder-panel folder-panel-mobile-round overflow-hidden">
        {loading ? (
          <div className="p-4">
            <SkeletonPanel />
          </div>
        ) : tab === 'history' ? (
          history.length === 0 ? (
            <EmptyState
              className="p-4"
              title="No releases yet"
              description="Lots you release to the plant will be recorded here."
            />
          ) : (
            <>
              <div className="hidden md:block">
              <SmartFilterBar
                filter={histFilter}
                placeholder="Search material, lot, supplier…"
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
              </div>
              <MobileListToolbar
                filter={histFilter}
                placeholder="Search material, lot…"
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateChange={(from, to) => {
                  setDateFrom(from)
                  setDateTo(to)
                }}
                resultCount={sortedHistory.length}
                noun={{ one: 'release', many: 'releases' }}
                sortOptions={[
                  { col: 'released', label: 'Released at', kind: 'date' },
                  { col: 'material', label: 'Material', kind: 'text' },
                  { col: 'lot', label: 'Lot / GRN', kind: 'text' },
                  { col: 'supplier', label: 'Supplier', kind: 'text' },
                  { col: 'purity', label: 'Purity', kind: 'number' },
                  { col: 'qty', label: 'Qty released', kind: 'number' },
                  { col: 'by', label: 'Released by', kind: 'text' },
                ]}
                sortCol={histSort}
                sortDir={histDir}
                onSort={handleHistSort}
              />
              {sortedHistory.length === 0 ? (
                <p className="p-4 text-sm text-muted">No releases match your search or filter.</p>
              ) : (
            <>
            <div className="space-y-3 md:hidden">
              {sortedHistory.map((r) => (
                <MobileCard
                  key={r.id}
                  id={r.invoice_number}
                  title={r.material_type}
                  subtitle={r.supplier_name ?? '—'}
                  aside={
                    <>
                      <p className="text-base font-medium tabular-nums text-pmc">
                        {r.qty} {r.unit}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-muted">Released</p>
                    </>
                  }
                  rows={[
                    { label: 'Released at', value: formatReleasedAt(r.released_at) },
                    { label: 'Purity', value: r.purity != null ? `${r.purity}%` : '—' },
                    { label: 'Released by', value: r.released_by_name ?? '—' },
                  ]}
                />
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[48rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <SortTh label="Released at" col="released" sortCol={histSort} sortDir={histDir} onSort={handleHistSort} />
                      <SortTh label="Material" col="material" sortCol={histSort} sortDir={histDir} onSort={handleHistSort} />
                      <SortTh label="Lot / GRN" col="lot" sortCol={histSort} sortDir={histDir} onSort={handleHistSort} />
                      <SortTh label="Supplier" col="supplier" sortCol={histSort} sortDir={histDir} onSort={handleHistSort} />
                      <SortTh label="Purity" col="purity" sortCol={histSort} sortDir={histDir} onSort={handleHistSort} />
                      <SortTh label="Qty released" col="qty" sortCol={histSort} sortDir={histDir} onSort={handleHistSort} />
                      <SortTh label="Released by" col="by" sortCol={histSort} sortDir={histDir} onSort={handleHistSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedHistory.map((r) => (
                      <tr key={r.id} className="border-b border-border/60 hover:bg-surface/60">
                        <td className="px-4 py-3 text-muted">{formatReleasedAt(r.released_at)}</td>
                        <td className="px-4 py-3 font-medium text-primary">{r.material_type}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-muted">
                          {r.invoice_number}
                        </td>
                        <td className="px-4 py-3 text-muted">{r.supplier_name ?? '—'}</td>
                        <td className="px-4 py-3 tabular-nums text-muted">
                          {r.purity != null ? `${r.purity}%` : '—'}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-muted">
                          {r.qty} {r.unit}
                        </td>
                        <td className="px-4 py-3 text-muted">{r.released_by_name ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            </div>
            </>
              )}
            </>
          )
        ) : requests.length === 0 ? (
          <p className="p-4 text-sm text-muted">No plant requests waiting for release.</p>
        ) : (
            <>
            <MobileListToolbar
              filter={pendingFilter}
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
                { col: 'requested', label: 'Requested', kind: 'number' },
                { col: 'released', label: 'Released', kind: 'number' },
                { col: 'needed', label: 'Needed by', kind: 'date' },
                { col: 'status', label: 'Status', kind: 'text' },
              ]}
              sortCol={pendingSort}
              sortDir={pendingDir}
              onSort={handlePendingSort}
            />
            {sortedRequests.length === 0 ? (
              <p className="p-4 text-sm text-muted">No requests match your search or filter.</p>
            ) : (
            <div className="space-y-3 md:hidden">
              {sortedRequests.map((r) => {
                const isOpen = expandedId === r.id
                const remainingNeed = Number(r.qty) - Number(r.qty_released || 0)
                const key = lotsKey(r)
                const lots = lotsByMaterial[key] ?? []
                const busy = actingId === r.id
                const loadingLots = lotsLoading === key
                const rejected = r.stock_grade === 'rejected'

                return (
                  <MobileCard
                    key={r.id}
                    title={
                      <>
                        {r.material_type}
                        {r.stock_kind === 'sfg' && rejected && (
                          <span className="ml-2 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-700">
                            Rejected SFG
                          </span>
                        )}
                        {r.stock_kind === 'sfg' && !rejected && (
                          <span className="ml-2 rounded-full bg-pmc/10 px-2 py-0.5 text-[11px] font-medium text-pmc">
                            Approved SFG
                          </span>
                        )}
                      </>
                    }
                    subtitle={<span className="capitalize">{r.status}</span>}
                    aside={
                      <>
                        <p className="text-base font-medium tabular-nums text-pmc">
                          {r.qty} {r.unit}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-muted">Requested</p>
                      </>
                    }
                    rows={[
                      { label: 'Released', value: `${r.qty_released ?? 0} ${r.unit}` },
                      { label: 'Needed by', value: r.needed_by_date ?? '—' },
                    ]}
                    footer={
                      <div className="space-y-4">
                        {isOpen ? (
                          <div className="space-y-3 border-t border-border pt-4">
                            {r.notes && <p className="text-xs text-muted">Note: {r.notes}</p>}
                            <p className="text-xs text-muted">
                              Remaining to release:{' '}
                              <span className="font-semibold text-pmc">
                                {remainingNeed.toFixed(3)} {r.unit}
                              </span>
                            </p>
                            {loadingLots ? (
                              <p className="text-sm text-muted">Loading warehouse lots…</p>
                            ) : lots.length === 0 ? (
                              <p className="text-sm text-muted">
                                {rejected
                                  ? 'No matching rejected SFG lots. Confirm the batch was rejected into warehouse stock.'
                                  : 'No matching warehouse lots for this material. Approve RM QC first so stock exists, then open Warehouse stock to confirm.'}
                              </p>
                            ) : (
                              <ul className="space-y-2">
                                {lots.map((lot) => (
                                  <li
                                    key={lot.invoice_number}
                                    className="rounded-lg border border-border p-3"
                                  >
                                    <p className="text-xs text-muted">{lot.invoice_number}</p>
                                    <dl className="mt-2 space-y-1 text-xs">
                                      <div className="flex justify-between gap-4">
                                        <dt className="text-muted">Supplier</dt>
                                        <dd className="text-right text-primary">
                                          {lot.supplier_name ?? '—'}
                                        </dd>
                                      </div>
                                      <div className="flex justify-between gap-4">
                                        <dt className="text-muted">Purity</dt>
                                        <dd className="text-right tabular-nums text-primary">
                                          {lot.purity != null ? `${lot.purity}%` : '—'}
                                        </dd>
                                      </div>
                                      <div className="flex justify-between gap-4">
                                        <dt className="text-muted">Available</dt>
                                        <dd className="text-right tabular-nums text-primary">
                                          {lot.tons_remaining}
                                        </dd>
                                      </div>
                                    </dl>
                                    <label className="mt-3 block">
                                      <span className="mb-1 block text-xs text-muted">
                                        Release qty
                                      </span>
                                      <input
                                        className="input-field h-11 w-full"
                                        type="number"
                                        inputMode="decimal"
                                        min="0"
                                        step="any"
                                        max={lot.tons_remaining}
                                        placeholder="0"
                                        value={qtyByInvoice[lot.invoice_number] ?? ''}
                                        onChange={(e) =>
                                          setQtyByInvoice((m) => ({
                                            ...m,
                                            [lot.invoice_number]: e.target.value,
                                          }))
                                        }
                                      />
                                    </label>
                                  </li>
                                ))}
                              </ul>
                            )}
                            <button
                              type="button"
                              disabled={busy || lots.length === 0 || loadingLots}
                              className="btn w-full border border-pmc bg-pmc text-white disabled:opacity-40"
                              onClick={() => void release(r)}
                            >
                              {busy ? 'Releasing…' : 'Release selected'}
                            </button>
                          </div>
                        ) : null}
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          className={isOpen ? 'btn btn-ghost w-full' : 'btn w-full border border-pmc bg-pmc text-white'}
                          onClick={() => void toggleExpand(r)}
                        >
                          {isOpen ? 'Close' : 'Release material'}
                        </button>
                      </div>
                    }
                  />
                )
              })}
            </div>
            )}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[42rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <SortTh label="Material" col="material" sortCol={pendingSort} sortDir={pendingDir} onSort={handlePendingSort} />
                    <SortTh label="Requested" col="requested" sortCol={pendingSort} sortDir={pendingDir} onSort={handlePendingSort} />
                    <SortTh label="Released" col="released" sortCol={pendingSort} sortDir={pendingDir} onSort={handlePendingSort} />
                    <SortTh label="Needed by" col="needed" sortCol={pendingSort} sortDir={pendingDir} onSort={handlePendingSort} />
                    <SortTh label="Status" col="status" sortCol={pendingSort} sortDir={pendingDir} onSort={handlePendingSort} />
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRequests.map((r) => {
                    const isOpen = expandedId === r.id
                    const remainingNeed = Number(r.qty) - Number(r.qty_released || 0)
                    const key = lotsKey(r)
                    const lots = lotsByMaterial[key] ?? []
                    const busy = actingId === r.id
                    const loadingLots = lotsLoading === key
                    const rejected = r.stock_grade === 'rejected'

                    return (
                      <Fragment key={r.id}>
                        <tr
                          className={`border-b border-border/60 ${
                            isOpen ? 'bg-pmc/[0.06]' : 'hover:bg-surface/60'
                          }`}
                        >
                          <td className="px-4 py-3 font-medium text-primary">
                            <span>{r.material_type}</span>
                            {r.stock_kind === 'sfg' && rejected && (
                              <span className="ml-2 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-700">
                                Rejected SFG
                              </span>
                            )}
                            {r.stock_kind === 'sfg' && !rejected && (
                              <span className="ml-2 rounded-full bg-pmc/10 px-2 py-0.5 text-[11px] font-medium text-pmc">
                                Approved SFG
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-muted">
                            {r.qty} {r.unit}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-muted">
                            {r.qty_released ?? 0} {r.unit}
                          </td>
                          <td className="px-4 py-3 text-muted">{r.needed_by_date ?? '—'}</td>
                          <td className="px-4 py-3 capitalize text-muted">{r.status}</td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              aria-expanded={isOpen}
                              className="inline-flex rounded-full bg-pmc px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                              onClick={() => void toggleExpand(r)}
                            >
                              {isOpen ? 'Close' : 'Release material'}
                            </button>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="border-b border-border/60 bg-surface/40">
                            <td colSpan={6} className="px-4 py-4">
                              <div className="space-y-4">
                                {r.notes && (
                                  <p className="text-xs text-muted">Note: {r.notes}</p>
                                )}
                                <p className="text-xs text-muted">
                                  Remaining to release:{' '}
                                  <span className="font-semibold text-pmc">
                                    {remainingNeed.toFixed(3)} {r.unit}
                                  </span>
                                </p>
                                {loadingLots ? (
                                  <p className="text-sm text-muted">Loading warehouse lots…</p>
                                ) : lots.length === 0 ? (
                                  <p className="text-sm text-muted">
                                    {rejected
                                      ? 'No matching rejected SFG lots. Confirm the batch was rejected into warehouse stock.'
                                      : 'No matching warehouse lots for this material. Approve RM QC first so stock exists, then open Warehouse stock to confirm.'}
                                  </p>
                                ) : (
                                  <div className="overflow-x-auto rounded-lg border border-border">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr>
                                          <th className="px-3 py-2 text-left">Lot / GRN</th>
                                          <th className="px-3 py-2 text-left">Supplier</th>
                                          <th className="px-3 py-2 text-left">Purity</th>
                                          <th className="px-3 py-2 text-left">Available</th>
                                          <th className="px-3 py-2 text-left">Release qty</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {lots.map((lot) => (
                                          <tr
                                            key={lot.invoice_number}
                                            className="border-b border-border/50"
                                          >
                                            <td className="px-3 py-2 font-mono text-[11px]">
                                              {lot.invoice_number}
                                            </td>
                                            <td className="px-3 py-2 text-muted">
                                              {lot.supplier_name ?? '—'}
                                            </td>
                                            <td className="px-3 py-2 tabular-nums text-muted">
                                              {lot.purity != null ? `${lot.purity}%` : '—'}
                                            </td>
                                            <td className="px-3 py-2 tabular-nums text-muted">
                                              {lot.tons_remaining}
                                            </td>
                                            <td className="px-3 py-2">
                                              <input
                                                className="input-field h-9 w-28"
                                                type="number"
                                                min="0"
                                                step="any"
                                                max={lot.tons_remaining}
                                                placeholder="0"
                                                value={qtyByInvoice[lot.invoice_number] ?? ''}
                                                onChange={(e) =>
                                                  setQtyByInvoice((m) => ({
                                                    ...m,
                                                    [lot.invoice_number]: e.target.value,
                                                  }))
                                                }
                                              />
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                                <button
                                  type="button"
                                  disabled={busy || lots.length === 0 || loadingLots}
                                  className="inline-flex h-10 items-center rounded-lg bg-pmc px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
                                  onClick={() => void release(r)}
                                >
                                  {busy ? 'Releasing…' : 'Release selected'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
            </>
        )}
        </section>
      </div>
    </AppLayout>
  )
}
