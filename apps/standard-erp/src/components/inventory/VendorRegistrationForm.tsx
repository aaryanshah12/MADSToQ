'use client'

import type { ReactNode } from 'react'
import { normalizeGstin, normalizeIndianMobile } from '@madstoq/shared-utils'
import {
  ACCOUNT_TYPE_OPTIONS,
  APPROVAL_REASON_OPTIONS,
  CONTACT_TITLES,
  type VendorFieldErrors,
  type VendorFormValues,
} from '@/lib/vendor-registration'

function Field({
  label,
  htmlFor,
  required,
  error,
  wide,
  children,
}: {
  label: string
  htmlFor?: string
  required?: boolean
  error?: string
  wide?: boolean
  children: ReactNode
}) {
  return (
    <div className={wide ? 'md:col-span-2' : undefined}>
      <label
        htmlFor={htmlFor}
        className="mb-1 block text-xs text-muted"
      >
        {label}
        {required ? ' *' : ''}
      </label>
      {children}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}

function Section({
  title,
  note,
  children,
}: {
  title: string
  note?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3 rounded-lg border border-owner/20 bg-layer-sm/40 p-4">
      <div>
        <h3 className="text-sm font-medium text-primary">{title}</h3>
        {note ? <p className="mt-0.5 text-xs text-muted">{note}</p> : null}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{children}</div>
    </section>
  )
}

function YesNo({
  name,
  value,
  onChange,
  yesFirst,
}: {
  name: string
  value: '' | 'yes' | 'no'
  onChange: (v: 'yes' | 'no') => void
  yesFirst?: boolean
}) {
  const opts = yesFirst
    ? ([
        { id: 'yes', label: 'Yes' },
        { id: 'no', label: 'No' },
      ] as const)
    : ([
        { id: 'no', label: 'No' },
        { id: 'yes', label: 'Yes' },
      ] as const)
  return (
    <div className="flex flex-wrap gap-3 pt-1">
      {opts.map((o) => (
        <label key={o.id} className="inline-flex items-center gap-2 text-sm text-primary">
          <input
            type="radio"
            name={name}
            checked={value === o.id}
            onChange={() => onChange(o.id)}
          />
          {o.label}
        </label>
      ))}
    </div>
  )
}

export default function VendorRegistrationForm({
  form,
  setForm,
  fieldErrors,
  setFieldErrors,
  inputClassName = 'input-field owner-focus',
  htmlRequired = true,
  factorySlot,
}: {
  form: VendorFormValues
  setForm: (next: VendorFormValues) => void
  fieldErrors: VendorFieldErrors
  setFieldErrors: (next: VendorFieldErrors) => void
  inputClassName?: string
  htmlRequired?: boolean
  factorySlot?: ReactNode
}) {
  const set = (patch: Partial<VendorFormValues>) => setForm({ ...form, ...patch })
  const err = (key: keyof VendorFieldErrors) =>
    fieldErrors[key] ? `${inputClassName} border-red-500 focus:border-red-500` : inputClassName

  function toggleReason(id: string) {
    set({
      approval_reasons: form.approval_reasons.includes(id)
        ? form.approval_reasons.filter((r) => r !== id)
        : [...form.approval_reasons, id],
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-mono text-muted">
        F/PUR/04 · Supplier registration
      </p>

      <Section title="Company details">
        {factorySlot ? <div className="md:col-span-2">{factorySlot}</div> : null}
        <Field label="Company name" htmlFor="vendor-name" required>
          <input
            id="vendor-name"
            className={inputClassName}
            required={htmlRequired}
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="e.g. Acme Chemicals Ltd."
          />
        </Field>
        <Field label="Product supplied" htmlFor="product-supplied">
          <input
            id="product-supplied"
            className={inputClassName}
            value={form.product_supplied}
            onChange={(e) => set({ product_supplied: e.target.value })}
            placeholder="e.g. Hydrazine hydrate"
          />
        </Field>
        <Field label="Address" htmlFor="company-address" required wide>
          <textarea
            id="company-address"
            className={`${inputClassName} min-h-[72px]`}
            required={htmlRequired}
            value={form.company_address}
            onChange={(e) => set({ company_address: e.target.value })}
            placeholder="Full company address"
          />
        </Field>
        <Field label="Tel / Fax no." htmlFor="tel-fax">
          <input
            id="tel-fax"
            className={inputClassName}
            value={form.tel_fax_no}
            onChange={(e) => set({ tel_fax_no: e.target.value })}
            placeholder="e.g. 079-1234 5678"
          />
        </Field>
        <Field label="Email ID" htmlFor="vendor-email" required error={fieldErrors.email}>
          <input
            id="vendor-email"
            className={err('email')}
            type="email"
            required={htmlRequired}
            aria-invalid={Boolean(fieldErrors.email)}
            value={form.email}
            onChange={(e) => {
              set({ email: e.target.value })
              if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: undefined })
            }}
            placeholder="vendor@company.com"
          />
        </Field>
        <Field label="GST no." htmlFor="gst-number" required error={fieldErrors.gst_number}>
          <input
            id="gst-number"
            className={`${err('gst_number')} font-mono uppercase`}
            required={htmlRequired}
            maxLength={15}
            aria-invalid={Boolean(fieldErrors.gst_number)}
            value={form.gst_number}
            onChange={(e) => {
              const gst = normalizeGstin(e.target.value).slice(0, 15)
              set({ gst_number: gst })
              if (fieldErrors.gst_number) setFieldErrors({ ...fieldErrors, gst_number: undefined })
            }}
            placeholder="e.g. 24AAAAA0000A1Z5"
          />
        </Field>
        <Field label="Zipcode" htmlFor="zipcode">
          <input
            id="zipcode"
            className={inputClassName}
            value={form.zipcode}
            onChange={(e) => set({ zipcode: e.target.value })}
            placeholder="e.g. 380015"
          />
        </Field>
        <Field label="Contact person" htmlFor="contact-name" wide>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[100px_1fr]">
            <select
              id="contact-title"
              className={inputClassName}
              value={form.contact_title}
              onChange={(e) => set({ contact_title: e.target.value })}
              aria-label="Title"
            >
              {CONTACT_TITLES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              id="contact-name"
              className={inputClassName}
              value={form.contact_name}
              onChange={(e) => set({ contact_name: e.target.value })}
              placeholder="e.g. Nisarg Patel"
            />
          </div>
        </Field>
      </Section>

      <Section title="Bank details">
        <Field label="Bank name" htmlFor="bank-name">
          <input
            id="bank-name"
            className={inputClassName}
            value={form.bank_name}
            onChange={(e) => set({ bank_name: e.target.value })}
            placeholder="e.g. HDFC Bank"
          />
        </Field>
        <Field label="Branch" htmlFor="bank-branch">
          <input
            id="bank-branch"
            className={inputClassName}
            value={form.bank_branch}
            onChange={(e) => set({ bank_branch: e.target.value })}
            placeholder="e.g. Navrangpura"
          />
        </Field>
        <Field label="Type of account" wide>
          <div className="flex flex-wrap gap-4 pt-1">
            {ACCOUNT_TYPE_OPTIONS.map((o) => (
              <label key={o.id} className="inline-flex items-center gap-2 text-sm text-primary">
                <input
                  type="radio"
                  name="account-type"
                  checked={form.account_type === o.id}
                  onChange={() => set({ account_type: o.id })}
                />
                {o.label}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Account no." htmlFor="account-no">
          <input
            id="account-no"
            className={inputClassName}
            value={form.account_no}
            onChange={(e) => set({ account_no: e.target.value })}
          />
        </Field>
        <Field label="IFS code" htmlFor="ifsc-code">
          <input
            id="ifsc-code"
            className={`${inputClassName} font-mono uppercase`}
            maxLength={11}
            value={form.ifsc_code}
            onChange={(e) => set({ ifsc_code: e.target.value.toUpperCase().slice(0, 11) })}
            placeholder="e.g. HDFC0000123"
          />
        </Field>
        <Field label="MICR code" htmlFor="micr-code">
          <input
            id="micr-code"
            className={`${inputClassName} font-mono`}
            maxLength={9}
            value={form.micr_code}
            onChange={(e) => set({ micr_code: e.target.value.replace(/\D/g, '').slice(0, 9) })}
          />
        </Field>
        <Field label="Mobile no." htmlFor="contact-number" error={fieldErrors.contact_phone}>
          <input
            id="contact-number"
            className={err('contact_phone')}
            inputMode="tel"
            maxLength={16}
            aria-invalid={Boolean(fieldErrors.contact_phone)}
            value={form.contact_phone}
            onChange={(e) => {
              set({ contact_phone: normalizeIndianMobile(e.target.value).slice(0, 16) })
              if (fieldErrors.contact_phone) {
                setFieldErrors({ ...fieldErrors, contact_phone: undefined })
              }
            }}
            placeholder="e.g. 9876543210"
          />
        </Field>
        <Field label="Residence no." htmlFor="residence-no">
          <input
            id="residence-no"
            className={inputClassName}
            value={form.residence_no}
            onChange={(e) => set({ residence_no: e.target.value })}
          />
        </Field>
      </Section>

      <Section title="Business profile">
        <Field label="Sister concerns, if any" htmlFor="sister-concerns" wide>
          <input
            id="sister-concerns"
            className={inputClassName}
            value={form.sister_concerns}
            onChange={(e) => set({ sister_concerns: e.target.value })}
          />
        </Field>
        <Field label="Reference (if any)" htmlFor="reference-note" wide>
          <input
            id="reference-note"
            className={inputClassName}
            value={form.reference_note}
            onChange={(e) => set({ reference_note: e.target.value })}
          />
        </Field>
        <Field
          label="Products, services, experience, processes, production capability and facilities"
          htmlFor="capability-notes"
          wide
        >
          <textarea
            id="capability-notes"
            className={`${inputClassName} min-h-[96px]`}
            value={form.capability_notes}
            onChange={(e) => set({ capability_notes: e.target.value })}
            placeholder="Briefly explain products, services, experience, processes, capability and facilities"
          />
        </Field>
        <Field label="Employee strength" htmlFor="employee-strength">
          <input
            id="employee-strength"
            className={inputClassName}
            value={form.employee_strength}
            onChange={(e) => set({ employee_strength: e.target.value })}
            placeholder="e.g. 45"
          />
        </Field>
        <Field label="Nos. of site / branch" htmlFor="site-branch-count">
          <input
            id="site-branch-count"
            className={inputClassName}
            value={form.site_branch_count}
            onChange={(e) => set({ site_branch_count: e.target.value })}
            placeholder="e.g. 2"
          />
        </Field>
        <Field label="Associated with our firm?" htmlFor="associated-with-firm">
          <YesNo
            name="associated-with-firm"
            value={form.associated_with_firm}
            onChange={(v) => set({ associated_with_firm: v, associated_years: v === 'no' ? '' : form.associated_years })}
            yesFirst
          />
        </Field>
        <Field label="Since how long? (years)" htmlFor="associated-years">
          <input
            id="associated-years"
            className={inputClassName}
            disabled={form.associated_with_firm === 'no'}
            value={form.associated_years}
            onChange={(e) => set({ associated_years: e.target.value })}
            placeholder="e.g. 3"
          />
        </Field>
        <Field label="Details of your speciality" htmlFor="speciality" wide>
          <textarea
            id="speciality"
            className={`${inputClassName} min-h-[72px]`}
            value={form.speciality}
            onChange={(e) => set({ speciality: e.target.value })}
          />
        </Field>
        <Field
          label="Any objection to visit for inspection, audit, or review of records?"
          wide
        >
          <YesNo
            name="inspection-objection"
            value={form.inspection_objection}
            onChange={(v) =>
              set({
                inspection_objection: v,
                inspection_objection_details: v === 'no' ? '' : form.inspection_objection_details,
              })
            }
          />
        </Field>
        {form.inspection_objection === 'yes' ? (
          <Field label="Document your objections" htmlFor="inspection-objection-details" wide>
            <textarea
              id="inspection-objection-details"
              className={`${inputClassName} min-h-[72px]`}
              value={form.inspection_objection_details}
              onChange={(e) => set({ inspection_objection_details: e.target.value })}
            />
          </Field>
        ) : null}
      </Section>

      <Section title="To be filled by company" note="Internal recommendation for approved supplier.">
        <Field label="Recommendation" wide>
          <div className="flex flex-col gap-2 pt-1 text-sm text-primary">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="recommended"
                checked={form.recommended === 'yes'}
                onChange={() => set({ recommended: 'yes' })}
              />
              Recommended as approved supplier
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="recommended"
                checked={form.recommended === 'no'}
                onChange={() => set({ recommended: 'no' })}
              />
              Not recommended as approved supplier
            </label>
          </div>
        </Field>
        <Field label="Reason for approval / rejection" wide>
          <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
            {APPROVAL_REASON_OPTIONS.map((o) => (
              <label key={o.id} className="inline-flex items-center gap-2 text-sm text-primary">
                <input
                  type="checkbox"
                  checked={form.approval_reasons.includes(o.id)}
                  onChange={() => toggleReason(o.id)}
                />
                {o.label}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Additional reason notes" htmlFor="approval-reason-notes" wide>
          <input
            id="approval-reason-notes"
            className={inputClassName}
            value={form.approval_reason_notes}
            onChange={(e) => set({ approval_reason_notes: e.target.value })}
          />
        </Field>
        <Field label="Name of authorised person" htmlFor="approver-name">
          <input
            id="approver-name"
            className={inputClassName}
            value={form.approver_name}
            onChange={(e) => set({ approver_name: e.target.value })}
          />
        </Field>
        <Field label="Designation" htmlFor="approver-designation">
          <input
            id="approver-designation"
            className={inputClassName}
            value={form.approver_designation}
            onChange={(e) => set({ approver_designation: e.target.value })}
          />
        </Field>
        <Field label="Sign date" htmlFor="approved-at">
          <input
            id="approved-at"
            type="date"
            className={inputClassName}
            value={form.approved_at}
            onChange={(e) => set({ approved_at: e.target.value })}
          />
        </Field>
      </Section>
    </div>
  )
}
