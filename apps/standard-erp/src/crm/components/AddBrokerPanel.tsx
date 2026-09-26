import { useState } from 'react'
import { useBrokers } from '../context/BrokerContext'
import {
  AGENCY_RELATION_LABELS,
  BROKER_ORG_LABELS,
  createEmptyBrokerProfile,
  type AgencyRelation,
  type BrokerOrgType,
  type BrokerProfile,
  type BrokerRecord,
} from '../types/sales'
import { Button, Field, Input, Select } from './ui/Form'

export function AddBrokerPanel({
  onSaved,
  onCancel,
}: {
  onSaved: (broker: BrokerRecord) => void
  onCancel: () => void
}) {
  const { saveBroker } = useBrokers()
  const [form, setForm] = useState<BrokerProfile>(() =>
    createEmptyBrokerProfile(),
  )
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof BrokerProfile>(key: K, value: BrokerProfile[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSave = () => {
    if (!form.fullName.trim()) {
      setError('Broker full name is required')
      return
    }
    if (!form.phone.trim()) {
      setError('Contact number is required')
      return
    }
    const record = saveBroker({
      ...form,
      fullName: form.fullName.trim(),
      firmName: form.firmName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      licenseNumber: form.licenseNumber.trim(),
      gstNumber: form.gstNumber.trim(),
      bankAccountName: form.bankAccountName.trim(),
      bankAccountNumber: form.bankAccountNumber.trim(),
      bankIfsc: form.bankIfsc.trim(),
      bankName: form.bankName.trim(),
      associatedAgency: form.associatedAgency.trim(),
    })
    onSaved(record)
  }

  return (
    <BrokerProfileFields
      form={form}
      set={set}
      error={error}
      title="Add broker"
      description="Saved to broker master and selected on this booking."
      onSave={handleSave}
      onCancel={onCancel}
    />
  )
}

export function BrokerProfileFields({
  form,
  set,
  error,
  title,
  description,
  onSave,
  onCancel,
}: {
  form: BrokerProfile
  set: <K extends keyof BrokerProfile>(key: K, value: BrokerProfile[K]) => void
  error: string | null
  title: string
  description: string
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-brand/30 bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">{title}</p>
          <p className="text-xs text-ink-muted">{description}</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Close
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Broker full name" required>
          <Input
            value={form.fullName}
            onChange={(e) => set('fullName', e.target.value)}
          />
        </Field>
        <Field label="Business / firm name">
          <Input
            value={form.firmName}
            onChange={(e) => set('firmName', e.target.value)}
          />
        </Field>
        <Field label="Organisation type">
          <Select
            value={form.orgType}
            onChange={(e) => set('orgType', e.target.value as BrokerOrgType)}
          >
            {(Object.keys(BROKER_ORG_LABELS) as BrokerOrgType[]).map((t) => (
              <option key={t} value={t}>
                {BROKER_ORG_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Contact number" required>
          <Input
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
          />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
          />
        </Field>
        <Field label="License number">
          <Input
            value={form.licenseNumber}
            onChange={(e) => set('licenseNumber', e.target.value)}
          />
        </Field>
        <Field label="GST number">
          <Input
            value={form.gstNumber}
            onChange={(e) => set('gstNumber', e.target.value)}
          />
        </Field>
        <Field label="Agency relation">
          <Select
            value={form.agencyRelation}
            onChange={(e) =>
              set('agencyRelation', e.target.value as AgencyRelation)
            }
          >
            {(Object.keys(AGENCY_RELATION_LABELS) as AgencyRelation[]).map(
              (r) => (
                <option key={r} value={r}>
                  {AGENCY_RELATION_LABELS[r]}
                </option>
              ),
            )}
          </Select>
        </Field>
        <Field
          label="Associated / parent / sister agency"
          className="sm:col-span-2"
        >
          <Input
            value={form.associatedAgency}
            onChange={(e) => set('associatedAgency', e.target.value)}
            placeholder="Agency or company name"
          />
        </Field>
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold text-ink">Bank account details</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Account holder name">
            <Input
              value={form.bankAccountName}
              onChange={(e) => set('bankAccountName', e.target.value)}
            />
          </Field>
          <Field label="Account number">
            <Input
              value={form.bankAccountNumber}
              onChange={(e) => set('bankAccountNumber', e.target.value)}
            />
          </Field>
          <Field label="IFSC">
            <Input
              value={form.bankIfsc}
              onChange={(e) => set('bankIfsc', e.target.value)}
            />
          </Field>
          <Field label="Bank name">
            <Input
              value={form.bankName}
              onChange={(e) => set('bankName', e.target.value)}
            />
          </Field>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" onClick={onSave}>
          Save broker
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
