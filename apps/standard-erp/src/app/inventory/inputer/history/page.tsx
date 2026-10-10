'use client'
import { useEffect, useMemo, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { EmptyState, SmartFilterBar, SpinnerBlock, useSmartFilter } from '@/components/ui'
import { DateRangeChip, inDateRange } from '@/components/inventory/DateRangeChip'
import PageHeader from '@madstoq/ui/erp-page-header'
import { inventoryApi } from '@/lib/client/inventory-api'
import { useAuth } from '@/hooks/useAuth'
import Link from 'next/link'
import { Plus } from 'lucide-react'

export default function InputerHistoryPage() {
  const { profile } = useAuth()
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    if (!profile) return
    inventoryApi.getInputerHistory(profile.id).then(({ entries }) => {
      setEntries(entries ?? [])
      setLoading(false)
    })
  }, [profile])

  const filter = useSmartFilter(entries, {
    getSearchText: (e) => [
      e.invoice_number,
      e.supplier_name,
      e.material_type,
      e.vehicle_number,
      e.factories?.name,
    ],
    facets: [
      { key: 'supplier', label: 'Supplier', getValue: (e) => e.supplier_name || '—' },
      { key: 'material', label: 'Material', getValue: (e) => e.material_type || '—' },
    ],
  })

  const visible = useMemo(
    () => filter.filtered.filter((e) => inDateRange(e.entry_date, dateFrom, dateTo)),
    [filter.filtered, dateFrom, dateTo],
  )

  return (
    <AppLayout>
      <div className="w-full p-4 md:p-8">
        <PageHeader
          title="My Stock Entries"
          subtitle="Inputer · Entry History"
          accent="inputer"
          actions={<Link href="/inventory/inputer/new" className="btn btn-inputer gap-2"><Plus size={15}/> New Entry</Link>}
        />
        <div className="card overflow-hidden">
          {loading ? (
            <SpinnerBlock accent="inputer" label="Loading entries" />
          ) : entries.length === 0 ? (
            <EmptyState
              title="No entries yet"
              description="Stock you log will appear here."
              action={<Link href="/inventory/inputer/new" className="btn btn-inputer gap-2"><Plus size={15}/> New Entry</Link>}
            />
          ) : (
            <>
              <SmartFilterBar
                filter={filter}
                placeholder="Search invoice, supplier, material…"
                accent="inputer"
                chipExtras={
                  <DateRangeChip
                    from={dateFrom}
                    to={dateTo}
                    onChange={(from, to) => {
                      setDateFrom(from)
                      setDateTo(to)
                    }}
                  />
                }
              />
              {visible.length === 0 ? (
                <EmptyState title="No entries match" description="Try a different search or clear the filter chips." />
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
                  {visible.map(e => (
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
                </tbody>
              </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3 p-4">
                {visible.map(e => (
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
            </>
          )}
        </div>
      </div>
    </AppLayout>
  )
}