import { useMemo, useState } from 'react'
import { Navigate } from '@/crm/router'
import { Pencil, Plus, Search, Trash2, UserRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  USER_ROLE_LABELS,
  type AppUser,
  type AppUserInput,
  type UserRole,
} from '../types/auth'
import { Button, Card, Field, Input, Select } from '../components/ui/Form'

const emptyForm = (): AppUserInput => ({
  name: '',
  username: '',
  password: '',
  role: 'sales',
  active: true,
  phone: '',
  email: '',
  whatsapp: '',
})

export function UsersPage() {
  const { user, users, saveUser, deleteUser } = useAuth()
  const [query, setQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AppUserInput>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const flash = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2200)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = !q
      ? users
      : users.filter((u) => {
          const hay = [
            u.name,
            u.username,
            u.phone,
            u.email,
            u.whatsapp,
            USER_ROLE_LABELS[u.role],
          ]
            .join(' ')
            .toLowerCase()
          return hay.includes(q)
        })
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [users, query])

  if (!user || user.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm())
    setError(null)
    setShowForm(true)
  }

  const openEdit = (u: AppUser) => {
    setEditingId(u.id)
    setForm({
      name: u.name,
      username: u.username,
      password: u.password,
      role: u.role,
      active: u.active,
      phone: u.phone || '',
      email: u.email || '',
      whatsapp: u.whatsapp || '',
    })
    setError(null)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm())
    setError(null)
  }

  const handleSave = () => {
    try {
      const record = saveUser(form, editingId || undefined)
      flash(editingId ? `Updated ${record.name}` : `Added ${record.name}`)
      closeForm()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  const handleDelete = (u: AppUser) => {
    if (!window.confirm(`Delete user “${u.name}”?`)) return
    try {
      deleteUser(u.id)
      flash(`Deleted ${u.name}`)
      if (editingId === u.id) closeForm()
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
            Masters
          </p>
          <h1 className="mt-1 font-display text-3xl tracking-tight text-ink">
            Users
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Login accounts plus phone / email for the Team directory. Bookings
            and payments are tagged to the signed-in user.
          </p>
        </div>
        {!showForm && (
          <Button type="button" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add user
          </Button>
        )}
      </div>

      {showForm && (
        <Card
          title={editingId ? 'Edit user' : 'Add user'}
          description="Username is used to sign in. Contact fields appear on Team for everyone."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
              />
            </Field>
            <Field label="Username" required>
              <Input
                value={form.username}
                onChange={(e) =>
                  setForm((p) => ({ ...p, username: e.target.value }))
                }
                autoComplete="off"
              />
            </Field>
            <Field label="Password" required>
              <Input
                type="text"
                value={form.password}
                onChange={(e) =>
                  setForm((p) => ({ ...p, password: e.target.value }))
                }
                autoComplete="new-password"
              />
            </Field>
            <Field label="Role" required>
              <Select
                value={form.role}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    role: e.target.value as UserRole,
                  }))
                }
              >
                {(Object.keys(USER_ROLE_LABELS) as UserRole[]).map((r) => (
                  <option key={r} value={r}>
                    {USER_ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Phone" hint="Shown on Team directory">
              <Input
                value={form.phone}
                onChange={(e) =>
                  setForm((p) => ({ ...p, phone: e.target.value }))
                }
                placeholder="e.g. 98765 43210"
              />
            </Field>
            <Field label="Email" hint="Shown on Team directory">
              <Input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((p) => ({ ...p, email: e.target.value }))
                }
                placeholder="name@company.com"
              />
            </Field>
            <Field label="WhatsApp" hint="Defaults to phone if empty">
              <Input
                value={form.whatsapp}
                onChange={(e) =>
                  setForm((p) => ({ ...p, whatsapp: e.target.value }))
                }
                placeholder="Optional"
              />
            </Field>
            <Field label="Active">
              <Select
                value={form.active ? 'yes' : 'no'}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    active: e.target.value === 'yes',
                  }))
                }
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </Select>
            </Field>
          </div>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
          <div className="mt-4 flex gap-2">
            <Button type="button" onClick={handleSave}>
              Save user
            </Button>
            <Button type="button" variant="ghost" onClick={closeForm}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, phone, email, role…"
            />
          </div>
          <p className="text-xs text-ink-muted">
            {filtered.length} of {users.length}
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line px-6 py-12 text-center">
            <UserRound className="mx-auto h-10 w-10 text-ink-muted" />
            <p className="mt-3 text-sm font-semibold text-ink">No users</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface-2/80 text-xs uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Name</th>
                  <th className="px-3 py-2.5 font-semibold">Contact</th>
                  <th className="px-3 py-2.5 font-semibold">Username</th>
                  <th className="px-3 py-2.5 font-semibold">Role</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr
                    key={u.id}
                    className="border-t border-line hover:bg-surface-2/40"
                  >
                    <td className="px-3 py-3 font-semibold text-ink">
                      {u.name}
                      {u.id === user.id && (
                        <span className="ml-2 text-[11px] font-medium text-brand">
                          you
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-ink-muted">
                      <p className="tabular-nums">{u.phone || '—'}</p>
                      <p className="text-xs">{u.email || '—'}</p>
                    </td>
                    <td className="px-3 py-3 tabular-nums text-ink-muted">
                      {u.username}
                    </td>
                    <td className="px-3 py-3">{USER_ROLE_LABELS[u.role]}</td>
                    <td className="px-3 py-3">
                      {u.active ? (
                        <span className="text-success">Active</span>
                      ) : (
                        <span className="text-ink-faint">Inactive</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className="rounded-lg p-2 text-ink-muted hover:bg-surface-2 hover:text-ink"
                          onClick={() => openEdit(u)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg p-2 text-ink-muted hover:bg-danger/10 hover:text-danger disabled:opacity-40"
                          onClick={() => handleDelete(u)}
                          title="Delete"
                          disabled={u.id === user.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
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
