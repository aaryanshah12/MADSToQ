'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@madstoq/ui/erp-page-header'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/providers/ToastProvider'
import { employeesApi, usersApi } from '@/lib/api'
import {
  EMPTY_EMPLOYEE_FORM,
  formToPayload,
  moneyToInput,
  type EmployeeFormValues,
} from '@/lib/employee'
import EmployeeForm, { type LinkableProfile } from '@/components/inventory/EmployeeForm'
import EmployeeDocuments, {
  type EmployeeDocumentRow,
} from '@/components/inventory/EmployeeDocuments'
import type { Factory } from '@/types'
import { SkeletonPanel } from '@/components/ui'

const ROLE_HOME: Record<string, string> = {
  owner: '/inventory/owner',
  chemist: '/inventory/chemist',
  plant_supervisor: '/inventory/chemist',
  lab_incharge: '/inventory/lab',
  warehouse_manager: '/inventory/warehouse',
  accountant: '/inventory/accountant',
  inputer: '/inventory/inputer',
}

function employeeToForm(row: Record<string, unknown>): EmployeeFormValues {
  return {
    ...EMPTY_EMPLOYEE_FORM,
    factory_id: String(row.factory_id ?? ''),
    employee_code: String(row.employee_code ?? ''),
    full_name: String(row.full_name ?? ''),
    father_name: String(row.father_name ?? ''),
    gender: String(row.gender ?? ''),
    date_of_birth: String(row.date_of_birth ?? ''),
    department: String(row.department ?? ''),
    designation: String(row.designation ?? ''),
    employment_type: String(row.employment_type ?? 'permanent'),
    employment_status: String(row.employment_status ?? 'active'),
    joining_date: String(row.joining_date ?? ''),
    leaving_date: String(row.leaving_date ?? ''),
    phone: String(row.phone ?? ''),
    email: String(row.email ?? ''),
    current_address: String(row.current_address ?? ''),
    permanent_address: String(row.permanent_address ?? ''),
    emergency_contact_name: String(row.emergency_contact_name ?? ''),
    emergency_contact_phone: String(row.emergency_contact_phone ?? ''),
    emergency_contact_relation: String(row.emergency_contact_relation ?? ''),
    blood_group: String(row.blood_group ?? ''),
    pan: String(row.pan ?? ''),
    aadhaar: String(row.aadhaar ?? ''),
    uan: String(row.uan ?? ''),
    pf_number: String(row.pf_number ?? ''),
    esi_number: String(row.esi_number ?? ''),
    bank_name: String(row.bank_name ?? ''),
    account_holder_name: String(row.account_holder_name ?? ''),
    account_number: String(row.account_number ?? ''),
    ifsc: String(row.ifsc ?? ''),
    monthly_gross: moneyToInput(row.monthly_gross),
    annual_ctc: moneyToInput(row.annual_ctc),
    basic_pay: moneyToInput(row.basic_pay),
    pf_eligible: Boolean(row.pf_eligible),
    esi_eligible: Boolean(row.esi_eligible),
    profile_id: String(row.profile_id ?? ''),
  }
}

export default function EditEmployeePage() {
  const params = useParams()
  const id = String(params.id ?? '')
  const router = useRouter()
  const toast = useToast()
  const { profile, loading: authLoading } = useAuth()
  const [form, setForm] = useState(EMPTY_EMPLOYEE_FORM)
  const [name, setName] = useState('Employee')
  const [factories, setFactories] = useState<Factory[]>([])
  const [assignedFactoryIds, setAssignedFactoryIds] = useState<string[]>([])
  const [linkableProfiles, setLinkableProfiles] = useState<LinkableProfile[]>([])
  const [documents, setDocuments] = useState<EmployeeDocumentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!profile) return
    if (profile.role !== 'owner') {
      router.replace(ROLE_HOME[profile.role] ?? '/inventory/login')
    }
  }, [authLoading, profile, router])

  const reload = useCallback(async () => {
    if (!id || profile?.role !== 'owner') return
    setLoading(true)
    const [detail, users] = await Promise.all([employeesApi.get(id), usersApi.getAll()])
    const list = (users.factories ?? []) as Factory[]
    const assigned = (users.assignedFactories ?? list.map((f) => f.id)) as string[]
    setFactories(list)
    setAssignedFactoryIds(assigned)
    if (detail.error) {
      setError(detail.error)
      setLoading(false)
      return
    }
    setForm(employeeToForm(detail.employee ?? {}))
    setName(String(detail.employee?.full_name ?? 'Employee'))
    setDocuments((detail.documents ?? []) as EmployeeDocumentRow[])
    setLinkableProfiles((detail.linkable_profiles ?? []) as LinkableProfile[])
    setLoading(false)
  }, [id, profile?.role])

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  useEffect(() => {
    if (!form.factory_id || loading) return
    void (async () => {
      const data = await employeesApi.list(form.factory_id, true)
      const extra = (data.linkable_profiles ?? []) as LinkableProfile[]
      setLinkableProfiles((prev) => {
        const byId = new Map(extra.map((p) => [p.id, p]))
        for (const p of prev) byId.set(p.id, p)
        return Array.from(byId.values())
      })
    })()
  }, [form.factory_id, loading])

  async function save() {
    setSaving(true)
    setError('')
    const data = await employeesApi.update(id, formToPayload(form))
    setSaving(false)
    if (data.error) {
      setError(data.error)
      toast.error(data.error)
      return
    }
    toast.success('Employee updated')
    setName(form.full_name)
    if (data.documents) setDocuments(data.documents as EmployeeDocumentRow[])
  }

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-4xl p-4 md:p-8">
        <PageHeader
          title={name}
          subtitle="Owner · Edit employee"
          accent="owner"
          actions={
            <Link href="/inventory/owner/management" className="text-sm text-owner hover:underline">
              ← Management
            </Link>
          }
        />
        {loading ? (
          <SkeletonPanel className="mt-6" />
        ) : (
          <div className="mt-6 space-y-5">
            <EmployeeForm
              form={form}
              setForm={setForm}
              factories={factories}
              assignedFactoryIds={assignedFactoryIds}
              linkableProfiles={linkableProfiles}
              saving={saving}
              error={error}
              submitLabel="Save employee"
              onSubmit={() => void save()}
            />
            <EmployeeDocuments
              employeeId={id}
              documents={documents}
              onChanged={() => void reload()}
            />
          </div>
        )}
      </div>
    </AppLayout>
  )
}
