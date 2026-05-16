'use client'

import { useMemo, useState } from 'react'
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
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Reference Number</h1>
          <p className="text-sm text-muted mt-1">
            A new reference is created whenever you save updated raw-material prices.
          </p>
        </div>
        <button
          type="button"
          onClick={openForm}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: 'var(--color-pmc)' }}
        >
          New reference
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSave}
          className="bg-panel border border-border rounded-xl p-6 space-y-4"
        >
          <h2 className="font-semibold text-primary">Raw material price list</h2>
          <p className="text-xs text-muted">
            Next reference number will be assigned automatically on save.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="py-2 pr-4">Material</th>
                  <th className="py-2 pr-4">Unit</th>
                  <th className="py-2">Price</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => (
                  <tr key={m.id} className="border-b border-border/60">
                    <td className="py-2 pr-4 font-medium">{m.name}</td>
                    <td className="py-2 pr-4 text-muted">{m.unit}</td>
                    <td className="py-2">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        required
                        value={prices[m.id] ?? ''}
                        onChange={(e) =>
                          setPrices((p) => ({ ...p, [m.id]: e.target.value }))
                        }
                        className="w-28 px-2 py-1.5 rounded border border-border bg-layer"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Notes (optional)</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-layer text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: 'var(--color-pmc)' }}
            >
              {saving ? 'Saving…' : 'Save reference'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg text-sm border border-border"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <section className="bg-panel border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-layer border-b border-border text-left text-muted">
              <th className="px-4 py-3">Reference #</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Notes</th>
            </tr>
          </thead>
          <tbody>
            {references.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-muted">
                  No references yet.
                </td>
              </tr>
            ) : (
              references.map((r) => (
                <tr key={r.id} className="border-b border-border/60 hover:bg-layer-sm">
                  <td className="px-4 py-3 font-mono font-medium">{r.ref_number}</td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-muted">{r.notes || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
