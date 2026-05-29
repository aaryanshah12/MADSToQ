'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { usePMC, usePMCData } from '@/contexts/PMCContext'
import { batchTotalCost } from '@madstoq/pmc-system/lib/bom-pricing'
import type { PMCBatchStatus } from '@madstoq/pmc-system/types'

export default function PMCBatchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { refresh } = usePMC()
  const { api: pmcApi, tick } = usePMCData()
  const [saving, setSaving] = useState(false)

  const batch = useMemo(() => {
    void tick
    return pmcApi.getBatch(id)
  }, [id, tick])

  const lines = useMemo(() => {
    void tick
    return pmcApi.listBatchLines(id)
  }, [id, tick])

  const product = useMemo(() => {
    void tick
    return batch ? pmcApi.getProduct(batch.product_id) : undefined
  }, [batch, tick])

  const [editLines, setEditLines] = useState<typeof lines | null>(null)
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
            Unit price (per product):{' '}
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
              <button type="button" className="btn btn-ghost" onClick={() => setEditLines(null)}>Cancel</button>
              <button type="button" className="btn btn-pmc" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
            </>
          )}
        </div>

        <table className="data-table w-full text-sm">
          <thead>
            <tr><th>Code</th><th>Name</th><th>Type</th><th>Qty</th><th>Unit price</th><th>Line total</th></tr>
          </thead>
          <tbody>
            {displayLines.map((l, idx) => (
              <tr key={l.id ?? idx}>
                <td className="font-mono text-xs">{l.item_code}</td>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
