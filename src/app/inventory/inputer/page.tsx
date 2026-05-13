'use client'
import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import StatCard from '@/components/ui/StatCard'
import PageHeader from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import DrilldownModal from '@/components/ui/DrilldownModal'
import { DrilldownRow, fetchLoadedDrilldown } from '@/lib/drilldown'
import { Package, TrendingUp, Clock } from 'lucide-react'
import Link from 'next/link'

export default function InputerDashboard() {
  const { profile } = useAuth()
  const [recentEntries, setRecentEntries] = useState<any[]>([])
  const [stats, setStats] = useState({ total: 0, todayCount: 0, totalTons: 0 })
  const [drilldownRows, setDrilldownRows] = useState<DrilldownRow[]>([])
  const [drilldownOpen, setDrilldownOpen] = useState(false)
  const [drilldownLoading, setDrilldownLoading] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const userProfile = profile
      if (!userProfile) {
        setLoading(false)
        return
      }
      const today = new Date().toISOString().split('T')[0]
      const [all, recent] = await Promise.all([
        supabase.from('stock_entries').select('tons_loaded, entry_date').eq('created_by', userProfile.id),
        supabase.from('stock_entries').select('*, factories(name)').eq('created_by', userProfile.id)
          .order('created_at', { ascending: false }).limit(8),
      ])
      const entries = all.data ?? []
      setStats({
        total: entries.length,
        todayCount: entries.filter(e => e.entry_date === today).length,
        totalTons: entries.reduce((s, e) => s + Number(e.tons_loaded), 0),
      })
      setRecentEntries(recent.data ?? [])
      const entryFactoryIds = Array.from(new Set((recent.data ?? []).map((e: any) => e.factory_id).filter(Boolean)))
      const factoryIds = entryFactoryIds.length > 0
        ? entryFactoryIds
        : (userProfile.factories ?? []).map((f: any) => f.id).filter(Boolean)
      if (factoryIds.length > 0) {
        const rows = await fetchLoadedDrilldown({ factoryIds, createdBy: userProfile.id })
        setDrilldownRows(rows)
      } else {
        setDrilldownRows([])
      }
      setLoading(false)
    }
    load()
  }, [profile])

  const openDrilldown = () => {
    setDrilldownOpen(true)
    setDrilldownLoading(false)
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-8">
        <PageHeader
          title={`Welcome, ${profile?.full_name?.split(' ')[0]}`}
          subtitle="Inputer · Stock Entry Dashboard"
          accent="inputer"
          actions={<Link href="/inventory/inputer/new" className="btn btn-inputer gap-2"><Package size={16}/> New Entry</Link>}
        />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-8">
          <StatCard label="Total Entries"     value={stats.total}                      icon={<Package size={18}/>}    color="inputer" />
          <StatCard
            label="Total KGS Loaded"
            value={`${stats.totalTons.toFixed(1)} KGS`}
            icon={<TrendingUp size={18}/>}
            color="inputer"
            onClick={openDrilldown}
          />
          <StatCard label="Today's Entries"   value={stats.todayCount}                 icon={<Clock size={18}/>}      color="muted"   />
        </div>

        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div className="font-mono text-xs text-muted uppercase tracking-widest">Recent Stock Entries</div>
            <Link href="/inventory/inputer/history" className="text-xs text-inputer hover:underline font-mono">View All →</Link>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-inputer border-t-transparent rounded-full animate-spin" />
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
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentEntries.map(e => (
                      <tr key={e.id}>
                        <td className="font-mono text-inputer text-xs">{e.invoice_number}</td>
                        <td className="text-primary text-xs">{e.factories?.name}</td>
                        <td className="text-primary">{e.supplier_name}</td>
                        <td className="text-muted">{e.material_type}</td>
                        <td className="font-mono text-inputer">{e.tons_loaded} KGS</td>
                        <td className="text-muted text-xs">{new Date(e.entry_date).toLocaleDateString('en-IN')}</td>
                      </tr>
                    ))}
                    {recentEntries.length === 0 && (
                      <tr><td colSpan={6} className="text-center text-muted py-10">
                        No entries yet. <Link href="/inventory/inputer/new" className="text-inputer">Create your first →</Link>
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden data-card-list p-4">
                {recentEntries.length === 0 && (
                  <div className="text-center text-muted py-6 border border-dashed border-[color-mix(in srgb, var(--color-border) 80%, transparent)] rounded-lg">
                    No entries yet. <Link href="/inventory/inputer/new" className="text-inputer">Create your first →</Link>
                  </div>
                )}
                {recentEntries.map(e => (
                  <div key={e.id} className="data-card">
                    <div className="data-card-header">
                      <span className="data-card-title text-inputer">{e.invoice_number}</span>
                      <span className="data-card-meta">{new Date(e.entry_date).toLocaleDateString('en-IN')}</span>
                    </div>
                    <div className="data-card-grid">
                      <span className="data-card-label">Factory</span>
                      <span className="data-card-value">{e.factories?.name ?? '—'}</span>

                      <span className="data-card-label">Supplier</span>
                      <span className="data-card-value">{e.supplier_name}</span>

                      <span className="data-card-label">Material</span>
                      <span className="text-muted text-right">{e.material_type}</span>

                      <span className="data-card-label">KGS</span>
                      <span className="font-mono text-inputer text-right">{e.tons_loaded} KGS</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <DrilldownModal
          open={drilldownOpen}
          title="Loaded by Supplier · Product"
          subtitle="Based on your stock entries"
          rows={drilldownRows}
          loading={drilldownLoading}
          onClose={() => setDrilldownOpen(false)}
        />
      </div>
    </AppLayout>
  )
}