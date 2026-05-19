'use client'
import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@madstoq/ui/page-header'
import { inventoryApi } from '@madstoq/inventory-system/api'
import { useAuth } from '@/hooks/useAuth'
import { useInventoryFactory } from '@/contexts/InventoryFactoryContext'
import { getCurrentFiscalYear, getFiscalYears, monthOptions } from '@/lib/monthlyMaterial'

export default function OwnerUsagePage() {
  const { profile, loading: authLoading } = useAuth()
  const { factoryId: ctxFactoryId } = useInventoryFactory()
  const [entries, setEntries]     = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [factories, setFactories] = useState<any[]>([])
  const [rateMin, setRateMin]     = useState('')
  const [rateMax, setRateMax]     = useState('')
  const [rateOpen, setRateOpen]   = useState(false)
  const [fiscalYear, setFiscalYear] = useState(() => getCurrentFiscalYear())
  const [selectedMonth, setSelectedMonth] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const fiscalYears = getFiscalYears(5)

  useEffect(() => {
    async function load() {
      if (authLoading) return
      const factoryIds = (profile?.factories ?? []).map((f: any) => f.id).filter(Boolean)
      if (factoryIds.length === 0) {
        setEntries([]); setFactories([]); setLoading(false); return
      }
      const page = await inventoryApi.getUsagePage(factoryIds)
      const entryList = page.usage ?? []
      const balMap = page.balMap ?? {}
      const stockMap = page.stockMap ?? {}
      setFactories(page.factories ?? [])

      // Compute remaining after each usage entry (per invoice)
      const grouped: Record<string, any[]> = {}
      entryList.forEach((entry: any) => {
        if (!grouped[entry.invoice_number]) grouped[entry.invoice_number] = []
        grouped[entry.invoice_number].push(entry)
      })

      const remainingById: Record<string, number | null> = {}
      Object.entries(grouped).forEach(([inv, list]) => {
        list.sort((a, b) => {
          const aDate = new Date(a.usage_date).getTime()
          const bDate = new Date(b.usage_date).getTime()
          if (aDate !== bDate) return aDate - bDate
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        })

        const totalLoaded =
          Number(stockMap[inv]?.tons_loaded) ||
          Number(balMap[inv]?.tons_loaded) ||
          (balMap[inv]?.tons_remaining !== undefined && balMap[inv]?.tons_remaining !== null
            ? Number(balMap[inv]?.tons_remaining) + list.reduce((s, x) => s + Number(x.tons_used || 0), 0)
            : 0)

        let remaining = totalLoaded
        list.forEach((entry: any) => {
          remaining -= Number(entry.tons_used || 0)
          remainingById[entry.id] = remaining
        })
      })

      setEntries(entryList.map((e: any) => ({
        ...e,
        stock_entries: stockMap[e.invoice_number] ?? null,
        kgs_remaining: remainingById[e.id] ?? balMap[e.invoice_number]?.tons_remaining ?? null,
      })))
      setLoading(false)
    }
    load()
  }, [])

  const filtered = entries.filter(e => {
    const matchSearch  = !search  || e.invoice_number?.toLowerCase().includes(search.toLowerCase()) || e.stock_entries?.supplier_name?.toLowerCase().includes(search.toLowerCase())
    const matchFactory = !ctxFactoryId || e.factory_id === ctxFactoryId
    const rate = Number(e.stock_entries?.rate_per_ton ?? 0)
    const matchRateMin = !rateMin || rate >= Number(rateMin)
    const matchRateMax = !rateMax || rate <= Number(rateMax)
    const usageDate = new Date(e.usage_date)
    const fyStart = Number(fiscalYear.replace('FY', '').split('-')[0])
    const matchFiscalYear = usageDate >= new Date(fyStart, 3, 1) && usageDate < new Date(fyStart + 1, 3, 1)
    const matchMonth = !selectedMonth || (usageDate.getMonth() + 1) === Number(selectedMonth)
    const matchDate = !selectedDate || (e.usage_date ? String(e.usage_date).slice(0, 10) === selectedDate : false)
    return matchSearch && matchFactory && matchRateMin && matchRateMax && matchFiscalYear && matchMonth && matchDate
  })

  const rateSliderMax = entries.length > 0
    ? Math.max(1000, Math.ceil(Math.max(...entries.map((e: any) => Number(e.stock_entries?.rate_per_ton ?? 0))) / 500) * 500)
    : 5000
  const minVal = rateMin ? Number(rateMin) : 0
  const maxVal = rateMax ? Number(rateMax) : rateSliderMax

  return (
    <AppLayout>
      <div className="p-4 md:p-8">
        <PageHeader title="Usage Log" subtitle="Owner · All Consumption Records" accent="owner" />

        <div className="flex flex-wrap items-center gap-2 mb-6">
          <input className="input-field owner-focus w-full md:w-[320px]" placeholder="Search invoice or supplier..." value={search} onChange={e=>setSearch(e.target.value)} />
          <select className="input-field owner-focus w-full md:w-[170px]" value={fiscalYear} onChange={e => setFiscalYear(e.target.value)}>
              {fiscalYears.map(fy => <option key={fy} value={fy}>{fy}</option>)}
          </select>
          <div className="relative w-full md:w-[170px] flex-shrink-0">
            <button
              type="button"
              onClick={() => setRateOpen(v => !v)}
              className={`input-field owner-focus w-full flex items-center justify-between gap-2 whitespace-nowrap cursor-pointer ${rateMin || rateMax ? 'border-owner' : ''}`}
            >
              <span className="text-xs font-mono text-muted">₹ Rate</span>
              {(rateMin || rateMax) && (
                <span className="text-xs font-mono text-owner">{rateMin || '0'} – {rateMax || '∞'}</span>
              )}
              <span className="text-muted text-[10px] ml-1">▾</span>
            </button>
            {rateOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setRateOpen(false)} />
                <div className="absolute top-full mt-1 left-0 z-20 card p-4 min-w-[300px] shadow-xl border border-border rounded-xl">
                  <div className="text-[10px] text-muted font-mono tracking-wider mb-3">Filter by Rate (₹)</div>
                  <div className="flex items-center gap-3">
                    <input
                      type="number" min={0} max={rateSliderMax}
                      value={minVal}
                      onChange={e => { const v = Number(e.target.value); setRateMin(v <= 0 ? '' : String(v)) }}
                      className="w-16 text-center text-xs font-mono bg-layer-sm border border-border rounded-md px-1 py-1.5 text-primary outline-none focus:border-owner transition-colors"
                    />
                    <div className="relative flex-1 h-5 flex items-center">
                      <div className="absolute w-full h-[3px] bg-border rounded-full" />
                      <div
                        className="absolute h-[3px] bg-owner rounded-full pointer-events-none"
                        style={{ left: `${(minVal / rateSliderMax) * 100}%`, right: `${100 - (maxVal / rateSliderMax) * 100}%` }}
                      />
                      <input
                        type="range" min={0} max={rateSliderMax} step={100}
                        value={minVal}
                        onChange={e => { const v = Number(e.target.value); if (v <= maxVal) setRateMin(v === 0 ? '' : String(v)) }}
                        className="absolute w-full h-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-owner [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-runnable-track]:bg-transparent"
                        style={{ zIndex: minVal >= rateSliderMax ? 5 : 3 }}
                      />
                      <input
                        type="range" min={0} max={rateSliderMax} step={100}
                        value={maxVal}
                        onChange={e => { const v = Number(e.target.value); if (v >= minVal) setRateMax(v >= rateSliderMax ? '' : String(v)) }}
                        className="absolute w-full h-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-owner [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-runnable-track]:bg-transparent"
                        style={{ zIndex: 4 }}
                      />
                    </div>
                    <input
                      type="number" min={0} max={rateSliderMax}
                      value={maxVal}
                      onChange={e => { const v = Number(e.target.value); setRateMax(!v || v >= rateSliderMax ? '' : String(v)) }}
                      className="w-16 text-center text-xs font-mono bg-layer-sm border border-border rounded-md px-1 py-1.5 text-primary outline-none focus:border-owner transition-colors"
                    />
                  </div>
                  {(rateMin || rateMax) && (
                    <button
                      type="button"
                      onClick={() => { setRateMin(''); setRateMax('') }}
                      className="mt-3 text-[10px] font-mono text-muted hover:text-red-400 transition-colors"
                    >
                      Clear filter
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="w-full md:w-auto md:flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
              <label className="flex flex-col gap-1">
                <span className="px-1 text-xs font-medium text-muted">Month</span>
                <select className="input-field owner-focus w-full" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                  <option value="">All Months</option>
                  {monthOptions.map(m => <option key={m.value} value={String(m.value)}>{m.label}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="px-1 text-xs font-medium text-muted">Date</span>
                <input
                  type="date"
                  className="input-field owner-focus w-full"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  aria-label="Filter by date"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-owner border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Supplier / Product</th>
                      <th>Invoice</th>
                      <th>Batch ID</th>
                      <th>Batch Month</th>
                      <th>Factory</th>
                      <th>Chemist</th>
                      <th>Material</th>
                      <th>KGS Used</th>
                      <th>Remaining KGS</th>
                      <th>Shift</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(e => {
                      const remaining = e.kgs_remaining
                      return (
                        <tr key={e.id}>
                          <td>
                            <div className="text-chemist font-semibold text-sm">{e.stock_entries?.supplier_name ?? '—'}</div>
                            <div className="text-primary text-xs">{e.stock_entries?.material_type ?? '—'}</div>
                          </td>
                          <td className="font-mono text-chemist text-xs">{e.invoice_number}</td>
                          <td className="text-xs text-primary">{e.batch_id ?? '—'}</td>
                          <td className="text-xs text-primary">{e.batch_month ?? '—'}</td>
                          <td className="text-primary text-xs">{e.factories?.name}</td>
                          <td className="text-primary">{e.profiles?.full_name}</td>
                          <td className="text-muted">{e.stock_entries?.material_type}</td>
                          <td className="font-mono text-chemist">{e.tons_used} KGS</td>
                          <td className={`font-mono ${remaining !== null && Number(remaining) < 5 ? 'text-red-400' : 'text-chemist'}`}>
                            {remaining !== null ? `${Number(remaining).toFixed(3)} KGS` : '—'}
                          </td>
                          <td>{e.shift ? <span className="badge badge-muted capitalize">{e.shift}</span> : '—'}</td>
                          <td className="text-muted text-xs">{new Date(e.usage_date).toLocaleDateString('en-IN')}</td>
                        </tr>
                      )
                    })}
                    {filtered.length === 0 && (
                      <tr><td colSpan={8} className="text-center text-muted py-12">No usage records found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden data-card-list p-4">
                {filtered.length === 0 && (
                  <div className="text-center text-muted py-6 border border-dashed border-[color-mix(in srgb, var(--color-border) 80%, transparent)] rounded-lg">
                    No usage records found
                  </div>
                )}
                {filtered.map(e => {
                  const remaining = e.kgs_remaining
                  return (
                    <div key={e.id} className="data-card">
                      <div className="data-card-header">
                        <div>
                          <div className="text-chemist font-semibold text-sm">{e.stock_entries?.supplier_name ?? '—'}</div>
                          <div className="text-primary text-xs">{e.stock_entries?.material_type ?? '—'}</div>
                          <div className="data-card-title font-mono text-[11px] text-muted">{e.invoice_number}</div>
                        </div>
                        <span className="data-card-meta">{new Date(e.usage_date).toLocaleDateString('en-IN')}</span>
                      </div>
                      <div className="data-card-grid">
                        <span className="data-card-label">Factory</span>
                        <span className="data-card-value">{e.factories?.name ?? '—'}</span>

                        <span className="data-card-label">Chemist</span>
                        <span className="data-card-value">{e.profiles?.full_name ?? '—'}</span>

                        <span className="data-card-label">Material</span>
                        <span className="text-muted text-right">{e.stock_entries?.material_type ?? '—'}</span>

                        <span className="data-card-label">Batch ID</span>
                        <span className="text-primary text-right">{e.batch_id ?? '—'}</span>

                        <span className="data-card-label">Batch Month</span>
                        <span className="text-primary text-right">{e.batch_month ?? '—'}</span>

                        <span className="data-card-label">Used</span>
                        <span className="font-mono text-chemist text-right">{e.tons_used} KGS</span>

                        <span className="data-card-label">Remaining</span>
                        <span className={`font-mono text-right ${remaining !== null && Number(remaining) < 5 ? 'text-red-400' : 'text-chemist'}`}>
                          {remaining !== null ? `${Number(remaining).toFixed(3)} KGS` : '—'}
                        </span>

                        <span className="data-card-label">Shift</span>
                        <span className="text-right">
                          {e.shift ? <span className="badge badge-muted capitalize">{e.shift}</span> : <span className="text-muted">—</span>}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
