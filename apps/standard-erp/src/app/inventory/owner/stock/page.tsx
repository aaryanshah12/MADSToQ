'use client'
import { useEffect, useMemo, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@madstoq/ui/erp-page-header'
import { inventoryApi } from '@/lib/client/inventory-api'
import { StockEntry } from '@/types'
import { Download } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/providers/ToastProvider'
import { EmptyState, ListPager, SmartFilterBar, SpinnerBlock, useSmartFilter } from '@/components/ui'
import { useInventoryFactory } from '@/contexts/InventoryFactoryContext'
import { getCurrentFiscalYear, getFiscalYears, monthOptions } from '@/lib/monthlyMaterial'
import { LedgerKindTabs } from '@/components/inventory/LedgerKindTabs'
import { DateRangeChip, inDateRange } from '@/components/inventory/DateRangeChip'
import { RateRangeChip } from '@/components/inventory/RateRangeChip'
import { ledgerTabOf, LEDGER_TABS, type LedgerTab } from '@/lib/ledger-kind'
import { SortTh } from '@/components/inventory/SortTh'
import { MobileCard, MobileListToolbar, MobileTabs } from '@/components/inventory/MobileList'
import { LIST_PAGE_SIZE } from '@/lib/list-page'

type SortCol = 'invoice' | 'supplier' | 'material' | 'qty' | 'rate' | 'value' | 'date' | 'bookedBy' | 'lot' | 'product' | 'chemist' | 'mfg' | 'purity'

function cmpText(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? '').localeCompare(b ?? '', undefined, { numeric: true, sensitivity: 'base' })
}

function fiscalYearOf(dateInput: string | Date) {
  const d = new Date(dateInput)
  const month = d.getMonth() + 1
  const year = d.getFullYear()
  const start = month >= 4 ? year : year - 1
  return `FY${start}-${String(start + 1).slice(-2)}`
}

