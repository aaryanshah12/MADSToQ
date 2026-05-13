'use client'
import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import StatCard from '@/components/ui/StatCard'
import PageHeader from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'
import { FactorySummary } from '@/types'
import DrilldownModal from '@/components/ui/DrilldownModal'
import { DrilldownRow, fetchLoadedDrilldown, fetchRemainingDrilldown } from '@/lib/drilldown'
import { Package, FlaskConical, Factory, TrendingUp, AlertTriangle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useAuth } from '@/hooks/useAuth'

export default function OwnerDashboard() {
  const { profile, loading: authLoading } = useAuth()
  const [summaries, setSummaries]   = useState<FactorySummary[]>([])
  const [recentStock, setRecentStock] = useState<any[]>([])
  const [recentUsage, setRecentUsage] = useState<any[]>([])
  const [loadedDrilldown, setLoadedDrilldown] = useState<DrilldownRow[]>([])
  const [remainingDrilldown, setRemainingDrilldown] = useState<DrilldownRow[]>([])
  const [drilldownRows, setDrilldownRows] = useState<DrilldownRow[]>([])
  const [drilldownTitle, setDrilldownTitle] = useState('')
  const [drilldownOpen, setDrilldownOpen] = useState(false)
  const [drilldownLoading, setDrilldownLoading] = useState(false)
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    async function load() {
      if (authLoading) return
      const factoryIds = (profile?.factories ?? []).map((f: any) => f.id).filter(Boolean)
      if (factoryIds.length === 0) {
        setSummaries([]); setRecentStock([]); setRecentUsage([]); setLoadedDrilldown([]); setRemainingDrilldown([]); setLoading(false)
        return
      }
      const [s, rs, ru, loadedRows, remainingRows] = await Promise.all([
        supabase.from('factory_summary').select('*').in('factory_id', factoryIds),
        supabase.from('stock_entries').select('*, factories(name)').in('factory_id', factoryIds).order('created_at', { ascending: false }).limit(5),
        supabase.from('usage_entries').select('*, factories(name), profiles(full_name)').in('factory_id', factoryIds).order('created_at', { ascending: false }).limit(5),
        fetchLoadedDrilldown({ factoryIds }),
        fetchRemainingDrilldown({ factoryIds }),
      ])
      setSummaries(s.data ?? [])
      setRecentStock(rs.data ?? [])
      setRecentUsage(ru.data ?? [])
      setLoadedDrilldown(loadedRows)
      setRemainingDrilldown(remainingRows)
      setLoading(false)
    }
    load()
  }, [authLoading, profile])

  const openDrilldown = (title: string, rows: DrilldownRow[]) => {
    setDrilldownTitle(title)
    setDrilldownRows(rows)
    setDrilldownOpen(true)
    setDrilldownLoading(false)
  }

  const totals = summaries.reduce((acc, s) => {
    const loaded = Number(s.total_tons_loaded)
    const balance = Number(s.closing_balance)
    const value = Number(s.total_stock_value)
    const remainingValue = loaded > 0 ? (balance / loaded) * value : 0
    return {
      loaded:         acc.loaded         + loaded,
      used:           acc.used           + Number(s.total_tons_used),
      balance:        acc.balance        + balance,
      value:          acc.value          + value,
      remainingValue: acc.remainingValue + remainingValue,
      invoices:       acc.invoices       + Number(s.total_invoices),
    }
  }, { loaded: 0, used: 0, balance: 0, value: 0, remainingValue: 0, invoices: 0 })

  const chartData = summaries.map(s => ({
    name: s.factory_name.replace('Factory ', ''),
    loaded:  Number(s.total_tons_loaded),
    used:    Number(s.total_tons_used),
    balance: Number(s.closing_balance),
  }))

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-owner border-t-transparent rounded-full animate-spin" />
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      <div className="p-4 md:p-8">
        <PageHeader
          title="Owner Dashboard"
          subtitle="All Factories · Live Overview"
          accent="owner"
          actions={
            <div className="badge badge-owner">
              <span className="w-1.5 h-1.5 rounded-full bg-owner animate-pulse" />
              Live Data
            </div>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 md:gap-4 mb-6 md:mb-8">
          <StatCard
            label="Total KGS Loaded"
            value={totals.loaded.toFixed(1)}
            sub="Across all factories"
            icon={<Package size={18}/>}
            color="inputer"
            onClick={() => openDrilldown('Loaded by Supplier · Product', loadedDrilldown)}
          />
          <StatCard label="Total KGS Used"    value={totals.used.toFixed(1)}    sub="All consumption"      icon={<FlaskConical size={18}/>}  color="chemist" />
          <StatCard
            label="Closing Balance"
            value={totals.balance.toFixed(1)}
            sub="Remaining stock (KGS)"
            icon={<TrendingUp size={18}/>}
            color="owner"
            onClick={() => openDrilldown('Remaining Stock by Supplier · Product', remainingDrilldown)}
            actionLabel="View breakdown"
          />
          <StatCard label="Total Stock Value"  value={`₹${(totals.value/100000).toFixed(1)}L`} sub={`${totals.invoices} invoices`} icon={<Factory size={18}/>} color="muted" />
          <StatCard label="Stock Remaining Value" value={`₹${(totals.remainingValue/100000).toFixed(1)}L`} sub="Est. value of balance stock" icon={<AlertTriangle size={18}/>} color="owner" />
        </div>

        {/* Chart + Factory table */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
          {/* Bar chart */}
          <div className="card p-4 md:p-6">
            <div className="font-mono text-xs text-muted uppercase tracking-widest mb-4">Factory-wise Stock Chart</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barGap={4}>
                <XAxis dataKey="name" tick={{ fill: '#4a6080', fontSize: 11, fontFamily: 'Share Tech Mono' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#4a6080', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#0f1520', border: '1px solid #1e2d45', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#c8d8ea' }}
                />
                <Bar dataKey="loaded"  name="Loaded"  radius={[4,4,0,0]} fill="#00c2ff" opacity={0.8} />
                <Bar dataKey="used"    name="Used"    radius={[4,4,0,0]} fill="#00e5a0" opacity={0.8} />
                <Bar dataKey="balance" name="Balance" radius={[4,4,0,0]} fill="#f0a500" opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2 justify-center">
              {[['#00c2ff','Loaded'],['#00e5a0','Used'],['#f0a500','Balance']].map(([c,l])=>(
                <div key={l} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{background:c}} />
                  <span className="font-mono text-[10px] text-muted">{l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Factory summary table */}
          <div className="card overflow-hidden">
            <div className="px-4 md:px-6 py-4 border-b border-border">
              <div className="font-mono text-xs text-muted uppercase tracking-widest">Factory Summary</div>
            </div>
            <div className="overflow-x-auto hidden md:block">
              <table className="data-table">
                <thead>
                  <tr><th>Factory</th><th>Loaded</th><th>Used</th><th>Balance</th></tr>
                </thead>
                <tbody>
                  {summaries.map(s => (
                    <tr key={s.factory_id}>
                      <td className="text-primary font-medium">{s.factory_name}</td>
                      <td className="text-inputer font-mono">{Number(s.total_tons_loaded).toFixed(1)} KGS</td>
                      <td className="text-chemist font-mono">{Number(s.total_tons_used).toFixed(1)} KGS</td>
                      <td>
                        <span className={`font-mono font-bold ${Number(s.closing_balance) < 10 ? 'text-red-400' : 'text-owner'}`}>
                          {Number(s.closing_balance).toFixed(1)} KGS
                        </span>
                        {Number(s.closing_balance) < 10 && (
                          <AlertTriangle size={12} className="inline ml-1 text-red-400" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden data-card-list p-4">
              {summaries.length === 0 && (
                <div className="text-center text-muted py-6 border border-dashed border-[color-mix(in srgb, var(--color-border) 80%, transparent)] rounded-lg">
                  No factories assigned
                </div>
              )}
              {summaries.map(s => (
                <div key={s.factory_id} className="data-card">
                  <div className="data-card-header">
                    <span className="data-card-title text-primary">{s.factory_name}</span>
                    <span className="data-card-meta">{s.total_invoices} invoices</span>
                  </div>
                  <div className="data-card-grid">
                    <span className="data-card-label">Loaded</span>
                    <span className="font-mono text-inputer text-right">{Number(s.total_tons_loaded).toFixed(1)} KGS</span>

                    <span className="data-card-label">Used</span>
                    <span className="font-mono text-chemist text-right">{Number(s.total_tons_used).toFixed(1)} KGS</span>

                    <span className="data-card-label">Balance</span>
                    <span className={`font-mono font-bold text-right ${Number(s.closing_balance) < 10 ? 'text-red-400' : 'text-owner'}`}>
                      {Number(s.closing_balance).toFixed(1)} KGS
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent activity */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
          <div className="card overflow-hidden">
            <div className="px-4 md:px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="font-mono text-xs text-muted uppercase tracking-widest">Recent Stock Entries</div>
              <span className="badge badge-inputer">Inputer</span>
            </div>
            <div className="overflow-x-auto hidden md:block">
              <table className="data-table">
                <thead><tr><th>Invoice</th><th>Supplier</th><th>KGS</th><th>Rate</th></tr></thead>
                <tbody>
                  {recentStock.map((s: any) => (
                    <tr key={s.id}>
                      <td className="font-mono text-inputer text-xs">{s.invoice_number}</td>
                      <td className="text-primary">{s.supplier_name}</td>
                      <td className="font-mono">{s.tons_loaded} KGS</td>
                      <td className="font-mono text-owner">₹{s.rate_per_ton}/T</td>
                    </tr>
                  ))}
                  {recentStock.length === 0 && (
                    <tr><td colSpan={4} className="text-center text-muted py-8">No entries yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="md:hidden data-card-list p-4">
              {recentStock.length === 0 && (
                <div className="text-center text-muted py-6 border border-dashed border-[color-mix(in srgb, var(--color-border) 80%, transparent)] rounded-lg">
                  No entries yet
                </div>
              )}
              {recentStock.map((s: any) => (
                <div key={s.id} className="data-card">
                  <div className="data-card-header">
                    <span className="data-card-title text-inputer">{s.invoice_number}</span>
                    <span className="data-card-meta">{s.supplier_name}</span>
                  </div>
                  <div className="data-card-grid">
                    <span className="data-card-label">KGS</span>
                    <span className="font-mono text-inputer text-right">{s.tons_loaded} KGS</span>

                    <span className="data-card-label">Rate</span>
                    <span className="font-mono text-owner text-right">₹{s.rate_per_ton}/T</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-4 md:px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="font-mono text-xs text-muted uppercase tracking-widest">Recent Usage Entries</div>
              <span className="badge badge-chemist">Chemist</span>
            </div>
            <div className="overflow-x-auto hidden md:block">
              <table className="data-table">
                <thead><tr><th>Invoice</th><th>By</th><th>Used</th><th>Date</th></tr></thead>
                <tbody>
                  {recentUsage.map((u: any) => (
                    <tr key={u.id}>
                      <td className="font-mono text-chemist text-xs">{u.invoice_number}</td>
                      <td className="text-primary">{u.profiles?.full_name ?? '—'}</td>
                      <td className="font-mono">{u.tons_used} KGS</td>
                      <td className="text-muted text-xs">{new Date(u.usage_date).toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                  {recentUsage.length === 0 && (
                    <tr><td colSpan={4} className="text-center text-muted py-8">No usage yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="md:hidden data-card-list p-4">
              {recentUsage.length === 0 && (
                <div className="text-center text-muted py-6 border border-dashed border-[color-mix(in srgb, var(--color-border) 80%, transparent)] rounded-lg">
                  No usage yet
                </div>
              )}
              {recentUsage.map((u: any) => (
                <div key={u.id} className="data-card">
                  <div className="data-card-header">
                    <span className="data-card-title text-chemist">{u.invoice_number}</span>
                    <span className="data-card-meta">{new Date(u.usage_date).toLocaleDateString('en-IN')}</span>
                  </div>
                  <div className="data-card-grid">
                    <span className="data-card-label">By</span>
                    <span className="data-card-value">{u.profiles?.full_name ?? '—'}</span>

                    <span className="data-card-label">Used</span>
                    <span className="font-mono text-chemist text-right">{u.tons_used} KGS</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <DrilldownModal
        open={drilldownOpen}
        title={drilldownTitle}
        subtitle="Supplier and product level details"
        rows={drilldownRows}
        loading={drilldownLoading}
        onClose={() => setDrilldownOpen(false)}
      />
    </AppLayout>
  )
}
