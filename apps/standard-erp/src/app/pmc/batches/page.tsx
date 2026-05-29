'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState, Suspense } from 'react'
import { Plus } from 'lucide-react'
import { usePMC, usePMCData } from '@/contexts/PMCContext'
import type { PmcApi } from '@madstoq/pmc-system/api'
import type { PMCBatchStatus } from '@madstoq/pmc-system/types'
import { PmcSimpleModal } from '@/components/pmc/PmcSimpleModal'

function BatchesContent() {
  const router = useRouter()
  const search = useSearchParams()
  const preProduct = search.get('product') ?? ''
  const { refresh } = usePMC()
  const { api: pmcApi, tick } = usePMCData()
  const [showAdd, setShowAdd] = useState(false)
  const [productId, setProductId] = useState(preProduct)
  const [batchSize, setBatchSize] = useState('1')
  const [status, setStatus] = useState<PMCBatchStatus>('draft')
  const [lines, setLines] = useState<ReturnType<PmcApi['buildBatchLinesFromProduct']>>([])
  const [saving, setSaving] = useState(false)

  const batches = useMemo(() => {
    void tick
    return pmcApi.listBatches()
  }, [tick])

  const products = useMemo(() => {
    void tick
    return pmcApi.listProducts()
  }, [tick])

  const productName = (pid: string) => {
    const p = products.find((x) => x.id === pid)
    return p ? `${p.code ? `${p.code} — ` : ''}${p.name}` : '—'
  }

  function loadBomFromProduct(pid: string, size: string) {
    setLines(pmcApi.buildBatchLinesFromProduct(pid, Number(size) || 1))
  }

  async function createBatch(e: React.FormEvent) {
    e.preventDefault()
    if (!productId || saving) return
    const size = Number(batchSize) || 1
    setSaving(true)
    try {
      const created = await pmcApi.createBatch({
        product_id: productId,
        batch_size: size,
        status,
        lines: lines.map((l) => ({
          raw_material_id: l.raw_material_id,
          item_code: l.item_code,
          item_name: l.item_name,
          item_type: l.item_type,
          qty: l.qty,
          unit_price: l.unit_price,
          is_primary: l.is_primary,
        })),
      })
      setShowAdd(false)
      refresh()
      router.push(`/pmc/batches/${created.id}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not create batch.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pmc-page space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="pmc-page-title">Batches</h1>
          <p className="text-sm text-muted mt-1">BOM per batch size with frozen unit prices.</p>
        </div>
        <button type="button" onClick={() => { setShowAdd(true); if (preProduct) loadBomFromProduct(preProduct, batchSize) }} className="btn btn-pmc">
          <Plus size={14} /> Add batch
        </button>
      </div>

      <div className="pmc-card overflow-x-auto p-0">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>Batch ID</th>
              <th>Status</th>
              <th>Product</th>
              <th>Batch size</th>
              <th>Unit price</th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 ? (
              <tr><td colSpan={5} className="py-10 text-center text-muted text-sm">No batches yet.</td></tr>
            ) : (
              batches.map((b) => (
                <tr key={b.id} className="cursor-pointer hover:bg-layer-sm" onClick={() => router.push(`/pmc/batches/${b.id}`)}>
                  <td className="font-mono text-pmc">{b.batch_code}</td>
                  <td className="capitalize text-sm">{b.status}</td>
                  <td className="text-sm">{productName(b.product_id)}</td>
                  <td>{b.batch_size}</td>
                  <td>₹{b.unit_price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <PmcSimpleModal
          title="Add batch"
          wide
          onClose={() => setShowAdd(false)}
          footer={
            <>
              <button type="button" onClick={() => setShowAdd(false)} className="btn btn-ghost">Cancel</button>
              <button type="submit" form="batch-add" disabled={saving} className="btn btn-pmc">{saving ? 'Saving…' : 'Create'}</button>
            </>
          }
        >
          <form id="batch-add" onSubmit={createBatch} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted mb-1">Product *</label>
                <select
                  value={productId}
                  onChange={(e) => {
                    setProductId(e.target.value)
                    loadBomFromProduct(e.target.value, batchSize)
                  }}
                  className="input w-full pmc-focus"
                  required
                >
                  <option value="">Select product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Batch size *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={batchSize}
                  onChange={(e) => {
                    setBatchSize(e.target.value)
                    if (productId) loadBomFromProduct(productId, e.target.value)
                  }}
                  className="input w-full pmc-focus"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as PMCBatchStatus)} className="input w-full pmc-focus">
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
            <p className="text-xs text-muted">Edit lines below — prices are snapshotted and won&apos;t change when procurement prices update.</p>
            <div className="max-h-56 overflow-y-auto space-y-2">
              {lines.map((l, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 text-sm items-center border border-border rounded p-2">
                  <span className="col-span-4 truncate">{l.item_code} {l.item_name}</span>
                  <input
                    type="number"
                    step="0.0001"
                    className="input col-span-2 pmc-focus py-1"
                    value={l.qty}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setLines((rows) => rows.map((r, i) => (i === idx ? { ...r, qty: v } : r)))
                    }}
                  />
                  <input
                    type="number"
                    step="0.01"
                    className="input col-span-2 pmc-focus py-1"
                    value={l.unit_price}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setLines((rows) => rows.map((r, i) => (i === idx ? { ...r, unit_price: v } : r)))
                    }}
                  />
                  <span className="col-span-3 text-right text-muted">
                    ₹{(l.qty * (Number(batchSize) || 1) * l.unit_price).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </form>
        </PmcSimpleModal>
      )}
    </div>
  )
}

export default function PMCBatchesPage() {
  return (
    <Suspense fallback={<div className="pmc-page p-6 text-muted">Loading…</div>}>
      <BatchesContent />
    </Suspense>
  )
}
