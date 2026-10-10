'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Pencil, Plus, UserX } from 'lucide-react'
import clsx from 'clsx'
import { employeesApi } from '@/lib/api'
import {
  DEPARTMENT_OPTIONS,
  EMPLOYMENT_STATUS_OPTIONS,
  employmentStatusLabel,
} from '@/lib/employee'
import { useToast } from '@/components/providers/ToastProvider'
import { EmptyState, SmartFilterBar, useConfirm, useSmartFilter } from '@/components/ui'
import { MobileCard, MobileListToolbar } from '@/components/inventory/MobileList'
import type { Factory } from '@/types'

type EmployeeRow = {
  id: string
  employee_code: string
  full_name: string
  department: string
  designation: string
  employment_status: string
  factory_name: string | null
  is_active: boolean
}

export default function EmployeesPanel({
  assignedFactoryIds,
}: {
  factories: Factory[]
  assignedFactoryIds: string[]
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const [rows, setRows] = useState<EmployeeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    const data = await employeesApi.list()
    if (data.error) setError(data.error)
    setRows((data.employees ?? []) as EmployeeRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const filter = useSmartFilter(rows, {
    getSearchText: (r) => [
      r.employee_code,
      r.full_name,
      r.department,
      r.designation,
      r.factory_name,
    ],
    facets: [
      {
        key: 'department',
        label: 'Department',
        getValue: (r) => r.department,
        options: DEPARTMENT_OPTIONS.map((d) => ({ id: d, label: d })),
      },
      {
        key: 'status',
        label: 'Status',
        getValue: (r) => r.employment_status,
        options: EMPLOYMENT_STATUS_OPTIONS.map((s) => ({ id: s.value, label: s.label })),
      },
      {
        key: 'factory',
        label: 'Factory',
        getValue: (r) => r.factory_name || '—',
      },
    ],
  })
  const [sortCol, setSortCol] = useState<'code' | 'name' | 'department' | 'status'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filter.filtered].sort((a, b) => {
      let cmp = 0
      switch (sortCol) {
        case 'code':
          cmp = a.employee_code.localeCompare(b.employee_code)
          break
        case 'department':
          cmp = a.department.localeCompare(b.department)
          break
        case 'status':
          cmp = a.employment_status.localeCompare(b.employment_status)
          break
        case 'name':
        default:
          cmp = a.full_name.localeCompare(b.full_name)
          break
      }
      return cmp * dir || a.full_name.localeCompare(b.full_name)
    })
  }, [filter.filtered, sortCol, sortDir])

  function handleSort(col: typeof sortCol) {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  async function deactivate(row: EmployeeRow) {
    const ok = await confirm({
      title: 'Deactivate employee?',
      body: `${row.full_name} will be marked terminated and will no longer appear in active employee lists.`,
      confirmLabel: 'Deactivate',
      destructive: true,
    })
    if (!ok) return
    const data = await employeesApi.deactivate(row.id)
    if (data.error) {
      toast.error(data.error)
      return
    }
    toast.success(`${row.full_name} deactivated`)
    void reload()
  }

  return (
    <div>
      {assignedFactoryIds.length === 0 && (
        <div className="card mb-4 p-6">
          <p className="text-sm text-muted">
            No factories assigned to your account yet. Ask the platform admin to assign factories first.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="md:overflow-hidden md:rounded-xl md:border md:border-border">
        {!loading && rows.length > 0 && (
          <>
            <div className="hidden md:block">
              <SmartFilterBar
                filter={filter}
                placeholder="Search name, code, department…"
                accent="owner"
                actions={
                  <Link href="/inventory/owner/employees/new" className="btn btn-owner h-10 gap-2">
                    <Plus size={16} /> Add Employee
                  </Link>
                }
              />
            </div>
            <div className="md:hidden">
              <Link href="/inventory/owner/employees/new" className="btn btn-owner mb-3 h-11 w-full gap-2">
                <Plus size={16} /> Add Employee
              </Link>
              <MobileListToolbar
                filter={filter}
                placeholder="Search name, code, department…"
                resultCount={sorted.length}
                noun={{ one: 'employee', many: 'employees' }}
                sortOptions={[
                  { col: 'name', label: 'Name', kind: 'text' },
                  { col: 'code', label: 'Code', kind: 'text' },
                  { col: 'department', label: 'Department', kind: 'text' },
                  { col: 'status', label: 'Status', kind: 'text' },
                ]}
                sortCol={sortCol}
                sortDir={sortDir}
                onSort={handleSort}
              />
            </div>
          </>
        )}
        {loading ? (
          <p className="px-5 py-10 text-center text-sm text-muted">Loading employees…</p>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <p className="text-sm text-muted">No employees yet.</p>
            <Link href="/inventory/owner/employees/new" className="btn btn-owner gap-2">
              <Plus size={15} /> Add your first employee
            </Link>
          </div>
        ) : filter.filtered.length === 0 ? (
          <EmptyState
            title="No employees match"
            description="Try a different search or clear the filter chips."
            action={
              filter.isFiltering ? (
                <button
                  type="button"
                  onClick={() => {
                    filter.setSearch('')
                    filter.clearAll()
                  }}
                  className="btn btn-ghost text-sm"
                >
                  Clear all
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {sorted.map((row) => (
                <MobileCard
                  key={row.id}
                  id={row.employee_code}
                  title={row.full_name}
                  subtitle={`${row.department} · ${row.designation}`}
                  aside={
                    <span className={clsx('badge', row.is_active ? 'badge-owner' : 'badge-chemist')}>
                      {employmentStatusLabel(row.employment_status)}
                    </span>
                  }
                  rows={[{ label: 'Factory', value: row.factory_name ?? '—' }]}
                  footer={
                    <div className="flex gap-2">
                      <Link
                        href={`/inventory/owner/employees/${row.id}`}
                        className="btn flex-1 border border-text bg-panel text-primary"
                      >
                        <Pencil size={14} /> Edit
                      </Link>
                      {row.is_active ? (
                        <button
                          type="button"
                          onClick={() => void deactivate(row)}
                          className="btn flex-1 border border-red-300 bg-panel text-red-600"
                        >
                          <UserX size={14} /> Deactivate
                        </button>
                      ) : null}
                    </div>
                  }
                />
              ))}
            </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Designation</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Factory</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((row) => (
                  <tr key={row.id} className={clsx(!row.is_active && 'opacity-60')}>
                    <td className="px-4 py-3 font-mono text-xs">{row.employee_code}</td>
                    <td className="px-4 py-3 font-medium text-primary">{row.full_name}</td>
                    <td className="px-4 py-3">{row.department}</td>
                    <td className="px-4 py-3">{row.designation}</td>
                    <td className="px-4 py-3">
                      <span className={clsx('badge', row.is_active ? 'badge-owner' : 'badge-chemist')}>
                        {employmentStatusLabel(row.employment_status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">{row.factory_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/inventory/owner/employees/${row.id}`}
                          className="btn btn-ghost gap-1 text-xs"
                        >
                          <Pencil size={14} /> Edit
                        </Link>
                        {row.is_active && (
                          <button
                            type="button"
                            onClick={() => void deactivate(row)}
                            className="btn btn-ghost gap-1 text-xs text-red-400"
                          >
                            <UserX size={14} /> Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </div>
  )
}