export default function OwnerStockPage() {
  const { loading: authLoading } = useAuth()
  const toast = useToast()
  const { factoryId: ctxFactoryId } = useInventoryFactory()
  const [entries, setEntries]     = useState<StockEntry[]>([])
  const [stockTotal, setStockTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading]     = useState(true)
  const [factories, setFactories] = useState<any[]>([])
  const [rateMin, setRateMin]     = useState('')
  const [rateMax, setRateMax]     = useState('')
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')
  const [tab, setTab] = useState<LedgerTab>('rm')
  const [sortCol, setSortCol] = useState<SortCol>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const fiscalYears = getFiscalYears(5)

  const scoped = entries

  const filter = useSmartFilter(scoped, {
    getSearchText: (e) => [e.invoice_number, e.supplier_name, e.material_type, (e as any).chemist_name],
    facets: [
      { key: 'supplier', label: 'Supplier', getValue: (e) => e.supplier_name },
      { key: 'material', label: 'Material', getValue: (e) => e.material_type },
      {
        key: 'fy',
        label: 'FY',
        getValue: (e) => fiscalYearOf(e.entry_date),
        options: fiscalYears.map((fy) => ({ id: fy, label: fy })),
      },
      {
        key: 'month',
        label: 'Month',
        getValue: (e) => String(new Date(e.entry_date).getMonth() + 1),
        options: monthOptions.map((m) => ({ id: String(m.value), label: m.label })),
      },
    ],
    initialSelected: { fy: [getCurrentFiscalYear()] },
  })

  const fyStart = /^FY(\d{4})/.exec(filter.selected.fy?.[0] ?? '')?.[1]
  const month = filter.selected.month?.[0] ? Number(filter.selected.month[0]) : undefined

  useEffect(() => {
    setPage(1)
  }, [ctxFactoryId, fyStart, month, filter.search, dateFrom, dateTo])

  useEffect(() => {
    if (authLoading) return
    if (!ctxFactoryId) {
      setEntries([])
      setFactories([])
      setStockTotal(0)
      setLoading(false)
      return
    }
    let cancelled = false
    const handle = setTimeout(() => {
      void (async () => {
        setLoading(true)
        const data = await inventoryApi.getStockPage([ctxFactoryId], {
          page,
          page_size: LIST_PAGE_SIZE,
          fy_start: fyStart,
          month,
          q: filter.search.trim() || undefined,
          from: dateFrom || undefined,
          to: dateTo || undefined,
        })
        if (cancelled) return
        setEntries((data.stock ?? []) as StockEntry[])
        setFactories(data.factories ?? [])
        setStockTotal(Number(data.total ?? data.stock?.length ?? 0))
        setLoading(false)
      })()
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [authLoading, ctxFactoryId, fyStart, month, filter.search, dateFrom, dateTo, page])

  const filtered = useMemo(() => {
    return filter.filtered.filter((e) => {
      if (ledgerTabOf(e) !== tab) return false
      if (!inDateRange(e.entry_date, dateFrom, dateTo)) return false
      if (tab !== 'rm') return true
      const rate = Number(e.rate_per_ton ?? 0)
      const matchRateMin = !rateMin || rate >= Number(rateMin)
      const matchRateMax = !rateMax || rate <= Number(rateMax)
      return matchRateMin && matchRateMax
    })
  }, [filter.filtered, tab, rateMin, rateMax, dateFrom, dateTo])

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const ar = a as any
      const br = b as any
      let cmp = 0
      switch (sortCol) {
        case 'supplier':
          cmp = cmpText(a.supplier_name, b.supplier_name)
          break
        case 'material':
        case 'product':
          cmp = cmpText(a.material_type, b.material_type)
          break
        case 'qty':
          cmp = Number(a.tons_loaded ?? 0) - Number(b.tons_loaded ?? 0)
          break
        case 'rate':
          cmp = Number(a.rate_per_ton ?? 0) - Number(b.rate_per_ton ?? 0)
          break
        case 'value':
          cmp = Number(a.total_value ?? 0) - Number(b.total_value ?? 0)
          break
        case 'date':
          cmp = new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
          break
        case 'bookedBy':
          cmp = cmpText(ar.profiles?.full_name, br.profiles?.full_name)
          break
        case 'chemist':
          cmp = cmpText(ar.chemist_name, br.chemist_name)
          break
        case 'mfg':
          cmp =
            new Date(ar.mfg_date || a.entry_date).getTime() -
            new Date(br.mfg_date || b.entry_date).getTime()
          break
        case 'purity':
          cmp = Number(ar.purity ?? -1) - Number(br.purity ?? -1)
          break
        case 'invoice':
        case 'lot':
        default:
          cmp = cmpText(a.invoice_number, b.invoice_number)
          break
      }
      return cmp * dir || cmpText(a.invoice_number, b.invoice_number)
    })
  }, [filtered, sortCol, sortDir])

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortCol(col)
    setSortDir(
      col === 'qty' || col === 'rate' || col === 'value' || col === 'date' || col === 'mfg' || col === 'purity'
        ? 'desc'
        : 'asc',
    )
  }

  function handleTabChange(next: LedgerTab) {
    setTab(next)
    setSortCol(next === 'rm' ? 'date' : 'mfg')
    setSortDir('desc')
  }

  const totalValue = sorted.reduce((s,e) => s + Number(e.total_value), 0)

  const formatCsvValue = (value: any) => {
    if (value === null || value === undefined) return ''
    const str = String(value)
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
  }

  const handleExport = () => {
    if (loading) return
    if (sorted.length === 0) {
      toast.error('No records to export')
      return
    }
    const isRm = tab === 'rm'
    const showPurity = tab === 'sfg' || tab === 'sfg_rejected' || tab === 'fg' || tab === 'fg_rejected'
    const headers = isRm
      ? ['Invoice', 'Supplier', 'Material', 'Quantity_Kg', 'Rate_Per_Kg', 'Total_Value', 'Entry_Date', 'Booked_By']
      : showPurity
        ? ['Lot', 'Product', 'Chemist', 'Mfg_Date', 'Quantity_Kg', 'Purity']
        : ['Lot', 'Product', 'Chemist', 'Mfg_Date', 'Quantity_Kg']
    const rows = sorted.map(e => {
      const row = e as any
      if (isRm) {
        return [
          e.invoice_number,
          e.supplier_name,
          e.material_type,
          Number(e.tons_loaded ?? 0),
          Number(e.rate_per_ton ?? 0),
          Number(e.total_value ?? 0),
          new Date(e.entry_date).toISOString().slice(0, 10),
          row.profiles?.full_name ?? '',
        ]
      }
      const mfg = row.mfg_date || (e.entry_date ? new Date(e.entry_date).toISOString().slice(0, 10) : '')
      const base = [
        e.invoice_number,
        e.material_type,
        row.chemist_name ?? '',
        mfg,
        Number(e.tons_loaded ?? 0),
      ]
      return showPurity ? [...base, row.purity ?? ''] : base
    })
    const lines = [headers.join(','), ...rows.map(r => r.map(formatCsvValue).join(','))]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const factoryLabel = ctxFactoryId ? (factories.find(f => f.id === ctxFactoryId)?.name ?? ctxFactoryId) : 'all'
    link.download = `stock-ledger_${factoryLabel}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const rateSliderMax = entries.length > 0
    ? Math.max(1000, Math.ceil(Math.max(...entries.map(e => Number(e.rate_per_ton ?? 0))) / 500) * 500)
    : 5000

  return (
    <AppLayout>
      <div className="w-full p-4 md:p-8">
        <div className="mb-8 hidden lg:block">
        <PageHeader
          title="Stock Ledger"
          subtitle="Owner · RM, SFG, FG, and byproduct"
          accent="owner"
          actions={
            <button className="btn btn-owner gap-2" onClick={handleExport} disabled={loading || sorted.length === 0}>
              <Download size={15}/> Export CSV
            </button>
          }
        />
        </div>

        <div className="md:hidden">
          <MobileTabs
            ariaLabel="Stock kind"
            active={tab}
            onChange={handleTabChange}
            tabs={LEDGER_TABS.map((t) => ({
              key: t.key,
              label:
                t.key === 'rm'
                  ? 'RM'
                  : t.key === 'sfg'
                    ? 'SFG'
                    : t.key === 'sfg_rejected'
                      ? 'Rej SFG'
                      : t.key === 'fg'
                        ? 'FG'
                        : t.key === 'fg_rejected'
                          ? 'Rej FG'
                          : 'BP',
            }))}
          />
          {loading ? (
            <SpinnerBlock accent="owner" label="Loading stock ledger" />
          ) : (
            <>
              <MobileListToolbar
                filter={filter}
                placeholder={tab === 'rm' ? 'Search GRN, invoice, or supplier…' : 'Search lot, batch, or product…'}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateChange={(from, to) => {
                  setDateFrom(from)
                  setDateTo(to)
                }}
                resultCount={sorted.length}
                noun={{ one: 'lot', many: 'lots' }}
                sortOptions={
                  tab === 'rm'
                    ? [
                        { col: 'invoice' as const, label: 'Invoice / GRN', kind: 'text' as const },
                        { col: 'supplier' as const, label: 'Supplier', kind: 'text' as const },
                        { col: 'material' as const, label: 'Material', kind: 'text' as const },
                        { col: 'qty' as const, label: 'Qty', kind: 'number' as const },
                        { col: 'rate' as const, label: 'Rate', kind: 'number' as const },
                        { col: 'value' as const, label: 'Value', kind: 'number' as const },
                        { col: 'date' as const, label: 'Date', kind: 'date' as const },
                      ]
                    : [
                        { col: 'lot' as const, label: 'Lot', kind: 'text' as const },
                        { col: 'product' as const, label: 'Product', kind: 'text' as const },
                        { col: 'chemist' as const, label: 'Chemist', kind: 'text' as const },
                        { col: 'mfg' as const, label: 'Mfg date', kind: 'date' as const },
                        { col: 'qty' as const, label: 'Qty', kind: 'number' as const },
                        { col: 'purity' as const, label: 'Purity', kind: 'number' as const },
                      ]
                }
                sortCol={sortCol}
                sortDir={sortDir}
                onSort={handleSort}
              />
              {sorted.length === 0 ? (
                <EmptyState className="rounded-xl bg-panel" title="No records found" />
              ) : (
                <div className="space-y-3">
                  {sorted.map((e) => {
                    const row = e as any
                    const mfg = row.mfg_date || e.entry_date
                    return (
                      <MobileCard
                        key={e.id}
                        id={e.invoice_number}
                        title={tab === 'rm' ? e.supplier_name : e.material_type}
                        subtitle={tab === 'rm' ? e.material_type : (row.chemist_name ?? '—')}
                        aside={
                          <>
                            <span className="block text-base font-medium tabular-nums text-owner">
                              {e.tons_loaded}
                            </span>
                            <span className="block text-[10px] uppercase tracking-wider text-muted">Kg</span>
                          </>
                        }
                        rows={
                          tab === 'rm'
                            ? [
                                { label: 'Rate / Kg', value: `₹${e.rate_per_ton}` },
                                { label: 'Value', value: `₹${Number(e.total_value).toLocaleString('en-IN')}` },
                                { label: 'Date', value: new Date(e.entry_date).toLocaleDateString('en-IN') },
                                { label: 'Booked by', value: row.profiles?.full_name ?? '—' },
                              ]
                            : [
                                {
                                  label: 'Mfg date',
                                  value: mfg ? new Date(mfg).toLocaleDateString('en-IN') : '—',
                                },
                                ...(tab !== 'byproduct'
                                  ? [{ label: 'Purity', value: row.purity != null ? `${row.purity}%` : '—' }]
                                  : []),
                              ]
                        }
                      />
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className="hidden md:block">
        <LedgerKindTabs tab={tab} onChange={handleTabChange}>
        {!loading && entries.length > 0 && (
          <div className="border-b border-border">
            <SmartFilterBar
              filter={filter}
              placeholder={tab === 'rm' ? 'Search GRN, invoice, or supplier…' : 'Search lot, batch, or product…'}
              accent="owner"
              chipExtras={
                <>
                  <DateRangeChip
                    from={dateFrom}
                    to={dateTo}
                    onChange={(from, to) => {
                      setDateFrom(from)
                      setDateTo(to)
                    }}
                  />
                  {tab === 'rm' ? (
                    <RateRangeChip
                      min={rateMin}
                      max={rateMax}
                      sliderMax={rateSliderMax}
                      onMinChange={setRateMin}
                      onMaxChange={setRateMax}
                      onClear={() => { setRateMin(''); setRateMax('') }}
                    />
                  ) : null}
                </>
              }
              actions={
                tab === 'rm' ? (
                  <span className="hidden whitespace-nowrap font-mono text-xs text-muted sm:inline">
                    Total: <span className="font-display text-base font-bold text-owner">₹{(totalValue / 100000).toFixed(2)}L</span>
                  </span>
                ) : null
              }
            />
          </div>
        )}

        <div>
          {loading ? (
            <SpinnerBlock accent="owner" label="Loading stock ledger" />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      {tab === 'rm' ? (
                        <>
                          <SortTh label="Invoice / GRN" col="invoice" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                          <SortTh label="Supplier" col="supplier" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                          <SortTh label="Material" col="material" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                          <SortTh label="Quantity (Kg)" col="qty" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                          <SortTh label="Rate / Kg" col="rate" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                          <SortTh label="Total Value" col="value" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                          <SortTh label="Date" col="date" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                          <SortTh label="Booked by" col="bookedBy" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                        </>
                      ) : (
                        <>
                          <SortTh label="Lot" col="lot" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                          <SortTh label="Product" col="product" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                          <SortTh label="Chemist" col="chemist" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                          <SortTh label="Mfg date" col="mfg" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                          <SortTh label="Quantity (Kg)" col="qty" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                          {tab !== 'byproduct' && (
                            <SortTh label="Purity" col="purity" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="owner" />
                          )}
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(e => {
                      const row = e as any
                      const mfg = row.mfg_date || e.entry_date
                      return (
                      <tr key={e.id}>
                        <td className="font-mono text-inputer text-xs">{e.invoice_number}</td>
                        {tab === 'rm' ? (
                          <>
                            <td className="text-primary">{e.supplier_name}</td>
                            <td className="text-muted">{e.material_type}</td>
                            <td className="font-mono text-inputer">{e.tons_loaded}</td>
                            <td className="font-mono text-owner">₹{e.rate_per_ton}</td>
                            <td className="font-mono font-bold text-owner">₹{Number(e.total_value).toLocaleString('en-IN')}</td>
                            <td className="text-muted text-xs">{new Date(e.entry_date).toLocaleDateString('en-IN')}</td>
                            <td className="text-muted text-xs">{row.profiles?.full_name}</td>
                          </>
                        ) : (
                          <>
                            <td className="text-primary">{e.material_type}</td>
                            <td className="text-primary text-xs">{row.chemist_name ?? '—'}</td>
                            <td className="text-muted text-xs">
                              {mfg ? new Date(mfg).toLocaleDateString('en-IN') : '—'}
                            </td>
                            <td className="font-mono text-inputer">{e.tons_loaded}</td>
                            {tab !== 'byproduct' && (
                              <td className="font-mono text-muted">
                                {row.purity != null ? `${row.purity}%` : '—'}
                              </td>
                            )}
                          </>
                        )}
                      </tr>
                      )
                    })}
                    {sorted.length === 0 && (
                      <tr><td colSpan={9} className="text-center text-muted py-12">No records found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        {!loading && (
          <div className="mt-4 flex justify-center">
            <ListPager page={page} total={stockTotal} onPage={setPage} />
          </div>
        )}
        </LedgerKindTabs>
        </div>
      </div>
    </AppLayout>
  )
}
