'use client'

import Link from 'next/link'
import { usePMC, usePMCData } from '@/contexts/PMCContext'
import { pmcApi } from '@/lib/pmc/api'
import { seedPMCDemoIfEmpty } from '@/lib/pmc/seed'

export default function PMCDashboardPage() {
  const { refresh } = usePMC()
  const { tick } = usePMCData()
  void tick

  const stats = pmcApi.dashboardStats()

  function loadDemo() {
    if (seedPMCDemoIfEmpty()) refresh()
    else alert('Data already exists.')
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-primary">Dashboard</h1>
        <p className="text-sm text-muted mt-1">Reference counts, products, and recent activity</p>
        {stats.referenceCount === 0 && (
          <button
            type="button"
            onClick={loadDemo}
            className="mt-3 text-xs underline"
            style={{ color: 'var(--color-pmc)' }}
          >
            Load sample data from pricing sheet
          </button>
        )}
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard label="References" value={stats.referenceCount} href="/pmc/references" />
        <StatCard label="Products" value={stats.productCount} href="/pmc/products" />
        <StatCard label="Raw materials" value={stats.rawMaterialCount} href="/pmc/master/raw-materials" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-panel border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-primary">Recent references</h2>
            <Link href="/pmc/references" className="text-xs font-medium" style={{ color: 'var(--color-pmc)' }}>
              View all
            </Link>
          </div>
          {stats.recentRefs.length === 0 ? (
            <p className="text-sm text-muted">No references yet. Create one under Reference Number.</p>
          ) : (
            <ul className="space-y-2">
              {stats.recentRefs.map((r) => (
                <li key={r.id} className="flex justify-between text-sm border-b border-border pb-2 last:border-0">
                  <span className="font-mono font-medium">{r.ref_number}</span>
                  <span className="text-muted">{new Date(r.created_at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-panel border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-primary">Products</h2>
            <Link href="/pmc/products" className="text-xs font-medium" style={{ color: 'var(--color-pmc)' }}>
              View all
            </Link>
          </div>
          {stats.recentProducts.length === 0 ? (
            <p className="text-sm text-muted">Add products in Master.</p>
          ) : (
            <ul className="space-y-2">
              {stats.recentProducts.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/pmc/products/${p.id}`}
                    className="text-sm font-medium hover:underline"
                    style={{ color: 'var(--color-pmc)' }}
                  >
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="block bg-panel border border-border rounded-xl p-5 hover:border-[var(--color-pmc)] transition-colors"
    >
      <p className="text-xs text-muted uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold mt-2" style={{ color: 'var(--color-pmc)' }}>
        {value}
      </p>
    </Link>
  )
}
