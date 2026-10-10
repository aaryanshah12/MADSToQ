'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@madstoq/ui/erp-page-header'
import { useAuth } from '@/hooks/useAuth'
import { useInventoryFactory } from '@/contexts/InventoryFactoryContext'
import { useToast } from '@/components/providers/ToastProvider'
import { procurementApi } from '@/lib/api'
import { ClipboardList, Plus } from 'lucide-react'
import { EmptyState, SkeletonText, SmartFilterBar, useSmartFilter } from '@/components/ui'
import { DateRangeChip, inDateRange } from '@/components/inventory/DateRangeChip'
import { SortTh, cmpNum, cmpStr, nextSortDir } from '@/components/inventory/SortTh'
import { MgmtDrawer } from '@/components/inventory/MgmtDrawer'
import { MobileCard, MobileListToolbar } from '@/components/inventory/MobileList'
import {
  NewBuyRequestFooter,
  NewBuyRequestForm,
} from '@/components/inventory/NewBuyRequestForm'

type MaterialRequest = {
  id: string
  material_type: string
  qty: number | null
  unit: string
  needed_by_date: string | null
  notes: string | null
  status: string
}

export default function WarehouseBuyRequestsPage() {
  return (
    <Suspense fallback={<SkeletonText lines={4} className="p-6" />}>
      <WarehouseBuyRequestsPageInner />
    </Suspense>
  )
}

