import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { SchemeRecord } from '../../types/scheme'
import type { PlotRecord } from '../../lib/pricing'
import {
  resolvePremiumAmount,
  roadPremiumForWidth,
} from '../../lib/pricing'
import { formatCurrency, formatNumber } from '../../lib/schemes'
import type { LandPaymentConfig } from '../../types/sales'
import { Button, Field, Input } from '../ui/Form'

export function LandPaymentDialog({
  open,
  onClose,
  onSave,
  bookingDate,
  plot,
  scheme,
  initial,
}: {
  open: boolean
  onClose: () => void
  onSave: (config: LandPaymentConfig) => void
  bookingDate: string
  plot: PlotRecord
  scheme: SchemeRecord
  initial?: LandPaymentConfig | null
}) {
  const defaultRate = scheme.baseRatePerSqYard || ''
  const [date, setDate] = useState(bookingDate)
  const [basicRate, setBasicRate] = useState(
    initial?.basicRate || defaultRate,
  )

  useEffect(() => {
    if (!open) return
    setDate(bookingDate)
    setBasicRate(initial?.basicRate || defaultRate)
  }, [open, bookingDate, defaultRate, initial?.basicRate])

  const sbu = Number(plot.sbuAreaSqYards) || 0
  const rate = Number(basicRate) || 0
  const basicAmount = sbu * rate

  const roadPremiumLabel = roadPremiumForWidth(
    scheme.roadWidthPremiums,
    plot.facingRoadWidth,
  )
  const roadPremiumAmount = resolvePremiumAmount(
    roadPremiumLabel,
    basicAmount,
    sbu,
  )
  const gardenPremiumAmount = plot.isGardenFacing
    ? resolvePremiumAmount(
        scheme.gardenFacingPremium || '',
        basicAmount,
        sbu,
      )
    : 0
  const developmentChargeAmount = resolvePremiumAmount(
    scheme.developmentCharge || '',
    basicAmount,
    sbu,
  )
  const totalValue =
    basicAmount +
    roadPremiumAmount +
    gardenPremiumAmount +
    developmentChargeAmount

  const preview = useMemo(
    () => ({
      basicAmount,
      roadPremiumAmount,
      gardenPremiumAmount,
      developmentChargeAmount,
      totalValue,
    }),
    [
      basicAmount,
      roadPremiumAmount,
      gardenPremiumAmount,
      developmentChargeAmount,
      totalValue,
    ],
  )

  if (!open) return null

  const roadLabel =
    plot.facingRoadWidth != null ? `${plot.facingRoadWidth} m` : 'Not set'

  const handleSave = () => {
    if (!rate || rate <= 0) return
    onSave({
      configured: true,
      bookingDate: date,
      plotNumber: plot.plotNumber,
      sbuAreaSqYards: plot.sbuAreaSqYards,
      basicRate: String(rate),
      facingRoadWidth: plot.facingRoadWidth,
      roadPremiumLabel,
      roadPremiumAmount,
      gardenPremiumAmount,
      developmentChargeAmount,
      developmentChargeLabel: scheme.developmentCharge || '0',
      basicAmount,
      totalValue,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink">Land payment</h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              A = basic + premiums · development always cash · EMI on A + development
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-ink-muted hover:bg-surface-2"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date of booking">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="Plot number">
              <Input value={plot.plotNumber} readOnly className="bg-surface-2" />
            </Field>
            <Field label="Total SBU area">
              <Input
                value={`${formatNumber(plot.sbuAreaSqYards)} sq.yd`}
                readOnly
                className="bg-surface-2"
              />
            </Field>
            <Field
              label="Facing road"
              hint={
                plot.facingRoadWidth
                  ? `Premium ${roadPremiumLabel || '0%'}`
                  : 'Set road width on the plot in inventory'
              }
            >
              <Input value={roadLabel} readOnly className="bg-surface-2" />
            </Field>
            <Field
              label="Basic rate (₹ / sq.yd)"
              hint="Default from scheme — you can edit"
              required
            >
              <Input
                type="number"
                min="0"
                value={basicRate}
                onChange={(e) => setBasicRate(e.target.value)}
              />
            </Field>
            <Field
              label="Road premium"
              hint={
                plot.facingRoadWidth
                  ? `${roadLabel} · ${roadPremiumLabel || '0'}`
                  : 'No facing road set'
              }
            >
              <Input
                value={formatCurrency(roadPremiumAmount)}
                readOnly
                className="bg-surface-2"
              />
            </Field>
            {plot.isGardenFacing && (
              <Field
                label="Garden facing premium"
                hint={scheme.gardenFacingPremium || '0'}
                className="sm:col-span-2"
              >
                <Input
                  value={formatCurrency(gardenPremiumAmount)}
                  readOnly
                  className="bg-surface-2"
                />
              </Field>
            )}
            <Field
              label="Development charge"
              hint="Fixed from scheme"
              className="sm:col-span-2"
            >
              <Input
                value={
                  scheme.developmentCharge
                    ? `${scheme.developmentCharge} → ${formatCurrency(developmentChargeAmount)}`
                    : formatCurrency(0)
                }
                readOnly
                className="bg-surface-2"
              />
            </Field>
          </div>

          <div className="rounded-xl border border-line bg-brand-soft/40 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Calculation
            </p>
            <dl className="mt-2 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">
                  Basic ({formatNumber(sbu)} × {formatCurrency(rate)})
                </dt>
                <dd className="font-medium tabular-nums">
                  {formatCurrency(preview.basicAmount)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">
                  Road premium
                  {plot.facingRoadWidth != null
                    ? ` (${plot.facingRoadWidth} m · ${roadPremiumLabel || '0'})`
                    : ''}
                </dt>
                <dd className="font-medium tabular-nums">
                  {formatCurrency(preview.roadPremiumAmount)}
                </dd>
              </div>
              {preview.gardenPremiumAmount > 0 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">Garden facing</dt>
                  <dd className="font-medium tabular-nums">
                    {formatCurrency(preview.gardenPremiumAmount)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-3 border-t border-line pt-2">
                <dt className="font-medium text-ink">
                  Land value A (cheque/cash split)
                </dt>
                <dd className="font-semibold tabular-nums">
                  {formatCurrency(
                    preview.basicAmount +
                      preview.roadPremiumAmount +
                      preview.gardenPremiumAmount,
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Development (100% cash)</dt>
                <dd className="font-medium tabular-nums">
                  {formatCurrency(preview.developmentChargeAmount)}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-line pt-2">
                <dt className="font-semibold text-ink">EMI base V</dt>
                <dd className="text-lg font-semibold tabular-nums text-ink">
                  {formatCurrency(preview.totalValue)}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={!rate}>
            Save land payment
          </Button>
        </div>
      </div>
    </div>
  )
}
