'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { ArrowLeft, Plus, Trash2, X } from 'lucide-react'
import { usePMC, usePMCData } from '@/contexts/PMCContext'
import { batchTotalCost } from '@madstoq/pmc-system/lib/bom-pricing'
import type { PMCBatchLine, PMCRawMaterial, PMCBatchStatus } from '@madstoq/pmc-system/types'

function newEmptyBatchLine(batchId: string, sortOrder: number): PMCBatchLine {
  return {
    id: `temp-${Date.now()}-${sortOrder}`,
    batch_id: batchId,
    raw_material_id: null,
    item_code: '',
    item_name: '',
    item_type: 'material',
    qty: 1,
    unit_price: 0,
    is_primary: false,
    sort_order: sortOrder,
  }
}

export default function PMCBatchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { refresh } = usePMC()
  const { api: pmcApi, tick } = usePMCData()
  const [saving, setSaving] = useState(false)

  const batch = useMemo(() => {
    void tick
    return pmcApi.getBatch(id)
  }, [id, tick, pmcApi])

  const lines = useMemo(() => {
    void tick
    return pmcApi.listBatchLines(id)
  }, [id, tick, pmcApi])

  const product = useMemo(() => {
    void tick
    return batch ? pmcApi.getProduct(batch.product_id) : undefined
  }, [batch, tick, pmcApi])

  const procurement = useMemo(() => {
    void tick
    return pmcApi.listRawMaterials().filter((m) => m.is_active)
  }, [tick, pmcApi])

  const [editLines, setEditLines] = useState<PMCBatchLine[] | null>(null)
  const [batchSize, setBatchSize] = useState('')
  const [status, setStatus] = useState<PMCBatchStatus>('draft')

  if (!batch) {
    return (
      <div className="pmc-page">
        <p className="text-muted">Batch not found.</p>
        <Link href="/pmc/batches" className="text-pmc text-sm">Back</Link>
      </div>
    )
  }

  async function save() {
    if (!editLines || !batch) return
    if (batch.status === 'completed') {
      alert('Completed batches cannot be edited.')
      setEditLines(null)
      return
    }

    const invalid = editLines.some((l) => !l.raw_material_id || !Number.isFinite(l.qty) || l.qty <= 0)
    if (invalid) {
      alert('Please select an item and enter a valid Qty for every BOM line.')
      return
    }

    setSaving(true)
    try {
      await pmcApi.updateBatch(id, {
        status,
        batch_size: Number(batchSize) || batch.batch_size,
        lines: editLines.map((l) => ({
          item_code: l.item_code,
          item_name: l.item_name,
          item_type: l.item_type,
          qty: l.qty,
          unit_price: l.unit_price,
          is_primary: l.is_primary,
          raw_material_id: l.raw_material_id,
        })),
      })
      setEditLines(null)
      refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!batch || !confirm(`Delete batch ${batch.batch_code}?`)) return
    try {
      await pmcApi.deleteBatch(id)
      refresh()
      router.push('/pmc/batches')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not delete.')
    }
  }

  const displayLines = editLines ?? lines
  const bomLocked = batch.status === 'completed'
  const sizeForTotals = Number(editLines ? batchSize : batch.batch_size) || 1
  const totalBatchCost = batchTotalCost(
    displayLines.map((l) => ({ qty: l.qty, unit_price: l.unit_price })),
    sizeForTotals
  )

  return (
    <div className="pmc-page space-y-6">
      <Link href="/pmc/batches" className="inline-flex items-center gap-1 text-sm text-pmc hover:underline">
        <ArrowLeft size={14} /> Batches
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="pmc-page-title font-mono">{batch.batch_code}</h1>
          <p className="text-sm text-muted">{product?.name} ({product?.code})</p>
          <p className="text-sm mt-1">
            Total batch cost:{' '}
            <strong>₹{totalBatchCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
            <span className="text-muted"> · Batch size {sizeForTotals}</span>
          </p>
          <p className="text-sm mt-1">
            Unit Price (RMC):{' '}
            <strong>
              ₹
              {(editLines
                ? totalBatchCost / sizeForTotals
                : batch.unit_price
              ).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </strong>
          </p>
        </div>
        <button type="button" onClick={remove} className="btn btn-ghost text-red-400"><Trash2 size={14} /> Delete</button>
      </div>

      <div className="pmc-card space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-muted">Status</label>
            <select
              value={editLines ? status : batch.status}
              disabled={!editLines}
              onChange={(e) => setStatus(e.target.value as PMCBatchStatus)}
              className="input pmc-focus block mt-1"
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted">Batch size</label>
            <input
              type="number"
              step="0.01"
              disabled={!editLines}
              value={editLines ? batchSize : batch.batch_size}
              onChange={(e) => setBatchSize(e.target.value)}
              className="input pmc-focus block mt-1 w-32"
            />
          </div>
          {bomLocked && (
            <p className="text-xs text-muted w-full sm:w-auto">
              BOM is locked — this batch is completed.
            </p>
          )}
          {!editLines ? (
            !bomLocked && (
              <button
                type="button"
                className="btn btn-pmc"
                onClick={() => {
                  setEditLines([...lines])
                  setBatchSize(String(batch.batch_size))
                  setStatus(batch.status)
                }}
              >
                Edit BOM
              </button>
            )
          ) : (
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setEditLines((rows) => [
                    ...(rows ?? []),
                    newEmptyBatchLine(id, (rows ?? []).length),
                  ])
                }}
              >
                <Plus size={14} /> Add item
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setEditLines(null)}>Cancel</button>
              <button type="button" className="btn btn-pmc" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
            </>
          )}
        </div>

        <table className="data-table w-full text-sm">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Type</th>
              <th>Qty</th>
              <th>Unit price</th>
              <th>Line total</th>
              {editLines && <th />}
            </tr>
          </thead>
          <tbody>
            {displayLines.map((l, idx) => (
              <tr key={l.id ?? idx}>
                <td className="font-mono text-xs">
                  {editLines ? (
                    <select
                      className="input pmc-focus py-1 text-sm w-48"
                      value={l.raw_material_id ?? ''}
                      onChange={(e) => {
                        const id = e.target.value
                        const picked = procurement.find((m: PMCRawMaterial) => m.id === id)
                        setEditLines((rows) =>
                          rows!.map((r, i) =>
                            i === idx
                              ? {
                                  ...r,
                                  raw_material_id: id || null,
                                  item_code: picked?.code ?? '',
                                  item_name: picked?.name ?? '',
                                  item_type: picked?.item_type ?? 'material',
                                  unit_price: picked?.price ?? 0,
                                }
                              : r
                          )
                        )
                      }}
                    >
                      <option value="">Select item…</option>
                      {procurement.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.code} — {m.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    l.item_code
                  )}
                </td>
                <td>{l.item_name}</td>
                <td className="capitalize">{l.item_type}</td>
                <td>
                  {editLines ? (
                    <input
                      type="number"
                      step="0.0001"
                      className="input w-20 py-1 pmc-focus"
                      value={l.qty}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setEditLines((rows) => rows!.map((r, i) => (i === idx ? { ...r, qty: v } : r)))
                      }}
                    />
                  ) : l.qty}
                </td>
                <td>
                  {editLines ? (
                    <input
                      type="number"
                      step="0.01"
                      className="input w-24 py-1 pmc-focus"
                      value={l.unit_price}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setEditLines((rows) => rows!.map((r, i) => (i === idx ? { ...r, unit_price: v } : r)))
                      }}
                    />
                  ) : `₹${l.unit_price}`}
                </td>
                <td>
                  ₹{(l.qty * (Number(editLines ? batchSize : batch.batch_size) || 1) * l.unit_price).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </td>
                {editLines && (
                  <td className="text-right">
                    <button
                      type="button"
                      className="text-muted hover:text-red-400"
                      onClick={() => setEditLines((rows) => rows!.filter((_, i) => i !== idx))}
                      aria-label="Remove line"
                    >
                      <X size={14} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
