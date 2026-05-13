'use client'
import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import clsx from 'clsx'

export default function ChemistHistoryPage() {
  const { profile } = useAuth()
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const createdBy = profile?.id
    if (!createdBy) { setEntries([]); setLoading(false); return }
    async function load() {
      const { data: usage } = await supabase.from('usage_entries')
        .select('*, factories(name)')
        .eq('created_by', createdBy)
        .order('created_at', { ascending: false })

      const list = usage ?? []
      const invNums = Array.from(new Set(list.map(u => u.invoice_number).filter(Boolean)))
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

      setEntries(list.map(u => ({
        ...u,
        stock_entries: stockMap[u.invoice_number] ?? null,
      })))
      setLoading(false)
    }
    load()
  }, [profile])

  const shiftColors: Record<string, string> = {
    morning:   'badge-inputer',
    afternoon: 'badge-owner',
    night:     'badge-muted',
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-8">
        <PageHeader
          title="My Usage History"
          subtitle="Chemist · Consumption Log"
          accent="chemist"
          actions={<Link href="/inventory/chemist/use" className="btn btn-chemist gap-2"><Plus size={15}/> Log Usage</Link>}
        />
        <div className="card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-chemist border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Supplier / Product</th>
                    <th>Invoice</th>
                    <th>Factory</th>
                    <th>KGS Used</th>
                    <th>Process ID</th>
                    <th>Shift</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(e => (
                    <tr key={e.id}>
                      <td>
                        <div className="text-chemist font-semibold text-sm">{e.stock_entries?.supplier_name ?? '—'}</div>
                        <div className="text-primary text-xs">{e.stock_entries?.material_type ?? '—'}</div>
                      </td>
                      <td className="font-mono text-chemist text-xs">{e.invoice_number}</td>
                      <td className="text-primary text-xs">{e.factories?.name}</td>
                      <td className="font-mono text-chemist font-bold">{e.tons_used} KGS</td>
                      <td className="text-muted text-xs">{e.process_id ?? '—'}</td>
                      <td>
                        {e.shift
                          ? <span className={`badge ${shiftColors[e.shift] ?? 'badge-muted'} capitalize`}>{e.shift}</span>
                          : <span className="text-muted">—</span>
                        }
                      </td>
                      <td className="text-muted text-xs">{new Date(e.usage_date).toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                  {entries.length === 0 && (
                    <tr><td colSpan={6} className="text-center text-muted py-12">
                      No usage logged yet. <Link href="/inventory/chemist/use" className="text-chemist">Log now →</Link>
                    </td></tr>
                  )}
                </tbody>
              </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden data-card-list p-4">
                {entries.length === 0 && (
                  <div className="text-center text-muted py-6 border border-dashed border-[color-mix(in srgb, var(--color-border) 80%, transparent)] rounded-lg">
                    No usage logged yet. <Link href="/inventory/chemist/use" className="text-chemist">Log now →</Link>
                  </div>
                )}
                {entries.map(e => (
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

                      <span className="data-card-label">KGS Used</span>
                      <span className="font-mono text-chemist text-right">{e.tons_used} KGS</span>

                      <span className="data-card-label">Process ID</span>
                      <span className="text-muted text-right">{e.process_id ?? '—'}</span>

                      <span className="data-card-label">Shift</span>
                      <span className="text-right">
                        {e.shift
                          ? <span className={`badge ${shiftColors[e.shift] ?? 'badge-muted'} capitalize`}>{e.shift}</span>
                          : <span className="text-muted">—</span>
                        }
                      </span>
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
