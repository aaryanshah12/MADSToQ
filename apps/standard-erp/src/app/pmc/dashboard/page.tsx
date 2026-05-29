'use client'

import Link from 'next/link'
import { usePMCData } from '@/contexts/PMCContext'

export default function PMCDashboardPage() {
  const { api: pmcApi, tick } = usePMCData()
  void tick
  const stats = pmcApi.dashboardStats()

  return (
    <div className="pmc-page">
      <div>
        <h1 className="pmc-page-title">Dashboard</h1>
        <p className="text-sm text-muted mt-1">Overview of procurement, products, and batches</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Procurement items" value={stats.procurementCount} href="/pmc/procurement" />
        <StatCard label="Products" value={stats.productCount} href="/pmc/products" />
        <StatCard label="Batches" value={stats.batchCount} href="/pmc/batches" />
        <StatCard label="Active batches" value={stats.activeBatchCount} href="/pmc/batches" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <section className="pmc-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-primary">Recent batches</h2>
            <Link href="/pmc/batches" className="text-xs font-medium text-pmc hover:underline">View all</Link>
          </div>
          {stats.recentBatches.length === 0 ? (
            <p className="text-sm text-muted">No batches yet. Create one under Batches.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {stats.recentBatches.map((b) => {
                const p = pmcApi.getProduct(b.product_id)
                return (
                  <li key={b.id} className="flex justify-between border-b border-border pb-2 last:border-0">
                    <Link href={`/pmc/batches/${b.id}`} className="font-mono text-pmc hover:underline">{b.batch_code}</Link>
                    <span className="text-muted truncate max-w-[120px]">{p?.name ?? '—'}</span>
                    <span>₹{b.unit_price.toFixed(0)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="pmc-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-primary">Recent products</h2>
            <Link href="/pmc/products" className="text-xs font-medium text-pmc hover:underline">View all</Link>
          </div>
          {stats.recentProducts.length === 0 ? (
            <p className="text-sm text-muted">Add products under Products.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {stats.recentProducts.map((p) => (
                <li key={p.id} className="flex justify-between border-b border-border pb-2 last:border-0">
                  <Link href={`/pmc/products/${p.id}`} className="font-medium text-pmc hover:underline">{p.name}</Link>
                  <span className="font-mono text-muted">{p.code}</span>
                  <span>₹{p.unit_price.toFixed(0)}</span>
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
    <Link href={href} className="block pmc-card hover:border-pmc-40 transition-colors glow-border-pmc">
      <p className="text-xs text-muted uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold mt-2 text-pmc">{value}</p>
    </Link>
  )
}
