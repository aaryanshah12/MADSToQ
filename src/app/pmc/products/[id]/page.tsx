'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Download } from 'lucide-react'
import { usePMC, usePMCData } from '@/contexts/PMCContext'
import { pmcApi } from '@/lib/pmc/api'
import {
  exportPricingSheetToXlsx,
  exportProductPricingSheetsToXlsx,
} from '@/lib/pmc/exportSheet'
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

  const exportableSheets = useMemo(
    () =>
      sheet
        .filter((row): row is typeof row & { result: NonNullable<typeof row.result> } => !!row.result)
        .map(({ reference, result }) => ({ reference, result })),
    [sheet]
  )

  const [exporting, setExporting] = useState<string | null>(null)

  async function handleExportOne(referenceId: string) {
    if (!product) return
    const row = sheet.find((s) => s.reference.id === referenceId)
    if (!row?.result) return
    setExporting(referenceId)
    try {
      await exportPricingSheetToXlsx({
        product,
        reference: row.reference,
        result: row.result,
      })
    } finally {
      setExporting(null)
    }
  }

  async function handleExportAll() {
    if (!product || !exportableSheets.length) return
    setExporting('all')
    try {
      await exportProductPricingSheetsToXlsx(product, exportableSheets)
    } finally {
      setExporting(null)
    }
  }

  if (!product) {
    return (
      <div className="pmc-page">
        <p className="text-muted">Product not found.</p>
        <Link href="/pmc/products" className="text-sm mt-4 inline-block text-pmc hover:underline">
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
    <div className="pmc-page">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <Link href="/pmc/products" className="text-xs text-muted hover:text-primary">
            ← Products
          </Link>
          <h1 className="pmc-page-title mt-2 break-words">{product.name}</h1>
          <p className="text-sm text-muted">
            Pricing sheet per reference (RMC = material total ÷ (yield × 10000) + overhead)
          </p>
        </div>
        {exportableSheets.length > 0 && (
          <button
            type="button"
            onClick={handleExportAll}
            disabled={exporting !== null}
            className="btn btn-ghost w-full sm:w-auto justify-center shrink-0"
          >
            <Download size={16} />
            {exporting === 'all' ? 'Exporting…' : `Export all (${exportableSheets.length})`}
          </button>
        )}
      </div>

      {sheet.length === 0 ? (
        <p className="text-sm text-muted pmc-card">
          Create a reference with raw-material prices first.
        </p>
      ) : (
        <div className="space-y-4">
          {sheet.map(({ reference, params, result }) => {
            const d = getDraft(reference.id)
            const open = expandedRef === reference.id
            return (
              <article key={reference.id} className="pmc-card p-0 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedRef(open ? null : reference.id)}
                  className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 sm:px-5 py-4 text-left hover:bg-layer-sm min-h-[44px]"
                >
                  <div className="min-w-0">
                    <span className="font-mono font-semibold break-all">{reference.ref_number}</span>
                    <span className="text-xs text-muted sm:ml-3 block sm:inline mt-0.5 sm:mt-0">
                      {new Date(reference.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    {result ? (
                      <span className="text-lg font-bold text-pmc">
                        RMC {formatINR(result.final_rmc)}
                      </span>
                    ) : (
                      <span className="text-sm text-muted">Enter yield to calculate</span>
                    )}
                  </div>
                </button>

                {open && (
                  <div className="px-4 sm:px-5 pb-5 border-t border-border space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
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
                        label="Yield value (×10000 for divisor)"
                        value={d.yield_value}
                        onChange={(v) =>
                          setDraft((prev) => ({
                            ...prev,
                            [reference.id]: { ...getDraft(reference.id), yield_value: v },
                          }))
                        }
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => saveParams(reference.id)}
                        className="btn btn-pmc w-full sm:w-auto justify-center"
                      >
                        Save for this reference
                      </button>
                      {result && (
                        <button
                          type="button"
                          onClick={() => handleExportOne(reference.id)}
                          disabled={exporting !== null}
                          className="btn btn-ghost w-full sm:w-auto justify-center"
                        >
                          <Download size={16} />
                          {exporting === reference.id ? 'Exporting…' : 'Export sheet'}
                        </button>
                      )}
                    </div>

                    {result && (
                      <>
                        <div className="pmc-table-wrap mx-0 px-0">
                        <table className="data-table w-full text-sm border border-border rounded-lg overflow-hidden">
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
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <SummaryRow label="Material total" value={formatINR(result.material_total)} />
                          <SummaryRow label="Yield (entered)" value={formatQty(result.yield_value)} />
                          <SummaryRow label="Yield divisor (×10000)" value={formatQty(result.yield_divisor)} />
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
        className="input w-full pmc-focus"
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
      <span className={clsx('font-mono', highlight && 'text-pmc')}>
        {value}
      </span>
    </div>
  )
}
