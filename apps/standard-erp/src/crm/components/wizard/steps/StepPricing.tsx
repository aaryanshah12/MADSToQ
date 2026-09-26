import type { Dispatch, SetStateAction } from 'react'
import type { FieldErrors } from '../../../lib/schemes'
import {
  CONSTRUCTION_UNIT_KEYS,
  normalizePhaseCount,
  normalizeRunningMaintenanceMonths,
  normalizeRunningMaintenanceRates,
  RUNNING_MAINTENANCE_GST_PERCENT,
  RUNNING_MAINTENANCE_MONTH_OPTIONS,
  type ConstructionUnitKey,
  type SchemeFormData,
} from '../../../types/scheme'
import { Card, Field, Input, Select, Toggle } from '../../ui/Form'

export function StepPricing({
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

  const setRoadPremium = (
    key: keyof SchemeFormData['roadWidthPremiums'],
    value: string,
  ) =>
    setForm((prev) => ({
      ...prev,
      roadWidthPremiums: { ...prev.roadWidthPremiums, [key]: value },
    }))

  const totalPhases = normalizePhaseCount(form.totalPhases)
  const rates = normalizeRunningMaintenanceRates(
    form.runningMaintenanceRates,
    totalPhases,
  )
  const months = normalizeRunningMaintenanceMonths(
    form.runningMaintenanceMonths,
    totalPhases,
  )

  const setTotalPhases = (value: string) => {
    const nextTotal = normalizePhaseCount(value)
    setForm((prev) => {
      const ratesNext = normalizeRunningMaintenanceRates(
        prev.runningMaintenanceRates,
        nextTotal,
      )
      const monthsNext = normalizeRunningMaintenanceMonths(
        prev.runningMaintenanceMonths,
        nextTotal,
      )
      const current = Math.min(
        nextTotal,
        Math.max(1, Math.floor(Number(prev.currentPhase) || 1)),
      )
      return {
        ...prev,
        totalPhases: String(nextTotal),
        currentPhase: String(current),
        runningMaintenanceRates: ratesNext,
        runningMaintenanceMonths: monthsNext,
      }
    })
  }

  const setPhaseRate = (index: number, value: string) => {
    setForm((prev) => {
      const next = normalizeRunningMaintenanceRates(
        prev.runningMaintenanceRates,
        normalizePhaseCount(prev.totalPhases),
      )
      next[index] = value
      return { ...prev, runningMaintenanceRates: next }
    })
  }

  const setPhaseMonths = (index: number, value: string) => {
    setForm((prev) => {
      const next = normalizeRunningMaintenanceMonths(
        prev.runningMaintenanceMonths,
        normalizePhaseCount(prev.totalPhases),
      )
      next[index] = value
      return { ...prev, runningMaintenanceMonths: next }
    })
  }

  return (
    <div className="space-y-4">
      <Card
        title="Pricing Configuration"
        description="Base rate plus premiums applied when generating plot pricing."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Base Rate per Sq. Yard"
            required={!!errors.baseRatePerSqYard}
            error={errors.baseRatePerSqYard}
          >
            <Input
              type="number"
              min="0"
              value={form.baseRatePerSqYard}
              onChange={(e) => set('baseRatePerSqYard', e.target.value)}
              placeholder="₹"
            />
          </Field>
          <Field
            label="Development Charge"
            hint="% of base, ₹/sq.yd, or use a number as ₹/sq.yd"
          >
            <Input
              value={form.developmentCharge}
              onChange={(e) => set('developmentCharge', e.target.value)}
              placeholder="e.g. 500 or 5%"
            />
          </Field>
          <Field label="Garden Facing Premium" hint="% of base or ₹/sq.yd">
            <Input
              value={form.gardenFacingPremium}
              onChange={(e) => set('gardenFacingPremium', e.target.value)}
              placeholder="e.g. 5% or 300"
            />
          </Field>
          <Field label="PLC Charges" hint="Flat ₹ per plot">
            <Input
              type="number"
              min="0"
              value={form.plcCharges}
              onChange={(e) => set('plcCharges', e.target.value)}
            />
          </Field>
          <Field label="Maintenance Charges" hint="Flat ₹ per plot">
            <Input
              type="number"
              min="0"
              value={form.maintenanceCharges}
              onChange={(e) => set('maintenanceCharges', e.target.value)}
            />
          </Field>
          <Field label="GST Applicable">
            <Toggle
              checked={form.gstApplicable}
              onChange={(v) => set('gstApplicable', v)}
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Other payments"
        description="Club, one-time maintenance, and phased running maintenance collected per plot (separate from land / construction EMIs)."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Club deposit"
            hint="Fixed ₹ per plot · cash only"
          >
            <Input
              type="number"
              min="0"
              value={form.clubDepositAmount}
              onChange={(e) => set('clubDepositAmount', e.target.value)}
              placeholder="₹"
            />
          </Field>
          <Field
            label="One-time maintenance rate"
            hint="₹ / sq.yd × plot SBU · cash only"
          >
            <Input
              type="number"
              min="0"
              value={form.oneTimeMaintenanceRate}
              onChange={(e) => set('oneTimeMaintenanceRate', e.target.value)}
              placeholder="₹ / sq.yd"
            />
          </Field>
          <Field label="Total phases" hint="Scheme development phases">
            <Input
              type="number"
              min="1"
              max="50"
              value={form.totalPhases}
              onChange={(e) => setTotalPhases(e.target.value)}
            />
          </Field>
          <Field
            label="Current phase"
            hint="Controls which running-maintenance due is active"
          >
            <Select
              value={form.currentPhase}
              onChange={(e) => set('currentPhase', e.target.value)}
            >
              {Array.from({ length: totalPhases }, (_, i) => i + 1).map((p) => (
                <option key={p} value={String(p)}>
                  Phase {p}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="mt-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Running maintenance · cheque / UPI / NEFT +{' '}
            {RUNNING_MAINTENANCE_GST_PERCENT}% GST · ₹/month/sq.yd × SBU × months
          </p>
          <div className="space-y-3">
            {rates.map((rate, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-xl border border-line bg-surface-2/40 p-3 sm:grid-cols-2"
              >
                <Field
                  label={`Phase ${index + 1} rate`}
                  hint={
                    Number(form.currentPhase) === index + 1
                      ? 'Current · ₹ / month / sq.yd'
                      : '₹ / month / sq.yd'
                  }
                >
                  <Input
                    type="number"
                    min="0"
                    value={rate}
                    onChange={(e) => setPhaseRate(index, e.target.value)}
                    placeholder="e.g. 3"
                  />
                </Field>
                <Field
                  label="Collect for"
                  hint="Amount = rate × SBU × months"
                >
                  <Select
                    value={months[index] || '12'}
                    onChange={(e) => setPhaseMonths(index, e.target.value)}
                  >
                    {RUNNING_MAINTENANCE_MONTH_OPTIONS.map((m) => (
                      <option key={m} value={String(m)}>
                        {m} months
                        {m === 12 ? ' (1 year)' : m === 24 ? ' (2 years)' : ''}
                      </option>
                    ))}
                    {!RUNNING_MAINTENANCE_MONTH_OPTIONS.includes(
                      Number(months[index]) as (typeof RUNNING_MAINTENANCE_MONTH_OPTIONS)[number],
                    ) && months[index] ? (
                      <option value={months[index]}>
                        {months[index]} months
                      </option>
                    ) : null}
                  </Select>
                </Field>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card
        title="Road Width Premiums"
        description="Preferential pricing by facing road — 13 m, 12 m, and 9 m. Use % of base amount or ₹ per sq. yard."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="13 m road"
            hint="Widest / main internal roads"
          >
            <Input
              value={form.roadWidthPremiums.road13m}
              onChange={(e) => setRoadPremium('road13m', e.target.value)}
              placeholder="15%"
            />
          </Field>
          <Field label="12 m road" hint="Secondary roads">
            <Input
              value={form.roadWidthPremiums.road12m}
              onChange={(e) => setRoadPremium('road12m', e.target.value)}
              placeholder="10%"
            />
          </Field>
          <Field label="9 m road" hint="Internal / standard">
            <Input
              value={form.roadWidthPremiums.road9m}
              onChange={(e) => setRoadPremium('road9m', e.target.value)}
              placeholder="0"
            />
          </Field>
        </div>
        <p className="mt-4 rounded-xl bg-surface-2 px-4 py-3 text-xs text-ink-muted">
          Example: base ₹5,000/sq.yd × 1,000 sq.yd = ₹50L. Facing 13 m at 15%
          adds ₹7.5L. Assign each plot’s facing road width in Plot Inventory.
        </p>
      </Card>

      <Card
        title="Construction unit master"
        description="Default built-up areas for 1–4 BHK and construction rates used when booking construction payment."
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="pb-2 pr-3 font-semibold">Type</th>
                <th className="pb-2 pr-3 font-semibold">Area (sq.yd)</th>
                <th className="pb-2 font-semibold">Rate ₹/sq.yd</th>
              </tr>
            </thead>
            <tbody>
              {CONSTRUCTION_UNIT_KEYS.map((key) => {
                const unit = form.constructionUnits[key]
                return (
                  <tr key={key} className="border-t border-line">
                    <td className="py-3 pr-3 font-medium">{unit.label}</td>
                    <td className="py-3 pr-3">
                      <Input
                        type="number"
                        min="0"
                        value={unit.areaSqYards}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            constructionUnits: {
                              ...prev.constructionUnits,
                              [key]: {
                                ...prev.constructionUnits[key],
                                areaSqYards: e.target.value,
                              },
                            },
                          }))
                        }
                        className="max-w-[140px]"
                      />
                    </td>
                    <td className="py-3">
                      <Input
                        type="number"
                        min="0"
                        value={unit.ratePerSqYard}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            constructionUnits: {
                              ...prev.constructionUnits,
                              [key as ConstructionUnitKey]: {
                                ...prev.constructionUnits[key],
                                ratePerSqYard: e.target.value,
                              },
                            },
                          }))
                        }
                        placeholder="₹"
                        className="max-w-[160px]"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-ink-muted">
          Defaults: 1 BHK 155 · 2 BHK 300 · 3 BHK 450 · 4 BHK 600 sq.yd. Rates
          are picked into the construction payment dialog on booking.
        </p>
      </Card>
    </div>
  )
}
