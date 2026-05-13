'use client'
import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import StatCard from '@/components/ui/StatCard'
import PageHeader from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import DrilldownModal from '@/components/ui/DrilldownModal'
import { DrilldownRow, fetchLoadedDrilldown, fetchRemainingDrilldown } from '@/lib/drilldown'
import { FlaskConical, Package, AlertTriangle, TrendingUp } from 'lucide-react'
import Link from 'next/link'

export default function ChemistDashboard() {
  const { profile } = useAuth()
  const [balance, setBalance]         = useState<any[]>([])
  const [recentUsage, setRecentUsage] = useState<any[]>([])
  const [drilldownRows, setDrilldownRows] = useState<DrilldownRow[]>([])
  const [drilldownTitle, setDrilldownTitle] = useState('')
  const [loadedRows, setLoadedRows] = useState<DrilldownRow[]>([])
  const [drilldownOpen, setDrilldownOpen] = useState(false)
  const [drilldownLoading, setDrilldownLoading] = useState(false)
  const [totalLoaded, setTotalLoaded] = useState(0)
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    if (!profile?.factories) return
    const factoryIds = profile.factories.map((f: any) => f.id)
    async function load() {
      const [b, u] = await Promise.all([
        supabase.from('stock_balance').select('*').in('factory_id', factoryIds),
        supabase.from('usage_entries').select('*, factories(name)').eq('created_by', profile!.id).order('created_at', { ascending: false }).limit(6),
      ])

      const usageList = u.data ?? []
      const invNums = Array.from(new Set(usageList.map((x: any) => x.invoice_number).filter(Boolean)))
      let stockMap: Record<string, { supplier_name: string | null; material_type: string | null }> = {}
      if (invNums.length > 0) {
        const { data: stocks } = await supabase
          .from('stock_entries_safe')
          .select('invoice_number, supplier_name, material_type')
          .in('invoice_number', invNums)
        stockMap = Object.fromEntries(
          (stocks ?? []).map((s: any) => [s.invoice_number, { supplier_name: s.supplier_name, material_type: s.material_type }])
        )
      }

      setBalance(b.data ?? [])
      setRecentUsage(usageList.map((u: any) => ({
        ...u,
        stock_entries: stockMap[u.invoice_number] ?? null,
      })))
      const remainingRows = await fetchRemainingDrilldown({ factoryIds })
      const loadedBySupplier = await fetchLoadedDrilldown({ factoryIds })
      setLoadedRows(loadedBySupplier)
      setTotalLoaded(loadedBySupplier.reduce((s, r) => s + Number(r.quantity), 0))
      setDrilldownRows(remainingRows)
      setLoading(false)
    }
    load()
  }, [profile])

  const totalAvailable = balance.reduce((s, b) => s + Number(b.tons_remaining), 0)
  const lowStock       = balance.filter(b => Number(b.tons_remaining) < 5)

  const openDrilldown = (title: string, rows: DrilldownRow[]) => {
    setDrilldownTitle(title)
    setDrilldownRows(rows)
    setDrilldownOpen(true)
    setDrilldownLoading(false)
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-8">
        <PageHeader
          title={`Hello, ${profile?.full_name?.split(' ')[0]}`}
          subtitle="Chemist · Stock Usage Dashboard"
          accent="chemist"
          actions={<Link href="/inventory/chemist/use" className="btn btn-chemist gap-2"><FlaskConical size={16}/> Log Usage</Link>}
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
          <StatCard
            label="Total Available"
            value={`${totalAvailable.toFixed(1)} KGS`}
            icon={<Package size={18}/>}
            color="chemist"
            sub="Across your factories"
            onClick={() => openDrilldown('Remaining Stock by Supplier · Product', drilldownRows)}
            actionLabel="Drill down"
          />
          <StatCard
            label="Stock Loaded"
            value={`${totalLoaded.toFixed(1)} KGS`}
            icon={<TrendingUp size={18}/>}
            color="inputer"
            sub="Across your factories"
            onClick={() => openDrilldown('Loaded by Supplier · Product', loadedRows)}
            actionLabel="Drill down"
          />
          <StatCard label="Active Batches"   value={balance.length}                  icon={<FlaskConical size={18}/>}  color="inputer" sub="Invoices with stock"   />
          <StatCard label="Low Stock Alerts" value={lowStock.length}                 icon={<AlertTriangle size={18}/>} color={lowStock.length > 0 ? 'owner' : 'muted'} sub="< 5 KGS remaining" />
        </div>

        {/* Low stock alert banner */}
        {lowStock.length > 0 && (
          <div className="bg-owner/8 border border-owner/25 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertTriangle size={18} className="text-owner flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-owner mb-1">Low Stock Warning</div>
              <div className="text-xs text-muted">
                {lowStock.map(b => `${b.invoice_number}: ${Number(b.tons_remaining).toFixed(1)} KGS remaining`).join(' · ')}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
          {/* Available stock */}
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <div className="font-mono text-xs text-muted uppercase tracking-widest">Available Stock</div>
              <div className="text-[10px] text-muted mt-0.5">Rates are hidden — quantity only</div>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-5 h-5 border-2 border-chemist border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr><th>Invoice No.</th><th>Factory</th><th>Material</th><th>Available</th></tr>
                    </thead>
                    <tbody>
                      {balance.filter(b => Number(b.tons_remaining) > 0).map(b => (
                        <tr key={b.invoice_number}>
                          <td className="font-mono text-inputer text-xs">{b.invoice_number}</td>
                          <td className="text-primary text-xs">{b.factory_name}</td>
                          <td className="text-muted">{b.material_type}</td>
                          <td>
                            <span className={`font-mono font-bold ${Number(b.tons_remaining) < 5 ? 'text-owner' : 'text-chemist'}`}>
                              {Number(b.tons_remaining).toFixed(3)} KGS
                            </span>
                          </td>
                        </tr>
                      ))}
                      {balance.length === 0 && (
                        <tr><td colSpan={4} className="text-center text-muted py-8">No stock available</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden data-card-list p-4">
                  {balance.length === 0 && (
                    <div className="text-center text-muted py-6 border border-dashed border-[color-mix(in srgb, var(--color-border) 80%, transparent)] rounded-lg">
                      No stock available
                    </div>
                  )}
                  {balance.filter(b => Number(b.tons_remaining) > 0).map(b => (
                    <div key={b.invoice_number} className="data-card">
                      <div className="data-card-header">
                        <span className="data-card-title text-inputer">{b.invoice_number}</span>
                        <span className="data-card-meta">{b.factory_name}</span>
                      </div>
                      <div className="data-card-grid">
                        <span className="data-card-label">Material</span>
                        <span className="text-muted text-right">{b.material_type}</span>

                        <span className="data-card-label">Available</span>
                        <span className={`font-mono font-bold text-right ${Number(b.tons_remaining) < 5 ? 'text-owner' : 'text-chemist'}`}>
                          {Number(b.tons_remaining).toFixed(3)} KGS
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Recent usage */}
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="font-mono text-xs text-muted uppercase tracking-widest">My Recent Usage</div>
              <Link href="/inventory/chemist/history" className="text-xs text-chemist hover:underline font-mono">View All →</Link>
            </div>
            <div className="overflow-x-auto hidden md:block">
              <table className="data-table">
                <thead>
                  <tr><th>Supplier / Product</th><th>Invoice</th><th>Factory</th><th>Used</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {recentUsage.map(u => (
                    <tr key={u.id}>
                      <td className="text-sm">
                        <div className="text-chemist font-semibold">{u.stock_entries?.supplier_name ?? '—'}</div>
                        <div className="text-primary text-xs">{u.stock_entries?.material_type ?? '—'}</div>
                      </td>
                      <td className="font-mono text-chemist text-xs">{u.invoice_number}</td>
                      <td className="text-primary text-xs">{u.factories?.name}</td>
                      <td className="font-mono text-chemist">{u.tons_used} KGS</td>
                      <td className="text-muted text-xs">{new Date(u.usage_date).toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                  {recentUsage.length === 0 && (
                    <tr><td colSpan={4} className="text-center text-muted py-8">
                      No usage logged yet. <Link href="/inventory/chemist/use" className="text-chemist">Log now →</Link>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="md:hidden data-card-list p-4">
              {recentUsage.length === 0 && (
                <div className="text-center text-muted py-6 border border-dashed border-[color-mix(in srgb, var(--color-border) 80%, transparent)] rounded-lg">
                  No usage logged yet. <Link href="/inventory/chemist/use" className="text-chemist">Log now →</Link>
                </div>
              )}
              {recentUsage.map(u => (
                <div key={u.id} className="data-card">
                  <div className="data-card-header">
                    <div>
                      <div className="text-chemist font-semibold text-sm">{u.stock_entries?.supplier_name ?? '—'}</div>
                      <div className="text-primary text-xs">{u.stock_entries?.material_type ?? '—'}</div>
                      <div className="data-card-title font-mono text-[11px] text-muted">{u.invoice_number}</div>
                    </div>
                    <span className="data-card-meta">{new Date(u.usage_date).toLocaleDateString('en-IN')}</span>
                  </div>
                  <div className="data-card-grid">
                    <span className="data-card-label">Factory</span>
                    <span className="data-card-value">{u.factories?.name ?? '—'}</span>

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
