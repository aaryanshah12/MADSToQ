'use client'
import { useEffect, useMemo, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { SpinnerBlock, EmptyState, useSmartFilter } from '@/components/ui'
import PageHeader from '@madstoq/ui/erp-page-header'
import { inventoryApi } from '@/lib/client/inventory-api'
import { useAuth } from '@/hooks/useAuth'
import { useInventoryFactory } from '@/contexts/InventoryFactoryContext'
import { getCurrentFiscalYear, getFiscalYears } from '@/lib/monthlyMaterial'
import { LedgerKindTabs } from '@/components/inventory/LedgerKindTabs'
import { DateRangeChip, inDateRange } from '@/components/inventory/DateRangeChip'
import { SortTh } from '@/components/inventory/SortTh'
import { MobileCard, MobileListToolbar, MobileTabs } from '@/components/inventory/MobileList'
import {
  isPlantBatchUsage,
  isWarehouseReleaseUsage,
  parseStockKind,
  plantUsageTabOf,
  PLANT_USAGE_TABS,
  type PlantUsageTab,
} from '@/lib/ledger-kind'

type UsageSort = 'batch' | 'product' | 'lot' | 'material' | 'qty' | 'remaining' | 'chemist' | 'shift' | 'date'

function cmpText(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? '').localeCompare(b ?? '', undefined, { numeric: true, sensitivity: 'base' })
}


