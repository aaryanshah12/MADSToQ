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
import { cmpNum, cmpStr, nextSortDir } from '@/components/inventory/SortTh'
import { MobileCard, MobileListToolbar } from '@/components/inventory/MobileList'

type HistorySort = 'date' | 'qty' | 'material' | 'invoice'

export default function ChemistHistoryPage() {
  const { profile } = useAuth()
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortCol, setSortCol] = useState<HistorySort>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    const createdBy = profile?.id
    if (!createdBy) { setEntries([]); setLoading(false); return }
    async function load() {
      const { usage, stockMap } = await inventoryApi.getChemistHistory(createdBy!)
      setEntries(((usage ?? []) as { invoice_number: string }[]).map((u) => ({
        ...u,
        stock_entries: stockMap[u.invoice_number] ?? null,
      })))
      setLoading(false)
    }
    load()
  }, [profile])

  const filter = useSmartFilter(entries, {
    getSearchText: (e) => [
      e.invoice_number,
      e.stock_entries?.supplier_name,
      e.stock_entries?.material_type,
      e.factories?.name,
      e.process_id,
      e.shift,
    ],
    facets: [
      { key: 'supplier', label: 'Supplier', getValue: (e) => e.stock_entries?.supplier_name || '—' },
      { key: 'material', label: 'Material', getValue: (e) => e.stock_entries?.material_type || '—' },
      {
        key: 'shift',
        label: 'Shift',
        getValue: (e) => e.shift || '',
        options: [
          { id: 'morning', label: 'Morning' },
          { id: 'afternoon', label: 'Afternoon' },
          { id: 'night', label: 'Night' },
        ],
      },
    ],
  })

  const visible = useMemo(() => {
    const filtered = filter.filtered.filter((e) => inDateRange(e.usage_date, dateFrom, dateTo))
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      let cmp = 0
      switch (sortCol) {
        case 'qty':
          cmp = cmpNum(Number(a.tons_used), Number(b.tons_used))
          break
        case 'material':
          cmp = cmpStr(a.stock_entries?.material_type, b.stock_entries?.material_type)
          break
        case 'invoice':
          cmp = cmpStr(a.invoice_number, b.invoice_number)
          break
        case 'date':
        default:
          cmp = cmpStr(a.usage_date, b.usage_date)
          break
      }
      return cmp * dir || cmpStr(a.id, b.id)
    })
  }, [filter.filtered, dateFrom, dateTo, sortCol, sortDir])

  function handleSort(col: HistorySort) {
    const next = nextSortDir(col, sortCol, sortDir, ['qty', 'date'])
    setSortCol(next.col)
    setSortDir(next.dir)
  }

  const shiftColors: Record<string, string> = {
    morning:   'badge-inputer',
    afternoon: 'badge-owner',
    night:     'badge-muted',
  }

  return (
    <AppLayout>
      <div className="w-full p-4 md:p-8">
        <div className="mb-8 hidden lg:block">
        <PageHeader
          title="My Usage History"
          subtitle="Chemist · Raw material consumption"
          accent="chemist"
          actions={<Link href="/inventory/chemist/use" className="btn btn-chemist gap-2"><Plus size={15}/> Log Usage</Link>}
        />
        </div>

        <div className="md:hidden">
          {loading ? (
            <SpinnerBlock accent="chemist" label="Loading usage history" />
          ) : (
            <>
              <MobileListToolbar
                filter={filter}
                placeholder="Search invoice, supplier…"
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateChange={(from, to) => {
                  setDateFrom(from)
                  setDateTo(to)
                }}
                resultCount={visible.length}
                noun={{ one: 'entry', many: 'entries' }}
                sortOptions={[
                  { col: 'date', label: 'Date', kind: 'date' },
                  { col: 'qty', label: 'Qty', kind: 'number' },
                  { col: 'material', label: 'Material', kind: 'text' },
                  { col: 'invoice', label: 'Invoice', kind: 'text' },
                ]}
                sortCol={sortCol}
                sortDir={sortDir}
                onSort={handleSort}
              />
              {entries.length === 0 ? (
                <EmptyState
                  className="rounded-xl bg-panel"
                  title="No usage logged yet"
                  action={<Link href="/inventory/chemist/use" className="btn btn-chemist gap-2"><Plus size={15}/> Log Usage</Link>}
                />
              ) : visible.length === 0 ? (
                <EmptyState className="rounded-xl bg-panel" title="No records match" description="Try a different search or clear the filter chips." />
              ) : (
                <div className="space-y-3">
                  {visible.map((e) => (
                    <MobileCard
                      key={e.id}
                      id={e.invoice_number}
                      title={e.stock_entries?.supplier_name ?? '—'}
                      subtitle={e.stock_entries?.material_type}
                      aside={
                        <>
                          <span className="block text-base font-medium tabular-nums text-chemist">
                            {e.tons_used} KGS
                          </span>
                          <span className="block text-[10px] uppercase tracking-wider text-muted">
                            {e.usage_date ? new Date(e.usage_date).toLocaleDateString('en-IN') : '—'}
                          </span>
                        </>
                      }
                      rows={[
                        { label: 'Factory', value: e.factories?.name ?? '—' },
                        { label: 'Process ID', value: e.process_id ?? '—' },
                        {
                          label: 'Shift',
                          value: e.shift
                            ? <span className={`badge ${shiftColors[e.shift] ?? 'badge-muted'} capitalize`}>{e.shift}</span>
                            : '—',
                        },
                      ]}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="card hidden overflow-hidden md:block">
          {loading ? (
            <SpinnerBlock accent="chemist" label="Loading usage history" />
          ) : entries.length === 0 ? (
            <EmptyState
              title="No usage logged yet"
              action={<Link href="/inventory/chemist/use" className="btn btn-chemist gap-2"><Plus size={15}/> Log Usage</Link>}
            />
          ) : (
            <>
              <SmartFilterBar
                filter={filter}
                placeholder="Search invoice, supplier, material…"
                accent="chemist"
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
                <EmptyState title="No records match" description="Try a different search or clear the filter chips." />
              ) : (
              <div className="overflow-x-auto">
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
                  {visible.map(e => (
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
                </tbody>
              </table>
              </div>
              )}
            </>
          )}
        </div>
      </div>
      <Link
        href="/inventory/chemist/use"
        className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 inline-flex h-12 items-center gap-2 rounded-full bg-text px-5 text-sm font-medium text-panel shadow-lg lg:hidden"
      >
        <Plus size={18} />
        Log usage
      </Link>
    </AppLayout>
  )
}
