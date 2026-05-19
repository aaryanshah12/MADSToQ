'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePMC, usePMCData } from '@/contexts/PMCContext'
import { pmcApi } from '@madstoq/pmc-system/api'
import type { PMCRawMaterial } from '@madstoq/pmc-system/types'
import { PmcRowActions } from '@/components/pmc/PmcRowActions'
import { PmcSimpleModal } from '@/components/pmc/PmcSimpleModal'

export default function PMCRawMaterialsPage() {
  const { refresh } = usePMC()
  const { tick } = usePMCData()
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('Kg')
  const [saving, setSaving] = useState(false)
  const [viewMaterial, setViewMaterial] = useState<PMCRawMaterial | null>(null)
  const [editMaterial, setEditMaterial] = useState<PMCRawMaterial | null>(null)
  const [editName, setEditName] = useState('')
  const [editUnit, setEditUnit] = useState('Kg')

  const materials = useMemo(() => {
    void tick
    return pmcApi.listAllRawMaterials()
  }, [tick])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      await pmcApi.upsertRawMaterial({ name, unit })
      setName('')
      setUnit('Kg')
      refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not save raw material.')
    } finally {
      setSaving(false)
    }
  }

  function openEdit(m: PMCRawMaterial) {
    setEditMaterial(m)
    setEditName(m.name)
    setEditUnit(m.unit)
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editMaterial || !editName.trim() || saving) return
    setSaving(true)
    try {
      await pmcApi.upsertRawMaterial({
        id: editMaterial.id,
        name: editName,
        unit: editUnit,
      })
      setEditMaterial(null)
      refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not update raw material.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(m: PMCRawMaterial) {
    if (!m.is_active) return
    if (!confirm(`Remove "${m.name}" from the active list?`)) return
    try {
      await pmcApi.deactivateRawMaterial(m.id)
      refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not remove raw material.')
    }
  }

  return (
    <div className="pmc-page max-w-3xl">
      <div>
        <Link href="/pmc/master" className="text-xs text-muted hover:text-primary">
          ← Master
        </Link>
        <h1 className="pmc-page-title mt-2">Raw materials</h1>
      </div>

      <form onSubmit={handleAdd} className="pmc-card flex flex-col sm:flex-row flex-wrap gap-3 sm:items-end">
        <div className="flex-1 min-w-0 w-full sm:min-w-[140px]">
          <label className="block text-xs font-mono uppercase tracking-widest text-muted mb-2">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input w-full pmc-focus"
            placeholder="e.g. ONT"
            required
          />
        </div>
        <div className="w-full sm:w-24">
          <label className="block text-xs font-mono uppercase tracking-widest text-muted mb-2">Unit</label>
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="input w-full pmc-focus"
          />
        </div>
        <button type="submit" disabled={saving} className="btn btn-pmc w-full sm:w-auto justify-center">
          {saving ? 'Saving…' : 'Add'}
        </button>
      </form>

      <ul className="pmc-card divide-y divide-border p-0 overflow-hidden">
        {materials.length === 0 ? (
          <li className="px-5 py-8 text-center text-sm text-muted">No raw materials yet.</li>
        ) : (
          materials.map((m) => (
            <li
              key={m.id}
              className={`px-5 py-3 flex justify-between items-center gap-3 ${!m.is_active ? 'opacity-50' : ''}`}
            >
              <div className="min-w-0">
                <span className="font-medium">{m.name}</span>
                <span className="text-xs text-muted ml-2">{m.unit}</span>
                {!m.is_active && (
                  <span className="text-xs text-muted ml-2">(inactive)</span>
                )}
              </div>
              <PmcRowActions
                onView={() => setViewMaterial(m)}
                onEdit={() => openEdit(m)}
                onDelete={() => handleDelete(m)}
                deleteDisabled={!m.is_active}
              />
            </li>
          ))
        )}
      </ul>

      {viewMaterial && (
        <PmcSimpleModal title="Raw material" onClose={() => setViewMaterial(null)}>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted uppercase tracking-wide">Name</dt>
              <dd className="font-medium mt-0.5">{viewMaterial.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted uppercase tracking-wide">Unit</dt>
              <dd className="mt-0.5">{viewMaterial.unit}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted uppercase tracking-wide">Status</dt>
              <dd className="mt-0.5">{viewMaterial.is_active ? 'Active' : 'Inactive'}</dd>
            </div>
          </dl>
        </PmcSimpleModal>
      )}

      {editMaterial && (
        <PmcSimpleModal
          title="Edit raw material"
          onClose={() => setEditMaterial(null)}
          footer={
            <>
              <button type="button" onClick={() => setEditMaterial(null)} className="btn btn-ghost">
                Cancel
              </button>
              <button type="submit" form="edit-raw-material-form" disabled={saving} className="btn btn-pmc">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          }
        >
          <form id="edit-raw-material-form" onSubmit={handleEditSave} className="space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-muted mb-2">Name</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="input w-full pmc-focus"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-muted mb-2">Unit</label>
              <input
                value={editUnit}
                onChange={(e) => setEditUnit(e.target.value)}
                className="input w-full pmc-focus"
              />
            </div>
          </form>
        </PmcSimpleModal>
      )}
    </div>
  )
}
