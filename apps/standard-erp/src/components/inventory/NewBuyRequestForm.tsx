'use client'

import { useEffect, useMemo, useState } from 'react'
import { procurementApi } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useInventoryFactory } from '@/contexts/InventoryFactoryContext'
import { parseMaterialCatalog, DEFAULT_MATERIAL_HSN } from '@/lib/procurement-materials'
import type { Factory } from '@/types'

const FALLBACK_MATERIALS = Object.keys(DEFAULT_MATERIAL_HSN)

function materialList(factory?: Factory | null): string[] {
  const catalog = parseMaterialCatalog(factory?.materials)
  const base = catalog.length > 0 ? catalog.map((m) => m.name) : FALLBACK_MATERIALS
  return [...base, 'Other']
}

export function NewBuyRequestForm({
  onCreated,
  onBusy,
}: {
  onCreated: () => void
  onBusy?: (busy: boolean) => void
}) {
  const { profile, loading: authLoading } = useAuth()
  const { factoryId: ctxFactoryId } = useInventoryFactory()
  const [factories, setFactories] = useState<Factory[]>([])
  const [form, setForm] = useState({
    factory_id: '',
    material_type: '',
    qty: '',
    unit: 'Kg',
    needed_by_date: '',
    notes: '',
  })
  const [customMaterial, setCustomMaterial] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return
    const list = (profile?.factories ?? []) as Factory[]
    setFactories(list)
    const preferred =
      (ctxFactoryId && list.some((f) => f.id === ctxFactoryId) && ctxFactoryId) ||
      (list.length === 1 ? list[0]!.id : '')
    if (preferred) {
      setForm((f) => (f.factory_id ? f : { ...f, factory_id: preferred }))
    }
  }, [authLoading, profile, ctxFactoryId])

  const materialOptions = useMemo(() => {
    const selected = factories.find((f) => f.id === form.factory_id)
    return materialList(selected)
  }, [factories, form.factory_id])

  function update(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profile?.id) return
    onBusy?.(true)
    setError('')

    const material =
      form.material_type === 'Other' ? customMaterial.trim() : form.material_type.trim()
    if (!form.factory_id) {
      setError('Select a factory')
      onBusy?.(false)
      return
    }
    if (!material) {
      setError('Material is required')
      onBusy?.(false)
      return
    }

    const result = await procurementApi.createRequest({
      factory_id: form.factory_id,
      material_type: material,
      qty: Number(form.qty),
      unit: form.unit,
      needed_by_date: form.needed_by_date,
      notes: form.notes || undefined,
      created_by: profile.id,
    })

    if (result.error) {
      setError(result.error)
      onBusy?.(false)
      return
    }

    onCreated()
  }

  return (
    <form id="new-buy-request-form" onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {authLoading ? (
        <p className="text-sm text-muted">Loading your factories…</p>
      ) : factories.length === 0 ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
          No factory assigned to this warehouse profile. Ask the owner to assign a factory under
          Management, then sign out and back in.
        </div>
      ) : null}

      <div>
        <label htmlFor="factory" className="mb-2 block font-mono text-xs uppercase tracking-widest text-muted max-md:font-body max-md:tracking-wider">
          Factory *
        </label>
        <select
          id="factory"
          className="input-field"
          required
          disabled={authLoading || factories.length === 0}
          value={form.factory_id}
          onChange={(e) => {
            update('factory_id', e.target.value)
            update('material_type', '')
          }}
        >
          <option value="">Select factory</option>
          {factories.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="material" className="mb-2 block font-mono text-xs uppercase tracking-widest text-muted max-md:font-body max-md:tracking-wider">
          Material *
        </label>
        <select
          id="material"
          className="input-field"
          required
          disabled={!form.factory_id}
          value={form.material_type}
          onChange={(e) => update('material_type', e.target.value)}
        >
          <option value="">Select material</option>
          {materialOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        {form.material_type === 'Other' && (
          <input
            className="input-field mt-2"
            required
            placeholder="Material name"
            value={customMaterial}
            onChange={(e) => setCustomMaterial(e.target.value)}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="quantity" className="mb-2 block font-mono text-xs uppercase tracking-widest text-muted max-md:font-body max-md:tracking-wider">
            Quantity *
          </label>
          <input
            id="quantity"
            className="input-field"
            type="number"
            inputMode="decimal"
            min="0.001"
            step="any"
            required
            value={form.qty}
            onChange={(e) => update('qty', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="unit" className="mb-2 block font-mono text-xs uppercase tracking-widest text-muted max-md:font-body max-md:tracking-wider">
            Unit
          </label>
          <select id="unit" className="input-field" value={form.unit} onChange={(e) => update('unit', e.target.value)}>
            <option value="Kg">Kg</option>
            <option value="MT">MT</option>
            <option value="Nos">Nos</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="needed-by-date" className="mb-2 block font-mono text-xs uppercase tracking-widest text-muted max-md:font-body max-md:tracking-wider">
          Needed by date *
        </label>
        <input
          id="needed-by-date"
          className="input-field"
          type="date"
          required
          value={form.needed_by_date}
          onChange={(e) => update('needed_by_date', e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="notes" className="mb-2 block font-mono text-xs uppercase tracking-widest text-muted max-md:font-body max-md:tracking-wider">
          Notes
        </label>
        <textarea
          id="notes"
          className="input-field min-h-[80px]"
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
          placeholder="Optional context for purchase team"
        />
      </div>
    </form>
  )
}

export function NewBuyRequestFooter({
  onClose,
  submitting,
}: {
  onClose: () => void
  submitting?: boolean
}) {
  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
        Cancel
      </button>
      <button
        type="submit"
        form="new-buy-request-form"
        disabled={submitting}
        className="btn border border-pmc bg-pmc text-white hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? 'Submitting…' : 'Submit request'}
      </button>
    </>
  )
}
