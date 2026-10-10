'use client'

import { useEffect, useMemo, useState } from 'react'
import { warehouseApi } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useInventoryFactory } from '@/contexts/InventoryFactoryContext'
import { parseMaterialCatalog, DEFAULT_MATERIAL_HSN } from '@/lib/procurement-materials'
import type { Factory } from '@/types'

const FALLBACK_MATERIALS = Object.keys(DEFAULT_MATERIAL_HSN)

function todayIso() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function clampTodayOrLater(value: string) {
  const today = todayIso()
  if (!value) return today
  return value < today ? today : value
}

function materialList(factory?: Factory | null): string[] {
  const catalog = parseMaterialCatalog(factory?.materials)
  const base = catalog.length > 0 ? catalog.map((m) => m.name) : FALLBACK_MATERIALS
  return [...base, 'Other']
}

export function ChemistRequestMaterialForm({
  onCreated,
  onBusy,
}: {
  onCreated: () => void
  onBusy?: (busy: boolean) => void
}) {
  const { profile, loading: authLoading } = useAuth()
  const { factoryId: ctxFactoryId } = useInventoryFactory()
  const [factories, setFactories] = useState<Factory[]>([])
  const [kind, setKind] = useState<'rm' | 'sfg_approved' | 'sfg_rejected'>('rm')
  const [form, setForm] = useState({
    factory_id: '',
    material_type: '',
    qty: '',
    unit: 'Kg',
    needed_by_date: todayIso(),
    notes: '',
  })
  const [customMaterial, setCustomMaterial] = useState('')
  const [rejectedMaterials, setRejectedMaterials] = useState<string[]>([])
  const [rejectedLoading, setRejectedLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return
    const list = (profile?.factories ?? []) as Factory[]
    setFactories(list)
    const preferred =
      (ctxFactoryId && list.some((f) => f.id === ctxFactoryId) && ctxFactoryId) ||
      (list.length === 1 ? list[0]?.id : '') ||
      ''
    if (preferred) {
      setForm((f) => (f.factory_id ? f : { ...f, factory_id: preferred }))
    }
  }, [authLoading, profile, ctxFactoryId])

  useEffect(() => {
    async function loadRejected() {
      if ((kind !== 'sfg_rejected' && kind !== 'sfg_approved') || !form.factory_id) {
        setRejectedMaterials([])
        return
      }
      setRejectedLoading(true)
      const data =
        kind === 'sfg_rejected'
          ? await warehouseApi.listStock(form.factory_id, undefined, 'rejected', 'sfg')
          : await warehouseApi.listStock(form.factory_id, undefined, 'approved', 'sfg')
      const names = [
        ...new Set(
          ((data.stock ?? []) as { material_type?: string }[])
            .map((r) => (r.material_type ?? '').trim())
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b))
      setRejectedMaterials(names)
      setRejectedLoading(false)
    }
    void loadRejected()
  }, [kind, form.factory_id])

  const rmOptions = useMemo(() => {
    const selected = factories.find((f) => f.id === form.factory_id)
    return materialList(selected)
  }, [factories, form.factory_id])

  const materialOptions = kind === 'rm' ? rmOptions : rejectedMaterials
  const showFactory = factories.length > 1
  const fieldLabel = 'mb-1.5 block text-xs text-muted'

  function update(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onBusy?.(true)
    setError('')

    const material =
      kind === 'rm' && form.material_type === 'Other'
        ? customMaterial.trim()
        : form.material_type.trim()
    if (!form.factory_id) {
      setError('Select a factory')
      onBusy?.(false)
      return
    }
    if (!material) {
      setError(
        kind === 'sfg_rejected'
          ? 'Select a rejected SFG product'
          : kind === 'sfg_approved'
            ? 'Select an approved SFG product'
            : 'Material is required',
      )
      onBusy?.(false)
      return
    }

    const result = await warehouseApi.createRequest({
      factory_id: form.factory_id,
      material_type: material,
      qty: Number(form.qty),
      unit: form.unit,
      needed_by_date: form.needed_by_date || undefined,
      notes: form.notes || undefined,
      stock_grade: kind === 'sfg_rejected' ? 'rejected' : 'approved',
      stock_kind: kind === 'rm' ? 'rm' : 'sfg',
    })

    if (result.error) {
      setError(result.error)
      onBusy?.(false)
      return
    }

    onCreated()
  }

  return (
    <form id="chemist-request-material-form" onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {authLoading ? (
        <p className="text-sm text-muted">Loading your factories…</p>
      ) : factories.length === 0 ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
          No factory assigned. Ask the owner to assign a factory under Management.
        </div>
      ) : null}

      <div>
        <p className={fieldLabel}>What to release *</p>
        <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-border">
          {(
            [
              { key: 'rm' as const, label: 'Raw material' },
              { key: 'sfg_approved' as const, label: 'Approved SFG' },
              { key: 'sfg_rejected' as const, label: 'Rejected SFG' },
            ] as const
          ).map((t) => {
            const on = kind === t.key
            return (
              <button
                key={t.key}
                type="button"
                className={`px-2 py-2 text-center text-xs font-medium sm:text-sm ${
                  on ? 'bg-chemist/15 text-chemist' : 'bg-panel text-muted hover:text-primary'
                }`}
                onClick={() => {
                  setKind(t.key)
                  update('material_type', '')
                  setCustomMaterial('')
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {showFactory ? (
      <div>
        <label htmlFor="factory" className={fieldLabel}>
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
      ) : null}

      <div>
        <label className={fieldLabel}>
          {kind === 'sfg_rejected'
            ? 'Rejected SFG *'
            : kind === 'sfg_approved'
              ? 'Approved SFG *'
              : 'Material *'}
        </label>
        <select
          className="input-field"
          required
          disabled={!form.factory_id || (kind !== 'rm' && rejectedLoading)}
          value={form.material_type}
          onChange={(e) => update('material_type', e.target.value)}
        >
          <option value="">
            {kind !== 'rm'
              ? rejectedLoading
                ? 'Loading SFG lots…'
                : kind === 'sfg_rejected'
                  ? 'Select rejected SFG'
                  : 'Select approved SFG'
              : 'Select material'}
          </option>
          {materialOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        {kind === 'rm' && form.material_type === 'Other' && (
          <input
            className="input-field mt-2"
            required
            placeholder="Material name"
            value={customMaterial}
            onChange={(e) => setCustomMaterial(e.target.value)}
          />
        )}
        {kind !== 'rm' &&
          !rejectedLoading &&
          Boolean(form.factory_id) &&
          rejectedMaterials.length === 0 && (
            <p className="mt-2 text-xs text-muted">
              {kind === 'sfg_rejected'
                ? 'No rejected SFG remaining in warehouse. Owner reject on SFG QC creates these lots.'
                : 'No approved SFG remaining in warehouse.'}
            </p>
          )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="quantity" className={fieldLabel}>
            Quantity *
          </label>
          <input
            id="quantity"
            className="input-field"
            type="number"
            min="0.001"
            step="any"
            required
            value={form.qty}
            onChange={(e) => update('qty', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="unit" className={fieldLabel}>
            Unit
          </label>
          <select
            id="unit"
            className="input-field"
            value={form.unit}
            onChange={(e) => update('unit', e.target.value)}
          >
            <option value="Kg">Kg</option>
            <option value="MT">MT</option>
            <option value="Nos">Nos</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="needed-by-date" className={fieldLabel}>
          Needed by
        </label>
        <input
          id="needed-by-date"
          className="input-field"
          type="date"
          min={todayIso()}
          value={form.needed_by_date}
          onChange={(e) => update('needed_by_date', clampTodayOrLater(e.target.value))}
        />
      </div>

      <div>
        <label htmlFor="notes" className={fieldLabel}>
          Notes
        </label>
        <textarea
          id="notes"
          className="input-field min-h-[64px]"
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
          placeholder="Optional for warehouse"
        />
      </div>
    </form>
  )
}

export function ChemistRequestMaterialFooter({
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
        form="chemist-request-material-form"
        disabled={submitting}
        className="btn border border-chemist bg-chemist text-white hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? 'Submitting…' : 'Submit request'}
      </button>
    </>
  )
}
