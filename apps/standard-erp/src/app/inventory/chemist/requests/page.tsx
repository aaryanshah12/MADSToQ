'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@madstoq/ui/erp-page-header'
import { useAuth } from '@/hooks/useAuth'
import { useInventoryFactory } from '@/contexts/InventoryFactoryContext'
import { useToast } from '@/components/providers/ToastProvider'
import { warehouseApi } from '@/lib/api'
import { ClipboardList, Plus } from 'lucide-react'
import { EmptyState, SkeletonText, SmartFilterBar, useSmartFilter } from '@/components/ui'
import { DateRangeChip, inDateRange } from '@/components/inventory/DateRangeChip'
import { SortTh, cmpNum, cmpStr, nextSortDir } from '@/components/inventory/SortTh'
import { MgmtDrawer } from '@/components/inventory/MgmtDrawer'
import { MobileCard, MobileListToolbar, MobileTabs } from '@/components/inventory/MobileList'
import {
  ChemistRequestMaterialFooter,
  ChemistRequestMaterialForm,
} from '@/components/inventory/ChemistRequestMaterialForm'

type IssueRequest = {
  id: string
  material_type: string
  qty: number | null
  qty_released: number | null
  unit: string
  needed_by_date: string | null
  notes: string | null
  status: string
  stock_grade?: string
  stock_kind?: string
}

type RequestSort = 'material' | 'grade' | 'qty' | 'released' | 'needed' | 'status'

function gradeLabel(r: IssueRequest) {
  if (r.stock_kind === 'sfg' && r.stock_grade === 'rejected') return 'Rejected SFG'
  if (r.stock_kind === 'sfg') return 'Approved SFG'
  return 'RM'
}

export default function ChemistIssueRequestsPage() {
  return (
    <Suspense fallback={<SkeletonText lines={4} className="p-6" />}>
      <ChemistIssueRequestsPageInner />
    </Suspense>
  )
}

