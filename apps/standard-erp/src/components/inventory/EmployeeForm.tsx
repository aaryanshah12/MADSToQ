'use client'

import type { FormEvent, ReactNode } from 'react'
import type { Factory } from '@/types'
import {
  BLOOD_GROUP_OPTIONS,
  DEPARTMENT_OPTIONS,
  EMPLOYMENT_STATUS_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  GENDER_OPTIONS,
  RELATION_OPTIONS,
  designationsForDepartment,
  type EmployeeFormValues,
} from '@/lib/employee'

export type LinkableProfile = {
  id: string
  full_name: string
  email: string | null
  role: string
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div>
      <label className="mb-2 block font-mono text-xs uppercase tracking-widest text-muted">
        {label}
        {required ? ' *' : ''}
      </label>
      {children}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card space-y-4 border-owner/20 p-5">
      <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-owner">{title}</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </section>
  )
}

export default function EmployeeForm({
  form,
  setForm,
  factories,
  assignedFactoryIds,
  linkableProfiles,
  saving,
  error,
  submitLabel,
  extraNote,
  onSubmit,
  isNew,
}: {
  form: EmployeeFormValues
  setForm: (next: EmployeeFormValues) => void
  factories: Factory[]
  assignedFactoryIds: string[]
  linkableProfiles: LinkableProfile[]
  saving: boolean
  error: string
  submitLabel: string
  extraNote?: ReactNode
  onSubmit: () => void
  isNew?: boolean
}) {
  const visibleFactories = factories.filter((f) => assignedFactoryIds.includes(f.id) && f.is_active)
  const set = (patch: Partial<EmployeeFormValues>) => setForm({ ...form, ...patch })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Section title="Identity">
        <Field label="Factory" required>
          <select
            className="input-field owner-focus"
            value={form.factory_id}
            onChange={(e) => set({ factory_id: e.target.value, profile_id: '' })}
            required
          >
            <option value="">Select factory</option>
            {visibleFactories.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>
        {!isNew && (
          <Field label="Employee code">
            <input
              className="input-field owner-focus cursor-default"
              value={form.employee_code}
              readOnly
              tabIndex={-1}
            />
          </Field>
        )}
        <Field label="Full name" required>
          <input
            className="input-field owner-focus"
            value={form.full_name}
            onChange={(e) => set({ full_name: e.target.value })}
            required
            placeholder="e.g. Ramesh Kumar"
          />
        </Field>
        <Field label="Father's name">
          <input
            className="input-field owner-focus"
            value={form.father_name}
            onChange={(e) => set({ father_name: e.target.value })}
          />
        </Field>
        <Field label="Gender">
          <select
            className="input-field owner-focus"
            value={form.gender}
            onChange={(e) => set({ gender: e.target.value })}
          >
            {GENDER_OPTIONS.map((o) => (
              <option key={o.value || 'none'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date of birth">
          <input
            type="date"
            className="input-field owner-focus"
            value={form.date_of_birth}
            onChange={(e) => set({ date_of_birth: e.target.value })}
          />
        </Field>
        <Field label="Department" required>
          <select
            className="input-field owner-focus"
            value={form.department}
            onChange={(e) => {
              const department = e.target.value
              const allowed = designationsForDepartment(department)
              set({
                department,
                designation: allowed.includes(form.designation) ? form.designation : '',
              })
            }}
            required
          >
            <option value="">Select department</option>
            {DEPARTMENT_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
            {form.department &&
              !(DEPARTMENT_OPTIONS as readonly string[]).includes(form.department) && (
                <option value={form.department}>{form.department}</option>
              )}
          </select>
        </Field>
        <Field label="Designation" required>
          <select
            className="input-field owner-focus"
            value={form.designation}
            onChange={(e) => set({ designation: e.target.value })}
            required
            disabled={!form.department}
          >
            <option value="">
              {form.department ? 'Select designation' : 'Select department first'}
            </option>
            {designationsForDepartment(form.department, form.designation).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Employment">
        <Field label="Employment type">
          <select
            className="input-field owner-focus"
            value={form.employment_type}
            onChange={(e) => set({ employment_type: e.target.value })}
          >
            {EMPLOYMENT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select
            className="input-field owner-focus"
            value={form.employment_status}
            onChange={(e) => set({ employment_status: e.target.value })}
          >
            {EMPLOYMENT_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Joining date" required>
          <input
            type="date"
            className="input-field owner-focus"
            value={form.joining_date}
            onChange={(e) => set({ joining_date: e.target.value })}
            required
          />
        </Field>
        <Field label="Leaving date">
          <input
            type="date"
            className="input-field owner-focus"
            value={form.leaving_date}
            onChange={(e) => set({ leaving_date: e.target.value })}
          />
        </Field>
        <Field label="Linked login">
          <select
            className="input-field owner-focus"
            value={form.profile_id}
            onChange={(e) => set({ profile_id: e.target.value })}
            disabled={!form.factory_id}
          >
            <option value="">No login linked</option>
            {linkableProfiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
                {p.email ? ` · ${p.email}` : ''} ({p.role})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted">
            Optional. Create login accounts under Management → Users.
          </p>
        </Field>
      </Section>

      <Section title="Contact">
        <Field label="Phone">
          <input
            className="input-field owner-focus"
            value={form.phone}
            onChange={(e) => set({ phone: e.target.value })}
            placeholder="+91 99999 00000"
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            className="input-field owner-focus"
            value={form.email}
            onChange={(e) => set({ email: e.target.value })}
          />
        </Field>
        <Field label="Blood group">
          <select
            className="input-field owner-focus"
            value={form.blood_group}
            onChange={(e) => set({ blood_group: e.target.value })}
          >
            {BLOOD_GROUP_OPTIONS.map((g) => (
              <option key={g || 'none'} value={g}>
                {g || '—'}
              </option>
            ))}
          </select>
        </Field>
        <div className="md:col-span-2">
          <Field label="Current address">
            <textarea
              className="input-field owner-focus min-h-[80px]"
              value={form.current_address}
              onChange={(e) => set({ current_address: e.target.value })}
            />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Permanent address">
            <textarea
              className="input-field owner-focus min-h-[80px]"
              value={form.permanent_address}
              onChange={(e) => set({ permanent_address: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Emergency contact name">
          <input
            className="input-field owner-focus"
            value={form.emergency_contact_name}
            onChange={(e) => set({ emergency_contact_name: e.target.value })}
          />
        </Field>
        <Field label="Emergency phone">
          <input
            className="input-field owner-focus"
            value={form.emergency_contact_phone}
            onChange={(e) => set({ emergency_contact_phone: e.target.value })}
          />
        </Field>
        <Field label="Relation">
          <select
            className="input-field owner-focus"
            value={form.emergency_contact_relation}
            onChange={(e) => set({ emergency_contact_relation: e.target.value })}
          >
            <option value="">—</option>
            {RELATION_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
            {form.emergency_contact_relation &&
              !(RELATION_OPTIONS as readonly string[]).includes(form.emergency_contact_relation) && (
                <option value={form.emergency_contact_relation}>
                  {form.emergency_contact_relation}
                </option>
              )}
          </select>
        </Field>
      </Section>

      <Section title="Statutory IDs">
        <Field label="PAN">
          <input
            className="input-field owner-focus"
            value={form.pan}
            onChange={(e) => set({ pan: e.target.value.toUpperCase() })}
          />
        </Field>
        <Field label="Aadhaar">
          <input
            className="input-field owner-focus"
            value={form.aadhaar}
            onChange={(e) => set({ aadhaar: e.target.value })}
            inputMode="numeric"
          />
        </Field>
        <Field label="UAN">
          <input
            className="input-field owner-focus"
            value={form.uan}
            onChange={(e) => set({ uan: e.target.value })}
          />
        </Field>
        <Field label="PF number">
          <input
            className="input-field owner-focus"
            value={form.pf_number}
            onChange={(e) => set({ pf_number: e.target.value })}
          />
        </Field>
        <Field label="ESI number">
          <input
            className="input-field owner-focus"
            value={form.esi_number}
            onChange={(e) => set({ esi_number: e.target.value })}
          />
        </Field>
      </Section>

      <Section title="Bank and salary">
        <Field label="Bank name">
          <input
            className="input-field owner-focus"
            value={form.bank_name}
            onChange={(e) => set({ bank_name: e.target.value })}
          />
        </Field>
        <Field label="Account holder">
          <input
            className="input-field owner-focus"
            value={form.account_holder_name}
            onChange={(e) => set({ account_holder_name: e.target.value })}
          />
        </Field>
        <Field label="Account number">
          <input
            className="input-field owner-focus"
            value={form.account_number}
            onChange={(e) => set({ account_number: e.target.value })}
            autoComplete="off"
          />
        </Field>
        <Field label="IFSC">
          <input
            className="input-field owner-focus"
            value={form.ifsc}
            onChange={(e) => set({ ifsc: e.target.value.toUpperCase() })}
          />
        </Field>
        <Field label="Monthly gross (₹)">
          <input
            className="input-field owner-focus"
            value={form.monthly_gross}
            onChange={(e) => set({ monthly_gross: e.target.value })}
            inputMode="decimal"
          />
        </Field>
        <Field label="Annual CTC (₹)">
          <input
            className="input-field owner-focus"
            value={form.annual_ctc}
            onChange={(e) => set({ annual_ctc: e.target.value })}
            inputMode="decimal"
          />
        </Field>
        <Field label="Basic pay (₹)">
          <input
            className="input-field owner-focus"
            value={form.basic_pay}
            onChange={(e) => set({ basic_pay: e.target.value })}
            inputMode="decimal"
          />
        </Field>
        <div className="flex flex-col justify-end gap-3">
          <label className="flex items-center gap-2 text-sm text-primary">
            <input
              type="checkbox"
              checked={form.pf_eligible}
              onChange={(e) => set({ pf_eligible: e.target.checked })}
            />
            PF eligible
          </label>
          <label className="flex items-center gap-2 text-sm text-primary">
            <input
              type="checkbox"
              checked={form.esi_eligible}
              onChange={(e) => set({ esi_eligible: e.target.checked })}
            />
            ESI eligible
          </label>
        </div>
      </Section>

      {extraNote}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="btn btn-owner px-6 py-3">
          {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