function WarehouseBuyRequestsPageInner() {
  const { profile, loading: authLoading } = useAuth()
  const { factoryId: ctxFactoryId } = useInventoryFactory()
  const toast = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [requests, setRequests] = useState<MaterialRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortCol, setSortCol] = useState<'material' | 'qty' | 'needed' | 'status'>('material')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [formOpen, setFormOpen] = useState(false)
  const [formBusy, setFormBusy] = useState(false)

  const factoryId = ctxFactoryId || profile?.factories?.[0]?.id || ''

  const reload = useCallback(async () => {
    if (authLoading) return
    if (!factoryId) {
      setRequests([])
      setLoading(false)
      return
    }
    setLoading(true)
    const data = await procurementApi.listRequests(factoryId)
    if (data.error) setError(data.error)
    setRequests((data.requests ?? []) as MaterialRequest[])
    setLoading(false)
  }, [authLoading, factoryId])

  useEffect(() => {
    void reload()
  }, [reload])

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
      router.replace('/inventory/warehouse/buy-requests')
    }
  }

  const filter = useSmartFilter(requests, {
    getSearchText: (r) => [r.material_type, r.status, r.notes],
    facets: [
      { key: 'material', label: 'Material', getValue: (r) => r.material_type },
      { key: 'status', label: 'Status', getValue: (r) => r.status },
    ],
  })

  const visible = useMemo(() => {
    const filtered = filter.filtered.filter((r) => inDateRange(r.needed_by_date, dateFrom, dateTo))
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      let cmp = 0
      switch (sortCol) {
        case 'qty':
          cmp = cmpNum(a.qty, b.qty)
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

  function handleSort(col: typeof sortCol) {
    const next = nextSortDir(col, sortCol, sortDir, ['qty', 'needed'])
    setSortCol(next.col)
    setSortDir(next.dir)
  }

  return (
    <AppLayout>
      <div className="w-full p-4 max-md:pb-24 md:p-8">
        <div className="hidden lg:block">
          <PageHeader
            title="Buy requests"
            subtitle="Warehouse · request purchase when stock is short — owner raises the PO"
            accent="accountant"
            actions={
              <button
                type="button"
                onClick={openForm}
                className="inline-flex items-center gap-2 rounded-lg bg-pmc px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                <Plus size={16} />
                New request
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
          {loading ? (
            <SkeletonText lines={4} className="rounded-xl bg-panel p-6" />
          ) : requests.length === 0 ? (
            <div className="rounded-xl bg-panel">
              <EmptyState
                icon={<ClipboardList size={28} strokeWidth={1.5} />}
                title="No buy requests yet"
                description="Raise a request when warehouse stock needs replenishing from a supplier."
                action={
                  <button
                    type="button"
                    onClick={openForm}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-primary hover:bg-layer"
                  >
                    <Plus size={16} />
                    Create request
                  </button>
                }
              />
            </div>
          ) : (
            <>
              <MobileListToolbar
                filter={filter}
                placeholder="Search material or status…"
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
                  { col: 'qty', label: 'Qty', kind: 'number' },
                  { col: 'needed', label: 'Needed by', kind: 'date' },
                  { col: 'status', label: 'Status', kind: 'text' },
                ]}
                sortCol={sortCol}
                sortDir={sortDir}
                onSort={handleSort}
              />
              {visible.length === 0 ? (
                <div className="rounded-xl bg-panel">
                  <EmptyState title="No requests match" description="Try a different search or clear the filter chips." />
                </div>
              ) : (
                <div className="space-y-3">
                  {visible.map((r) => (
                    <MobileCard
                      key={r.id}
                      title={r.material_type}
                      aside={
                        <>
                          <span className="block text-base font-medium tabular-nums text-pmc">
                            {r.qty ?? '—'} {r.unit}
                          </span>
                          <span className="block text-[10px] uppercase tracking-wider text-muted">Qty</span>
                        </>
                      }
                      footer={
                        <div className="-mt-1 flex items-center justify-between gap-3 text-xs">
                          <span className="text-muted">
                            Needed by <span className="text-primary">{r.needed_by_date ?? '—'}</span>
                          </span>
                          <span className="badge badge-muted shrink-0 capitalize">{r.status}</span>
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
        <div className="card overflow-hidden">
          {loading ? (
            <SkeletonText lines={4} className="p-6" />
          ) : requests.length === 0 ? (
            <EmptyState
              icon={<ClipboardList size={28} strokeWidth={1.5} />}
              title="No buy requests yet"
              description="Raise a request when warehouse stock needs replenishing from a supplier."
              action={
                <button
                  type="button"
                  onClick={openForm}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-primary hover:bg-layer"
                >
                  <Plus size={16} />
                  Create request
                </button>
              }
            />
          ) : (
            <>
              <SmartFilterBar
                filter={filter}
                placeholder="Search material or status…"
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
              {visible.length === 0 ? (
                <EmptyState title="No requests match" description="Try a different search or clear the filter chips." />
              ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <SortTh label="Material" col="material" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Qty" col="qty" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Needed by" col="needed" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Status" col="status" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="px-4 py-3 text-primary">{r.material_type}</td>
                    <td className="px-4 py-3 text-primary">
                      {r.qty ?? '—'} {r.unit}
                    </td>
                    <td className="px-4 py-3 text-muted">{r.needed_by_date ?? '—'}</td>
                    <td className="px-4 py-3 capitalize text-muted">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
              )}
            </>
          )}
        </div>
        </div>
      </div>
      {!formOpen ? (
        <button
          type="button"
          onClick={openForm}
          className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 inline-flex h-12 items-center gap-2 rounded-full bg-text px-5 text-sm font-medium text-panel shadow-lg lg:hidden"
        >
          <Plus size={18} />
          New request
        </button>
      ) : null}
      {formOpen ? (
        <MgmtDrawer
          title="New buy request"
          eyebrow="Warehouse · material, quantity, needed-by date"
          onClose={closeForm}
          mobileSheet
          footer={<NewBuyRequestFooter onClose={closeForm} submitting={formBusy} />}
        >
          <NewBuyRequestForm
            key={String(formOpen)}
            onBusy={setFormBusy}
            onCreated={() => {
              toast.success('Request submitted — owner will select vendor and share the PO.')
              setFormBusy(false)
              setFormOpen(false)
              if (searchParams.get('new') === '1') {
                router.replace('/inventory/warehouse/buy-requests')
              }
              void reload()
            }}
          />
        </MgmtDrawer>
      ) : null}
    </AppLayout>
  )
}

