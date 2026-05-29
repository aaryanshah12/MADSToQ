'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { usePMC, usePMCData } from '@/contexts/PMCContext'
import type { PMCRawMaterial } from '@madstoq/pmc-system/types'

export default function PMCProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { refresh } = usePMC()
  const { api: pmcApi, tick } = usePMCData()
  const [saving, setSaving] = useState(false)

  const product = useMemo(() => {
    void tick
    return pmcApi.getProduct(id)
  }, [id, tick])

  const bom = useMemo(() => {
    void tick
    return pmcApi.getProductRecipeLines(id)
  }, [id, tick])

  const batches = useMemo(() => {
    void tick
    return pmcApi.listBatches(id)
  }, [id, tick])

  const procurement = useMemo(() => {
    void tick
    return pmcApi.listRawMaterials()
  }, [tick])

  const [bomEdit, setBomEdit] = useState<{ raw_material_id: string; qty: string; is_primary: boolean }[]>([])

  if (!product) {
    return (
      <div className="pmc-page">
        <p className="text-muted">Product not found.</p>
        <Link href="/pmc/products" className="text-pmc text-sm mt-2 inline-block">Back to products</Link>
      </div>
    )
  }

  const maxBatchPrice = Math.max(...batches.map((b) => b.unit_price), product.unit_price, 1)

  async function saveBom() {
    const valid = bomEdit.filter((r) => r.raw_material_id && Number(r.qty) > 0)
    if (valid.filter((r) => r.is_primary).length !== 1) {
      alert('Exactly one primary line required.')
      return
    }
    setSaving(true)
    try {
      await pmcApi.setProductMaterials(
        id,
        valid.map((r) => ({
          raw_material_id: r.raw_material_id,
          qty: Number(r.qty),
          is_primary: r.is_primary,
        }))
      )
      refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not save BOM.')
    } finally {
      setSaving(false)
    }
  }

  function startEditBom() {
    setBomEdit(
      bom.length
        ? bom.map((l) => ({
            raw_material_id: l.raw_material_id,
            qty: String(l.qty),
            is_primary: l.is_primary,
          }))
        : [{ raw_material_id: '', qty: '1', is_primary: true }]
    )
  }

  return (
    <div className="pmc-page space-y-6">
      <Link href="/pmc/products" className="inline-flex items-center gap-1 text-sm text-pmc hover:underline">
        <ArrowLeft size={14} /> Products
      </Link>

      <div>
        <h1 className="pmc-page-title">{product.name}</h1>
        <p className="text-sm text-muted font-mono">{product.code}</p>
        <p className="text-sm mt-2">
          Template unit price:{' '}
          <strong>₹{product.unit_price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
        </p>
      </div>

      <section className="pmc-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Bill of materials</h2>
          {bomEdit.length === 0 ? (
            <button type="button" onClick={startEditBom} className="btn btn-ghost text-sm">Edit BOM</button>
          ) : (
            <div className="flex gap-2">
              <button type="button" onClick={() => setBomEdit([])} className="btn btn-ghost text-sm">Cancel</button>
              <button type="button" onClick={saveBom} disabled={saving} className="btn btn-pmc text-sm">{saving ? 'Saving…' : 'Save BOM'}</button>
            </div>
          )}
        </div>
        {bomEdit.length > 0 ? (
          <div className="space-y-2">
            {bomEdit.map((row, idx) => (
              <div key={idx} className="flex flex-wrap gap-2 items-center">
                <select
                  value={row.raw_material_id}
                  onChange={(e) => {
                    const v = e.target.value
                    setBomEdit((rows) => rows.map((r, i) => (i === idx ? { ...r, raw_material_id: v } : r)))
                  }}
                  className="input flex-1 pmc-focus text-sm"
                >
                  <option value="">Select</option>
                  {procurement.map((m: PMCRawMaterial) => (
                    <option key={m.id} value={m.id}>{m.code} — {m.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.0001"
                  value={row.qty}
                  onChange={(e) => {
                    const v = e.target.value
                    setBomEdit((rows) => rows.map((r, i) => (i === idx ? { ...r, qty: v } : r)))
                  }}
                  className="input w-24 pmc-focus text-sm"
                />
                <label className="text-xs flex items-center gap-1">
                  <input
                    type="radio"
                    checked={row.is_primary}
                    onChange={() => setBomEdit((rows) => rows.map((r, i) => ({ ...r, is_primary: i === idx })))}
                  />
                  Primary
                </label>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setBomEdit((r) => [...r, { raw_material_id: '', qty: '1', is_primary: false }])}
              className="text-xs text-pmc hover:underline"
            >
              + Add line
            </button>
          </div>
        ) : (
          <table className="data-table w-full text-sm">
            <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Line</th></tr></thead>
            <tbody>
              {bom.map((l) => (
                <tr key={l.raw_material_id}>
                  <td>{l.item_code} — {l.raw_material_name}</td>
                  <td>{l.qty}</td>
                  <td>₹{l.unit_price}</td>
                  <td>₹{l.line_total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="pmc-card">
        <h2 className="font-semibold mb-4">Unit price across batches</h2>
        {batches.length === 0 && product.unit_price <= 0 ? (
          <p className="text-sm text-muted">No batches yet.</p>
        ) : (
          <div className="flex items-end gap-2 h-40 border-b border-border pb-2">
            <div className="flex flex-col items-center flex-1 min-w-[48px]" title="Template (current BOM)">
              <div
                className="w-full max-w-[48px] bg-pmc/80 rounded-t"
                style={{ height: `${Math.max(8, (product.unit_price / maxBatchPrice) * 100)}%` }}
              />
              <span className="text-[10px] text-muted mt-1 text-center">Template</span>
              <span className="text-[10px] font-mono">₹{product.unit_price.toFixed(0)}</span>
            </div>
            {batches.map((b) => (
              <div key={b.id} className="flex flex-col items-center flex-1 min-w-[48px]" title={b.batch_code}>
                <div
                  className="w-full max-w-[48px] bg-inputer/70 rounded-t"
                  style={{ height: `${Math.max(8, (b.unit_price / maxBatchPrice) * 100)}%` }}
                />
                <span className="text-[10px] text-muted mt-1 truncate max-w-full">{b.batch_code}</span>
                <span className="text-[10px] font-mono">₹{b.unit_price.toFixed(0)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="pmc-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Recent batches</h2>
          <Link href={`/pmc/batches?product=${id}`} className="text-xs text-pmc hover:underline">View all</Link>
        </div>
        {batches.length === 0 ? (
          <p className="text-sm text-muted">No batches for this product.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {batches.slice(0, 8).map((b) => (
              <li key={b.id} className="flex justify-between border-b border-border pb-2">
                <Link href={`/pmc/batches/${b.id}`} className="font-mono text-pmc hover:underline">{b.batch_code}</Link>
                <span className="capitalize text-muted">{b.status}</span>
                <span>₹{b.unit_price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