function ChemistIssueRequestsPageInner() {
  const { profile, loading: authLoading } = useAuth()
  const { factoryId: ctxFactoryId } = useInventoryFactory()
  const toast = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const factoryId = ctxFactoryId || profile?.factories?.[0]?.id || ''
  const [tab, setTab] = useState<'open' | 'released'>('open')
  const [requests, setRequests] = useState<IssueRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actingId, setActingId] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [formBusy, setFormBusy] = useState(false)
  const [sortCol, setSortCol] = useState<RequestSort>('material')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const reload = useCallback(async () => {
    if (!factoryId) {
      setRequests([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    const status = tab === 'open' ? 'open' : 'released'
    const data = await warehouseApi.listRequests(factoryId, status)
    if (data.error) setError(data.error)
    setRequests((data.requests ?? []) as IssueRequest[])
    setLoading(false)
  }, [factoryId, tab])

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  useEffect(() => {
    if (searchParams.get('new') === '1') setFormOpen(true)
  }, [searchParams])

  function openForm() {
    setFormBusy(false)
    setFormOpen(true)
  }

  function closeForm() {
    if (formBusy) return
    setFormOpen(false)
    if (searchParams.get('new') === '1') {
      router.replace('/inventory/chemist/requests')
    }
  }

  async function cancel(id: string) {
    setActingId(id)
    setError('')
    const result = await warehouseApi.cancelRequest(id)
    setActingId(null)
    if (result.error) {
      setError(result.error)
      return
    }
    await reload()
  }

  const filter = useSmartFilter(requests, {
    getSearchText: (r) => [r.material_type, r.status, r.notes, r.stock_grade],
    facets: [
      { key: 'material', label: 'Material', getValue: (r) => r.material_type },
      {
        key: 'grade',
        label: 'Grade',
        getValue: (r) =>
          r.stock_kind === 'sfg'
            ? r.stock_grade === 'rejected'
              ? 'rejected sfg'
              : 'approved sfg'
            : 'rm',
        options: [
          { id: 'rm', label: 'RM' },
          { id: 'rejected', label: 'Rejected SFG' },
        ],
      },
    ],
  })

  const visible = useMemo(() => {
    const filtered = filter.filtered.filter((r) => inDateRange(r.needed_by_date, dateFrom, dateTo))
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      let cmp = 0
      switch (sortCol) {
        case 'grade':
          cmp = cmpStr(gradeLabel(a), gradeLabel(b))
          break
        case 'qty':
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
  }, [filter.filtered, dateFrom, dateTo, sortCol, sortDir])

  function handleSort(col: RequestSort) {
    const next = nextSortDir(col, sortCol, sortDir, ['qty', 'released', 'needed'])
    setSortCol(next.col)
    setSortDir(next.dir)
  }

  return (
    <AppLayout>
      <div className="w-full p-4 md:p-8">
        <div className="mb-8 hidden lg:block">
        <PageHeader
          title="My requests"
          subtitle="Chemist · issue requests to warehouse"
          accent="chemist"
          actions={
            <button
              type="button"
              onClick={openForm}
              className="inline-flex items-center gap-2 rounded-lg bg-chemist px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <Plus size={16} />
              Request material
            </button>
          }
        />
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="md:hidden">
          <MobileTabs
            ariaLabel="My requests"
            active={tab}
            onChange={setTab}
            tabs={[
              { key: 'open', label: 'Pending' },
              { key: 'released', label: 'Released' },
            ]}
          />
          {loading ? (
            <SkeletonText lines={4} className="rounded-xl bg-panel p-6" />
          ) : (
            <>
              <MobileListToolbar
                filter={filter}
                placeholder="Search material…"
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateChange={(from, to) => {
                  setDateFrom(from)
                  setDateTo(to)
                }}
                resultCount={visible.length}
                noun={{ one: 'request', many: 'requests' }}
                sortOptions={[
                  { col: 'material', label: 'Material', kind: 'text' },
                  { col: 'grade', label: 'Grade', kind: 'text' },
                  { col: 'qty', label: 'Qty', kind: 'number' },
                  { col: 'released', label: 'Released', kind: 'number' },
                  { col: 'needed', label: 'Needed by', kind: 'date' },
                  { col: 'status', label: 'Status', kind: 'text' },
                ]}
                sortCol={sortCol}
                sortDir={sortDir}
                onSort={handleSort}
              />
              {requests.length === 0 ? (
                <EmptyState
                  className="rounded-xl bg-panel"
                  icon={<ClipboardList size={28} strokeWidth={1.5} />}
                  title={tab === 'open' ? 'No open requests' : 'No released requests yet'}
                  description={
                    tab === 'open'
                      ? 'Material you request from the warehouse stays here until it is released.'
                      : 'Requests the warehouse has released will be listed here.'
                  }
                />
              ) : visible.length === 0 ? (
                <EmptyState
                  className="rounded-xl bg-panel"
                  title="No requests match"
                  description="Try a different search or clear the filter chips."
                />
              ) : (
                <div className="space-y-3">
                  {visible.map((r) => (
                    <MobileCard
                      key={r.id}
                      title={r.material_type}
                      subtitle={gradeLabel(r)}
                      aside={
                        <>
                          <span className="block text-base font-medium tabular-nums text-chemist">
                            {r.qty ?? '—'} {r.unit}
                          </span>
                          <span className="block text-[10px] uppercase tracking-wider text-muted">Qty</span>
                        </>
                      }
                      rows={[
                        { label: 'Released', value: `${r.qty_released ?? 0} ${r.unit}` },
                        { label: 'Needed by', value: r.needed_by_date ?? '—' },
                        { label: 'Status', value: r.status },
                      ]}
                      footer={
                        tab === 'open' && (r.status === 'pending' || r.status === 'partial') ? (
                          <button
                            type="button"
                            disabled={actingId === r.id}
                            className="btn w-full border border-red-300 bg-panel text-red-600 disabled:opacity-40"
                            onClick={() => void cancel(r.id)}
                          >
                            Cancel request
                          </button>
                        ) : undefined
                      }
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="hidden md:block">
        <div className="folder-tabs" role="tablist" aria-label="My requests">
          {(
            [
              { key: 'open' as const, label: 'Pending' },
              { key: 'released' as const, label: 'Already released' },
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
        <section className="folder-panel min-h-[28rem] overflow-hidden">
          {loading ? (
            <SkeletonText lines={4} className="p-6" />
          ) : requests.length === 0 ? (
            <EmptyState
              icon={<ClipboardList size={28} strokeWidth={1.5} />}
              title={tab === 'open' ? 'No open requests' : 'No released requests yet'}
              description={
                tab === 'open'
                  ? 'Material you request from the warehouse stays here until it is released.'
                  : 'Requests the warehouse has released will be listed here.'
              }
              action={
                tab === 'open' ? (
                  <button
                    type="button"
                    onClick={openForm}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-primary hover:bg-layer"
                  >
                    <Plus size={16} />
                    Create request
                  </button>
                ) : undefined
              }
            />
          ) : (
            <>
              <SmartFilterBar
                filter={filter}
                placeholder="Search material…"
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
                <EmptyState title="No requests match" description="Try a different search or clear the filter chips." />
              ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <SortTh label="Material" col="material" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="chemist" />
                  <SortTh label="Grade" col="grade" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="chemist" />
                  <SortTh label="Qty" col="qty" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="chemist" />
                  <SortTh label="Released" col="released" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="chemist" />
                  <SortTh label="Needed by" col="needed" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="chemist" />
                  <SortTh label="Status" col="status" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="chemist" />
                  {tab === 'open' && <th className="px-4 py-3 text-right">Action</th>}
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="px-4 py-3 text-primary">{r.material_type}</td>
                    <td className="px-4 py-3 text-muted">
                      {r.stock_kind === 'sfg' && r.stock_grade === 'rejected' ? (
                        <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-700">
                          Rejected SFG
                        </span>
                      ) : r.stock_kind === 'sfg' ? (
                        <span className="rounded-full bg-chemist/10 px-2 py-0.5 text-[11px] font-medium text-chemist">
                          Approved SFG
                        </span>
                      ) : (
                        'RM'
                      )}
                    </td>
                    <td className="px-4 py-3 text-primary">
                      {r.qty ?? '—'} {r.unit}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {r.qty_released ?? 0} {r.unit}
                    </td>
                    <td className="px-4 py-3 text-muted">{r.needed_by_date ?? '—'}</td>
                    <td className="px-4 py-3 capitalize text-muted">{r.status}</td>
                    {tab === 'open' && (
                      <td className="px-4 py-3 text-right">
                        {(r.status === 'pending' || r.status === 'partial') && (
                          <button
                            type="button"
                            disabled={actingId === r.id}
                            className="text-xs text-red-600 hover:underline disabled:opacity-40"
                            onClick={() => void cancel(r.id)}
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
              )}
            </>
          )}
        </section>
        </div>
      </div>
      {!formOpen ? (
        <button
          type="button"
          onClick={openForm}
          className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 inline-flex h-12 items-center gap-2 rounded-full bg-text px-5 text-sm font-medium text-panel shadow-lg lg:hidden"
        >
          <Plus size={18} />
          Request material
        </button>
      ) : null}
      {formOpen ? (
        <MgmtDrawer
          title="Request material"
          eyebrow="Release RM or SFG from warehouse"
          size="sm"
          onClose={closeForm}
          mobileSheet
          footer={<ChemistRequestMaterialFooter onClose={closeForm} submitting={formBusy} />}
        >
          <ChemistRequestMaterialForm
            key={String(formOpen)}
            onBusy={setFormBusy}
            onCreated={() => {
              toast.success('Request submitted — warehouse will release material against this request.')
              setFormBusy(false)
              setFormOpen(false)
              if (searchParams.get('new') === '1') {
                router.replace('/inventory/chemist/requests')
              }
              void reload()
            }}
          />
        </MgmtDrawer>
      ) : null}
    </AppLayout>
  )
}
