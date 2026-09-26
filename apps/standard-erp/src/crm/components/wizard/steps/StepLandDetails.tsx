import type { Dispatch, SetStateAction } from 'react'
import {
  calcCommonArea,
  formatNumber,
  parseArea,
  type FieldErrors,
} from '../../../lib/schemes'
import type { SchemeFormData } from '../../../types/scheme'
import { Card, Field, Input, Select, StatPill } from '../../ui/Form'

export function StepLandDetails({
  form,
  setForm,
  errors,
}: {
  form: SchemeFormData
  setForm: Dispatch<SetStateAction<SchemeFormData>>
  errors: FieldErrors
}) {
  const set = <K extends keyof SchemeFormData>(key: K, value: SchemeFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const common = calcCommonArea(form)
  const total = parseArea(form.totalLandArea)
  const saleable = parseArea(form.saleableArea)
  const saleablePct =
    total > 0 && saleable > 0 ? ((saleable / total) * 100).toFixed(1) : null

  return (
    <div className="space-y-4">
      <Card
        title="Land Details"
        description="Capture total inventory footprint. Common area auto-calculates when possible."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Total Land Area"
            required={!!errors.totalLandArea}
            error={errors.totalLandArea}
          >
            <Input
              type="number"
              min="0"
              step="any"
              value={form.totalLandArea}
              onChange={(e) => set('totalLandArea', e.target.value)}
            />
          </Field>
          <Field label="Area Unit">
            <Select
              value={form.areaUnit}
              onChange={(e) =>
                set('areaUnit', e.target.value as SchemeFormData['areaUnit'])
              }
            >
              <option>Sq. Yard</option>
              <option>Sq. Meter</option>
              <option>Acre</option>
            </Select>
          </Field>
          <Field label="Saleable Area">
            <Input
              type="number"
              min="0"
              step="any"
              value={form.saleableArea}
              onChange={(e) => set('saleableArea', e.target.value)}
            />
          </Field>
          <Field
            label="Common Area"
            hint="Leave blank to auto-calculate (Total − Saleable)"
          >
            <Input
              type="number"
              min="0"
              step="any"
              value={form.commonArea}
              onChange={(e) => set('commonArea', e.target.value)}
              placeholder={
                common !== null && form.commonArea === ''
                  ? String(common)
                  : undefined
              }
            />
          </Field>
          <Field label="Number of Blocks">
            <Input
              type="number"
              min="0"
              value={form.numberOfBlocks}
              onChange={(e) => set('numberOfBlocks', e.target.value)}
            />
          </Field>
          <Field
            label="Total Number of Plots"
            required={!!errors.totalNumberOfPlots}
            error={errors.totalNumberOfPlots}
          >
            <Input
              type="number"
              min="0"
              value={form.totalNumberOfPlots}
              onChange={(e) => set('totalNumberOfPlots', e.target.value)}
            />
          </Field>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatPill
          label="Computed Common Area"
          value={
            common !== null
              ? `${formatNumber(common)} ${form.areaUnit}`
              : '—'
          }
        />
        <StatPill
          label="Saleable Ratio"
          value={saleablePct ? `${saleablePct}%` : '—'}
        />
        <StatPill
          label="Avg Area / Plot"
          value={
            saleable > 0 && parseArea(form.totalNumberOfPlots) > 0
              ? `${formatNumber(
                  saleable / parseArea(form.totalNumberOfPlots),
                )} ${form.areaUnit}`
              : '—'
          }
        />
      </div>
    </div>
  )
}
