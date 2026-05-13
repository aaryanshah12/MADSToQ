'use client'
import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'
import { supabase } from '@/lib/supabase'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { BarChart3 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const COLORS = ['#00c2ff', '#00e5a0', '#f0a500', '#ff6060', '#a78bfa']

export default function OwnerReportsPage() {
  const { profile, loading: authLoading } = useAuth()
  const [factorySummary, setFactorySummary] = useState<any[]>([])
  const [monthlyData, setMonthlyData]       = useState<any[]>([])
  const [materialBreakdown, setMaterialBreakdown] = useState<any[]>([])
  const [loading, setLoading]               = useState(true)

  useEffect(() => {
    async function load() {
      if (authLoading) return
      const factoryIds = (profile?.factories ?? []).map((f: any) => f.id).filter(Boolean)
      if (factoryIds.length === 0) {
        setFactorySummary([]); setMonthlyData([]); setMaterialBreakdown([]); setLoading(false); return
      }
      const [fs, se, ue] = await Promise.all([
        supabase.from('factory_summary').select('*').in('factory_id', factoryIds),
        supabase.from('stock_entries').select('entry_date, tons_loaded, material_type, factory_id').in('factory_id', factoryIds),
        supabase.from('usage_entries').select('usage_date, tons_used, factory_id').in('factory_id', factoryIds),
      ])

      setFactorySummary(fs.data ?? [])

      // Monthly aggregation
      const monthMap: Record<string, { loaded: number; used: number }> = {}
      ;(se.data ?? []).forEach((e: any) => {
        const m = e.entry_date.slice(0, 7)
        if (!monthMap[m]) monthMap[m] = { loaded: 0, used: 0 }
        monthMap[m].loaded += Number(e.tons_loaded)
      })
      ;(ue.data ?? []).forEach((e: any) => {
        const m = e.usage_date.slice(0, 7)
        if (!monthMap[m]) monthMap[m] = { loaded: 0, used: 0 }
        monthMap[m].used += Number(e.tons_used)
      })
      setMonthlyData(Object.entries(monthMap).sort().slice(-6).map(([m, v]) => ({ month: m, ...v })))

      // Material breakdown
      const matMap: Record<string, number> = {}
      ;(se.data ?? []).forEach((e: any) => {
        matMap[e.material_type] = (matMap[e.material_type] ?? 0) + Number(e.tons_loaded)
      })
      setMaterialBreakdown(Object.entries(matMap).map(([name, value]) => ({ name, value: Number(value.toFixed(2)) })))

      setLoading(false)
    }
    load()
  }, [authLoading, profile])

  const totals = factorySummary.reduce((a, s) => ({
    value:   a.value   + Number(s.total_stock_value),
    loaded:  a.loaded  + Number(s.total_tons_loaded),
    used:    a.used    + Number(s.total_tons_used),
    balance: a.balance + Number(s.closing_balance),
  }), { value: 0, loaded: 0, used: 0, balance: 0 })

  return (
    <AppLayout>
      <div className="p-4 md:p-8">
        <PageHeader title="Reports & Analytics" subtitle="Owner · Consolidated View" accent="owner" />

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Stock Value"  value={`₹${(totals.value/100000).toFixed(1)}L`} color="owner"   />
          <StatCard label="Total KGS Loaded"  value={`${totals.loaded.toFixed(1)} KGS`}          color="inputer" />
          <StatCard label="Total KGS Used"    value={`${totals.used.toFixed(1)} KGS`}            color="chemist" />
          <StatCard label="Closing Balance"    value={`${totals.balance.toFixed(1)} KGS`}         color="muted"   />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          {/* Monthly trend */}
          <div className="card p-6">
            <div className="font-mono text-xs text-muted uppercase tracking-widest mb-4">Monthly Load vs Usage (KGS)</div>
            {loading ? (
              <div className="h-48 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-owner border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="gLoaded" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00c2ff" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#00c2ff" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gUsed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00e5a0" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#00e5a0" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fill: '#4a6080', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#4a6080', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#0f1520', border: '1px solid #1e2d45', borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="loaded" stroke="#00c2ff" fill="url(#gLoaded)" strokeWidth={2} name="Loaded" />
                  <Area type="monotone" dataKey="used"   stroke="#00e5a0" fill="url(#gUsed)"   strokeWidth={2} name="Used"   />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Material pie */}
          <div className="card p-6">
            <div className="font-mono text-xs text-muted uppercase tracking-widest mb-4">Material Breakdown</div>
            {loading ? (
              <div className="h-48 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-owner border-t-transparent rounded-full animate-spin" />
              </div>
            ) : materialBreakdown.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={materialBreakdown} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name">
                    {materialBreakdown.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0f1520', border: '1px solid #1e2d45', borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#4a6080' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Factory comparison table */}
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <div className="font-mono text-xs text-muted uppercase tracking-widest">Factory Performance Comparison</div>
          </div>
          <div className="overflow-x-auto hidden md:block">
            <table className="data-table">
              <thead>
                <tr><th>Factory</th><th>Invoices</th><th>Loaded (T)</th><th>Used (T)</th><th>Balance (T)</th><th>Stock Value</th><th>Utilization</th></tr>
              </thead>
              <tbody>
                {factorySummary.map(s => {
                  const utilization = s.total_tons_loaded > 0 ? ((s.total_tons_used / s.total_tons_loaded) * 100).toFixed(1) : 0
                  return (
                    <tr key={s.factory_id}>
                      <td className="text-primary font-medium">{s.factory_name}</td>
                      <td className="font-mono text-muted">{s.total_invoices}</td>
                      <td className="font-mono text-inputer">{Number(s.total_tons_loaded).toFixed(1)}</td>
                      <td className="font-mono text-chemist">{Number(s.total_tons_used).toFixed(1)}</td>
                      <td className="font-mono text-owner font-bold">{Number(s.closing_balance).toFixed(1)}</td>
                      <td className="font-mono text-owner">₹{(Number(s.total_stock_value)/100000).toFixed(2)}L</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-border rounded-full h-1.5">
                            <div className="bg-chemist h-1.5 rounded-full" style={{ width: `${utilization}%` }} />
                          </div>
                          <span className="font-mono text-xs text-muted">{utilization}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="md:hidden data-card-list p-4">
            {factorySummary.length === 0 && (
              <div className="text-center text-muted py-6 border border-dashed border-[color-mix(in srgb, var(--color-border) 80%, transparent)] rounded-lg">
                No data yet
              </div>
            )}
            {factorySummary.map(s => {
              const utilization = s.total_tons_loaded > 0 ? ((s.total_tons_used / s.total_tons_loaded) * 100).toFixed(1) : 0
              return (
                <div key={s.factory_id} className="data-card">
                  <div className="data-card-header">
                    <span className="data-card-title text-primary">{s.factory_name}</span>
                    <span className="data-card-meta">{s.total_invoices} invoices</span>
                  </div>
                  <div className="data-card-grid">
                    <span className="data-card-label">Loaded</span>
                    <span className="font-mono text-inputer text-right">{Number(s.total_tons_loaded).toFixed(1)} T</span>

                    <span className="data-card-label">Used</span>
                    <span className="font-mono text-chemist text-right">{Number(s.total_tons_used).toFixed(1)} T</span>

                    <span className="data-card-label">Balance</span>
                    <span className="font-mono text-owner text-right">{Number(s.closing_balance).toFixed(1)} T</span>

                    <span className="data-card-label">Stock Value</span>
                    <span className="font-mono text-owner text-right">₹{(Number(s.total_stock_value)/100000).toFixed(2)}L</span>

                    <span className="data-card-label">Utilization</span>
                    <span className="text-right text-muted">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-border rounded-full h-1.5">
                          <div className="bg-chemist h-1.5 rounded-full" style={{ width: `${utilization}%` }} />
                        </div>
                        <span className="font-mono text-[11px] text-muted">{utilization}%</span>
                      </div>
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
