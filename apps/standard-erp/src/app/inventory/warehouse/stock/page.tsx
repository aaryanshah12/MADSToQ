'use client'

import { useEffect, useMemo, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@madstoq/ui/erp-page-header'
import { useAuth } from '@/hooks/useAuth'
import { useInventoryFactory } from '@/contexts/InventoryFactoryContext'
import { warehouseApi } from '@/lib/api'
import { LIST_PAGE_SIZE } from '@/lib/list-page'
import { ListPager, SkeletonPanel, SmartFilterBar, useSmartFilter } from '@/components/ui'
import { DateRangeChip, inDateRange } from '@/components/inventory/DateRangeChip'
import { SortTh, cmpNum, cmpStr, nextSortDir } from '@/components/inventory/SortTh'
import { MobileCard, MobileListToolbar, MobileTabs } from '@/components/inventory/MobileList'

type StockRow = {
  invoice_number: string
  material_type: string
  supplier_name: string | null
  tons_loaded: number
  tons_used: number
  tons_remaining: number
  entry_date: string | null
  purity: number | null
  mfg_date?: string | null
  chemist_name?: string | null
  source?: string | null
  stock_grade?: string
  stock_kind?: string
}

/** Production byproduct lots use `{batch}/BP/{slug}` invoice numbers or stock_kind. */
function isByproduct(r: StockRow) {
  return r.stock_kind === 'byproduct' || /\/BP\//i.test(r.invoice_number)
}

function isSemiFinished(r: StockRow) {
  if (isByproduct(r)) return false
  if (r.stock_kind === 'sfg') return true
  if (r.stock_kind === 'fg' || r.stock_kind === 'rm') return false
  if (r.source === 'production') return true
  return (r.supplier_name ?? '').toLowerCase().startsWith('production')
}

function isFinished(r: StockRow) {
  if (isByproduct(r)) return false
  return r.stock_kind === 'fg'
}

function isRejected(r: StockRow) {
  return (r.stock_grade || 'approved') === 'rejected'
}

type StockSort =
  | 'material'
  | 'lot'
  | 'supplier'
  | 'purity'
  | 'loaded'
  | 'remaining'
  | 'date'
  | 'chemist'

function StockTable({
  rows,
  kind,
  sortCol,
  sortDir,
  onSort: handleSort,
}: {
  rows: StockRow[]
  kind: 'rm' | 'sfg' | 'rejected' | 'fg' | 'fg_rejected' | 'byproduct'
  sortCol: StockSort
  sortDir: 'asc' | 'desc'
  onSort: (col: StockSort) => void
}) {
  const sfg = kind !== 'rm'

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      let cmp = 0
      switch (sortCol) {
        case 'lot':
          cmp = cmpStr(a.invoice_number, b.invoice_number)
          break
        case 'supplier':
          cmp = cmpStr(a.supplier_name, b.supplier_name)
          break
        case 'purity':
          cmp = cmpNum(a.purity, b.purity)
          break
        case 'loaded':
          cmp = cmpNum(a.tons_loaded, b.tons_loaded)
          break
        case 'remaining':
          cmp = cmpNum(a.tons_remaining, b.tons_remaining)
          break
        case 'date':
          cmp = cmpStr(a.mfg_date || a.entry_date, b.mfg_date || b.entry_date)
          break
        case 'chemist':
          cmp = cmpStr(a.chemist_name, b.chemist_name)
          break
        case 'material':
        default:
          cmp = cmpStr(a.material_type, b.material_type)
          break
      }
      return cmp * dir || cmpStr(a.invoice_number, b.invoice_number)
    })
  }, [rows, sortCol, sortDir])

  if (rows.length === 0) {
    return (
      <p className="p-6 text-sm text-muted">
        {kind === 'byproduct'
          ? 'No byproduct lots with remaining balance.'
          : kind === 'fg_rejected'
          ? 'No rejected finished-goods lots with remaining balance.'
          : kind === 'fg'
            ? 'No approved finished-goods lots with remaining balance.'
            : kind === 'rejected'
          ? 'No rejected semi-finished lots with remaining balance.'
          : kind === 'sfg'
            ? 'No approved semi-finished lots with remaining balance.'
            : 'No raw-material lots with remaining balance.'}
      </p>
    )
  }

  return (
    <>
    <div className="md:hidden">
      <div className="space-y-3">
        {sorted.map((r) => (
          <MobileCard
            key={r.invoice_number}
            id={r.invoice_number}
            title={r.material_type}
            subtitle={r.supplier_name ?? '—'}
            aside={
              <>
                <p className="text-base font-medium tabular-nums text-pmc">
                  {r.tons_remaining}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-muted">Remaining</p>
              </>
            }
            rows={[
              { label: 'Purity', value: r.purity != null ? `${r.purity}%` : '—' },
              { label: 'Loaded', value: r.tons_loaded },
              { label: sfg ? 'Mfg date' : 'Date', value: r.mfg_date || r.entry_date || '—' },
              ...(sfg ? [{ label: 'Chemist', value: r.chemist_name || '—' }] : []),
            ]}
          />
        ))}
      </div>
    </div>
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead>
          <tr className="border-b border-border">
            <SortTh
              label={sfg ? 'Product' : 'Material'}
              col="material"
              sortCol={sortCol}
              sortDir={sortDir}
              onSort={handleSort}
            />
            <SortTh
              label={sfg ? 'Batch' : 'Lot / GRN'}
              col="lot"
              sortCol={sortCol}
              sortDir={sortDir}
              onSort={handleSort}
            />
            <SortTh
              label={sfg ? 'Source' : 'Supplier'}
              col="supplier"
              sortCol={sortCol}
              sortDir={sortDir}
              onSort={handleSort}
            />
            <SortTh label="Purity" col="purity" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
            <SortTh label="Loaded" col="loaded" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
            <SortTh
              label="Remaining"
              col="remaining"
              sortCol={sortCol}
              sortDir={sortDir}
              onSort={handleSort}
            />
            <SortTh
              label={sfg ? 'Mfg date' : 'Date'}
              col="date"
              sortCol={sortCol}
              sortDir={sortDir}
              onSort={handleSort}
            />
            {sfg ? (
              <SortTh
                label="Chemist"
                col="chemist"
                sortCol={sortCol}
                sortDir={sortDir}
                onSort={handleSort}
              />
            ) : null}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.invoice_number} className="border-b border-border/60 hover:bg-surface/60">
              <td className="px-4 py-3 font-medium text-primary">{r.material_type}</td>
              <td className="px-4 py-3 font-mono text-[11px] text-muted">{r.invoice_number}</td>
              <td className="px-4 py-3 text-muted">{r.supplier_name ?? '—'}</td>
              <td className="px-4 py-3 tabular-nums text-muted">
                {r.purity != null ? `${r.purity}%` : '—'}
              </td>
              <td className="px-4 py-3 tabular-nums text-muted">{r.tons_loaded}</td>
              <td className="px-4 py-3 tabular-nums font-medium text-pmc">{r.tons_remaining}</td>
              <td className="px-4 py-3 text-muted">{r.mfg_date || r.entry_date || '—'}</td>
              {sfg ? (
                <td className="px-4 py-3 text-muted">{r.chemist_name || '—'}</td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  )
}

