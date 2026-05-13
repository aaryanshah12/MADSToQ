'use client'
import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import Link from 'next/link'
import { Plus } from 'lucide-react'

export default function InputerHistoryPage() {
  const { profile } = useAuth()
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    supabase.from('stock_entries')
      .select('*, factories(name)')
      .eq('created_by', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setEntries(data ?? []); setLoading(false) })
  }, [profile])

  return (
    <AppLayout>
      <div className="p-4 md:p-8">
        <PageHeader
          title="My Stock Entries"
          subtitle="Inputer · Entry History"
          accent="inputer"
          actions={<Link href="/inventory/inputer/new" className="btn btn-inputer gap-2"><Plus size={15}/> New Entry</Link>}
        />
        <div className="card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-inputer border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice No.</th>
                    <th>Factory</th>
                    <th>Supplier</th>
                    <th>Material</th>
                    <th>KGS</th>
                    <th>Vehicle</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(e => (
                    <tr key={e.id}>
                      <td className="font-mono text-inputer text-xs">{e.invoice_number}</td>
                      <td className="text-primary text-xs">{e.factories?.name}</td>
                      <td className="text-primary">{e.supplier_name}</td>
                      <td className="text-muted">{e.material_type}</td>
                      <td className="font-mono text-inputer">{e.tons_loaded} KGS</td>
                      <td className="text-muted text-xs">{e.vehicle_number ?? '—'}</td>
                      <td className="text-muted text-xs">{new Date(e.entry_date).toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                  {entries.length === 0 && (
                    <tr><td colSpan={7} className="text-center text-muted py-12">
                      No entries yet. <Link href="/inventory/inputer/new" className="text-inputer">Create one →</Link>
                    </td></tr>
                  )}
                </tbody>
              </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3 p-4">
                {entries.length === 0 && (
                  <div className="text-center text-muted py-6 border border-dashed border-[color-mix(in srgb, var(--color-border) 80%, transparent)] rounded-lg">
                    No entries yet. <Link href="/inventory/inputer/new" className="text-inputer">Create one →</Link>
                  </div>
                )}
                {entries.map(e => (
                  <div
                    key={e.id}
                    className="rounded-lg border border-[color-mix(in srgb, var(--color-border) 70%, transparent)] bg-layer-sm px-4 py-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-inputer text-sm">{e.invoice_number}</span>
                      <span className="text-muted text-[11px]">
                        {new Date(e.entry_date).toLocaleDateString('en-IN')}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      <span className="text-muted uppercase tracking-[0.08em]">Factory</span>
                      <span className="text-primary text-right">{e.factories?.name ?? '—'}</span>

                      <span className="text-muted uppercase tracking-[0.08em]">Supplier</span>
                      <span className="text-primary text-right">{e.supplier_name}</span>

                      <span className="text-muted uppercase tracking-[0.08em]">Material</span>
                      <span className="text-muted text-right">{e.material_type}</span>

                      <span className="text-muted uppercase tracking-[0.08em]">KGS</span>
                      <span className="font-mono text-inputer text-right">{e.tons_loaded} KGS</span>

                      <span className="text-muted uppercase tracking-[0.08em]">Vehicle</span>
                      <span className="text-muted text-right">{e.vehicle_number ?? '—'}</span>
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