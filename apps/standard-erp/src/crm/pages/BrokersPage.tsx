import { useMemo, useState } from 'react'
import { Handshake, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useBrokers } from '../context/BrokerContext'
import { useAuth } from '../context/AuthContext'
import { BrokerProfileFields } from '../components/AddBrokerPanel'
import { Button, Card, Input } from '../components/ui/Form'
import {
  AGENCY_RELATION_LABELS,
  BROKER_ORG_LABELS,
  createEmptyBrokerProfile,
  type BrokerProfile,
  type BrokerRecord,
} from '../types/sales'

function profileFromRecord(b: BrokerRecord): BrokerProfile {
  return {
    fullName: b.fullName,
    firmName: b.firmName,
    phone: b.phone,
    email: b.email,
    orgType: b.orgType,
    licenseNumber: b.licenseNumber,
    gstNumber: b.gstNumber,
    bankAccountName: b.bankAccountName,
    bankAccountNumber: b.bankAccountNumber,
    bankIfsc: b.bankIfsc,
    bankName: b.bankName,
    associatedAgency: b.associatedAgency,
    agencyRelation: b.agencyRelation,
  }
}

export function BrokersPage() {
  const { brokers, saveBroker, deleteBroker } = useBrokers()
  const { user } = useAuth()
  const canManageBrokers = user?.role === 'admin'
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<BrokerProfile>(() =>
    createEmptyBrokerProfile(),
  )
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const flash = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2200)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = !q
      ? brokers
      : brokers.filter((b) => {
          const hay = [
            b.fullName,
            b.firmName,
            b.phone,
            b.email,
            b.licenseNumber,
            b.gstNumber,
            b.associatedAgency,
            b.bankName,
            BROKER_ORG_LABELS[b.orgType],
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
          return hay.includes(q)
        })
    return [...list].sort((a, b) =>
      a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' }),
    )
  }, [brokers, query])

  const set = <K extends keyof BrokerProfile>(
    key: K,
    value: BrokerProfile[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }))

  const openCreate = () => {
    setEditingId(null)
    setForm(createEmptyBrokerProfile())
    setError(null)
    setShowForm(true)
  }

  const openEdit = (b: BrokerRecord) => {
    setEditingId(b.id)
    setForm(profileFromRecord(b))
    setError(null)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(createEmptyBrokerProfile())
    setError(null)
  }

  const handleSave = () => {
    if (!form.fullName.trim()) {
      setError('Broker full name is required')
      return
    }
    if (!form.phone.trim()) {
      setError('Contact number is required')
      return
    }
    const record = saveBroker(
      {
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
      },
      editingId || undefined,
    )
    flash(
      editingId
        ? `Updated ${record.fullName}`
        : `Added ${record.fullName} to broker master`,
    )
    closeForm()
  }

  const handleDelete = (b: BrokerRecord) => {
    if (
      !window.confirm(
        `Delete broker “${b.fullName}”? Existing bookings keep their saved broker snapshot.`,
      )
    ) {
      return
    }
    deleteBroker(b.id)
    if (editingId === b.id) closeForm()
    flash(`Deleted ${b.fullName}`)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
            Masters
          </p>
          <h1 className="mt-1 font-display text-3xl tracking-tight text-ink">
            Brokers
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Master list of brokers — used when a booking is via broker.
          </p>
        </div>
        {canManageBrokers && !showForm && (
          <Button type="button" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add broker
          </Button>
        )}
      </div>

      {canManageBrokers && showForm && (
        <BrokerProfileFields
          form={form}
          set={set}
          error={error}
          title={editingId ? 'Edit broker' : 'Add broker'}
          description={
            editingId
              ? 'Update master details. Bookings already saved keep their own snapshot until re-selected.'
              : 'Saved to broker master and available in booking Select broker.'
          }
          onSave={handleSave}
          onCancel={closeForm}
        />
      )}

      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, phone, firm, GST…"
            />
          </div>
          <p className="text-xs text-ink-muted">
            {filtered.length} of {brokers.length} broker
            {brokers.length === 1 ? '' : 's'}
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line px-6 py-12 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-ink-muted">
              <Handshake className="h-6 w-6" />
            </span>
            <p className="mt-4 text-sm font-semibold text-ink">
              {brokers.length === 0 ? 'No brokers yet' : 'No matches'}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {brokers.length === 0
                ? canManageBrokers
                  ? 'Add a broker here or from a booking form.'
                  : 'Ask an admin to add brokers to the master list.'
                : 'Try a different search.'}
            </p>
            {canManageBrokers && brokers.length === 0 && (
              <Button type="button" className="mt-4" size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Add broker
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface-2/80 text-xs uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Broker</th>
                  <th className="px-3 py-2.5 font-semibold">Contact</th>
                  <th className="hidden px-3 py-2.5 font-semibold md:table-cell">
                    Org
                  </th>
                  <th className="hidden px-3 py-2.5 font-semibold lg:table-cell">
                    GST / License
                  </th>
                  <th className="hidden px-3 py-2.5 font-semibold xl:table-cell">
                    Bank
                  </th>
                  {canManageBrokers && (
                    <th className="px-3 py-2.5 font-semibold" />
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr
                    key={b.id}
                    className="border-t border-line hover:bg-surface-2/40"
                  >
                    <td className="px-3 py-3">
                      <p className="font-semibold text-ink">{b.fullName}</p>
                      <p className="text-xs text-ink-muted">
                        {b.firmName || '—'}
                        {b.associatedAgency
                          ? ` · ${AGENCY_RELATION_LABELS[b.agencyRelation]}: ${b.associatedAgency}`
                          : ''}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="tabular-nums text-ink">{b.phone}</p>
                      <p className="text-xs text-ink-muted">{b.email || '—'}</p>
                    </td>
                    <td className="hidden px-3 py-3 md:table-cell">
                      {BROKER_ORG_LABELS[b.orgType]}
                    </td>
                    <td className="hidden px-3 py-3 text-xs text-ink-muted lg:table-cell">
                      <p>{b.gstNumber || '—'}</p>
                      <p>{b.licenseNumber || '—'}</p>
                    </td>
                    <td className="hidden px-3 py-3 text-xs text-ink-muted xl:table-cell">
                      {b.bankName || b.bankAccountNumber ? (
                        <>
                          <p>{b.bankName || '—'}</p>
                          <p className="tabular-nums">
                            {b.bankAccountNumber || '—'}
                            {b.bankIfsc ? ` · ${b.bankIfsc}` : ''}
                          </p>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    {canManageBrokers && (
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            className="rounded-lg p-2 text-ink-muted hover:bg-surface-2 hover:text-ink"
                            title="Edit"
                            onClick={() => openEdit(b)}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded-lg p-2 text-ink-muted hover:bg-danger/10 hover:text-danger"
                            title="Delete"
                            onClick={() => handleDelete(b)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-canvas shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
