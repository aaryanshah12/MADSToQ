'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@madstoq/ui/erp-page-header'
import { useAuth } from '@/hooks/useAuth'
import { useInventoryFactory } from '@/contexts/InventoryFactoryContext'
import { productionApi } from '@/lib/api'
import { LIST_PAGE_SIZE } from '@/lib/list-page'
import { ProductionKindTabs } from '@/components/inventory/ProductionKindTabs'
import { ProductionRecordExportButton } from '@/components/inventory/ProductionRecordExportButton'
import { EmptyState, ListPager, SmartFilterBar, StatusBadge, TableSkeleton, useSmartFilter } from '@/components/ui'
import { FlaskConical } from 'lucide-react'
import { MgmtDrawer } from '@/components/inventory/MgmtDrawer'
import { OwnerProductionBatchDetail } from '@/components/inventory/OwnerProductionBatchDetail'
import { DateRangeChip, inDateRange } from '@/components/inventory/DateRangeChip'
import { SortTh } from '@/components/inventory/SortTh'
import { MobileCard, MobileListToolbar, MobileTabs } from '@/components/inventory/MobileList'

type BatchRow = {
  id: string
  batch_no: string
  kind?: string
  vessel: string | null
  status: string
  product_code: string | null
  product_name: string | null
  created_by_name: string | null
  created_at?: string | null
  completed_at: string | null
  progress_label?: string | null
}

type ProdSort = 'batch' | 'product' | 'vessel' | 'process' | 'status' | 'created'

function cmpText(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? '').localeCompare(b ?? '', undefined, { numeric: true, sensitivity: 'base' })
}