export default function OwnerUsagePage() {
  const { profile, loading: authLoading } = useAuth()
  const { factoryId: ctxFactoryId } = useInventoryFactory()
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fiscalYear, setFiscalYear] = useState(() => getCurrentFiscalYear())
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [tab, setTab] = useState<PlantUsageTab>('rm_sfg')
  const [sortCol, setSortCol] = useState<UsageSort>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const fiscalYears = getFiscalYears(5)

  useEffect(() => {
    async function load() {
      if (authLoading) return
      if (!profile) {
        setEntries([])
        setLoading(false)
        return
      }
      if (!ctxFactoryId) {
        setEntries([])
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const page = await inventoryApi.getUsagePage([ctxFactoryId])
        const entryList = page.usage ?? []
        const stockMap = page.stockMap ?? {}

        const releasedByLot: Record<string, number> = {}
        entryList.forEach((entry: any) => {
          if (!isWarehouseReleaseUsage(entry)) return
          const inv = entry.invoice_number
          releasedByLot[inv] = (releasedByLot[inv] ?? 0) + Number(entry.tons_used || 0)
        })

        const plantRows = entryList.filter((e: any) => isPlantBatchUsage(e))
        const grouped: Record<string, any[]> = {}
        plantRows.forEach((entry: any) => {
          if (!grouped[entry.invoice_number]) grouped[entry.invoice_number] = []
          grouped[entry.invoice_number].push(entry)
        })

        const remainingById: Record<string, number> = {}
        Object.entries(grouped).forEach(([inv, list]) => {
          list.sort((a, b) => {
            const aDate = new Date(a.usage_date).getTime()
            const bDate = new Date(b.usage_date).getTime()
            if (aDate !== bDate) return aDate - bDate
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          })
          let remaining = releasedByLot[inv] ?? 0
          list.forEach((entry: any) => {
            remaining -= Number(entry.tons_used || 0)
            remainingById[entry.id] = remaining
          })
        })

        setEntries(
          plantRows.map((e: any) => ({
            ...e,
            stock_entries: stockMap[e.invoice_number] ?? null,
            plant_remaining: remainingById[e.id] ?? null,
            stock_kind: parseStockKind(stockMap[e.invoice_number]?.stock_kind ?? e.stock_kind),
            stock_grade: stockMap[e.invoice_number]?.stock_grade ?? e.stock_grade,
          })),
        )
      } catch (err) {
        console.error(err)
        setEntries([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [authLoading, profile, ctxFactoryId])

  const tabEntries = useMemo(
    () => entries.filter((e) => plantUsageTabOf(e) === tab),
    [entries, tab],
  )
  const filter = useSmartFilter(tabEntries, {
    getSearchText: (e) => [
      e.invoice_number,
      e.batch_no,
      e.product_name,
      e.product_code,
      e.stock_entries?.supplier_name,
      e.stock_entries?.material_type,
      e.profiles?.full_name,
    ],
    facets: [
      { key: 'material', label: 'Material', getValue: (e) => e.stock_entries?.material_type || '—' },
      { key: 'product', label: 'Product', getValue: (e) => e.product_name || e.product_code || '—' },
      { key: 'chemist', label: 'Chemist', getValue: (e) => e.profiles?.full_name || '—' },
    ],
  })
  const filtered = useMemo(() => {
    return filter.filtered.filter((e) => {
      const usageDate = new Date(e.usage_date)
      const rangeActive = Boolean(dateFrom || dateTo)
      const matchRange = inDateRange(e.usage_date, dateFrom, dateTo)
      const fyStart = Number(fiscalYear.replace('FY', '').split('-')[0])
      const matchFiscalYear =
        rangeActive ||
        (usageDate >= new Date(fyStart, 3, 1) && usageDate < new Date(fyStart + 1, 3, 1))
      return matchRange && matchFiscalYear
    })
  }, [filter.filtered, dateFrom, dateTo, fiscalYear])

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      let cmp = 0
      switch (sortCol) {
        case 'batch':
          cmp = cmpText(a.batch_no, b.batch_no)
          break
        case 'product':
          cmp = cmpText(a.product_name ?? a.product_code, b.product_name ?? b.product_code)
          break
        case 'lot':
          cmp = cmpText(a.invoice_number, b.invoice_number)
          break
        case 'material':
          cmp = cmpText(a.stock_entries?.material_type, b.stock_entries?.material_type)
          break
        case 'qty':
          cmp = Number(a.tons_used || 0) - Number(b.tons_used || 0)
          break
        case 'remaining':
          cmp = Number(a.plant_remaining ?? -1) - Number(b.plant_remaining ?? -1)
          break
        case 'chemist':
          cmp = cmpText(a.profiles?.full_name, b.profiles?.full_name)
          break
        case 'shift':
          cmp = cmpText(a.shift, b.shift)
          break
        case 'date':
        default:
          cmp = cmpText(a.usage_date, b.usage_date)
          break
      }
      return cmp * dir || cmpText(a.id, b.id)
    })
  }, [filtered, sortCol, sortDir])

  function handleSort(col: UsageSort) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir(col === 'date' || col === 'qty' || col === 'remaining' ? 'desc' : 'asc')
    }
  }

  return (
    <AppLayout>
      <div className="w-full p-4 md:p-8">
        <div className="mb-8 hidden lg:block">
        <PageHeader
          title="Plant Usage"
          subtitle="Owner · Lot consume into production batches (released-to-plant remaining)"
          accent="owner"
        />
        </div>

        <div className="md:hidden">
          <MobileTabs
            ariaLabel="Plant usage"
            active={tab}
            onChange={setTab}
            tabs={[
              { key: 'rm_sfg', label: 'RM used', sublabel: 'in SFG' },
              { key: 'rm_fg', label: 'RM used', sublabel: 'in FG' },
              { key: 'sfg', label: 'SFG used', sublabel: 'in FG' },
            ]}
          />
          {loading ? (
            <SpinnerBlock accent="owner" label="Loading plant usage" />
          ) : (
            <>
              <MobileListToolbar
                filter={filter}
                placeholder="Search batch, lot, material, or chemist…"
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateChange={(from, to) => {
                  setDateFrom(from)
                  setDateTo(to)
                }}
                resultCount={sorted.length}
                noun={{ one: 'usage', many: 'usages' }}
                sortOptions={[
                  { col: 'batch', label: 'Batch', kind: 'text' },
                  { col: 'product', label: 'Product', kind: 'text' },
                  { col: 'lot', label: 'Lot', kind: 'text' },
                  { col: 'material', label: 'Material', kind: 'text' },
                  { col: 'qty', label: 'Used', kind: 'number' },
                  { col: 'remaining', label: 'Remaining', kind: 'number' },
                  { col: 'chemist', label: 'Chemist', kind: 'text' },
                  { col: 'date', label: 'Date', kind: 'date' },
                ]}
                sortCol={sortCol}
                sortDir={sortDir}
                onSort={handleSort}
              />
              {sorted.length === 0 ? (
                <EmptyState className="rounded-xl bg-panel" title="No plant batch usage found" />
              ) : (
                <div className="space-y-3">
                  {sorted.map((e) => {
                    const remaining = e.plant_remaining
                    return (
                      <MobileCard
                        key={e.id}
                        id={e.invoice_number}
                        title={e.batch_no ?? '—'}
                        subtitle={e.product_name ?? e.product_code ?? '—'}
                        aside={
                          <>
                            <span className="block text-base font-medium tabular-nums text-owner">
                              {e.tons_used} KGS
                            </span>
                            <span className="block text-[10px] uppercase tracking-wider text-muted">Used</span>
                          </>
                        }
                        rows={[
                          { label: 'Material', value: e.stock_entries?.material_type ?? '—' },
                          { label: 'Chemist', value: e.profiles?.full_name ?? '—' },
                          {
                            label: 'Plant remaining',
                            value: remaining !== null ? `${Number(remaining).toFixed(3)} KGS` : '—',
                          },
                          { label: 'Shift', value: e.shift ? String(e.shift) : '—' },
                          { label: 'Date', value: new Date(e.usage_date).toLocaleDateString('en-IN') },
                        ]}
                      />
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className="hidden md:block">
        <LedgerKindTabs tab={tab} onChange={setTab} tabs={PLANT_USAGE_TABS}>
          <div>
            <div className="relative z-10 flex flex-wrap items-center gap-2 border-b border-border bg-panel px-4 py-3">
              <input
                className="input-field owner-focus w-full md:w-[320px]"
                placeholder="Search batch, lot, material, or chemist…"
                value={filter.search}
                onChange={(e) => filter.setSearch(e.target.value)}
              />
              <select
                className="input-field owner-focus w-full md:w-[170px]"
                value={fiscalYear}
                onChange={(e) => setFiscalYear(e.target.value)}
                disabled={Boolean(dateFrom || dateTo)}
                title={dateFrom || dateTo ? 'FY is skipped while a date range is set' : undefined}
              >
                {fiscalYears.map((fy) => (
                  <option key={fy} value={fy}>
                    {fy}
                  </option>
                ))}
              </select>
              <DateRangeChip
                from={dateFrom}
                to={dateTo}
                onChange={(from, to) => {
                  setDateFrom(from)
                  setDateTo(to)
                }}
              />
            </div>

            {loading ? (
              <SpinnerBlock accent="owner" label="Loading plant usage" />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <SortTh label="Batch" col="batch" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                        <SortTh label="Product" col="product" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                        <SortTh label="Lot" col="lot" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                        <SortTh label="Material" col="material" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                        <SortTh label="KGS used" col="qty" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                        <SortTh label="Plant remaining" col="remaining" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                        <SortTh label="Chemist" col="chemist" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                        <SortTh label="Shift" col="shift" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                        <SortTh label="Date" col="date" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((e) => {
                        const remaining = e.plant_remaining
                        return (
                          <tr key={e.id}>
                            <td className="font-mono text-xs text-primary">{e.batch_no ?? '—'}</td>
                            <td className="text-sm text-primary">
                              {e.product_name ?? e.product_code ?? '—'}
                            </td>
                            <td className="font-mono text-chemist text-xs">{e.invoice_number}</td>
                            <td className="text-muted">{e.stock_entries?.material_type ?? '—'}</td>
                            <td className="font-mono text-chemist">{e.tons_used} KGS</td>
                            <td
                              className={`font-mono ${
                                remaining !== null && Number(remaining) < 5
                                  ? 'text-red-400'
                                  : 'text-chemist'
                              }`}
                            >
                              {remaining !== null ? `${Number(remaining).toFixed(3)} KGS` : '—'}
                            </td>
                            <td className="text-primary">{e.profiles?.full_name ?? '—'}</td>
                            <td>
                              {e.shift ? (
                                <span className="badge badge-muted capitalize">{e.shift}</span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="text-muted text-xs">
                              {new Date(e.usage_date).toLocaleDateString('en-IN')}
                            </td>
                          </tr>
                        )
                      })}
                      {sorted.length === 0 && (
                        <tr>
                          <td colSpan={9} className="py-12 text-center text-muted">
                            No plant batch usage found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </LedgerKindTabs>
        </div>
      </div>
    </AppLayout>
  )
}