export default function WarehouseStockPage() {
  const { profile, loading: authLoading } = useAuth()
  const { factoryId: ctxFactoryId } = useInventoryFactory()
  const factoryId = ctxFactoryId || profile?.factories?.[0]?.id || ''
  const [rows, setRows] = useState<StockRow[]>([])
  const [stockTotal, setStockTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'rm' | 'sfg' | 'rejected' | 'fg' | 'fg_rejected' | 'byproduct'>(
    'rm',
  )
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    setPage(1)
  }, [factoryId, tab, dateFrom, dateTo])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (authLoading || !factoryId) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError('')
      const spec =
        tab === 'fg' ? { kind: 'fg', grade: 'approved' }
        : tab === 'fg_rejected' ? { kind: 'fg', grade: 'rejected' }
        : tab === 'sfg' ? { kind: 'sfg', grade: 'approved' }
        : tab === 'rejected' ? { kind: 'sfg', grade: 'rejected' }
        : tab === 'byproduct' ? { kind: 'byproduct', grade: 'approved' }
        : { kind: 'rm', grade: 'approved' }
      const data = await warehouseApi.listStock(factoryId, undefined, spec.grade, spec.kind, {
        page,
        page_size: LIST_PAGE_SIZE,
        from: dateFrom || undefined,
        to: dateTo || undefined,
      })
      if (cancelled) return
      if (data.error) setError(data.error)
      setRows((data.stock ?? []) as StockRow[])
      setStockTotal(Number(data.total ?? data.stock?.length ?? 0))
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [authLoading, factoryId, tab, dateFrom, dateTo, page])

  const filter = useSmartFilter(rows, {
    getSearchText: (r) => [
      r.material_type,
      r.invoice_number,
      r.supplier_name,
      r.chemist_name,
    ],
    facets: [
      { key: 'material', label: 'Material', getValue: (r) => r.material_type },
      { key: 'supplier', label: 'Supplier', getValue: (r) => r.supplier_name || '—' },
    ],
  })

  const filtered = useMemo(
    () =>
      filter.filtered.filter((r) => inDateRange(r.mfg_date || r.entry_date, dateFrom, dateTo)),
    [filter.filtered, dateFrom, dateTo],
  )

  const rawMaterials = useMemo(
    () =>
      filtered.filter(
        (r) => !isByproduct(r) && !isFinished(r) && !isSemiFinished(r) && !isRejected(r),
      ),
    [filtered],
  )
  const semiFinished = useMemo(
    () => filtered.filter((r) => isSemiFinished(r) && !isRejected(r)),
    [filtered],
  )
  const rejectedSfg = useMemo(
    () => filtered.filter((r) => isSemiFinished(r) && isRejected(r)),
    [filtered],
  )
  const finished = useMemo(
    () => filtered.filter((r) => isFinished(r) && !isRejected(r)),
    [filtered],
  )
  const rejectedFg = useMemo(
    () => filtered.filter((r) => isFinished(r) && isRejected(r)),
    [filtered],
  )
  const byproducts = useMemo(
    () => filtered.filter((r) => isByproduct(r) && !isRejected(r)),
    [filtered],
  )

  const [sortCol, setSortCol] = useState<StockSort>('material')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function handleSort(col: StockSort) {
    const next = nextSortDir(col, sortCol, sortDir, ['purity', 'loaded', 'remaining', 'date'])
    setSortCol(next.col)
    setSortDir(next.dir)
  }

  const tabRows =
    tab === 'byproduct'
      ? byproducts
      : tab === 'fg_rejected'
        ? rejectedFg
        : tab === 'fg'
          ? finished
          : tab === 'rejected'
            ? rejectedSfg
            : tab === 'sfg'
              ? semiFinished
              : rawMaterials
  const sfgTab = tab !== 'rm'
  const sortProps = { sortCol, sortDir, onSort: handleSort }

  return (
    <AppLayout>
      <div className="w-full p-4 md:p-8">
        <div className="hidden lg:block">
          <PageHeader
            title="Warehouse stock"
            subtitle="Raw materials, SFG, finished goods, and byproducts with remaining warehouse balance"
            accent="accountant"
          />
        </div>

        {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

        <div>
          <MobileTabs
            ariaLabel="Warehouse stock kind"
            active={tab}
            onChange={setTab}
            tabs={[
              { key: 'rm', label: 'RM' },
              { key: 'sfg', label: 'SFG' },
              { key: 'rejected', label: 'Rej SFG' },
              { key: 'fg', label: 'FG' },
              { key: 'fg_rejected', label: 'Rej FG' },
              { key: 'byproduct', label: 'BP' },
            ]}
          />
          <div className="hidden md:block">
          <div className="folder-tabs" role="tablist" aria-label="Warehouse stock kind">
            {(
              [
                { key: 'rm' as const, label: 'Raw materials' },
                { key: 'sfg' as const, label: 'Semi-finished goods' },
                { key: 'rejected' as const, label: 'Rejected SFG' },
                { key: 'fg' as const, label: 'Finished goods' },
                { key: 'fg_rejected' as const, label: 'Rejected FG' },
                { key: 'byproduct' as const, label: 'Byproduct' },
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

        {loading ? (
          <section className="folder-panel folder-panel-mobile-round p-4">
            <SkeletonPanel />
          </section>
        ) : (
          <section className="folder-panel folder-panel-mobile-round overflow-hidden">
            {rows.length > 0 && (
              <>
              <div className="hidden md:block">
              <SmartFilterBar
                filter={filter}
                placeholder={
                  tab === 'rm'
                    ? 'Search material, lot, supplier…'
                    : 'Search product, batch, chemist…'
                }
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
                filter={filter}
                placeholder={tab === 'rm' ? 'Search material, lot…' : 'Search product, batch…'}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateChange={(from, to) => {
                  setDateFrom(from)
                  setDateTo(to)
                }}
                resultCount={tabRows.length}
                noun={{ one: 'lot', many: 'lots' }}
                sortOptions={[
                  { col: 'material', label: sfgTab ? 'Product' : 'Material', kind: 'text' },
                  { col: 'lot', label: sfgTab ? 'Batch' : 'Lot / GRN', kind: 'text' },
                  { col: 'supplier', label: sfgTab ? 'Source' : 'Supplier', kind: 'text' },
                  { col: 'purity', label: 'Purity', kind: 'number' },
                  { col: 'loaded', label: 'Loaded', kind: 'number' },
                  { col: 'remaining', label: 'Remaining', kind: 'number' },
                  { col: 'date', label: sfgTab ? 'Mfg date' : 'Date', kind: 'date' },
                  ...(sfgTab ? [{ col: 'chemist' as const, label: 'Chemist', kind: 'text' as const }] : []),
                ]}
                {...sortProps}
              />
              </>
            )}
            {tab === 'byproduct' ? (
              <StockTable rows={byproducts} kind="byproduct" {...sortProps} />
            ) : tab === 'fg_rejected' ? (
              <StockTable rows={rejectedFg} kind="fg_rejected" {...sortProps} />
            ) : tab === 'fg' ? (
              <StockTable rows={finished} kind="fg" {...sortProps} />
            ) : tab === 'rejected' ? (
              <StockTable rows={rejectedSfg} kind="rejected" {...sortProps} />
            ) : tab === 'sfg' ? (
              <StockTable rows={semiFinished} kind="sfg" {...sortProps} />
            ) : (
              <StockTable rows={rawMaterials} kind="rm" {...sortProps} />
            )}
            {!loading && (
              <div className="mt-4 flex justify-center">
                <ListPager page={page} total={stockTotal} onPage={setPage} />
              </div>
            )}
          </section>
        )}
        </div>
      </div>
    </AppLayout>
  )
}
