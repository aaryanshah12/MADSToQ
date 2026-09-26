import type { Dispatch, SetStateAction } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { FieldErrors } from '../../../lib/schemes'
import { formatCurrency } from '../../../lib/schemes'
import {
  FIXED_CHEQUE_GST_PERCENT,
  createPaymentPlan,
  syncLegacyPaymentPlanFields,
  type SchemeFormData,
  type SchemePaymentPlan,
} from '../../../types/scheme'
import {
  MIN_CHEQUE_PERCENT,
  constructionCashChequeSplit,
} from '../../../lib/dealFinance'
import { Button, Card, Field, Input, Toggle } from '../../ui/Form'

export function StepBooking({
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

  const plans = form.paymentPlans?.length
    ? form.paymentPlans
    : [createPaymentPlan(1)]

  const updatePlans = (next: SchemePaymentPlan[]) => {
    setForm((prev) => ({
      ...prev,
      paymentPlans: next,
      ...syncLegacyPaymentPlanFields(next),
    }))
  }

  const updatePlan = (
    id: string,
    key: keyof SchemePaymentPlan,
    value: string,
  ) => {
    updatePlans(
      plans.map((p) => (p.id === id ? { ...p, [key]: value } : p)),
    )
  }

  const addPlan = () => {
    updatePlans([...plans, createPaymentPlan(plans.length + 1)])
  }

  const removePlan = (id: string) => {
    if (plans.length <= 1) return
    updatePlans(plans.filter((p) => p.id !== id))
  }

  return (
    <div className="space-y-4">
      <Card
        title="Booking Configuration"
        description="Rules that govern reservations, booking validity, and cancellations."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Minimum Booking Amount"
            required={!!errors.minimumBookingAmount}
            error={errors.minimumBookingAmount}
          >
            <Input
              type="number"
              min="0"
              value={form.minimumBookingAmount}
              onChange={(e) => set('minimumBookingAmount', e.target.value)}
              placeholder="₹"
            />
          </Field>
          <Field label="Booking Validity (Days)">
            <Input
              type="number"
              min="0"
              value={form.bookingValidityDays}
              onChange={(e) => set('bookingValidityDays', e.target.value)}
            />
          </Field>
          <Field label="Reservation Validity" hint="Days">
            <Input
              type="number"
              min="0"
              value={form.reservationValidity}
              onChange={(e) => set('reservationValidity', e.target.value)}
            />
          </Field>
          <Field label="Cancellation Charges">
            <Input
              value={form.cancellationCharges}
              onChange={(e) => set('cancellationCharges', e.target.value)}
              placeholder="e.g. 10% or 25000"
            />
          </Field>
          <Field label="Installment Available">
            <Toggle
              checked={form.installmentAvailable}
              onChange={(v) => set('installmentAvailable', v)}
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Payment plan master"
        description="Add one or more plans. Each plan has duration, cheque %, and GST on cheque only."
        action={
          <Button type="button" size="sm" onClick={addPlan}>
            <Plus className="h-4 w-4" />
            Add plan
          </Button>
        }
      >
        <div className="space-y-4">
          {plans.map((plan, index) => {
            const chequePct = Number(plan.chequePaymentPercent) || 0
            const gstPct = Number(FIXED_CHEQUE_GST_PERCENT)
            const split = constructionCashChequeSplit(1000000, chequePct, gstPct)
            return (
              <div
                key={plan.id}
                className="rounded-2xl border border-line bg-surface-2/40 p-4"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">
                    {plan.name || `Plan ${index + 1}`}
                  </p>
                  {plans.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removePlan(plan.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </Button>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Plan name">
                    <Input
                      value={plan.name}
                      onChange={(e) =>
                        updatePlan(plan.id, 'name', e.target.value)
                      }
                      placeholder={`Plan ${index + 1}`}
                    />
                  </Field>
                  <Field label="Duration (months)" required>
                    <Input
                      type="number"
                      min="1"
                      value={plan.months}
                      onChange={(e) =>
                        updatePlan(plan.id, 'months', e.target.value)
                      }
                      placeholder="12"
                    />
                  </Field>
                  <Field
                    label="Cheque payment %"
                    hint={`Min ${MIN_CHEQUE_PERCENT}% · rest is cash`}
                  >
                    <Input
                      type="number"
                      min={MIN_CHEQUE_PERCENT}
                      max="100"
                      value={plan.chequePaymentPercent}
                      onChange={(e) =>
                        updatePlan(
                          plan.id,
                          'chequePaymentPercent',
                          e.target.value,
                        )
                      }
                      placeholder="50"
                    />
                  </Field>
                  <Field label="GST on cheque %" hint="Fixed · no GST on cash">
                    <Input
                      type="text"
                      value={`${FIXED_CHEQUE_GST_PERCENT}%`}
                      readOnly
                      disabled
                    />
                  </Field>
                </div>
                <p className="mt-3 text-xs text-ink-muted">
                  Example on ₹10L (full amount split, like construction): Cheque{' '}
                  {formatCurrency(split.chequeTotal)} (incl. GST{' '}
                  {formatCurrency(split.chequeGst)}) · Cash{' '}
                  {formatCurrency(split.cashAmount)} · Payable{' '}
                  {formatCurrency(split.payableTotal)}. Land splits % on A only;
                  development is always cash.
                </p>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
