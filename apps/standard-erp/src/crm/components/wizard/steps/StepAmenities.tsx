import type { Dispatch, SetStateAction } from 'react'
import {
  AMENITY_KEYS,
  AMENITY_LABELS,
  type AmenityKey,
  type SchemeFormData,
} from '../../../types/scheme'
import { Card, CheckboxCard, Field, Input, Textarea } from '../../ui/Form'

export function StepAmenities({
  form,
  setForm,
}: {
  form: SchemeFormData
  setForm: Dispatch<SetStateAction<SchemeFormData>>
}) {
  const toggle = (key: AmenityKey, value: boolean) =>
    setForm((prev) => ({
      ...prev,
      amenities: { ...prev.amenities, [key]: value },
    }))

  return (
    <div className="space-y-4">
      <Card
        title="Development & Amenities"
        description="Select amenities included in the scheme development."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {AMENITY_KEYS.map((key) => (
            <CheckboxCard
              key={key}
              label={AMENITY_LABELS[key]}
              checked={form.amenities[key]}
              onChange={(v) => toggle(key, v)}
            />
          ))}
        </div>
      </Card>

      <Card title="Road & Additional Details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Internal Road Width" hint="In feet">
            <Input
              value={form.internalRoadWidth}
              onChange={(e) =>
                setForm((p) => ({ ...p, internalRoadWidth: e.target.value }))
              }
              placeholder="e.g. 30"
            />
          </Field>
          <Field label="Main Road Width" hint="In feet">
            <Input
              value={form.mainRoadWidth}
              onChange={(e) =>
                setForm((p) => ({ ...p, mainRoadWidth: e.target.value }))
              }
              placeholder="e.g. 60"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Other Amenities">
              <Textarea
                value={form.otherAmenities}
                onChange={(e) =>
                  setForm((p) => ({ ...p, otherAmenities: e.target.value }))
                }
                placeholder="Temple, kids play area, rainwater harvesting…"
              />
            </Field>
          </div>
        </div>
      </Card>
    </div>
  )
}
