'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { usePMC, usePMCData } from '@/contexts/PMCContext'
import type { PMCRawMaterial, PMCItemType } from '@madstoq/pmc-system/types'
import { PmcRowActions } from '@/components/pmc/PmcRowActions'
import { PmcSimpleModal } from '@/components/pmc/PmcSimpleModal'

const emptyForm = () => ({
  code: '',
  name: '',
  price: '',
  item_type: 'material' as PMCItemType,
  vendor: '',
  description: '',
})

export default function PMCProcurementPanel() {
  const { refresh } = usePMC()
  const { api: pmcApi, tick } = usePMCData()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editItem, setEditItem] = useState<PMCRawMaterial | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null)
  const [priceDraft, setPriceDraft] = useState('')
  const editingPriceIdRef = useRef<string | null>(null)
  const priceEditOriginalRef = useRef(0)
  const committingPriceRef = useRef(false)
  const skipNextPriceBlurRef = useRef(false)

  useEffect(() => {
    editingPriceIdRef.current = editingPriceId
  }, [editingPriceId])

  const items = useMemo(() => {
    void tick
    return pmcApi.listAllRawMaterials().filter((m) => m.is_active)
  }, [tick])

  async function saveNew(e: React.FormEvent) {
    e.preventDefault()
    if (!form.code.trim() || !form.name.trim() || saving) return
    setSaving(true)
    try {
      await pmcApi.upsertRawMaterial({
        code: form.code,
        name: form.name,
        price: Number(form.price) || 0,
        item_type: form.item_type,
        vendor: form.vendor || null,
        description: form.description || null,
      })
      setShowAdd(false)
      setForm(emptyForm())
      refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  function openEdit(m: PMCRawMaterial) {
    setEditItem(m)
    setEditForm({
      code: m.code,
      name: m.name,
      price: String(m.price),
      item_type: m.item_type,
      vendor: m.vendor ?? '',
      description: m.description ?? '',
    })
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editItem || saving) return
    setSaving(true)
    try {
      await pmcApi.upsertRawMaterial({
        id: editItem.id,
        code: editForm.code,
        name: editForm.name,
        price: Number(editForm.price) || 0,
        item_type: editForm.item_type,
        vendor: editForm.vendor || null,
        description: editForm.description || null,
      })
      setEditItem(null)
      refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not update.')
    } finally {
      setSaving(false)
    }
  }

  function startPriceEdit(m: PMCRawMaterial) {
    priceEditOriginalRef.current = m.price
    setEditingPriceId(m.id)
    setPriceDraft(String(m.price))
  }

  function cancelPriceEdit() {
    skipNextPriceBlurRef.current = true
    setEditingPriceId(null)
    setPriceDraft('')
  }

  function handlePriceBlur(itemId: string, originalPrice: number, draft: string) {
    window.setTimeout(() => {
      if (skipNextPriceBlurRef.current) {
        skipNextPriceBlurRef.current = false
        return
      }
      void commitInlinePrice(itemId, originalPrice, draft)
    }, 0)
  }

  async function commitInlinePrice(id: string, originalPrice: number, draftValue?: string) {
    if (committingPriceRef.current) return

    const draft = draftValue ?? priceDraft
    const price = Number(draft)
    const stillEditing = editingPriceIdRef.current === id

    if (stillEditing) {
      setEditingPriceId(null)
      setPriceDraft('')
    }

    if (Number.isNaN(price) || price < 0) return
    if (price === originalPrice) return

    committingPriceRef.current = true
    try {
      await pmcApi.updateProcurementPrice(id, price)
      refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not update price.')
      if (stillEditing) {
        setEditingPriceId(id)
        setPriceDraft(draft)
      }
    } finally {
      committingPriceRef.current = false
    }
  }

  async function handleDelete(m: PMCRawMaterial) {
    if (!confirm(`Remove "${m.name}"?`)) return
    try {
      await pmcApi.deactivateRawMaterial(m.id)
      refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not remove.')
    }
  }

  const formFields = (
    f: ReturnType<typeof emptyForm>,
    set: (v: ReturnType<typeof emptyForm>) => void
  ) => (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-mono uppercase tracking-widest text-muted mb-1">Code *</label>
          <input value={f.code} onChange={(e) => set({ ...f, code: e.target.value })} className="input w-full pmc-focus" required />
        </div>
        <div>
          <label className="block text-xs font-mono uppercase tracking-widest text-muted mb-1">Name *</label>
          <input value={f.name} onChange={(e) => set({ ...f, name: e.target.value })} className="input w-full pmc-focus" required />
        </div>
        <div>
          <label className="block text-xs font-mono uppercase tracking-widest text-muted mb-1">Price *</label>
          <input type="number" step="0.01" min="0" value={f.price} onChange={(e) => set({ ...f, price: e.target.value })} className="input w-full pmc-focus" required />
        </div>
        <div>
          <label className="block text-xs font-mono uppercase tracking-widest text-muted mb-1">Type *</label>
          <select value={f.item_type} onChange={(e) => set({ ...f, item_type: e.target.value as PMCItemType })} className="input w-full pmc-focus">
            <option value="material">Material</option>
            <option value="service">Service</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-mono uppercase tracking-widest text-muted mb-1">Vendor</label>
          <input value={f.vendor} onChange={(e) => set({ ...f, vendor: e.target.value })} className="input w-full pmc-focus" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-mono uppercase tracking-widest text-muted mb-1">Description</label>
          <textarea value={f.description} onChange={(e) => set({ ...f, description: e.target.value })} className="input w-full pmc-focus min-h-[72px]" />
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={() => setShowAdd(true)} className="btn btn-pmc">
          <Plus size={14} /> Add
        </button>
      </div>

      <div className="pmc-card overflow-x-auto p-0">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Price</th>
              <th>Type</th>
              <th>Vendor</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={6} className="py-10 text-center text-sm text-muted">No procurement items yet.</td></tr>
            ) : (
              items.map((m) => (
                <tr key={m.id}>
                  <td className="font-mono text-xs">{m.code}</td>
                  <td className="font-medium">{m.name}</td>
                  <td>
                    {editingPriceId === m.id ? (
                      <input
                        autoFocus
                        type="number"
                        step="0.01"
                        min="0"
                        className="input w-28 py-1 text-sm pmc-focus"
                        value={priceDraft}
                        onChange={(e) => setPriceDraft(e.target.value)}
                        onBlur={(e) => handlePriceBlur(m.id, priceEditOriginalRef.current, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            skipNextPriceBlurRef.current = true
                            void commitInlinePrice(m.id, priceEditOriginalRef.current)
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault()
                            cancelPriceEdit()
                          }
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => startPriceEdit(m)}
                        className="text-left font-mono tabular-nums text-pmc hover:underline cursor-pointer"
                        title="Click to edit price"
                      >
                        ₹{m.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </button>
                    )}
                  </td>
                  <td className="capitalize text-xs">{m.item_type}</td>
                  <td className="text-xs text-muted max-w-[120px] truncate">{m.vendor || '—'}</td>
                  <td className="text-right">
                    <PmcRowActions onEdit={() => openEdit(m)} onDelete={() => handleDelete(m)} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <PmcSimpleModal
          title="Add procurement item"
          onClose={() => setShowAdd(false)}
          footer={
            <>
              <button type="button" onClick={() => setShowAdd(false)} className="btn btn-ghost">Cancel</button>
              <button type="submit" form="proc-add-form" disabled={saving} className="btn btn-pmc">{saving ? 'Saving…' : 'Save'}</button>
            </>
          }
        >
          <form id="proc-add-form" onSubmit={saveNew}>{formFields(form, setForm)}</form>
        </PmcSimpleModal>
      )}

      {editItem && (
        <PmcSimpleModal
          title="Edit procurement item"
          onClose={() => setEditItem(null)}
          footer={
            <>
              <button type="button" onClick={() => setEditItem(null)} className="btn btn-ghost">Cancel</button>
              <button type="submit" form="proc-edit-form" disabled={saving} className="btn btn-pmc">{saving ? 'Saving…' : 'Save'}</button>
            </>
          }
        >
          <form id="proc-edit-form" onSubmit={saveEdit}>{formFields(editForm, setEditForm)}</form>
        </PmcSimpleModal>
      )}
    </div>
  )
}
