'use client'
import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@/components/ui/PageHeader'
import { usersApi } from '@/lib/api'
import { Profile } from '@/types'
import clsx from 'clsx'
import { UserCheck, UserX, Plus, CheckCircle, Pencil, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const EMPTY_NEW_USER = { full_name: '', email: '', phone: '', role: 'inputer', password: '', factory_ids: [] as string[] }

export default function OwnerUsersPage() {
  const { profile, loading: authLoading } = useAuth()
  const [users, setUsers]           = useState<Profile[]>([])
  const [factories, setFactories]   = useState<any[]>([])
  const [pfMap, setPfMap]           = useState<Record<string, string[]>>({})
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [showForm, setShowForm]     = useState(false)
  const [addError, setAddError]     = useState('')
  const [addSuccess, setAddSuccess] = useState('')
  const [newUser, setNewUser]       = useState(EMPTY_NEW_USER)
  const [loadError, setLoadError]   = useState('')
  const [assignedFactoryIds, setAssignedFactoryIds] = useState<string[]>([])

  // Edit modal state
  const [editUser, setEditUser]     = useState<Profile | null>(null)
  const [editForm, setEditForm]     = useState({ full_name: '', phone: '', role: '', factory_ids: [] as string[] })
  const [editError, setEditError]   = useState('')
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    if (!authLoading) { loadAll() }
  }, [authLoading])

  async function loadAll() {
    if (authLoading) return
    setLoading(true); setLoadError('')
    const data = await usersApi.getAll()
    if (data.error) {
      setLoadError(data.error)
      setUsers([]); setFactories([]); setPfMap({})
      setLoading(false)
      return
    }
    setUsers(data.users ?? [])
    setFactories(data.factories ?? [])
    setPfMap(data.pfMap ?? {})
    setAssignedFactoryIds(data.assignedFactories ?? [])
    setLoading(false)
  }

  // ─── CREATE USER ────────────────────────────────────────
  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault()
    setAddError(''); setSaving(true)
    const result = await usersApi.create(newUser)
    if (result.error) { setAddError(result.error); setSaving(false); return }
    setAddSuccess(`User "${newUser.full_name}" created successfully!`)
    setNewUser(EMPTY_NEW_USER)
    setShowForm(false)
    await loadAll()
    setSaving(false)
  }

  function toggleNewFactory(id: string) {
    setNewUser(u => ({
      ...u,
      factory_ids: u.factory_ids.includes(id)
        ? u.factory_ids.filter(f => f !== id)
        : [...u.factory_ids, id]
    }))
  }

  // ─── EDIT USER ──────────────────────────────────────────
  function openEdit(user: Profile) {
    setEditUser(user)
    setEditForm({
      full_name:   user.full_name,
      phone:       user.phone ?? '',
      role:        user.role,
      factory_ids: pfMap[user.id] ?? [],
    })
    setEditError('')
  }

  function toggleEditFactory(id: string) {
    setEditForm(f => ({
      ...f,
      factory_ids: f.factory_ids.includes(id)
        ? f.factory_ids.filter(x => x !== id)
        : [...f.factory_ids, id]
    }))
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editUser) return
    setEditError(''); setEditSaving(true)
    const result = await usersApi.update({
      id:          editUser.id,
      full_name:   editForm.full_name,
      phone:       editForm.phone || undefined,
      role:        editForm.role,
      factory_ids: editForm.factory_ids,
    })
    if (result.error) { setEditError(result.error); setEditSaving(false); return }
    setEditUser(null)
    setAddSuccess(`User "${editForm.full_name}" updated successfully!`)
    await loadAll()
    setEditSaving(false)
  }

  // ─── TOGGLE ACTIVE ──────────────────────────────────────
  async function toggleActive(user: Profile) {
    await usersApi.update({ id: user.id, is_active: !user.is_active })
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: !u.is_active } : u))
  }

  // ─── FACTORY CHECKBOX COMPONENT ─────────────────────────
  function FactoryCheckboxes({ selected, onToggle }: { selected: string[]; onToggle: (id: string) => void }) {
    if (factories.length === 0) return <p className="text-xs text-muted italic">No active factories found.</p>
    return (
      <div className="flex flex-wrap gap-2">
        {factories.map(f => {
          const checked = selected.includes(f.id)
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onToggle(f.id)}
              className={clsx(
                'flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg border transition-all',
                checked
                  ? 'bg-owner/15 text-owner border-owner/40'
                  : 'bg-transparent text-muted border-border hover:border-white/30'
              )}
            >
              <span className={clsx('w-3 h-3 rounded-sm border flex items-center justify-center flex-shrink-0',
                checked ? 'bg-owner border-owner' : 'border-muted'
              )}>
                {checked && <span className="text-[8px] text-black font-bold">✓</span>}
              </span>
              {f.name}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-8">
        <PageHeader
          title="User Management"
          subtitle="Owner · Manage All Users"
          accent="owner"
          actions={
            <button
              onClick={() => { setShowForm(!showForm); setAddError('') }}
              className="btn btn-owner gap-2"
            >
              <Plus size={16}/> Add User
            </button>
          }
        />

        {loadError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-300 mb-4">
            {loadError}
          </div>
        )}

        {!loading && !loadError && assignedFactoryIds.length === 0 && (
          <div className="card p-6 mb-4">
            <p className="text-sm text-muted">
              You do not have any factories assigned yet. Ask the platform admin to assign factories to your account to manage users.
            </p>
          </div>
        )}

        {/* Success banner */}
        {addSuccess && (
          <div className="flex items-center gap-3 bg-chemist/10 border border-chemist/30 rounded-xl px-5 py-3 mb-6 animate-fade-down">
            <CheckCircle size={16} className="text-chemist flex-shrink-0" />
            <span className="text-sm text-chemist">{addSuccess}</span>
            <button onClick={() => setAddSuccess('')} className="ml-auto text-muted hover:text-primary text-xl leading-none">×</button>
          </div>
        )}

        {/* ─── ADD USER FORM ─────────────────────────────── */}
        {showForm && (
          <div className="card border-owner/30 p-6 mb-6 animate-fade-down">
            <h3 className="font-display text-lg font-semibold text-owner uppercase tracking-wide mb-5">
              Create New User
            </h3>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">Full Name *</label>
                  <input
                    className="input-field owner-focus"
                    value={newUser.full_name}
                    onChange={e => setNewUser({ ...newUser, full_name: e.target.value })}
                    required
                    placeholder="e.g. Ramesh Kumar"
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">Email *</label>
                  <input
                    type="email"
                    className="input-field owner-focus"
                    value={newUser.email}
                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                    required
                    placeholder="user@factory.com"
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">Phone</label>
                  <input
                    className="input-field owner-focus"
                    value={newUser.phone}
                    onChange={e => setNewUser({ ...newUser, phone: e.target.value })}
                    placeholder="+91 99999 00000"
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">Role *</label>
                  <select
                    className="input-field owner-focus"
                    value={newUser.role}
                    onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                  >
                    <option value="owner">Owner</option>
                    <option value="inputer">Inputer</option>
                    <option value="chemist">Chemist</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">Password *</label>
                  <input
                    type="password"
                    className="input-field owner-focus"
                    value={newUser.password}
                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                    required
                    placeholder="Minimum 8 characters"
                    minLength={8}
                  />
                </div>
              </div>

              {/* Factory access */}
              <div>
                <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-3">
                  Factory Access
                  <span className="ml-2 normal-case text-[10px] text-muted/60">(select which factories this user can access)</span>
                </label>
                <FactoryCheckboxes selected={newUser.factory_ids} onToggle={toggleNewFactory} />
              </div>

              {addError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">
                  {addError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="btn btn-owner flex-1 justify-center py-3">
                  {saving ? 'Creating...' : '✓ Create User'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setAddError(''); setNewUser(EMPTY_NEW_USER) }}
                  className="btn btn-ghost px-6"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ─── USERS LIST ───────────────────────────────── */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-owner border-t-transparent rounded-full animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <p className="text-muted text-sm">No users yet.</p>
                <button onClick={() => setShowForm(true)} className="btn btn-owner gap-2">
                  <Plus size={15}/> Add your first user
                </button>
              </div>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-border">
                  {users.map(user => (
                    <div key={user.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={clsx(
                            'w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0',
                            user.role === 'owner'   ? 'bg-owner/15 text-owner'   :
                            user.role === 'inputer' ? 'bg-inputer/15 text-inputer' :
                                                      'bg-chemist/15 text-chemist'
                          )}>
                            {user.full_name.charAt(0)}
                          </div>
                          <div>
                            <div className="text-sm text-primary font-semibold">{user.full_name}</div>
                            <div className="text-xs text-muted">{user.email}</div>
                          </div>
                        </div>
                        <span className={clsx('badge',
                          user.role === 'owner'   ? 'badge-owner'   :
                          user.role === 'inputer' ? 'badge-inputer' : 'badge-chemist'
                        )}>
                          {user.role}
                        </span>
                      </div>
                      <div className="text-xs text-muted">{user.phone ?? 'No phone'}</div>
                      <div className="flex flex-wrap gap-1">
                        {(pfMap[user.id] ?? []).length === 0 ? (
                          <span className="text-[11px] text-muted italic">No factories assigned</span>
                        ) : (
                          factories
                            .filter(f => (pfMap[user.id] ?? []).includes(f.id))
                            .map(f => (
                              <span key={f.id} className="text-[10px] font-mono px-2 py-0.5 rounded bg-owner/15 text-owner border border-owner/30 whitespace-nowrap">
                                {f.name}
                              </span>
                            ))
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={clsx('badge', user.is_active ? 'badge-chemist' : 'badge-muted')}>
                          {user.is_active ? '● Active' : '○ Inactive'}
                        </span>
                        <div className="ml-auto flex items-center gap-2">
                          <button
                            onClick={() => openEdit(user)}
                            className="btn btn-ghost text-xs py-1.5 px-3 gap-1 whitespace-nowrap"
                            title="Edit user"
                          >
                            <Pencil size={12}/> Edit
                          </button>
                          <button
                            onClick={() => toggleActive(user)}
                            className={clsx('btn text-xs py-1.5 px-3 whitespace-nowrap', user.is_active ? 'btn-danger' : 'btn-chemist')}
                          >
                            {user.is_active
                              ? <><UserX size={12}/> Deactivate</>
                              : <><UserCheck size={12}/> Activate</>
                            }
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <table className="data-table hidden md:table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Contact</th>
                      <th>Assigned Factories</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className={clsx(
                              'w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0',
                              user.role === 'owner'   ? 'bg-owner/15 text-owner'   :
                              user.role === 'inputer' ? 'bg-inputer/15 text-inputer' :
                                                        'bg-chemist/15 text-chemist'
                            )}>
                              {user.full_name.charAt(0)}
                            </div>
                            <div>
                              <div className="text-sm text-primary font-medium whitespace-nowrap">{user.full_name}</div>
                              <div className="text-xs text-muted">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={clsx('badge',
                            user.role === 'owner'   ? 'badge-owner'   :
                            user.role === 'inputer' ? 'badge-inputer' : 'badge-chemist'
                          )}>
                            {user.role}
                          </span>
                        </td>
                        <td className="text-muted text-xs whitespace-nowrap">{user.phone ?? '—'}</td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {(pfMap[user.id] ?? []).length === 0 ? (
                              <span className="text-xs text-muted italic">None assigned</span>
                            ) : (
                              factories
                                .filter(f => (pfMap[user.id] ?? []).includes(f.id))
                                .map(f => (
                                  <span key={f.id} className="text-[10px] font-mono px-2 py-0.5 rounded bg-owner/15 text-owner border border-owner/30 whitespace-nowrap">
                                    {f.name}
                                  </span>
                                ))
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={clsx('badge', user.is_active ? 'badge-chemist' : 'badge-muted')}>
                            {user.is_active ? '● Active' : '○ Inactive'}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEdit(user)}
                              className="btn btn-ghost text-xs py-1.5 px-3 gap-1 whitespace-nowrap"
                              title="Edit user"
                            >
                              <Pencil size={12}/> Edit
                            </button>
                            <button
                              onClick={() => toggleActive(user)}
                              className={clsx('btn text-xs py-1.5 px-3 whitespace-nowrap', user.is_active ? 'btn-danger' : 'btn-chemist')}
                            >
                              {user.is_active
                                ? <><UserX size={12}/> Deactivate</>
                                : <><UserCheck size={12}/> Activate</>
                              }
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ─── EDIT USER MODAL ─────────────────────────────── */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-down">
          <div className="card border-owner/30 w-full max-w-lg p-6 relative">
            <button
              onClick={() => setEditUser(null)}
              className="absolute top-4 right-4 text-muted hover:text-primary transition-colors"
            >
              <X size={20}/>
            </button>

            <h3 className="font-display text-lg font-semibold text-owner uppercase tracking-wide mb-1">
              Edit User
            </h3>
            <p className="text-xs text-muted mb-5">{editUser.email}</p>

            <form onSubmit={handleEditSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">Full Name *</label>
                  <input
                    className="input-field owner-focus"
                    value={editForm.full_name}
                    onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">Phone</label>
                  <input
                    className="input-field owner-focus"
                    value={editForm.phone}
                    onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="+91 99999 00000"
                  />
                </div>
                {editUser.role !== 'owner' && (
                  <div className="md:col-span-2">
                    <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">Role *</label>
                    <select
                      className="input-field owner-focus"
                      value={editForm.role}
                      onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                    >
                      <option value="inputer">Inputer</option>
                      <option value="chemist">Chemist</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Factory access */}
              <div>
                <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-3">
                  Factory Access
                  <span className="ml-2 normal-case text-[10px] text-muted/60">(toggle to grant or remove access)</span>
                </label>
                <FactoryCheckboxes selected={editForm.factory_ids} onToggle={toggleEditFactory} />
              </div>

              {editError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">
                  {editError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={editSaving} className="btn btn-owner flex-1 justify-center py-3">
                  {editSaving ? 'Saving...' : '✓ Save Changes'}
                </button>
                <button type="button" onClick={() => setEditUser(null)} className="btn btn-ghost px-6">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
