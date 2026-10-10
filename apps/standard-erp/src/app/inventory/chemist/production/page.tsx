'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@madstoq/ui/erp-page-header'
import { useAuth } from '@/hooks/useAuth'
import { useInventoryFactory } from '@/contexts/InventoryFactoryContext'
import { productionApi } from '@/lib/api'
import { FlaskConical, Plus } from 'lucide-react'
import { ProductionKindTabs } from '@/components/inventory/ProductionKindTabs'
import { ProductionRecordExportButton } from '@/components/inventory/ProductionRecordExportButton'
import { EmptyState, SmartFilterBar, StatusBadge, TableSkeleton, useSmartFilter } from '@/components/ui'
import { DateRangeChip, inDateRange } from '@/components/inventory/DateRangeChip'
import { SortTh, cmpStr, nextSortDir } from '@/components/inventory/SortTh'
import { MobileCard, MobileListToolbar, MobileTabs } from '@/components/inventory/MobileList'

type BatchRow = {
  id: string
  batch_no: string
  kind?: string
  vessel: string | null
  status: string
  product_code: string | null
  product_name: string | null
  created_at: string | null
  completed_at: string | null
  progress_label?: string | null
}

export default function ChemistProductionListPage() {
  const { profile, loading: authLoading } = useAuth()
  const { factoryId: ctxFactoryId } = useInventoryFactory()
  const factoryId = ctxFactoryId || profile?.factories?.[0]?.id || ''
  const [batches, setBatches] = useState<BatchRow[]>([])
  const [tab, setTab] = useState<'sfg' | 'fg'>('sfg')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortCol, setSortCol] = useState<'batch' | 'product' | 'vessel' | 'process' | 'status'>('batch')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const reload = useCallback(async () => {
    if (!factoryId) {
      setBatches([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    const data = await productionApi.listBatches(factoryId)
    if (data.error) setError(data.error)
    setBatches((data.batches ?? []) as BatchRow[])
    setLoading(false)
  }, [factoryId])

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

  const visibleBatches = useMemo(() => {
    const filtered = filter.filtered.filter((b) =>
      inDateRange(b.created_at || b.completed_at, dateFrom, dateTo),
    )
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      let cmp = 0
      switch (sortCol) {
        case 'product':
          cmp = cmpStr(`${a.product_code ?? ''} ${a.product_name ?? ''}`, `${b.product_code ?? ''} ${b.product_name ?? ''}`)
          break
        case 'vessel':
          cmp = cmpStr(a.vessel, b.vessel)
          break
        case 'process':
          cmp = cmpStr(a.progress_label, b.progress_label)
          break
        case 'status':
          cmp = cmpStr(a.status, b.status)
          break
        case 'batch':
        default:
          cmp = cmpStr(a.batch_no, b.batch_no)
          break
      }
      return cmp * dir || cmpStr(a.batch_no, b.batch_no)
    })
  }, [filter.filtered, dateFrom, dateTo, sortCol, sortDir])

  function handleSort(col: typeof sortCol) {
    const next = nextSortDir(col, sortCol, sortDir, ['batch'])
    setSortCol(next.col)
    setSortDir(next.dir)
  }

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  return (
    <AppLayout>
      <div className="w-full p-4 md:p-8">
        <div className="mb-8 hidden lg:block">
        <PageHeader
          title="Production"
          subtitle="Chemist · batches from product templates"
          accent="chemist"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <ProductionRecordExportButton factoryId={factoryId} disabled={loading} />
              <Link
                href={`/inventory/chemist/production/new?kind=${tab}`}
                className="btn btn-chemist gap-2"
              >
                <Plus size={16} />
                New batch
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
                resultCount={visibleBatches.length}
                noun={{ one: 'batch', many: 'batches' }}
                sortOptions={[
                  { col: 'batch', label: 'Batch', kind: 'text' },
                  { col: 'product', label: 'Product', kind: 'text' },
                  { col: 'vessel', label: 'Vessel', kind: 'text' },
                  { col: 'process', label: 'Process', kind: 'text' },
                  { col: 'status', label: 'Status', kind: 'text' },
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
                      ? 'Start a Stage II batch to wash crude lots into finished goods.'
                      : 'Start a Stage I batch to begin recording raw → semi-finished production.'
                  }
                />
              ) : visibleBatches.length === 0 ? (
                <EmptyState
                  className="rounded-xl bg-panel"
                  icon={<FlaskConical size={28} strokeWidth={1.5} />}
                  title="No batches match"
                  description="Try a different search or clear the filter chips."
                />
              ) : (
                <div className="space-y-3">
                  {visibleBatches.map((b) => (
                    <MobileCard
                      key={b.id}
                      id={b.batch_no}
                      title={b.product_name || b.product_code || '—'}
                      subtitle={b.product_code && b.product_name ? b.product_code : undefined}
                      aside={<StatusBadge status={b.status} />}
                      rows={[
                        { label: 'Vessel', value: b.vessel || '—' },
                        { label: 'Process', value: b.progress_label || '—' },
                      ]}
                      footer={
                        <Link
                          href={`/inventory/chemist/production/${b.id}`}
                          className="btn w-full border border-chemist bg-chemist text-white"
                        >
                          Open batch
                        </Link>
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
          )}
          <div className="overflow-x-auto">
          <table className="data-table min-w-[720px]">
            <thead>
              <tr>
                <SortTh label="Batch" col="batch" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="chemist" />
                <SortTh label="Product" col="product" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="chemist" />
                <SortTh label="Vessel" col="vessel" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="chemist" />
                <SortTh label="Process reached" col="process" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="chemist" />
                <SortTh label="Status" col="status" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="chemist" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton columns={5} rows={5} />
              ) : tabBatches.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-0">
                    <EmptyState
                      icon={<FlaskConical size={28} strokeWidth={1.5} />}
                      title={tab === 'fg' ? 'No finished batches yet' : 'No semi-finished batches yet'}
                      description={
                        tab === 'fg'
                          ? 'Start a Stage II batch to wash crude lots into finished goods.'
                          : 'Start a Stage I batch to begin recording raw → semi-finished production.'
                      }
                    />
                  </td>
                </tr>
              ) : visibleBatches.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-0">
                    <EmptyState
                      icon={<FlaskConical size={28} strokeWidth={1.5} />}
                      title="No batches match"
                      description="Try a different search or clear the filter chips."
                    />
                  </td>
                </tr>
              ) : (
                visibleBatches.map((b) => (
                  <tr key={b.id} className="border-b border-border/60 last:border-0">
                    <td className="font-medium">
                      <Link
                        href={`/inventory/chemist/production/${b.id}`}
                        className="text-primary hover:underline"
                      >
                        {b.batch_no}
                      </Link>
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </ProductionKindTabs>
        </div>
      </div>
      <Link
        href={`/inventory/chemist/production/new?kind=${tab}`}
        className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 inline-flex h-12 items-center gap-2 rounded-full bg-text px-5 text-sm font-medium text-panel shadow-lg lg:hidden"
      >
        <Plus size={18} />
        New batch
      </Link>
    </AppLayout>
  )
}
