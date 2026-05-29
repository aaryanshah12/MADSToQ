'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { usePMC, usePMCData } from '@/contexts/PMCContext'
import type { PMCBatch, PMCRawMaterial } from '@madstoq/pmc-system/types'

type ChartPoint = {
  label: string
  unitPrice: number
  kind: 'template' | 'batch'
}

function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

function batchTotalEstimate(b: PMCBatch) {
  return b.unit_price * (b.batch_size > 0 ? b.batch_size : 1)
}

function statusBadgeClass(status: PMCBatch['status']) {
  switch (status) {
    case 'completed':
      return 'bg-pmc-10 text-pmc border-pmc-30'
    case 'active':
      return 'bg-layer-sm text-primary border-border'
    case 'cancelled':
      return 'bg-red-500/10 text-red-400 border-red-500/30'
    default:
      return 'bg-layer-sm text-muted border-border'
  }
}

export default function PMCProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { refresh } = usePMC()
  const { api: pmcApi, tick } = usePMCData()
  const [saving, setSaving] = useState(false)

  const product = useMemo(() => {
    void tick
    return pmcApi.getProduct(id)
  }, [id, tick, pmcApi])

  const bom = useMemo(() => {
    void tick
    return pmcApi.getProductRecipeLines(id)
  }, [id, tick, pmcApi])

  const batches = useMemo(() => {
    void tick
    return pmcApi.listBatches(id)
  }, [id, tick, pmcApi])

  const procurement = useMemo(() => {
    void tick
    return pmcApi.listRawMaterials()
  }, [tick, pmcApi])

  const [bomEdit, setBomEdit] = useState<{ raw_material_id: string; qty: string }[]>([])

  const bomSlotCount = useMemo(() => {
    if (bomEdit.length > 0) return bomEdit.length
    if (bom.length === 0) return 1
    return bom.length
  }, [bomEdit.length, bom.length])

  const visibleBatches = useMemo(
    () => batches.slice(0, bomSlotCount),
    [batches, bomSlotCount]
  )

  const emptyBatchSlots = Math.max(0, bomSlotCount - visibleBatches.length)

  const chartData = useMemo((): ChartPoint[] => {
    if (!product) return []
    const points: ChartPoint[] = [
      { label: 'Template', unitPrice: product.unit_price, kind: 'template' },
    ]
    for (const b of [...batches].reverse()) {
      points.push({ label: b.batch_code, unitPrice: b.unit_price, kind: 'batch' })
    }
    return points
  }, [product, batches])

  if (!product) {
    return (
      <div className="pmc-page">
        <p className="text-muted">Product not found.</p>
        <Link href="/pmc/products" className="text-pmc text-sm mt-2 inline-block">
          Back to products
        </Link>
      </div>
    )
  }

  async function saveBom() {
    const valid = bomEdit.filter((r) => r.raw_material_id && Number(r.qty) > 0)
    setSaving(true)
    try {
      await pmcApi.setProductMaterials(
        id,
        valid.map((r) => ({
          raw_material_id: r.raw_material_id,
          qty: Number(r.qty),
        }))
      )
      setBomEdit([])
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
          }))
        : [{ raw_material_id: '', qty: '1' }]
    )
  }

  return (
    <div className="pmc-page space-y-6">
      <Link
        href="/pmc/products"
        className="inline-flex items-center gap-1 text-sm text-pmc hover:underline"
      >
        <ArrowLeft size={14} /> Products
      </Link>

      <div>
        <h1 className="pmc-page-title">{product.name}</h1>
        <p className="text-sm text-muted font-mono">{product.code}</p>
        <p className="text-sm mt-2">
          Template unit price: <strong>{formatInr(product.unit_price)}</strong>
          <span className="text-muted"> (current BOM, per product unit)</span>
        </p>
      </div>

      {/* BOM (left) + Recent batches (right) — matched height by row count */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        <section className="pmc-card flex flex-col min-h-0">
          <div className="flex items-center justify-between gap-2 mb-4 shrink-0">
            <h2 className="font-semibold">Bill of materials</h2>
            {bomEdit.length === 0 ? (
              <button type="button" onClick={startEditBom} className="btn btn-ghost text-sm shrink-0">
                Edit BOM
              </button>
            ) : (
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={() => setBomEdit([])} className="btn btn-ghost text-sm">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveBom}
                  disabled={saving}
                  className="btn btn-pmc text-sm"
                >
                  {saving ? 'Saving…' : 'Save BOM'}
                </button>
              </div>
            )}
          </div>
          <div className="flex-1 min-h-0">
            {bomEdit.length > 0 ? (
              <div className="space-y-2 h-full flex flex-col">
                <div className="flex-1 space-y-2 min-h-0">
                  {bomEdit.map((row, idx) => (
                    <div
                      key={idx}
                      className="flex flex-wrap gap-2 items-center min-h-[44px] py-1 border-b border-border/60 last:border-0"
                    >
                      <select
                        value={row.raw_material_id}
                        onChange={(e) => {
                          const v = e.target.value
                          setBomEdit((rows) =>
                            rows.map((r, i) => (i === idx ? { ...r, raw_material_id: v } : r))
                          )
                        }}
                        className="input flex-1 min-w-0 pmc-focus text-sm"
                      >
                        <option value="">Select</option>
                        {procurement.map((m: PMCRawMaterial) => (
                          <option key={m.id} value={m.id}>
                            {m.code} — {m.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="0.0001"
                        value={row.qty}
                        onChange={(e) => {
                          const v = e.target.value
                          setBomEdit((rows) =>
                            rows.map((r, i) => (i === idx ? { ...r, qty: v } : r))
                          )
                        }}
                        className="input w-24 pmc-focus text-sm shrink-0"
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setBomEdit((r) => [...r, { raw_material_id: '', qty: '1' }])}
                  className="text-xs text-pmc hover:underline shrink-0 pt-1"
                >
                  + Add line
                </button>
              </div>
            ) : (
              <table className="data-table w-full text-sm">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Rate</th>
                    <th>Line</th>
                  </tr>
                </thead>
                <tbody>
                  {bom.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-muted">
                        No materials in recipe yet.
                      </td>
                    </tr>
                  ) : (
                    bom.map((l) => (
                      <tr key={l.raw_material_id}>
                        <td>
                          {l.item_code} — {l.raw_material_name}
                        </td>
                        <td>{l.qty}</td>
                        <td>₹{l.unit_price}</td>
                        <td>₹{l.line_total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="flex flex-col min-h-0">
          <div className="flex items-center justify-between gap-2 mb-4 shrink-0">
            <h2 className="font-semibold text-primary">Recent batches</h2>
            {batches.length > 0 && (
              <Link
                href={`/pmc/batches?product=${id}`}
                className="inline-flex items-center gap-0.5 text-sm font-medium text-pmc hover:underline shrink-0"
              >
                See more
                <ChevronRight size={14} />
              </Link>
            )}
          </div>
          <div className="pmc-card flex-1 flex flex-col min-h-0">
            {batches.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-8">
                <p className="text-sm text-muted">No batches for this product yet.</p>
                <Link
                  href={`/pmc/batches?product=${id}`}
                  className="text-sm text-pmc hover:underline mt-2"
                >
                  Create a batch
                </Link>
              </div>
            ) : (
              <div className="flex flex-col flex-1 gap-2 min-h-0">
                {visibleBatches.map((b) => (
                  <Link
                    key={b.id}
                    href={`/pmc/batches/${b.id}`}
                    className="flex-1 min-h-[44px] flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-layer-sm/50 hover:border-pmc-40 hover:bg-pmc-10 transition-colors"
                  >
                    <span className="font-mono text-sm font-semibold text-pmc shrink-0">
                      {b.batch_code}
                    </span>
                    <span
                      className={`text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border shrink-0 ${statusBadgeClass(b.status)}`}
                    >
                      {b.status}
                    </span>
                    <span className="text-xs text-muted shrink-0">×{b.batch_size}</span>
                    <span className="text-sm ml-auto text-right shrink-0">
                      <span className="text-muted text-xs">/ unit </span>
                      <strong>{formatInr(b.unit_price)}</strong>
                      <span className="text-muted text-xs block sm:inline sm:ml-2">
                        · {formatInr(batchTotalEstimate(b))} total
                      </span>
                    </span>
                  </Link>
                ))}
                {Array.from({ length: emptyBatchSlots }, (_, i) => (
                  <div
                    key={`batch-slot-${i}`}
                    className="flex-1 min-h-[44px] rounded-lg border border-dashed border-border bg-layer-sm/30"
                    aria-hidden
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="pmc-card">
        <h2 className="font-semibold mb-1">Unit price per product</h2>
        <p className="text-xs text-muted mb-4">
          Template (live BOM) vs frozen unit price from each batch (total batch cost ÷ batch size).
        </p>
        {chartData.length <= 1 && batches.length === 0 ? (
          <p className="text-sm text-muted">Add a batch to compare pricing over time.</p>
        ) : (
          <>
            <div className="w-full h-[260px] min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
                    axisLine={{ stroke: 'var(--color-border)' }}
                    tickLine={false}
                    interval={0}
                    angle={chartData.length > 4 ? -25 : 0}
                    textAnchor={chartData.length > 4 ? 'end' : 'middle'}
                    height={chartData.length > 4 ? 56 : 32}
                  />
                  <YAxis
                    tick={{ fill: 'var(--color-muted)', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                    width={56}
                  />
                  <Tooltip
                    cursor={{ fill: 'color-mix(in srgb, var(--color-pmc) 8%, transparent)' }}
                    contentStyle={{
                      background: 'var(--color-panel)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: 'var(--color-text)', fontWeight: 600 }}
                    formatter={(value) => [formatInr(Number(value)), 'Per unit']}
                  />
                  <Bar dataKey="unitPrice" name="Per unit" radius={[6, 6, 0, 0]} maxBarSize={56}>
                    {chartData.map((entry) => (
                      <Cell
                        key={entry.label}
                        fill={entry.kind === 'template' ? '#0086b3' : '#00c2ff'}
                        fillOpacity={entry.kind === 'template' ? 0.9 : 0.75}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-4 mt-3 justify-center text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#0086b3]" /> Template
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#00c2ff] opacity-80" /> Batch
              </span>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
