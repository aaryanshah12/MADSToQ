'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePMC, usePMCData } from '@/contexts/PMCContext'
import { pmcApi } from '@/lib/pmc/api'
import { seedPMCDemoIfEmpty } from '@/lib/pmc/seed'

export default function PMCDashboardPage() {
  const { refresh } = usePMC()
  const { tick } = usePMCData()
  const [seeding, setSeeding] = useState(false)
  void tick

  const stats = pmcApi.dashboardStats()

  async function loadDemo() {
    if (seeding) return
    setSeeding(true)
    try {
      if (await seedPMCDemoIfEmpty()) refresh()
      else alert('Data already exists.')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not load sample data.')
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="pmc-page">
      <div>
        <h1 className="pmc-page-title">Dashboard</h1>
        <p className="text-sm text-muted mt-1">Reference counts, products, and recent activity</p>
        {stats.referenceCount === 0 && (
          <button
            type="button"
            onClick={loadDemo}
            disabled={seeding}
            className="mt-3 text-xs text-pmc hover:underline disabled:opacity-50"
          >
            {seeding ? 'Loading sample…' : 'Load sample data from pricing sheet'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="References" value={stats.referenceCount} href="/pmc/references" />
        <StatCard label="Products" value={stats.productCount} href="/pmc/products" />
        <StatCard label="Raw materials" value={stats.rawMaterialCount} href="/pmc/master/raw-materials" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <section className="pmc-card">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="font-semibold text-primary">Recent references</h2>
            <Link href="/pmc/references" className="text-xs font-medium text-pmc hover:underline">
              View all
            </Link>
          </div>
          {stats.recentRefs.length === 0 ? (
            <p className="text-sm text-muted">No references yet. Create one under Reference Number.</p>
          ) : (
            <ul className="space-y-2">
              {stats.recentRefs.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap justify-between gap-2 text-sm border-b border-border pb-2 last:border-0"
                >
                  <span className="font-mono font-medium break-all">{r.ref_number}</span>
                  <span className="text-muted shrink-0">{new Date(r.created_at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="pmc-card">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="font-semibold text-primary">Products</h2>
            <Link href="/pmc/products" className="text-xs font-medium text-pmc hover:underline">
              View all
            </Link>
          </div>
          {stats.recentProducts.length === 0 ? (
            <p className="text-sm text-muted">Add products in Master.</p>
          ) : (
            <ul className="space-y-2">
              {stats.recentProducts.map((p) => (
                <li key={p.id}>
                  <Link href={`/pmc/products/${p.id}`} className="text-sm font-medium text-pmc hover:underline">
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
    <Link href={href} className="block pmc-card hover:border-pmc-40 transition-colors glow-border-pmc">
      <p className="text-xs text-muted uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold mt-2 text-pmc">{value}</p>
    </Link>
  )
}
