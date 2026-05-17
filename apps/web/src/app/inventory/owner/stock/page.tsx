'use client'
import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@/components/ui/PageHeader'
import { inventoryApi } from '@/lib/client/inventory-api'
import { StockEntry } from '@/types'
import { Download } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useInventoryFactory } from '@/contexts/InventoryFactoryContext'
import { getCurrentFiscalYear, getFiscalYears, monthOptions } from '@/lib/monthlyMaterial'

export default function OwnerStockPage() {
  const { profile, loading: authLoading } = useAuth()
  const { factoryId: ctxFactoryId } = useInventoryFactory()
  const [entries, setEntries]     = useState<StockEntry[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [factories, setFactories] = useState<any[]>([])
  const [rateMin, setRateMin]     = useState('')
  const [rateMax, setRateMax]     = useState('')
  const [rateOpen, setRateOpen]   = useState(false)
  const [fiscalYear, setFiscalYear]         = useState(() => getCurrentFiscalYear())
  const [selectedMonth, setSelectedMonth]   = useState('')
  const [selectedDate, setSelectedDate]     = useState('')
  const fiscalYears = getFiscalYears(5)

  useEffect(() => {
    async function load() {
      if (authLoading) return
      const factoryIds = (profile?.factories ?? []).map((f: any) => f.id).filter(Boolean)
      if (factoryIds.length === 0) {
        setEntries([]); setFactories([]); setLoading(false); return
      }
      const data = await inventoryApi.getStockPage(factoryIds)
      setEntries((data.stock ?? []) as StockEntry[])
      setFactories(data.factories ?? [])
      setLoading(false)
    }
    load()
  }, [authLoading, profile])

  const filtered = entries.filter(e => {
    const matchSearch  = !search  || e.invoice_number.toLowerCase().includes(search.toLowerCase()) || e.supplier_name.toLowerCase().includes(search.toLowerCase())
    const matchFactory = !ctxFactoryId || e.factory_id === ctxFactoryId
    const rate = Number(e.rate_per_ton ?? 0)
    const matchRateMin = !rateMin || rate >= Number(rateMin)
    const matchRateMax = !rateMax || rate <= Number(rateMax)
    const entryDate = new Date(e.entry_date)
    const fyStart = Number(fiscalYear.replace('FY', '').split('-')[0])
    const matchFiscalYear = entryDate >= new Date(fyStart, 3, 1) && entryDate < new Date(fyStart + 1, 3, 1)
    const matchMonth = !selectedMonth || (entryDate.getMonth() + 1) === Number(selectedMonth)
    const matchDate = !selectedDate || e.entry_date === selectedDate
    return matchSearch && matchFactory && matchRateMin && matchRateMax && matchFiscalYear && matchMonth && matchDate
  })

  const totalValue = filtered.reduce((s,e) => s + Number(e.total_value), 0)

  const formatCsvValue = (value: any) => {
    if (value === null || value === undefined) return ''
    const str = String(value)
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
  }

  const handleExport = () => {
    if (loading) return
    if (filtered.length === 0) {
      alert('No records to export')
      return
    }
    const headers = [
      'Invoice',
      'Factory',
      'Supplier',
      'Material',
      'KGS_Loaded',
      'Rate_Per_Ton',
      'Total_Value',
      'Entry_Date',
      'Created_By',
    ]
    const rows = filtered.map(e => [
      e.invoice_number,
      (e as any).factories?.name ?? '',
      e.supplier_name,
      e.material_type,
      Number(e.tons_loaded ?? 0),
      Number(e.rate_per_ton ?? 0),
      Number(e.total_value ?? 0),
      new Date(e.entry_date).toISOString().slice(0, 10),
      (e as any).profiles?.full_name ?? '',
    ])
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
  const minVal = rateMin ? Number(rateMin) : 0
  const maxVal = rateMax ? Number(rateMax) : rateSliderMax

  return (
    <AppLayout>
      <div className="p-4 md:p-8">
        <PageHeader
          title="Stock Ledger"
          subtitle="Owner · All Loading Records"
          accent="owner"
          actions={
            <button className="btn btn-owner gap-2" onClick={handleExport} disabled={loading || filtered.length === 0}>
              <Download size={15}/> Export CSV
            </button>
          }
        />

        <div className="flex flex-wrap items-center gap-2 mb-6">
          <input className="input-field owner-focus w-full md:w-[320px]" placeholder="Search invoice or supplier..." value={search} onChange={e => setSearch(e.target.value)} />
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
          <div className="ml-auto flex items-center gap-2">
            <span className="font-mono text-xs text-muted">Total Value:</span>
            <span className="font-display text-lg font-bold text-owner">₹{(totalValue/100000).toFixed(2)}L</span>
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
                      <th>Invoice No.</th>
                      <th>Factory</th>
                      <th>Supplier</th>
                      <th>Material</th>
                      <th>KGS</th>
                      <th>Rate / KGs</th>
                      <th>Total Value</th>
                      <th>Date</th>
                      <th>By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(e => (
                      <tr key={e.id}>
                        <td className="font-mono text-inputer text-xs">{e.invoice_number}</td>
                        <td className="text-primary text-xs">{(e as any).factories?.name}</td>
                        <td className="text-primary">{e.supplier_name}</td>
                        <td className="text-muted">{e.material_type}</td>
                        <td className="font-mono text-inputer">{e.tons_loaded} KGS</td>
                        <td className="font-mono text-owner">₹{e.rate_per_ton}</td>
                        <td className="font-mono font-bold text-owner">₹{Number(e.total_value).toLocaleString('en-IN')}</td>
                        <td className="text-muted text-xs">{new Date(e.entry_date).toLocaleDateString('en-IN')}</td>
                        <td className="text-muted text-xs">{(e as any).profiles?.full_name}</td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={9} className="text-center text-muted py-12">No records found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden data-card-list p-4">
                {filtered.length === 0 && (
                  <div className="text-center text-muted py-6 border border-dashed border-[color-mix(in srgb, var(--color-border) 80%, transparent)] rounded-lg">
                    No records found
                  </div>
                )}
                {filtered.map(e => (
                  <div key={e.id} className="data-card">
                    <div className="data-card-header">
                      <span className="data-card-title text-inputer">{e.invoice_number}</span>
                      <span className="data-card-meta">{new Date(e.entry_date).toLocaleDateString('en-IN')}</span>
                    </div>
                    <div className="data-card-grid">
                      <span className="data-card-label">Factory</span>
                      <span className="data-card-value">{(e as any).factories?.name ?? '—'}</span>

                      <span className="data-card-label">Supplier</span>
                      <span className="data-card-value">{e.supplier_name}</span>

                      <span className="data-card-label">Material</span>
                      <span className="text-muted text-right">{e.material_type}</span>

                      <span className="data-card-label">KGS</span>
                      <span className="font-mono text-inputer text-right">{e.tons_loaded} KGS</span>

                      <span className="data-card-label">Rate / KGs</span>
                      <span className="font-mono text-owner text-right">₹{e.rate_per_ton}</span>

                      <span className="data-card-label">Total Value</span>
                      <span className="font-mono text-owner font-bold text-right">₹{Number(e.total_value).toLocaleString('en-IN')}</span>

                      <span className="data-card-label">By</span>
                      <span className="text-muted text-right">{(e as any).profiles?.full_name ?? '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
