'use client'

import { useMemo, useState } from 'react'
import { Plus, Eye } from 'lucide-react'
import clsx from 'clsx'
import { formatINR } from '@/lib/pmc/pricing'
import { usePMC, usePMCData } from '@/contexts/PMCContext'
import { pmcApi } from '@/lib/pmc/api'

export default function PMCReferencesPage() {
  const { refresh } = usePMC()
  const { tick } = usePMCData()
  const [showForm, setShowForm] = useState(false)
  const [notes, setNotes] = useState('')
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [viewRefId, setViewRefId] = useState<string | null>(null)

  const materials = useMemo(() => {
    void tick
    return pmcApi.listRawMaterials()
  }, [tick])

  const references = useMemo(() => {
    void tick
    return pmcApi.listReferences()
  }, [tick])

  const latestRefId = useMemo(() => {
    void tick
    return pmcApi.getLatestReference()?.id ?? null
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
            A new reference is created whenever you save updated raw-material prices. Numbers are
            sequential (REF-001, REF-002, …).
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
                <th className="w-16 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {references.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-muted py-8">
                    No references yet.
                  </td>
                </tr>
              ) : (
                references.map((r) => {
                  const detail = viewRefId === r.id ? pmcApi.getReferenceDetail(r.id) : null
                  return (
                    <ReferenceRow
                      key={r.id}
                      refNumber={r.ref_number}
                      createdAt={r.created_at}
                      notes={r.notes}
                      isLatest={r.id === latestRefId}
                      open={viewRefId === r.id}
                      detail={detail}
                      onToggleView={() => setViewRefId(viewRefId === r.id ? null : r.id)}
                    />
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden data-card-list p-4">
          {references.length === 0 ? (
            <p className="text-sm text-muted text-center py-4">No references yet.</p>
          ) : (
            references.map((r) => {
              const open = viewRefId === r.id
              const detail = open ? pmcApi.getReferenceDetail(r.id) : null
              return (
                <article key={r.id} className="data-card">
                  <div className="data-card-header">
                    <span className="data-card-title font-mono flex flex-wrap items-center gap-2">
                      {r.ref_number}
                      {r.id === latestRefId && (
                        <span className="badge badge-pmc text-[10px] uppercase tracking-wide">
                          Latest
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => setViewRefId(open ? null : r.id)}
                      className={clsx(
                        'inline-flex items-center justify-center min-h-[36px] min-w-[36px] rounded-lg border border-border hover:bg-layer-sm transition-colors text-muted hover:text-pmc shrink-0',
                        open && 'bg-pmc-10 text-pmc border-pmc-30'
                      )}
                      aria-label={`View prices for ${r.ref_number}`}
                      title="View price list"
                    >
                      <Eye size={16} />
                    </button>
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
                  {open && detail && (
                    <ReferencePriceList detail={detail} className="mt-3 pt-3 border-t border-border" />
                  )}
                </article>
              )
            })
          )}
        </div>
      </section>
    </div>
  )
}

function ReferenceRow({
  refNumber,
  createdAt,
  notes,
  isLatest,
  open,
  detail,
  onToggleView,
}: {
  refNumber: string
  createdAt: string
  notes: string | null
  isLatest?: boolean
  open: boolean
  detail: ReturnType<typeof pmcApi.getReferenceDetail> | null
  onToggleView: () => void
}) {
  return (
    <>
      <tr className={open ? 'bg-layer-sm' : undefined}>
        <td className="font-mono font-medium">
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>{refNumber}</span>
            {isLatest && (
              <span className="badge badge-pmc text-[10px] uppercase tracking-wide font-sans">
                Latest
              </span>
            )}
          </span>
        </td>
        <td className="text-muted">{new Date(createdAt).toLocaleString()}</td>
        <td className="text-muted">{notes || '—'}</td>
        <td className="text-right">
          <button
            type="button"
            onClick={onToggleView}
            className={clsx(
              'inline-flex items-center justify-center min-h-[36px] min-w-[36px] rounded-lg border border-border hover:bg-layer-sm transition-colors text-muted hover:text-pmc',
              open && 'bg-pmc-10 text-pmc border-pmc-30'
            )}
            aria-label={`View prices for ${refNumber}`}
            title="View price list"
          >
            <Eye size={16} />
          </button>
        </td>
      </tr>
      {open && detail && (
        <tr>
          <td colSpan={4} className="p-0 bg-layer-sm/50">
            <ReferencePriceList detail={detail} className="p-4" />
          </td>
        </tr>
      )}
    </>
  )
}

function ReferencePriceList({
  detail,
  className,
}: {
  detail: NonNullable<ReturnType<typeof pmcApi.getReferenceDetail>>
  className?: string
}) {
  return (
    <div className={className}>
      {detail.reference.notes && (
        <p className="text-sm text-muted mb-3">{detail.reference.notes}</p>
      )}
      <div className="pmc-table-wrap mx-0 px-0">
        <table className="data-table w-full text-sm">
          <thead>
            <tr>
              <th>Material</th>
              <th>Unit</th>
              <th className="text-right">Price</th>
            </tr>
          </thead>
          <tbody>
            {detail.prices.map((p) => (
              <tr key={p.id}>
                <td className="font-medium">{p.material_name}</td>
                <td className="text-muted">{p.unit}</td>
                <td className="text-right font-mono">{formatINR(p.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
