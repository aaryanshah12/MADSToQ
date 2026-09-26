import type { Dispatch, SetStateAction } from 'react'
import type { FieldErrors } from '../../../lib/schemes'
import type { SchemeFormData } from '../../../types/scheme'
import { Card, Field, Input, Select, Textarea } from '../../ui/Form'

export function StepBasicInfo({
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
      title="Basic Information"
      description="Identify the scheme and developer. Code is generated automatically."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Scheme Name" required error={errors.schemeName}>
          <Input
            value={form.schemeName}
            onChange={(e) => set('schemeName', e.target.value)}
            placeholder="e.g. Green Valley Township"
          />
        </Field>
        <Field label="Scheme Code" hint="Auto-generated unique identifier">
          <Input value={form.schemeCode} readOnly className="bg-surface-2 font-mono" />
        </Field>
        <Field
          label="Developer Company"
          required
          error={errors.developerCompany}
        >
          <Input
            value={form.developerCompany}
            onChange={(e) => set('developerCompany', e.target.value)}
            placeholder="e.g. MADSTOQ Developers Pvt Ltd"
          />
        </Field>
        <Field label="Project Status">
          <Select
            value={form.projectStatus}
            onChange={(e) =>
              set(
                'projectStatus',
                e.target.value as SchemeFormData['projectStatus'],
              )
            }
          >
            <option>Planning</option>
            <option>Active</option>
            <option>Sold Out</option>
            <option>Completed</option>
          </Select>
        </Field>
        <Field label="Launch Date">
          <Input
            type="date"
            value={form.launchDate}
            onChange={(e) => set('launchDate', e.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Description">
            <Textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Short overview of the plotting scheme…"
            />
          </Field>
        </div>
      </div>
    </Card>
  )
}
