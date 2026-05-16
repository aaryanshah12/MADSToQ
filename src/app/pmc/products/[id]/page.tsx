'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { usePMC, usePMCData } from '@/contexts/PMCContext'
import { pmcApi } from '@/lib/pmc/api'
import { formatINR, formatQty } from '@/lib/pmc/pricing'

export default function PMCProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { refresh } = usePMC()
  const { tick } = usePMCData()
  const [expandedRef, setExpandedRef] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, { overhead: string; tons_kg: string; yield_value: string }>>({})

  const product = useMemo(() => {
    void tick
    return pmcApi.getProduct(id)
  }, [id, tick])

  const sheet = useMemo(() => {
    void tick
    return pmcApi.pricingSheetForProduct(id)
  }, [id, tick])

  if (!product) {
    return (
      <div className="max-w-4xl mx-auto">
        <p className="text-muted">Product not found.</p>
        <Link href="/pmc/products" className="text-sm mt-4 inline-block" style={{ color: 'var(--color-pmc)' }}>
          ← Back to products
        </Link>
      </div>
    )
  }

  function getDraft(referenceId: string) {
    const existing = draft[referenceId]
    if (existing) return existing
    const params = pmcApi.getProductParams(id, referenceId)
    return {
      overhead: params ? String(params.overhead) : '',
      tons_kg: params ? String(params.tons_kg) : '',
      yield_value: params ? String(params.yield_value) : '',
    }
  }

  function saveParams(referenceId: string) {
    const d = getDraft(referenceId)
    const overhead = Number(d.overhead) || 0
    const tons_kg = Number(d.tons_kg) || 0
    const yield_value = Number(d.yield_value) || 0
    if (yield_value <= 0) {
      alert('Yield value must be greater than zero.')
      return
    }
    pmcApi.upsertProductParams({
      product_id: id,
      reference_id: referenceId,
      overhead,
      tons_kg,
      yield_value,
    })
    refresh()
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <Link href="/pmc/products" className="text-xs text-muted hover:text-primary">
          ← Products
        </Link>
        <h1 className="text-2xl font-bold text-primary mt-2">{product.name}</h1>
        <p className="text-sm text-muted">Pricing sheet per reference (RMC = material total ÷ yield + overhead)</p>
      </div>

      {sheet.length === 0 ? (
        <p className="text-sm text-muted bg-panel border border-border rounded-xl p-6">
          Create a reference with raw-material prices first.
        </p>
      ) : (
        <div className="space-y-4">
          {sheet.map(({ reference, params, result }) => {
            const d = getDraft(reference.id)
            const open = expandedRef === reference.id
            return (
              <article key={reference.id} className="bg-panel border border-border rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedRef(open ? null : reference.id)}
                  className="w-full flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-left hover:bg-layer-sm"
                >
                  <div>
                    <span className="font-mono font-semibold">{reference.ref_number}</span>
                    <span className="text-xs text-muted ml-3">
                      {new Date(reference.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-right">
                    {result ? (
                      <span className="text-lg font-bold" style={{ color: 'var(--color-pmc)' }}>
                        RMC {formatINR(result.final_rmc)}
                      </span>
                    ) : (
                      <span className="text-sm text-muted">Enter yield to calculate</span>
                    )}
                  </div>
                </button>

                {open && (
                  <div className="px-5 pb-5 border-t border-border space-y-5">
                    <div className="grid sm:grid-cols-3 gap-4 pt-4">
                      <Field
                        label="Overhead"
                        value={d.overhead}
                        onChange={(v) =>
                          setDraft((prev) => ({
                            ...prev,
                            [reference.id]: { ...getDraft(reference.id), overhead: v },
                          }))
                        }
                      />
                      <Field
                        label="Tons / Kgs required"
                        value={d.tons_kg}
                        onChange={(v) =>
                          setDraft((prev) => ({
                            ...prev,
                            [reference.id]: { ...getDraft(reference.id), tons_kg: v },
                          }))
                        }
                      />
                      <Field
                        label="Yield value"
                        value={d.yield_value}
                        onChange={(v) =>
                          setDraft((prev) => ({
                            ...prev,
                            [reference.id]: { ...getDraft(reference.id), yield_value: v },
                          }))
                        }
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => saveParams(reference.id)}
                      className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                      style={{ background: 'var(--color-pmc)' }}
                    >
                      Save for this reference
                    </button>

                    {result && (
                      <>
                        <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
                          <thead>
                            <tr className="bg-layer text-muted text-left">
                              <th className="px-3 py-2">Raw material</th>
                              <th className="px-3 py-2 text-right">Qty</th>
                              <th className="px-3 py-2 text-right">Price</th>
                              <th className="px-3 py-2 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.lines.map((line) => (
                              <tr key={line.raw_material_id} className="border-t border-border">
                                <td className="px-3 py-2">{line.raw_material_name}</td>
                                <td className="px-3 py-2 text-right font-mono">{formatQty(line.qty)}</td>
                                <td className="px-3 py-2 text-right font-mono">{formatINR(line.price)}</td>
                                <td className="px-3 py-2 text-right font-mono font-medium">
                                  {formatINR(line.line_total)}
                                </td>
                              </tr>
                            ))}
                            <tr className="border-t-2 border-border font-semibold bg-layer-sm">
                              <td colSpan={3} className="px-3 py-2 text-right">
                                Material total
                              </td>
                              <td className="px-3 py-2 text-right font-mono">
                                {formatINR(result.material_total)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <div className="grid sm:grid-cols-2 gap-3 text-sm">
                          <SummaryRow label="Material total" value={formatINR(result.material_total)} />
                          <SummaryRow label="Yield (divisor)" value={formatQty(result.yield_value)} />
                          <SummaryRow label="Unit before overhead" value={formatINR(result.unit_before_overhead)} />
                          <SummaryRow label="Overhead" value={formatINR(result.overhead)} />
                          <SummaryRow
                            label="Final RMC"
                            value={formatINR(result.final_rmc)}
                            highlight
                          />
                          {result.tons_kg > 0 && (
                            <SummaryRow
                              label="Tons / Kgs (recorded)"
                              value={formatQty(result.tons_kg)}
                            />
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-xs text-muted mb-1">{label}</label>
      <input
        type="number"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-border bg-layer text-sm"
      />
    </div>
  )
}

function SummaryRow({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={`flex justify-between px-3 py-2 rounded-lg border border-border ${highlight ? 'bg-layer font-semibold' : 'bg-layer-sm'}`}
    >
      <span className="text-muted">{label}</span>
      <span className="font-mono" style={highlight ? { color: 'var(--color-pmc)' } : undefined}>
        {value}
      </span>
    </div>
  )
}
