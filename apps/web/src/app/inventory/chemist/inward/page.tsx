'use client'

import { useEffect, useMemo, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@/components/ui/PageHeader'
import SimpleModal from '@/components/ui/SimpleModal'
import { useAuth } from '@/hooks/useAuth'
import { deleteInwardEntry, fetchInwardEntries, InwardEntry, saveInwardEntry, totalsForInward, toInwardCsv } from '@/lib/inward'
import { Download, Save, Trash2 } from 'lucide-react'
import { fetchInOutProducts, InOutProduct } from '@/lib/inoutProducts'
import { calendarYearForFy, currentFinancialYear, financialYearOptions, fyLabel, monthOptions, monthRangeISO } from '@/lib/monthFilter'

export default function ChemistInwardPage() {
  const { profile } = useAuth()
  const factories = useMemo(() => profile?.factories ?? [], [profile])
  const factoryIds = useMemo(() => factories.map((f: any) => f.id).filter(Boolean), [factories])
  const { fyStart: defaultFyStart, month: defaultMonth } = useMemo(() => currentFinancialYear(), [])
  const fyOptions = useMemo(() => financialYearOptions(6), [])

  const [entries, setEntries] = useState<InwardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [products, setProducts] = useState<InOutProduct[]>([])
  const [fyStart, setFyStart] = useState<number>(defaultFyStart)
  const [month, setMonth] = useState<number>(defaultMonth)
  const [form, setForm] = useState<InwardEntry>({
    factory_id: '',
    product_id: '',
    entry_date: new Date().toISOString().split('T')[0],
    tons: 0,
  })


  const productOptions = useMemo(
    () => products.filter(p => p.factory_id === form.factory_id && p.kind === 'inward' && p.is_active),
    [products, form.factory_id],
  )

  const load = async () => {
    if (!profile) return
    setLoading(true)
    const calYear = calendarYearForFy(fyStart, month)
    const range = monthRangeISO(calYear, month)
    const data = await fetchInwardEntries({ factoryIds, from: range.from, to: range.to })
    setEntries(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [profile, factoryIds.join(','), fyStart, month])

  useEffect(() => {
    if (!profile) return
    ;(async () => {
      try {
        const all = await fetchInOutProducts({ kind: 'inward', include_inactive: false })
        setProducts(all)
      } catch (e: any) {
        console.error(e)
        setProducts([])
      }
    })()
  }, [profile])

  useEffect(() => {
    if (factories.length > 0 && !form.factory_id) {
      setForm(f => ({ ...f, factory_id: factories[0].id }))
    }
  }, [factories])

  useEffect(() => {
    const firstProduct = productOptions[0] ?? ''
    const firstId = firstProduct?.id ?? ''
    setForm(f => ({ ...f, product_id: f.product_id && productOptions.some(p => p.id === f.product_id) ? f.product_id : firstId }))
  }, [form.factory_id, productOptions.map(p => p.id).join('|')])

  const parseNumber = (value: string) => value === '' ? 0 : Number(value)

  const hasFactory = Boolean(form.factory_id)
  const hasProduct = hasFactory && Boolean(form.product_id)
  const hasDate = hasProduct && Boolean(form.entry_date)
  const hasTons = hasDate && Number(form.tons) > 0

  const openModal = () => {
    const defaultFactoryId = factories[0]?.id ?? ''
    const firstProductId = products.find(p => p.factory_id === defaultFactoryId && p.kind === 'inward' && p.is_active)?.id ?? ''
    setForm({
      factory_id: defaultFactoryId,
      product_id: firstProductId,
      entry_date: new Date().toISOString().split('T')[0],
      tons: 0,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!profile) return
    if (!hasTons) {
      alert('Please complete all fields in order')
      return
    }
    setSaving(true)
    try {
      await saveInwardEntry({
        factory_id: form.factory_id,
        product_id: form.product_id,
        entry_date: form.entry_date ?? undefined,
        tons: Number(form.tons),
        created_by: profile.id,
      })
      setModalOpen(false)
      await load()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id?: string) => {
    if (!id) return
    if (!confirm('Delete this entry?')) return
    await deleteInwardEntry(id)
    await load()
  }

  const totals = totalsForInward(entries)
  const factoryNameById = useMemo(() => Object.fromEntries(factories.map((f: any) => [f.id, f.name])), [factories])

  const handleDownload = () => {
    const csv = toInwardCsv(entries, { includeTotals: true, factoryNameById })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const monthLabel = monthOptions.find(m => m.value === month)?.label ?? String(month)
    a.download = `Inward_FY${fyLabel(fyStart)}_${monthLabel}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-8">
        <PageHeader
          title="Inward"
          subtitle="Chemist · Log inward product quantities"
          accent="chemist"
          actions={
            <div className="flex items-center gap-2">
              <button className="btn btn-chemist-secondary gap-2" onClick={handleDownload} disabled={entries.length === 0}>
                <Download size={16} /> Download CSV
              </button>
              <button className="btn btn-chemist gap-2" onClick={openModal}>
                Add Entry <Save size={16} />
              </button>
            </div>
          }
        />

        <div className="card p-4 md:p-6 mb-4 grid gap-4 md:grid-cols-3 items-end">
          <div className="flex flex-col gap-2">
            <label className="text-xs text-muted font-mono">Financial Year</label>
            <select value={fyStart} onChange={e => setFyStart(Number(e.target.value))} className="input">
              {fyOptions.map(y => <option key={y} value={y}>{fyLabel(y)}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs text-muted font-mono">Month</label>
            <select value={month} onChange={e => setMonth(Number(e.target.value))} className="input">
              {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="text-xs text-muted">
            Showing entries for selected month
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="px-4 md:px-6 py-4 border-b border-border flex items-center justify-between">
            <div className="font-mono text-xs text-muted uppercase tracking-widest">Entries</div>
            {loading && <div className="w-4 h-4 border-2 border-chemist border-t-transparent rounded-full animate-spin" />}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="data-table min-w-full">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Factory</th>
                  <th>Product</th>
                  <th>TONS (in Kg)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="py-12">
                    <div className="flex justify-center">
                      <div className="w-6 h-6 border-2 border-chemist border-t-transparent rounded-full animate-spin" />
                    </div>
                  </td></tr>
                ) : (
                  <>
                    {entries.map(e => (
                      <tr key={e.id}>
                        <td className="font-mono text-xs text-muted">{e.entry_date ? new Date(e.entry_date).toLocaleDateString('en-IN') : '—'}</td>
                        <td className="text-primary text-xs">{factories.find((f: any) => f.id === e.factory_id)?.name ?? '—'}</td>
                        <td className="text-primary">{e.product_name ?? '—'}</td>
                        <td className="font-mono text-chemist">{Number(e.tons ?? 0).toFixed(3)}</td>
                        <td className="text-right">
                          <button className="text-xs text-red-400 hover:underline inline-flex items-center gap-1" onClick={() => handleDelete(e.id)}>
                            <Trash2 size={14} /> Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {entries.length === 0 && (
                      <tr><td colSpan={5} className="text-center text-muted py-8">No entries yet</td></tr>
                    )}
                  </>
                )}
              </tbody>
              {entries.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={3} className="text-right font-semibold">Total</td>
                    <td className="font-mono text-chemist">{totals.totalTons.toFixed(3)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="md:hidden p-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-chemist border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="data-card-list">
                {entries.map(e => (
                  <div key={e.id} className="data-card">
                    <div className="data-card-header">
                      <span className="data-card-title">{e.product_name ?? '—'}</span>
                      <span className="data-card-meta">{e.entry_date ? new Date(e.entry_date).toLocaleDateString('en-IN') : '—'}</span>
                    </div>
                    <div className="data-card-grid">
                      <span className="data-card-label">Factory</span>
                      <span className="data-card-value">{factories.find((f: any) => f.id === e.factory_id)?.name ?? '—'}</span>
                      <span className="data-card-label">TONS (in Kg)</span>
                      <span className="font-mono text-chemist text-right">{Number(e.tons ?? 0).toFixed(3)}</span>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <button className="text-xs text-red-400 inline-flex items-center gap-1" onClick={() => handleDelete(e.id)}>
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </div>
                ))}
                {entries.length === 0 && (
                  <div className="text-center text-muted py-8">No entries yet</div>
                )}
              </div>
            )}
            {!loading && entries.length > 0 && (
              <div className="data-card mt-3">
                <div className="data-card-header">
                  <span className="data-card-title">Total</span>
                  <span className="data-card-meta">All factories</span>
                </div>
                <div className="data-card-grid">
                  <span className="data-card-label">TONS (in Kg)</span>
                  <span className="data-card-value text-chemist font-mono text-right">{totals.totalTons.toFixed(3)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <SimpleModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Inward Entry"
        subtitle="Fields appear step-by-step"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted font-mono">Factory</label>
            <select className="input-field input-dark chemist-focus" value={form.factory_id} onChange={e => setForm(f => ({ ...f, factory_id: e.target.value }))}>
              {factories.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>

          {hasFactory && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted font-mono">Product</label>
              <select className="input-field input-dark chemist-focus" value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}>
                {productOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          {hasProduct && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted font-mono">Date</label>
              <input className="input-field input-dark chemist-focus" type="date" value={String(form.entry_date ?? '')} onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} />
            </div>
          )}

          {hasDate && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted font-mono">TONS (in Kg)</label>
              <input className="input-field input-dark chemist-focus" type="number" step="0.001" placeholder="0" value={form.tons || ''} onChange={e => setForm(f => ({ ...f, tons: parseNumber(e.target.value) }))} />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
          <button className="btn btn-chemist gap-2" onClick={handleSave} disabled={saving || !hasTons}>
            {saving ? 'Saving…' : 'Save Entry'} <Save size={16} />
          </button>
        </div>
      </SimpleModal>
    </AppLayout>
  )
}
