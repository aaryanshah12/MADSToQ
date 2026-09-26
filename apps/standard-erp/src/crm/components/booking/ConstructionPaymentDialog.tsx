import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { PlotRecord } from '../../lib/pricing'
import { formatCurrency, formatNumber } from '../../lib/schemes'
import {
  CONSTRUCTION_UNIT_KEYS,
  type ConstructionUnitKey,
  type SchemeRecord,
} from '../../types/scheme'
import type { ConstructionPaymentConfig } from '../../types/sales'
import { Button, Field, Input, Select } from '../ui/Form'

export function ConstructionPaymentDialog({
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
  onSave: (config: ConstructionPaymentConfig) => void
  bookingDate: string
  plot: PlotRecord
  scheme: SchemeRecord
  initial?: ConstructionPaymentConfig | null
}) {
  const [date, setDate] = useState(bookingDate)
  const [unitType, setUnitType] = useState<ConstructionUnitKey | ''>(
    initial?.unitType || '',
  )
  const [constructionRate, setConstructionRate] = useState(
    initial?.constructionRate || '',
  )

  useEffect(() => {
    if (!open) return
    setDate(bookingDate)
    const type = initial?.unitType || ''
    setUnitType(type)
    if (type && scheme.constructionUnits[type]) {
      setConstructionRate(
        initial?.constructionRate ||
          scheme.constructionUnits[type].ratePerSqYard ||
          '',
      )
    } else {
      setConstructionRate(initial?.constructionRate || '')
    }
  }, [open, bookingDate, initial, scheme.constructionUnits])

  const selectedUnit = unitType
    ? scheme.constructionUnits[unitType]
    : null
  const unitArea = Number(selectedUnit?.areaSqYards || 0)
  const rate = Number(constructionRate) || 0
  const totalValue = unitArea * rate

  const preview = useMemo(
    () => ({ unitArea, rate, totalValue }),
    [unitArea, rate, totalValue],
  )

  if (!open) return null

  const handleTypeChange = (value: ConstructionUnitKey | '') => {
    setUnitType(value)
    if (value && scheme.constructionUnits[value]) {
      setConstructionRate(scheme.constructionUnits[value].ratePerSqYard || '')
    }
  }

  const handleSave = () => {
    if (!unitType || !selectedUnit) return
    if (!rate || rate <= 0) return
    onSave({
      included: true,
      configured: true,
      bookingDate: date,
      plotNumber: plot.plotNumber,
      sbuAreaSqYards: plot.sbuAreaSqYards,
      unitType,
      unitLabel: selectedUnit.label,
      unitAreaSqYards: selectedUnit.areaSqYards,
      constructionRate: String(rate),
      totalValue,
      amount: totalValue,
      notes: '',
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
            <h2 className="text-base font-semibold text-ink">
              Construction payment
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              Optional · unit type area × construction rate
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
            <Field label="Total SBU area (plot)">
              <Input
                value={`${formatNumber(plot.sbuAreaSqYards)} sq.yd`}
                readOnly
                className="bg-surface-2"
              />
            </Field>
            <Field label="Plot type" required>
              <Select
                value={unitType}
                onChange={(e) =>
                  handleTypeChange(e.target.value as ConstructionUnitKey | '')
                }
              >
                <option value="">Select type</option>
                {CONSTRUCTION_UNIT_KEYS.map((key) => {
                  const u = scheme.constructionUnits[key]
                  return (
                    <option key={key} value={key}>
                      {u.label} · {u.areaSqYards || '—'} sq.yd
                    </option>
                  )
                })}
              </Select>
            </Field>
            <Field label="Unit area (from master)">
              <Input
                value={
                  selectedUnit
                    ? `${formatNumber(selectedUnit.areaSqYards)} sq.yd`
                    : '—'
                }
                readOnly
                className="bg-surface-2"
              />
            </Field>
            <Field
              label="Construction rate (₹ / sq.yd)"
              hint="Default from scheme master — editable"
              required
            >
              <Input
                type="number"
                min="0"
                value={constructionRate}
                onChange={(e) => setConstructionRate(e.target.value)}
                disabled={!unitType}
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
                  {selectedUnit?.label || 'Unit'} area × rate
                </dt>
                <dd className="font-medium tabular-nums">
                  {formatNumber(preview.unitArea)} ×{' '}
                  {formatCurrency(preview.rate)}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-line pt-2">
                <dt className="font-semibold text-ink">
                  Total construction value
                </dt>
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
          <Button
            type="button"
            onClick={handleSave}
            disabled={!unitType || !rate}
          >
            Save construction payment
          </Button>
        </div>
      </div>
    </div>
  )
}
