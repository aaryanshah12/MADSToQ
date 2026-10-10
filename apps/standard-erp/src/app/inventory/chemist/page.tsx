'use client'
import { useEffect, useMemo, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { EmptyState, SpinnerBlock } from '@/components/ui'
import StatCard from '@madstoq/ui/stat-card'
import PageHeader from '@madstoq/ui/erp-page-header'
import { inventoryApi } from '@/lib/client/inventory-api'
import { useAuth } from '@/hooks/useAuth'
import { useInventoryFactory } from '@/contexts/InventoryFactoryContext'
import DrilldownModal from '@madstoq/ui/drilldown-modal'
import { DrilldownRow, fetchLoadedDrilldown, fetchRemainingDrilldown } from '@/lib/drilldown'
import { FlaskConical, Package, AlertTriangle, TrendingUp, Send } from 'lucide-react'
import Link from 'next/link'
import { MobileCard } from '@/components/inventory/MobileList'

export default function ChemistDashboard() {
  const { profile } = useAuth()
  const { factoryId: ctxFactoryId } = useInventoryFactory()
  const factoryId = ctxFactoryId || profile?.factories?.[0]?.id || ''
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
    if (!profile?.id || !factoryId) {
      setBalance([])
      setRecentUsage([])
      setLoadedRows([])
      setDrilldownRows([])
      setTotalLoaded(0)
      setLoading(false)
      return
    }
    const factoryIds = [factoryId]
    async function load() {
      setLoading(true)
      const dash = await inventoryApi.getChemistDashboard(factoryIds, profile!.id)
      const usageList = dash.recentUsage ?? []
      const stockMap = dash.stockMap ?? {}

      setBalance(dash.balances ?? [])
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
    void load()
  }, [profile, factoryId])

  const available = useMemo(
    () => balance.filter((b) => Number(b.tons_remaining) > 0),
    [balance],
  )
  const totalAvailable = available.reduce((s, b) => s + Number(b.tons_remaining), 0)
  const lowStock = useMemo(() => {
    const byMaterial = new Map<string, number>()
    for (const b of balance) {
      const name = String(b.material_type || '').trim() || 'Unknown'
      byMaterial.set(name, (byMaterial.get(name) ?? 0) + Number(b.tons_remaining || 0))
    }
    return [...byMaterial.entries()]
      .map(([material, remaining]) => ({ material, remaining }))
      .filter((row) => row.remaining > 0 && row.remaining < 5)
      .sort((a, b) => a.remaining - b.remaining || a.material.localeCompare(b.material))
  }, [balance])

  const openDrilldown = (title: string, rows: DrilldownRow[]) => {
    setDrilldownTitle(title)
    setDrilldownRows(rows)
    setDrilldownOpen(true)
    setDrilldownLoading(false)
  }

  return (
    <AppLayout>
      <div className="w-full p-4 md:p-8">
        <div className="mb-4 hidden lg:block">
        <PageHeader
          title={`Hello, ${profile?.full_name?.split(' ')[0]}`}
          subtitle="Chemist · plant batches & stock usage"
          accent="chemist"
          actions={
            <Link href="/inventory/chemist/requests?new=1" className="btn btn-chemist gap-2">
              <Send size={16} /> Request material
            </Link>
          }
        />
        </div>

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
          <StatCard label="Low Stock Alerts" value={lowStock.length}                 icon={<AlertTriangle size={18}/>} color={lowStock.length > 0 ? 'owner' : 'muted'} sub="Materials under 5 KGS" />
        </div>

        {/* Low stock alert banner */}
        {lowStock.length > 0 && (
          <div role="alert" className="alert-warning mb-6 flex items-start gap-3 rounded-xl p-4">
            <span className="alert-warning-icon mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg" aria-hidden="true">
              <AlertTriangle size={18} />
            </span>
            <div>
              <div className="alert-warning-title mb-1 text-sm font-semibold">Low Stock Warning</div>
              <div className="alert-warning-body text-xs font-medium">
                {lowStock.map((row) => `${row.material}: ${row.remaining.toFixed(1)} KGS remaining`).join(' · ')}
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
              <SpinnerBlock accent="chemist" size="md" label="Loading recent usage" className="py-10" />
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr><th>Invoice No.</th><th>Factory</th><th>Material</th><th>Available</th></tr>
                    </thead>
                    <tbody>
                      {available.map(b => (
                        <tr key={`${b.invoice_number}-${b.material_type}`}>
                          <td className="font-mono text-primary text-xs">{b.invoice_number}</td>
                          <td className="text-primary text-xs">{b.factory_name}</td>
                          <td className="text-muted">{b.material_type}</td>
                          <td>
                            <span className={`font-mono font-bold ${Number(b.tons_remaining) < 5 ? 'badge badge-warning' : 'text-primary'}`}>
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

                <div className="md:hidden space-y-3 p-4">
                  {available.length === 0 && (
                    <EmptyState className="rounded-xl bg-panel" title="No stock available" />
                  )}
                  {available.map((b) => (
                    <MobileCard
                      key={`${b.invoice_number}-${b.material_type}`}
                      id={b.invoice_number}
                      title={b.material_type || '—'}
                      subtitle={b.factory_name}
                      aside={
                        <>
                          <span
                            className={`block text-base font-medium tabular-nums ${
                              Number(b.tons_remaining) < 5 ? 'text-amber-700' : 'text-primary'
                            }`}
                          >
                            {Number(b.tons_remaining).toFixed(3)}
                          </span>
                          <span className="block text-[10px] uppercase tracking-wider text-muted">KGS</span>
                        </>
                      }
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Recent usage */}
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="font-mono text-xs text-muted uppercase tracking-widest">My Recent Usage</div>
              <Link href="/inventory/chemist/history" className="text-xs text-primary hover:underline font-mono">View All →</Link>
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
                        <div className="text-primary font-semibold">{u.stock_entries?.supplier_name ?? '—'}</div>
                        <div className="text-muted text-xs">{u.stock_entries?.material_type ?? '—'}</div>
                      </td>
                      <td className="font-mono text-primary text-xs">{u.invoice_number}</td>
                      <td className="text-primary text-xs">{u.factories?.name}</td>
                      <td className="font-mono text-primary">{u.tons_used} KGS</td>
                      <td className="text-muted text-xs">{new Date(u.usage_date).toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                  {recentUsage.length === 0 && (
                    <tr><td colSpan={4} className="text-center text-muted py-8">
                      No usage logged yet. <Link href="/inventory/chemist/use" className="text-primary hover:underline">Log now →</Link>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="md:hidden space-y-3 p-4">
              {recentUsage.length === 0 && (
                <EmptyState
                  className="rounded-xl bg-panel"
                  title="No usage logged yet"
                  description="Log raw-material consumption from a production batch or the usage form."
                  action={
                    <Link href="/inventory/chemist/use" className="btn btn-chemist">
                      Log usage
                    </Link>
                  }
                />
              )}
              {recentUsage.map((u) => (
                <MobileCard
                  key={u.id}
                  id={u.invoice_number}
                  title={u.stock_entries?.supplier_name ?? '—'}
                  subtitle={u.stock_entries?.material_type}
                  aside={
                    <>
                      <span className="block text-base font-medium tabular-nums text-primary">
                        {u.tons_used} KGS
                      </span>
                      <span className="block text-[10px] uppercase tracking-wider text-muted">
                        {new Date(u.usage_date).toLocaleDateString('en-IN')}
                      </span>
                    </>
                  }
                  rows={[{ label: 'Factory', value: u.factories?.name ?? '—' }]}
                />
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
      <Link
        href="/inventory/chemist/requests?new=1"
        className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 inline-flex h-12 items-center gap-2 rounded-full bg-text px-5 text-sm font-medium text-panel shadow-lg lg:hidden"
      >
        <Send size={18} />
        Request
      </Link>
    </AppLayout>
  )
}