export default function OwnerProductionListPage() {
  const { profile, loading: authLoading } = useAuth()
  const { factoryId: ctxFactoryId } = useInventoryFactory()
  const factoryId = ctxFactoryId || profile?.factories?.[0]?.id || ''
  const [batches, setBatches] = useState<BatchRow[]>([])
  const [batchTotal, setBatchTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [paging, setPaging] = useState(false)
  const [tab, setTab] = useState<'sfg' | 'fg'>('sfg')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detailBatchId, setDetailBatchId] = useState<string | null>(null)
  const [sortCol, setSortCol] = useState<ProdSort>('batch')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const reload = useCallback(async () => {
    if (!factoryId) {
      setBatches([])
      setPaging(false)
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    const data = await productionApi.listBatches(factoryId, {
      kind: tab,
      page,
      page_size: LIST_PAGE_SIZE,
      from: dateFrom || undefined,
      to: dateTo || undefined,
    })
    if (data.error) setError(data.error)
    setBatches((data.batches ?? []) as BatchRow[])
    setBatchTotal(Number(data.total ?? data.batches?.length ?? 0))
    setPaging(false)
    setLoading(false)
  }, [factoryId, tab, dateFrom, dateTo, page])

  useEffect(() => {
    setPage(1)
  }, [factoryId, tab, dateFrom, dateTo])

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  const sfgBatches = useMemo(
    () => batches.filter((b) => b.kind !== 'fg'),
    [batches],
  )
  const fgBatches = useMemo(
    () => batches.filter((b) => b.kind === 'fg'),
    [batches],
  )
  const tabBatches = tab === 'fg' ? fgBatches : sfgBatches

  const filter = useSmartFilter(tabBatches, {
    getSearchText: (b) => [
      b.batch_no,
      b.product_code,
      b.product_name,
      b.vessel,
      b.status,
      b.progress_label,
      b.created_by_name,
    ],
    facets: [
      {
        key: 'status',
        label: 'Status',
        getValue: (b) => b.status,
        options: [
          { id: 'draft', label: 'Draft' },
          { id: 'in_progress', label: 'In progress' },
          { id: 'completed', label: 'Completed' },
        ],
      },
      { key: 'product', label: 'Product', getValue: (b) => b.product_code || '—' },
      { key: 'vessel', label: 'Vessel', getValue: (b) => b.vessel || '—' },
    ],
  })

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filter.filtered]
      .filter((b) => inDateRange(b.created_at || b.completed_at, dateFrom, dateTo))
      .sort((a, b) => {
      let cmp = 0
      switch (sortCol) {
        case 'product':
          cmp = cmpText(`${a.product_code ?? ''} ${a.product_name ?? ''}`, `${b.product_code ?? ''} ${b.product_name ?? ''}`)
          break
        case 'vessel':
          cmp = cmpText(a.vessel, b.vessel)
          break
        case 'process':
          cmp = cmpText(a.progress_label, b.progress_label)
          break
        case 'status':
          cmp = cmpText(a.status, b.status)
          break
        case 'created':
          cmp = cmpText(a.created_by_name, b.created_by_name)
          break
        case 'batch':
        default:
          cmp = cmpText(a.batch_no, b.batch_no)
          break
      }
      return cmp * dir || cmpText(a.batch_no, b.batch_no)
    })
  }, [filter.filtered, sortCol, sortDir, dateFrom, dateTo])

  function handleSort(col: ProdSort) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir(col === 'batch' ? 'desc' : 'asc')
    }
  }

  return (
    <AppLayout>
      <div className="w-full p-4 md:p-8">
        <div className="mb-8 hidden lg:block">
        <PageHeader
          title="Production"
          subtitle="Owner · live batch progress (view only)"
          accent="owner"
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <ProductionRecordExportButton factoryId={factoryId} disabled={loading} />
              <Link
                href="/inventory/owner/management"
                className="text-sm text-owner hover:underline"
              >
                Configure templates →
              </Link>
            </div>
          }
        />
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="md:hidden">
          <MobileTabs
            ariaLabel="Production kind"
            active={tab}
            onChange={setTab}
            tabs={[
              { key: 'sfg', label: 'Semi-Finished Goods' },
              { key: 'fg', label: 'Finished Goods' },
            ]}
          />
          {loading ? (
            <p className="py-4 text-sm text-muted">Loading…</p>
          ) : (
            <>
              <MobileListToolbar
                filter={filter}
                placeholder="Search batch, product, vessel…"
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateChange={(from, to) => {
                  setDateFrom(from)
                  setDateTo(to)
                }}
                resultCount={sorted.length}
                noun={{ one: 'batch', many: 'batches' }}
                sortOptions={[
                  { col: 'batch', label: 'Batch', kind: 'text' },
                  { col: 'product', label: 'Product', kind: 'text' },
                  { col: 'vessel', label: 'Vessel', kind: 'text' },
                  { col: 'process', label: 'Process', kind: 'text' },
                  { col: 'status', label: 'Status', kind: 'text' },
                  { col: 'created', label: 'Created by', kind: 'text' },
                ]}
                sortCol={sortCol}
                sortDir={sortDir}
                onSort={handleSort}
              />
              {tabBatches.length === 0 ? (
                <EmptyState
                  className="rounded-xl bg-panel"
                  icon={<FlaskConical size={28} strokeWidth={1.5} />}
                  title={tab === 'fg' ? 'No finished batches yet' : 'No semi-finished batches yet'}
                  description={
                    tab === 'fg'
                      ? 'Stage II batches started by chemists will appear here as they progress.'
                      : 'Stage I batches started by chemists will appear here as they progress.'
                  }
                />
              ) : sorted.length === 0 ? (
                <EmptyState
                  className="rounded-xl bg-panel"
                  icon={<FlaskConical size={28} strokeWidth={1.5} />}
                  title="No batches match"
                  description="Try a different search or clear the filter chips."
                />
              ) : (
                <div className="space-y-3">
                  {sorted.map((b) => (
                    <MobileCard
                      key={b.id}
                      id={b.batch_no}
                      title={b.product_name || b.product_code || '—'}
                      subtitle={b.product_code && b.product_name ? b.product_code : undefined}
                      aside={<StatusBadge status={b.status} />}
                      rows={[
                        { label: 'Vessel', value: b.vessel || '—' },
                        { label: 'Process', value: b.progress_label || '—' },
                        { label: 'Created by', value: b.created_by_name || '—' },
                      ]}
                      footer={
                        <button
                          type="button"
                          onClick={() => setDetailBatchId(b.id)}
                          className="btn w-full border border-owner bg-owner text-white"
                        >
                          Open batch
                        </button>
                      }
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="hidden md:block">
        <ProductionKindTabs tab={tab} onChange={setTab}>
          {!loading && (
            <SmartFilterBar
              filter={filter}
              placeholder="Search batch, product, vessel…"
              accent="owner"
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
          )}
          <div className="overflow-x-auto">
          <table className="data-table min-w-[720px]">
            <thead>
              <tr>
                <SortTh label="Batch" col="batch" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                <SortTh label="Product" col="product" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                <SortTh label="Vessel" col="vessel" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                <SortTh label="Process reached" col="process" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                <SortTh label="Status" col="status" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                <SortTh label="Created by" col="created" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton columns={6} rows={5} />
              ) : tabBatches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-0">
                    <EmptyState
                      icon={<FlaskConical size={28} strokeWidth={1.5} />}
                      title={tab === 'fg' ? 'No finished batches yet' : 'No semi-finished batches yet'}
                      description={
                        tab === 'fg'
                          ? 'Stage II batches started by chemists will appear here as they progress.'
                          : 'Stage I batches started by chemists will appear here as they progress.'
                      }
                    />
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-0">
                    <EmptyState
                      icon={<FlaskConical size={28} strokeWidth={1.5} />}
                      title="No batches match"
                      description="Try a different search or clear the filter chips."
                    />
                  </td>
                </tr>
              ) : (
                sorted.map((b) => (
                  <tr
                    key={b.id}
                    className="border-b border-border/60 last:border-0 hover:bg-owner/[0.03]"
                  >
                    <td className="font-medium">
                      <button
                        type="button"
                        onClick={() => setDetailBatchId(b.id)}
                        className="text-primary hover:underline"
                      >
                        {b.batch_no}
                      </button>
                    </td>
                    <td>
                      {b.product_code}
                      {b.product_name ? (
                        <span className="text-muted"> · {b.product_name}</span>
                      ) : null}
                    </td>
                    <td>{b.vessel || '—'}</td>
                    <td className="text-primary">{b.progress_label || '—'}</td>
                    <td>
                      <StatusBadge status={b.status} />
                    </td>
                    <td>{b.created_by_name || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        {!loading && (
          <div className="mt-4 flex justify-center">
            <ListPager page={page} total={batchTotal} disabled={paging} onPage={(next) => { setPaging(true); setPage(next) }} />
          </div>
        )}
        </ProductionKindTabs>
        </div>
      </div>

      {detailBatchId ? (
        <MgmtDrawer
          eyebrow="Production"
          title="Batch"
          onClose={() => setDetailBatchId(null)}
          size="lg"
          padded={false}
        >
          <OwnerProductionBatchDetail
            batchId={detailBatchId}
            onClose={() => setDetailBatchId(null)}
          />
        </MgmtDrawer>
      ) : null}
    </AppLayout>
  )
}
