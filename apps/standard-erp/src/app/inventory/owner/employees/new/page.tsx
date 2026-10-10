'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@madstoq/ui/erp-page-header'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/providers/ToastProvider'
import { employeesApi, usersApi } from '@/lib/api'
import { EMPTY_EMPLOYEE_FORM, formToPayload } from '@/lib/employee'
import EmployeeForm, { type LinkableProfile } from '@/components/inventory/EmployeeForm'
import type { Factory } from '@/types'

const ROLE_HOME: Record<string, string> = {
  owner: '/inventory/owner',
  chemist: '/inventory/chemist',
  plant_supervisor: '/inventory/chemist',
  lab_incharge: '/inventory/lab',
  warehouse_manager: '/inventory/warehouse',
  accountant: '/inventory/accountant',
  inputer: '/inventory/inputer',
}

export default function NewEmployeePage() {
  const router = useRouter()
  const toast = useToast()
  const { profile, loading: authLoading } = useAuth()
  const [form, setForm] = useState(EMPTY_EMPLOYEE_FORM)
  const [factories, setFactories] = useState<Factory[]>([])
  const [assignedFactoryIds, setAssignedFactoryIds] = useState<string[]>([])
  const [linkableProfiles, setLinkableProfiles] = useState<LinkableProfile[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!profile) return
    if (profile.role !== 'owner') {
      router.replace(ROLE_HOME[profile.role] ?? '/inventory/login')
    }
  }, [authLoading, profile, router])

  useEffect(() => {
    if (authLoading || profile?.role !== 'owner') return
    const fromProfile = (profile.factories ?? []) as Factory[]
    if (fromProfile.length > 0) {
      setFactories(fromProfile)
      setAssignedFactoryIds(fromProfile.map((f) => f.id))
      const onlyFactory = fromProfile[0]
      if (onlyFactory) {
        setForm((prev) => (prev.factory_id ? prev : { ...prev, factory_id: onlyFactory.id }))
      }
    }
    void (async () => {
      const data = await usersApi.getAll()
      const list = (data.factories ?? fromProfile) as Factory[]
      const assigned = (data.assignedFactories ?? list.map((f) => f.id)) as string[]
      setFactories(list)
      setAssignedFactoryIds(assigned)
      const onlyFactory = assigned[0]
      if (onlyFactory) {
        setForm((prev) => (prev.factory_id ? prev : { ...prev, factory_id: onlyFactory }))
      }
    })()
  }, [authLoading, profile])

  useEffect(() => {
    if (!form.factory_id) {
      setLinkableProfiles([])
      return
    }
    void (async () => {
      const data = await employeesApi.list(form.factory_id, true)
      setLinkableProfiles((data.linkable_profiles ?? []) as LinkableProfile[])
    })()
  }, [form.factory_id])

  async function save() {
    setSaving(true)
    setError('')
    const data = await employeesApi.create(formToPayload(form))
    if (data.error) {
      setSaving(false)
      setError(data.error)
      toast.error(data.error)
      return
    }
    const id = data.employee?.id as string | undefined
    setSaving(false)
    toast.success(`Employee "${form.full_name}" created`)
    router.push(id ? `/inventory/owner/employees/${id}` : '/inventory/owner/management')
  }

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-4xl p-4 md:p-8">
        <PageHeader
          title="Add employee"
          subtitle="Owner · HR directory"
          accent="owner"
          actions={
            <Link href="/inventory/owner/management" className="text-sm text-owner hover:underline">
              ← Management
            </Link>
          }
        />
        <div className="mt-6">
          <EmployeeForm
            form={form}
            setForm={setForm}
            factories={factories}
            assignedFactoryIds={assignedFactoryIds}
            linkableProfiles={linkableProfiles}
            saving={saving}
            error={error}
            submitLabel="Create employee"
            extraNote={
              <p className="text-sm text-muted">
                Documents (PAN, Aadhaar, photo, letters) can be added after you save.
              </p>
            }
            onSubmit={() => void save()}
            isNew
          />
        </div>
      </div>
    </AppLayout>
  )
}
