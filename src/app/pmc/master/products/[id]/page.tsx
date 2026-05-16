'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { usePMC, usePMCData } from '@/contexts/PMCContext'
import { pmcApi } from '@/lib/pmc/api'

type Row = { raw_material_id: string; qty: string }

export default function PMCMasterProductRecipePage() {
  const { id } = useParams<{ id: string }>()
  const { refresh } = usePMC()
  const { tick } = usePMCData()
  const [rows, setRows] = useState<Row[]>([{ raw_material_id: '', qty: '' }])

  const product = useMemo(() => {
    void tick
    return pmcApi.getProduct(id)
  }, [id, tick])

  const materials = useMemo(() => {
    void tick
    return pmcApi.listRawMaterials()
  }, [tick])

  useEffect(() => {
    const existing = pmcApi.listProductMaterials(id)
    if (existing.length) {
      setRows(
        existing.map((m) => ({
          raw_material_id: m.raw_material_id,
          qty: String(m.qty),
        }))
      )
    }
  }, [id, tick])

  if (!product) {
    return <p className="text-muted">Product not found.</p>
  }

  function addRow() {
    setRows((r) => [...r, { raw_material_id: '', qty: '' }])
  }

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)))
  }

  function removeRow(i: number) {
    setRows((r) => r.filter((_, j) => j !== i))
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const parsed = rows
      .filter((r) => r.raw_material_id && Number(r.qty) > 0)
      .map((r) => ({ raw_material_id: r.raw_material_id, qty: Number(r.qty) }))
    if (parsed.length === 0) {
      alert('Add at least one raw material with quantity.')
      return
    }
    pmcApi.setProductMaterials(id, parsed)
    refresh()
    alert('Recipe saved.')
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link href="/pmc/master/products" className="text-xs text-muted hover:text-primary">
          ← Products
        </Link>
        <h1 className="text-2xl font-bold text-primary mt-2">{product.name}</h1>
        <p className="text-sm text-muted">Raw materials consumed (qty per batch)</p>
      </div>

      {materials.length === 0 ? (
        <p className="text-sm text-muted">
          Add raw materials first in{' '}
          <Link href="/pmc/master/raw-materials" className="underline" style={{ color: 'var(--color-pmc)' }}>
            Raw materials
          </Link>
          .
        </p>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="bg-panel border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-layer border-b border-border text-left text-muted">
                  <th className="px-4 py-2">Raw material</th>
                  <th className="px-4 py-2">Qty</th>
                  <th className="px-4 py-2 w-12" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-border/60">
                    <td className="px-4 py-2">
                      <select
                        value={row.raw_material_id}
                        onChange={(e) => updateRow(i, { raw_material_id: e.target.value })}
                        className="w-full px-2 py-1.5 rounded border border-border bg-layer"
                        required
                      >
                        <option value="">Select…</option>
                        {materials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={row.qty}
                        onChange={(e) => updateRow(i, { qty: e.target.value })}
                        className="w-full px-2 py-1.5 rounded border border-border bg-layer"
                        required
                      />
                    </td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="text-muted hover:text-red-500 text-xs"
                        aria-label="Remove row"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={addRow} className="px-3 py-2 text-sm border border-border rounded-lg">
              + Add row
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: 'var(--color-pmc)' }}
            >
              Save recipe
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
