'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useMemo, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { Download, ChevronDown, ChevronUp } from 'lucide-react'
import { usePMC, usePMCData } from '@/contexts/PMCContext'
import { pmcApi } from '@madstoq/pmc-system/api'
import {
  exportPricingSheetToXlsx,
  exportProductPricingSheetsToXlsx,
} from '@madstoq/pmc-system/lib/exportSheet'
import { formatINR, formatQty } from '@madstoq/pmc-system/lib/pricing'
import type { PMCPricingResult } from '@madstoq/pmc-system/types'

export default function PMCProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { refresh } = usePMC()
  const { tick } = usePMCData()
  const [expandedRef, setExpandedRef] = useState<string | null>(null)
  const [refDetailsOpen, setRefDetailsOpen] = useState<string | null>(null)
  const [draft, setDraft] = useState<
    Record<string, { overhead: string; batch_multiplier: string; yield_value: string }>
  >({})

  const product = useMemo(() => {
    void tick
    return pmcApi.getProduct(id)
  }, [id, tick])

  const sheet = useMemo(() => {
    void tick
    return pmcApi.pricingSheetForProduct(id)
  }, [id, tick])

  const latestRefId = useMemo(() => {
    void tick
    return pmcApi.getLatestReference()?.id ?? null
  }, [tick])

  const hasPrimary = useMemo(() => {
    void tick
    return Boolean(pmcApi.getPrimaryMaterial(id))
  }, [id, tick])

  const exportableSheets = useMemo(
    () =>
      sheet
        .filter((row): row is typeof row & { result: NonNullable<typeof row.result> } => !!row.result)
        .map(({ reference, result }) => ({ reference, result })),
    [sheet]
  )

  const [exporting, setExporting] = useState<string | null>(null)
  const [savingRef, setSavingRef] = useState<string | null>(null)

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
    const legacyTons = (params as { tons_kg?: number } | undefined)?.tons_kg
    return {
      overhead: params ? String(params.overhead) : '',
      batch_multiplier: params
        ? String(params.batch_multiplier || legacyTons || 1)
        : '1',
      yield_value: params ? String(params.yield_value) : '',
    }
  }

  async function saveParams(referenceId: string) {
    const d = getDraft(referenceId)
    const overhead = Number(d.overhead) || 0
    const batch_multiplier = Number(d.batch_multiplier) || 0
    const yield_value = Number(d.yield_value) || 0
    if (batch_multiplier <= 0) {
      alert('Batch multiplier must be greater than zero.')
      return
    }
    if (yield_value <= 0) {
      alert('Yield value must be greater than zero.')
      return
    }
    if (!hasPrimary) {
      alert('Set a primary raw material in Master → Products → recipe (Yes).')
      return
    }
    setSavingRef(referenceId)
    try {
      await pmcApi.upsertProductParams({
        product_id: id,
        reference_id: referenceId,
        overhead,
        batch_multiplier,
        yield_value,
      })
      refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not save parameters.')
    } finally {
      setSavingRef(null)
    }
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
            RMC = material total ÷ (yield × primary qty × batch multiplier) + overhead. Batch
            multiplier scales all recipe qtys including primary for real final product.
          </p>
          {!hasPrimary && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
              No primary raw material — set one in{' '}
              <Link href={`/pmc/master/products/${id}`} className="underline">
                recipe
              </Link>
              .
            </p>
          )}
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
          {sheet.map(({ reference, result }) => {
            const d = getDraft(reference.id)
            const open = expandedRef === reference.id
            const isLatest = reference.id === latestRefId
            const refDetail = refDetailsOpen === reference.id ? pmcApi.getReferenceDetail(reference.id) : null

            return (
              <article
                key={reference.id}
                className="pmc-card p-0 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => {
                    if (open) {
                      setExpandedRef(null)
                      setRefDetailsOpen(null)
                    } else {
                      setExpandedRef(reference.id)
                      setRefDetailsOpen(null)
                    }
                  }}
                  className={clsx(
                    'w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 sm:px-5 py-4 text-left hover:bg-layer-sm min-h-[44px]',
                    isLatest && !open && 'pmc-ref-list-latest'
                  )}
                >
                    <div className="min-w-0 flex flex-wrap items-center gap-2">
                      <span className="font-mono font-semibold break-all">{reference.ref_number}</span>
                      {isLatest && (
                        <span className="badge badge-pmc text-[10px] uppercase tracking-wide">
                          Latest
                        </span>
                      )}
                      <span className="text-xs text-muted w-full sm:w-auto sm:ml-1">
                        {new Date(reference.created_at).toLocaleString()}
                      </span>
                    </div>
                  <div className="text-left sm:text-right shrink-0">
                    {result ? (
                      <span className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-base sm:text-lg font-bold text-pmc pmc-rmc-result tabular-nums">
                        <span className="text-[10px] font-mono uppercase tracking-widest opacity-80">
                          RMC
                        </span>
                        {formatINR(result.final_rmc)}
                      </span>
                    ) : (
                      <span className="text-sm text-muted">
                        {!hasPrimary ? 'Set primary in recipe' : 'Enter yield & save'}
                      </span>
                    )}
                  </div>
                </button>

                {open && (
                  <div className="border-t border-border">
                    <div className="px-4 sm:px-5 pb-5 space-y-4">
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
                          label="Batch multiplier"
                          value={d.batch_multiplier}
                          onChange={(v) =>
                            setDraft((prev) => ({
                              ...prev,
                              [reference.id]: { ...getDraft(reference.id), batch_multiplier: v },
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

                      <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => saveParams(reference.id)}
                          disabled={savingRef === reference.id}
                          className="btn btn-pmc w-full sm:w-auto justify-center"
                        >
                          {savingRef === reference.id ? 'Saving…' : 'Save for this reference'}
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

                      <MaterialBreakdownSection result={result} />

                      {result && <PricingSummaryGrid result={result} />}

                      <CollapsibleSection
                        id={`ref-prices-${reference.id}`}
                        title="Reference price list"
                        open={refDetailsOpen === reference.id}
                        onToggle={() =>
                          setRefDetailsOpen(refDetailsOpen === reference.id ? null : reference.id)
                        }
                        badge={refDetail ? `${refDetail.prices.length} prices` : undefined}
                      >
                        {refDetail ? (
                          <div className="pmc-card p-0 overflow-hidden -mx-1">
                            {refDetail.reference.notes && (
                              <p className="px-4 py-2 text-sm text-muted border-b border-border">
                                {refDetail.reference.notes}
                              </p>
                            )}
                            <div className="pmc-table-wrap mx-0 px-0">
                              <table className="data-table w-full text-sm">
                                <thead>
                                  <tr>
                                    <th>Material</th>
                                    <th>Unit</th>
                                    <th className="text-right">Price</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {refDetail.prices.map((p) => (
                                    <tr key={p.id}>
                                      <td>{p.material_name}</td>
                                      <td className="text-muted">{p.unit}</td>
                                      <td className="text-right font-mono">{formatINR(p.price)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : refDetailsOpen === reference.id ? (
                          <p className="text-sm text-muted py-2">Loading prices…</p>
                        ) : null}
                      </CollapsibleSection>


                    </div>
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

function MaterialBreakdownSection({ result }: { result: PMCPricingResult | null }) {
  return (
    <section className="rounded-xl border border-border overflow-hidden bg-layer-sm/50">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-layer-sm">
        <h3 className="text-sm font-semibold text-primary">Material breakdown</h3>
        {result && (
          <span className="badge badge-pmc text-[10px] font-normal">{result.lines.length} items</span>
        )}
      </div>
      <div className="p-4">
        {result ? (
          <div className="pmc-table-wrap mx-0 px-0">
            <LineItemsTable result={result} />
          </div>
        ) : (
          <p className="text-sm text-muted">Save parameters above to calculate the breakdown.</p>
        )}
      </div>
    </section>
  )
}

function CollapsibleSection({
  id,
  title,
  open,
  onToggle,
  badge,
  children,
}: {
  id?: string
  title: string
  open: boolean
  onToggle: () => void
  badge?: string
  children: ReactNode
}) {
  return (
    <section id={id} className="rounded-xl border border-border overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left bg-layer-sm hover:bg-layer min-h-[44px]"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-primary min-w-0">
          {open ? <ChevronUp size={16} className="shrink-0 text-pmc" /> : <ChevronDown size={16} className="shrink-0 text-pmc" />}
          <span className="truncate">{title}</span>
          {badge && (
            <span className="badge badge-pmc text-[10px] font-normal shrink-0">{badge}</span>
          )}
        </span>
      </button>
      {open && <div className="px-4 pb-4 pt-1 border-t border-border">{children}</div>}
    </section>
  )
}

function PricingSummaryGrid({ result }: { result: PMCPricingResult }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
      <SummaryRow label="Material total" value={formatINR(result.material_total)} />
      <SummaryRow label="Batch multiplier" value={formatQty(result.batch_multiplier)} />
      <SummaryRow label="Yield" value={formatQty(result.yield_value)} />
      <SummaryRow
        label="Primary material"
        value={`${result.primary_material_name} (${formatQty(result.primary_material_qty)})`}
        primary
      />
      <SummaryRow label="Real Final Product" value={formatQty(result.real_final_product)} />
      <SummaryRow label="Unit before overhead" value={formatINR(result.unit_before_overhead)} />
      <SummaryRow label="Overhead" value={formatINR(result.overhead)} />
      <SummaryRow label="Final RMC" value={formatINR(result.final_rmc)} emphasis />
    </div>
  )
}

function LineItemsTable({ result }: { result: PMCPricingResult }) {
  return (
    <table className="data-table w-full text-sm border border-border rounded-lg overflow-hidden">
      <thead>
        <tr className="bg-layer text-muted text-left">
          <th className="px-3 py-2">Raw material</th>
          <th className="px-3 py-2 text-right">Base qty</th>
          <th className="px-3 py-2 text-right">Effective qty</th>
          <th className="px-3 py-2 text-right">Price</th>
          <th className="px-3 py-2 text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        {result.lines.map((line) => (
          <tr
            key={line.raw_material_id}
            className={clsx('border-t border-border', line.is_primary && 'pmc-primary-row')}
          >
            <td className="px-3 py-2">
              {line.raw_material_name}
              {line.is_primary && (
                <span className="ml-2 badge badge-pmc text-[10px]">Primary</span>
              )}
            </td>
            <td className="px-3 py-2 text-right font-mono">{formatQty(line.base_qty)}</td>
            <td className="px-3 py-2 text-right font-mono">{formatQty(line.effective_qty)}</td>
            <td className="px-3 py-2 text-right font-mono">{formatINR(line.price)}</td>
            <td className="px-3 py-2 text-right font-mono font-medium">{formatINR(line.line_total)}</td>
          </tr>
        ))}
        <tr className="border-t-2 border-border font-semibold bg-layer-sm">
          <td colSpan={4} className="px-3 py-2 text-right">
            Material total
            {result.batch_multiplier !== 1 && (
              <span className="text-muted font-normal text-xs ml-1">(×{formatQty(result.batch_multiplier)})</span>
            )}
          </td>
          <td className="px-3 py-2 text-right font-mono">{formatINR(result.material_total)}</td>
        </tr>
      </tbody>
    </table>
  )
}

function Field({
  label,
  value,
  onChange,
  className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  return (
    <div className={className}>
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
  primary,
  emphasis,
}: {
  label: string
  value: string
  primary?: boolean
  emphasis?: boolean
}) {
  if (primary) {
    return (
      <div className="flex justify-between px-3 py-2 rounded-lg border gap-3 pmc-primary-row border-pmc-30">
        <span className="text-pmc font-medium shrink-0">{label}</span>
        <span className="font-mono text-pmc font-semibold tabular-nums text-right break-all">{value}</span>
      </div>
    )
  }

  if (emphasis) {
    return (
      <div className="sm:col-span-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 rounded-lg border border-border bg-layer-sm">
        <span className="text-sm font-semibold text-primary">{label}</span>
        <span className="font-mono text-xl sm:text-2xl font-bold text-primary tabular-nums">{value}</span>
      </div>
    )
  }

  return (
    <div className="flex justify-between px-3 py-2 rounded-lg border border-border bg-layer-sm gap-3">
      <span className="text-muted shrink-0">{label}</span>
      <span className="font-mono text-primary tabular-nums text-right break-all">{value}</span>
    </div>
  )
}
