import type { Dispatch, SetStateAction } from 'react'
import type { FieldErrors } from '../../../lib/schemes'
import type { SchemeFormData } from '../../../types/scheme'
import { Card, Field, Input, Textarea } from '../../ui/Form'

export function StepLocation({
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

  return (
    <Card
      title="Location"
      description="Land location details used across bookings, maps, and compliance."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Country">
          <Input
            value={form.country}
            onChange={(e) => set('country', e.target.value)}
          />
        </Field>
        <Field label="State" required={!!errors.state} error={errors.state}>
          <Input
            value={form.state}
            onChange={(e) => set('state', e.target.value)}
            placeholder="Gujarat"
          />
        </Field>
        <Field
          label="District"
          required={!!errors.district}
          error={errors.district}
        >
          <Input
            value={form.district}
            onChange={(e) => set('district', e.target.value)}
          />
        </Field>
        <Field label="Taluka">
          <Input
            value={form.taluka}
            onChange={(e) => set('taluka', e.target.value)}
          />
        </Field>
        <Field label="Village">
          <Input
            value={form.village}
            onChange={(e) => set('village', e.target.value)}
          />
        </Field>
        <Field label="Survey Number(s)">
          <Input
            value={form.surveyNumbers}
            onChange={(e) => set('surveyNumbers', e.target.value)}
            placeholder="12/1, 12/2"
          />
        </Field>
        <Field label="TP Number">
          <Input
            value={form.tpNumber}
            onChange={(e) => set('tpNumber', e.target.value)}
          />
        </Field>
        <Field label="FP Number">
          <Input
            value={form.fpNumber}
            onChange={(e) => set('fpNumber', e.target.value)}
          />
        </Field>
        <Field label="Google Maps Link" className="sm:col-span-2 lg:col-span-3">
          <Input
            value={form.googleMapsLink}
            onChange={(e) => set('googleMapsLink', e.target.value)}
            placeholder="https://maps.google.com/…"
          />
        </Field>
        <Field label="Latitude">
          <Input
            value={form.latitude}
            onChange={(e) => set('latitude', e.target.value)}
            placeholder="23.0225"
          />
        </Field>
        <Field label="Longitude">
          <Input
            value={form.longitude}
            onChange={(e) => set('longitude', e.target.value)}
            placeholder="72.5714"
          />
        </Field>
        <div className="sm:col-span-2 lg:col-span-3">
          <Field label="Full Address">
            <Textarea
              value={form.fullAddress}
              onChange={(e) => set('fullAddress', e.target.value)}
              placeholder="Complete site address"
            />
          </Field>
        </div>
      </div>
    </Card>
  )
}
