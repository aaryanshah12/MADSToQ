'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { factoriesApi } from '@/lib/api'
import { useToast } from '@/components/providers/ToastProvider'
import type { Factory } from '@/types'
import { MobileCard } from '@/components/inventory/MobileList'

export type FactoryMaterial = {
  name: string
  hsn?: string
}

function normalizeMaterials(
  raw: Factory['materials'],
): FactoryMaterial[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((m) => {
      if (typeof m === 'string') {
        const name = m.trim()
        return name ? { name } : null
      }
      const name = String(m?.name ?? '').trim()
      if (!name) return null
      const hsn = String(m.hsn ?? m.hsnCode ?? '').trim()
      return hsn ? { name, hsn } : { name }
    })
    .filter((m): m is FactoryMaterial => m != null)
}

export function materialNamesFromFactory(factory: Factory | null | undefined): string[] {
  return normalizeMaterials(factory?.materials).map((m) => m.name)
}

export default function RawMaterialsPanel({
  factories,
  assignedFactoryIds,
  onSaved,
}: {
  factories: Factory[]
  assignedFactoryIds: string[]
  onSaved?: () => void | Promise<void>
}) {
  const toast = useToast()
  const [factoryId, setFactoryId] = useState('')
  const [rows, setRows] = useState<FactoryMaterial[]>([])
  const [draftName, setDraftName] = useState('')
  const [draftHsn, setDraftHsn] = useState('')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const visibleFactories = factories.filter(
    (f) => assignedFactoryIds.includes(f.id) || assignedFactoryIds.length === 0,
  )

  const selected = useMemo(
    () => factories.find((f) => f.id === factoryId) ?? null,
    [factories, factoryId],
  )

  useEffect(() => {
    if (!factoryId && visibleFactories.length === 1) {
      setFactoryId(visibleFactories[0].id)
    }
  }, [factoryId, visibleFactories])

  useEffect(() => {
    setRows(normalizeMaterials(selected?.materials))
    setDirty(false)
    setDraftName('')
    setDraftHsn('')
  }, [selected])

  function addRow() {
    const name = draftName.trim()
    if (!name) {
      toast.error('Material name is required')
      return
    }
    if (rows.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
      toast.error('That material is already on the list')
      return
    }
    setRows((prev) => [...prev, { name, hsn: draftHsn.trim() || undefined }])
    setDraftName('')
    setDraftHsn('')
    setDirty(true)
  }

  function updateRow(i: number, patch: Partial<FactoryMaterial>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
    setDirty(true)
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i))
    setDirty(true)
  }

  async function save() {
    if (!factoryId) {
      toast.error('Select a factory')
      return
    }
    const cleaned = rows
      .map((r) => {
        const name = r.name.trim()
        if (!name) return null
        const hsn = (r.hsn ?? '').trim()
        return hsn ? { name, hsn } : { name }
      })
      .filter((r): r is FactoryMaterial => r != null)

    const seen = new Set<string>()
    for (const r of cleaned) {
      const key = r.name.toLowerCase()
      if (seen.has(key)) {
        toast.error(`Duplicate material name: ${r.name}`)
        return
      }
      seen.add(key)
    }

    setSaving(true)
    const result = await factoriesApi.update({
      id: factoryId,
      materials: cleaned,
    })
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    setDirty(false)
    toast.success('Raw materials saved')
    await onSaved?.()
  }

  return (
    <div>
      <p className="mb-5 text-sm text-muted">
        Maintain the factory raw-materials list used for procurement, stock, and production
        templates. Add materials here first, then pick them when configuring Production products.
      </p>

      <div className="mb-5">
        <label htmlFor="factory" className="mb-2 block text-xs text-muted">
          Factory
        </label>
        <select id="factory"
          className="input-field owner-focus w-full md:max-w-md"
          value={factoryId}
          onChange={(e) => setFactoryId(e.target.value)}
        >
          <option value="">Select factory</option>
          {visibleFactories.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      {!factoryId ? (
        <p className="text-sm text-muted">Select a factory to manage raw materials.</p>
      ) : (
        <>
          <div className="mobile-card mb-4 space-y-3 rounded-xl p-4">
            <input
              className="input-field owner-focus"
              placeholder="Material name (e.g. Bromine)"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addRow()
                }
              }}
            />
            <input
              className="input-field owner-focus font-mono"
              placeholder="HSN (optional)"
              value={draftHsn}
              onChange={(e) => setDraftHsn(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addRow()
                }
              }}
            />
            <button
              type="button"
              onClick={addRow}
              className="btn btn-owner inline-flex w-full items-center justify-center gap-1 px-3 py-2 text-sm md:w-auto"
            >
              <Plus size={16} />
              Add
            </button>
          </div>

          {rows.length === 0 ? (
            <p className="px-1 py-6 text-sm text-muted">No raw materials yet.</p>
          ) : (
            <div className="mb-4 space-y-3">
              {rows.map((row, i) => (
                <MobileCard
                  key={`${row.name}-${i}`}
                  title={
                    <input
                      className="input-field owner-focus"
                      value={row.name}
                      onChange={(e) => updateRow(i, { name: e.target.value })}
                    />
                  }
                  rows={[
                    {
                      label: 'HSN',
                      value: (
                        <input
                          className="input-field owner-focus w-28 font-mono"
                          placeholder="HSN"
                          value={row.hsn ?? ''}
                          onChange={(e) => updateRow(i, { hsn: e.target.value })}
                        />
                      ),
                    },
                  ]}
                  footer={
                    <button
                      type="button"
                      className="btn w-full justify-center gap-1.5 border border-red-300 bg-panel py-2 text-xs text-red-600"
                      onClick={() => removeRow(i)}
                      aria-label={`Remove ${row.name}`}
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  }
                />
              ))}
            </div>
          )}

          <button
            type="button"
            disabled={saving || !dirty}
            onClick={() => void save()}
            className="btn btn-owner w-full px-6 py-3 disabled:opacity-50 md:w-auto"
          >
            {saving ? 'Saving…' : 'Save raw materials'}
          </button>
        </>
      )}
    </div>
  )
}
