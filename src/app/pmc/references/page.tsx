'use client'

import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { usePMC, usePMCData } from '@/contexts/PMCContext'
import { pmcApi } from '@/lib/pmc/api'

export default function PMCReferencesPage() {
  const { refresh } = usePMC()
  const { tick } = usePMCData()
  const [showForm, setShowForm] = useState(false)
  const [notes, setNotes] = useState('')
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const materials = useMemo(() => {
    void tick
    return pmcApi.listRawMaterials()
  }, [tick])

  const references = useMemo(() => {
    void tick
    return pmcApi.listReferences()
  }, [tick])

  const latestPrices = useMemo(() => {
    const latest = pmcApi.getLatestReference()
    if (!latest) return new Map<string, number>()
    return pmcApi.getPricesForReference(latest.id)
  }, [tick])

  function openForm() {
    const initial: Record<string, string> = {}
    materials.forEach((m) => {
      const prev = latestPrices.get(m.id)
      initial[m.id] = prev !== undefined ? String(prev) : ''
    })
    setPrices(initial)
    setNotes('')
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (materials.length === 0) {
      alert('Add raw materials in Master first.')
      return
    }
    setSaving(true)
    const rows = materials.map((m) => ({
      raw_material_id: m.id,
      price: Number(prices[m.id]) || 0,
    }))
    pmcApi.createReference(rows, notes)
    setSaving(false)
    setShowForm(false)
    refresh()
  }

  return (
    <div className="pmc-page max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="pmc-page-title">Reference Number</h1>
          <p className="text-sm text-muted mt-1">
            A new reference is created whenever you save updated raw-material prices.
          </p>
        </div>
        <button type="button" onClick={openForm} className="btn btn-pmc shrink-0 w-full sm:w-auto justify-center">
          <Plus size={15} /> New reference
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="pmc-card space-y-4">
          <h2 className="font-semibold text-primary">Raw material price list</h2>
          <p className="text-xs text-muted">
            Next reference number will be assigned automatically on save.
          </p>
          <div className="pmc-table-wrap">
            <table className="data-table w-full text-sm">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Unit</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => (
                  <tr key={m.id}>
                    <td className="font-medium">{m.name}</td>
                    <td className="text-muted">{m.unit}</td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        required
                        value={prices[m.id] ?? ''}
                        onChange={(e) =>
                          setPrices((p) => ({ ...p, [m.id]: e.target.value }))
                        }
                        className="input w-full min-w-[5rem] max-w-[8rem] pmc-focus py-2"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-muted mb-2">
              Notes (optional)
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input w-full pmc-focus"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving} className="btn btn-pmc justify-center min-w-[8rem]">
              {saving ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                'Save reference'
              )}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-ghost">
              Cancel
            </button>
          </div>
        </form>
      )}

      <section className="pmc-card p-0 overflow-hidden">
        <div className="hidden md:block pmc-table-wrap mx-0 px-0">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Reference #</th>
                <th>Created</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {references.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center text-muted py-8">
                    No references yet.
                  </td>
                </tr>
              ) : (
                references.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono font-medium">{r.ref_number}</td>
                    <td className="text-muted">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="text-muted">{r.notes || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden data-card-list p-4">
          {references.length === 0 ? (
            <p className="text-sm text-muted text-center py-4">No references yet.</p>
          ) : (
            references.map((r) => (
              <article key={r.id} className="data-card">
                <div className="data-card-header">
                  <span className="data-card-title font-mono">{r.ref_number}</span>
                </div>
                <div className="data-card-grid">
                  <div>
                    <p className="data-card-label">Created</p>
                    <p className="data-card-value text-left mt-0.5">
                      {new Date(r.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="data-card-label">Notes</p>
                    <p className="data-card-value text-left mt-0.5">{r.notes || '—'}</p>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
