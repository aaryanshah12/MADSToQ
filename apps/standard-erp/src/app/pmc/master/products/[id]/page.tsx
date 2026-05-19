'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { usePMC, usePMCData } from '@/contexts/PMCContext'
import { pmcApi } from '@madstoq/pmc-system/api'

type Row = { raw_material_id: string; qty: string; is_primary: boolean }

export default function PMCMasterProductRecipePage() {
  const { id } = useParams<{ id: string }>()
  const { refresh } = usePMC()
  const { tick } = usePMCData()
  const [rows, setRows] = useState<Row[]>([
    { raw_material_id: '', qty: '', is_primary: true },
  ])
  const [saving, setSaving] = useState(false)

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
          is_primary: m.is_primary,
        }))
      )
    }
  }, [id, tick])

  if (!product) {
    return <p className="text-muted">Product not found.</p>
  }

  function addRow() {
    setRows((r) => [...r, { raw_material_id: '', qty: '', is_primary: false }])
  }

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((r) => {
      let next = r.map((row, j) => (j === i ? { ...row, ...patch } : row))
      if (patch.is_primary === true) {
        next = next.map((row, j) => ({ ...row, is_primary: j === i }))
      }
      return next
    })
  }

  function removeRow(i: number) {
    setRows((r) => {
      const next = r.filter((_, j) => j !== i)
      if (next.length && !next.some((row) => row.is_primary)) {
        next[0].is_primary = true
      }
      return next.length ? next : [{ raw_material_id: '', qty: '', is_primary: true }]
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const parsed = rows
      .filter((r) => r.raw_material_id && Number(r.qty) > 0)
      .map((r) => ({
        raw_material_id: r.raw_material_id,
        qty: Number(r.qty),
        is_primary: r.is_primary,
      }))
    if (parsed.length === 0) {
      alert('Add at least one raw material with quantity.')
      return
    }
    if (parsed.filter((r) => r.is_primary).length !== 1) {
      alert('Select exactly one primary raw material (Yes).')
      return
    }
    setSaving(true)
    try {
      await pmcApi.setProductMaterials(id, parsed)
      refresh()
      alert('Recipe saved.')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not save recipe.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pmc-page max-w-3xl">
      <div>
        <Link href="/pmc/master/products" className="text-xs text-muted hover:text-primary">
          ← Products
        </Link>
        <h1 className="pmc-page-title mt-2">{product.name}</h1>
        <p className="text-sm text-muted">
          Recipe qty per batch. Mark one raw material as primary (used for Real Final Product).
        </p>
      </div>

      {materials.length === 0 ? (
        <p className="text-sm text-muted">
          Add raw materials first in{' '}
          <Link href="/pmc/master/raw-materials" className="text-pmc hover:underline">
            Raw materials
          </Link>
          .
        </p>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="pmc-card p-0 overflow-hidden">
            <div className="pmc-table-wrap mx-0 px-0">
              <table className="data-table w-full text-sm min-w-[32rem]">
                <thead>
                  <tr className="bg-layer border-b border-border text-left text-muted">
                    <th className="px-4 py-2">Raw material</th>
                    <th className="px-4 py-2">Qty</th>
                    <th className="px-4 py-2">Primary</th>
                    <th className="px-4 py-2 w-12" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={i}
                      className={clsx(
                        'border-b border-border/60',
                        row.is_primary && 'bg-pmc-10'
                      )}
                    >
                      <td className="px-4 py-2">
                        <select
                          value={row.raw_material_id}
                          onChange={(e) => updateRow(i, { raw_material_id: e.target.value })}
                          className="input w-full pmc-focus py-2"
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
                          className="input w-full pmc-focus py-2"
                          required
                        />
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={row.is_primary ? 'yes' : 'no'}
                          onChange={(e) =>
                            updateRow(i, { is_primary: e.target.value === 'yes' })
                          }
                          className="input w-full pmc-focus py-2 min-w-[5rem]"
                        >
                          <option value="no">No</option>
                          <option value="yes">Yes</option>
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => removeRow(i)}
                          className="text-muted hover:text-red-500 text-xs min-h-[44px] min-w-[44px]"
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
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={addRow} className="btn btn-ghost w-full sm:w-auto justify-center">
              + Add row
            </button>
            <button type="submit" disabled={saving} className="btn btn-pmc w-full sm:w-auto justify-center">
              {saving ? 'Saving…' : 'Save recipe'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}