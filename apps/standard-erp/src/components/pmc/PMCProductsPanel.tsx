'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { usePMC, usePMCData } from '@/contexts/PMCContext'
import type { PMCRawMaterial } from '@madstoq/pmc-system/types'
import { PmcRowActions } from '@/components/pmc/PmcRowActions'
import { PmcSimpleModal } from '@/components/pmc/PmcSimpleModal'

type BomRow = { raw_material_id: string; qty: string }

export default function PMCProductsPanel() {
  const { refresh } = usePMC()
  const { api: pmcApi, tick } = usePMCData()
  const [showAdd, setShowAdd] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [bomRows, setBomRows] = useState<BomRow[]>([{ raw_material_id: '', qty: '1' }])
  const [saving, setSaving] = useState(false)

  const products = useMemo(() => {
    void tick
    return pmcApi.listProducts()
  }, [tick])

  const procurement = useMemo(() => {
    void tick
    return pmcApi.listRawMaterials()
  }, [tick])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim() || !name.trim() || saving) return
    const valid = bomRows.filter((r) => r.raw_material_id && Number(r.qty) > 0)
    if (valid.length === 0) {
      alert('Add at least one procurement line to the BOM.')
      return
    }
    setSaving(true)
    try {
      await pmcApi.saveProductWithMaterials(
        { name, code },
        valid.map((r) => ({
          raw_material_id: r.raw_material_id,
          qty: Number(r.qty),
        }))
      )
      setShowAdd(false)
      setCode('')
      setName('')
      setBomRows([{ raw_material_id: '', qty: '1' }])
      refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not save product.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`Delete product "${label}"?`)) return
    try {
      await pmcApi.deactivateProduct(id)
      refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not delete.')
    }
  }

  function addBomRow() {
    setBomRows((rows) => [...rows, { raw_material_id: '', qty: '1' }])
  }

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
              <th>Product name</th>
              <th>Unit price</th>
              <th>Raw materials</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr><td colSpan={5} className="py-10 text-center text-sm text-muted">No products yet.</td></tr>
            ) : (
              products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/pmc/products/${p.id}`} className="font-mono text-sm text-pmc hover:underline">
                      {p.code || '—'}
                    </Link>
                  </td>
                  <td className="font-medium">{p.name}</td>
                  <td>₹{(p.unit_price ?? pmcApi.templateUnitPrice(p.id)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  <td className="text-sm text-muted">{pmcApi.countProductMaterials(p.id)}</td>
                  <td className="text-right">
                    <PmcRowActions
                      editHref={`/pmc/products/${p.id}`}
                      onDelete={() => handleDelete(p.id, p.name)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <PmcSimpleModal
          title="Add product"
          onClose={() => setShowAdd(false)}
          wide
          footer={
            <>
              <button type="button" onClick={() => setShowAdd(false)} className="btn btn-ghost">Cancel</button>
              <button type="submit" form="prod-add-form" disabled={saving} className="btn btn-pmc">{saving ? 'Saving…' : 'Save'}</button>
            </>
          }
        >
          <form id="prod-add-form" onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono uppercase tracking-widest text-muted mb-1">Code *</label>
                <input value={code} onChange={(e) => setCode(e.target.value)} className="input w-full pmc-focus" required />
              </div>
              <div>
                <label className="block text-xs font-mono uppercase tracking-widest text-muted mb-1">Name *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="input w-full pmc-focus" required />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-mono uppercase tracking-widest text-muted">BOM (procurement) *</label>
                <button type="button" onClick={addBomRow} className="text-xs text-pmc hover:underline">+ Line</button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {bomRows.map((row, idx) => (
                  <div key={idx} className="flex flex-wrap gap-2 items-center border border-border rounded-lg p-2">
                    <select
                      value={row.raw_material_id}
                      onChange={(e) => {
                        const v = e.target.value
                        setBomRows((rows) => rows.map((r, i) => (i === idx ? { ...r, raw_material_id: v } : r)))
                      }}
                      className="input flex-1 min-w-[140px] pmc-focus text-sm"
                      required
                    >
                      <option value="">Select item</option>
                      {procurement.map((m: PMCRawMaterial) => (
                        <option key={m.id} value={m.id}>{m.code} — {m.name} (₹{m.price})</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      placeholder="Qty"
                      value={row.qty}
                      onChange={(e) => {
                        const v = e.target.value
                        setBomRows((rows) => rows.map((r, i) => (i === idx ? { ...r, qty: v } : r)))
                      }}
                      className="input w-24 pmc-focus text-sm"
                      required
                    />
                  </div>
                ))}
              </div>
            </div>
          </form>
        </PmcSimpleModal>
      )}
    </div>
  )
}
