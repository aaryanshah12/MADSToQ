'use client'
import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'
import { usersApi } from '@/lib/api'
import { Profile, PermissionOverride } from '@/types'
import { Shield, Plus, Trash2, ToggleLeft, ToggleRight, UserCheck, UserX } from 'lucide-react'
import clsx from 'clsx'

const FEATURES = [
  { key: 'view_stock_balance',   label: 'View Stock Balance',   roles: ['inputer','chemist'] },
  { key: 'edit_past_entries',    label: 'Edit Past Entries',    roles: ['inputer'] },
  { key: 'view_invoice_details', label: 'View Invoice Details', roles: ['inputer'] },
  { key: 'export_data',          label: 'Export Data',          roles: ['inputer','chemist'] },
  { key: 'view_all_factories',   label: 'View All Factories',   roles: ['inputer','chemist'] },
]

export default function PermissionsPage() {
  const [users, setUsers]       = useState<Profile[]>([])
  const [overrides, setOverrides] = useState<PermissionOverride[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [loadError, setLoadError] = useState('')

  // New user form state
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUser, setNewUser] = useState({ full_name: '', email: '', phone: '', role: 'inputer', password: '' })
  const [addError, setAddError] = useState('')
  const [addSuccess, setAddSuccess] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true); setLoadError('')
    const data = await usersApi.getAll()
    if (data.error) {
      setLoadError(data.error)
      setUsers([]); setOverrides([])
      setLoading(false)
      return
    }

    const accessibleUsers = (data.users ?? []).filter((u: Profile) => u.role !== 'owner')
    const userIds = accessibleUsers.map((u: Profile) => u.id)
    let overrideRows: PermissionOverride[] = []
    if (userIds.length > 0) {
      const { data: o } = await supabase.from('permission_overrides').select('*').in('profile_id', userIds)
      overrideRows = (o as PermissionOverride[]) ?? []
    }

    setUsers(accessibleUsers)
    setOverrides(overrideRows)
    setSelected(prev => (prev && userIds.includes(prev) ? prev : null))
    setLoading(false)
  }

  function getUserOverrides(userId: string) {
    return overrides.filter(o => o.profile_id === userId)
  }

  function getOverride(userId: string, feature: string) {
    return overrides.find(o => o.profile_id === userId && o.feature === feature)
  }

  async function toggleFeature(userId: string, feature: string, currentAllowed: boolean | undefined) {
    setSaving(true)
    const existing = getOverride(userId, feature)
    if (existing) {
      await supabase.from('permission_overrides').update({ is_allowed: !currentAllowed }).eq('id', existing.id)
    } else {
      await supabase.from('permission_overrides').insert({ profile_id: userId, feature, is_allowed: false })
    }
    await loadData()
    setSaving(false)
  }

  async function toggleUserActive(user: Profile) {
    await supabase.from('profiles').update({ is_active: !user.is_active }).eq('id', user.id)
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: !u.is_active } : u))
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault()
    setAddError(''); setAddSuccess('')
    setSaving(true)
    const result = await usersApi.create(newUser)
    if (result.error) { setAddError(result.error); setSaving(false); return }
    setAddSuccess(`User ${newUser.full_name} created successfully!`)
    setNewUser({ full_name: '', email: '', phone: '', role: 'inputer', password: '' })
    await loadData()
    setSaving(false)
  }

  const selectedUser = users.find(u => u.id === selected)

  return (
    <AppLayout>
      <div className="p-8">
        <PageHeader
          title="Permission Management"
          subtitle="Owner · User Access Control"
          accent="owner"
          actions={
            <button onClick={() => setShowAddUser(!showAddUser)} className="btn btn-owner gap-2">
              <Plus size={16}/> Add User
            </button>
          }
        />

        {loadError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-300 mb-4">
            {loadError}
          </div>
        )}

        {/* Add User Form */}
        {showAddUser && (
          <div className="card border-owner/30 p-6 mb-6 animate-fade-down">
            <h3 className="font-display text-lg font-semibold text-owner mb-4 uppercase tracking-wide">Create New User</h3>
            <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-1.5">Full Name</label>
                <input className="input-field owner-focus" value={newUser.full_name} onChange={e=>setNewUser({...newUser,full_name:e.target.value})} required placeholder="Ramesh Kumar" />
              </div>
              <div>
                <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-1.5">Email</label>
                <input type="email" className="input-field owner-focus" value={newUser.email} onChange={e=>setNewUser({...newUser,email:e.target.value})} required placeholder="user@factory.com" />
              </div>
              <div>
                <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-1.5">Phone</label>
                <input className="input-field owner-focus" value={newUser.phone} onChange={e=>setNewUser({...newUser,phone:e.target.value})} placeholder="+91 99999 00000" />
              </div>
              <div>
                <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-1.5">Role</label>
                <select className="input-field owner-focus" value={newUser.role} onChange={e=>setNewUser({...newUser,role:e.target.value})}>
                  <option value="owner">Owner</option>
                  <option value="inputer">Inputer</option>
                  <option value="chemist">Chemist</option>
                </select>
              </div>
              <div>
                <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-1.5">Temp Password</label>
                <input type="password" className="input-field owner-focus" value={newUser.password} onChange={e=>setNewUser({...newUser,password:e.target.value})} required placeholder="Min 8 characters" minLength={8} />
              </div>
              <div className="flex items-end gap-3">
                <button type="submit" disabled={saving} className="btn btn-owner flex-1 justify-center">
                  {saving ? 'Creating...' : 'Create User'}
                </button>
                <button type="button" onClick={() => setShowAddUser(false)} className="btn btn-ghost">Cancel</button>
              </div>
              {addError   && <div className="col-span-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">{addError}</div>}
              {addSuccess && <div className="col-span-2 bg-chemist/10 border border-chemist/30 rounded-lg px-4 py-2 text-sm text-chemist">{addSuccess}</div>}
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User list */}
          <div className="col-span-1 card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <div className="font-mono text-xs text-muted uppercase tracking-widest">Users ({users.length})</div>
            </div>
            <div className="divide-y divide-border">
              {users.map(user => (
                <button
                  key={user.id}
                  onClick={() => setSelected(user.id)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-5 py-4 text-left transition-all',
                    selected === user.id ? 'bg-owner/10 border-l-2 border-owner' : 'hover:bg-layer-sm border-l-2 border-transparent'
                  )}
                >
                  <div className={clsx(
                    'w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0',
                    user.role === 'inputer' ? 'bg-inputer/15 text-inputer' : 'bg-chemist/15 text-chemist'
                  )}>
                    {user.full_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-primary font-medium truncate">{user.full_name}</div>
                    <div className={clsx('font-mono text-[10px] uppercase tracking-widest', user.role === 'inputer' ? 'text-inputer' : 'text-chemist')}>
                      {user.role}
                    </div>
                  </div>
                  {!user.is_active && <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" title="Inactive" />}
                </button>
              ))}
              {users.length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-muted">No users yet</div>
              )}
            </div>
          </div>

          {/* Permission detail */}
          <div className="lg:col-span-2">
            {!selectedUser ? (
              <div className="card flex items-center justify-center h-64">
                <div className="text-center">
                  <Shield size={32} className="text-muted mx-auto mb-3" />
                  <p className="text-muted">Select a user to manage their permissions</p>
                </div>
              </div>
            ) : (
              <div className="space-y-5 animate-fade-up">
                {/* User header */}
                <div className="card p-5 border-owner/25">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold',
                        selectedUser.role === 'inputer' ? 'bg-inputer/15 text-inputer' : 'bg-chemist/15 text-chemist'
                      )}>
                        {selectedUser.full_name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-primary">{selectedUser.full_name}</div>
                        <div className="text-sm text-muted">{selectedUser.email}</div>
                        <div className={clsx('font-mono text-xs uppercase tracking-widest mt-0.5',
                          selectedUser.role === 'inputer' ? 'text-inputer' : 'text-chemist'
                        )}>{selectedUser.role}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleUserActive(selectedUser)}
                      className={clsx('btn gap-2', selectedUser.is_active ? 'btn-danger' : 'btn-chemist')}
                    >
                      {selectedUser.is_active ? <><UserX size={15}/> Deactivate</> : <><UserCheck size={15}/> Activate</>}
                    </button>
                  </div>
                </div>

                {/* Feature toggles */}
                <div className="card overflow-hidden">
                  <div className="px-6 py-4 border-b border-border">
                    <div className="font-mono text-xs text-muted uppercase tracking-widest">Feature Permissions</div>
                    <div className="text-xs text-muted mt-1">Toggle to override default role permissions</div>
                  </div>
                  <div className="divide-y divide-border">
                    {FEATURES.filter(f => f.roles.includes(selectedUser.role)).map(feature => {
                      const override = getOverride(selectedUser.id, feature.key)
                      // Default: allowed unless overridden to false
                      const isAllowed = override ? override.is_allowed : true
                      return (
                        <div key={feature.key} className="flex items-center justify-between px-6 py-4">
                          <div>
                            <div className="text-sm text-primary">{feature.label}</div>
                            {override && (
                              <div className="font-mono text-[10px] text-owner mt-0.5">⚠ Override active</div>
                            )}
                          </div>
                          <button
                            onClick={() => toggleFeature(selectedUser.id, feature.key, isAllowed)}
                            disabled={saving}
                            className={clsx('transition-all', isAllowed ? 'text-chemist' : 'text-muted')}
                          >
                            {isAllowed
                              ? <ToggleRight size={32} />
                              : <ToggleLeft  size={32} />
                            }
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Active overrides list */}
                {getUserOverrides(selectedUser.id).length > 0 && (
                  <div className="card overflow-hidden">
                    <div className="px-6 py-4 border-b border-border">
                      <div className="font-mono text-xs text-muted uppercase tracking-widest">Active Overrides</div>
                    </div>
                    <div className="divide-y divide-border">
                      {getUserOverrides(selectedUser.id).map(o => (
                        <div key={o.id} className="flex items-center justify-between px-6 py-3">
                          <div className="flex items-center gap-3">
                            <span className={clsx('badge', o.is_allowed ? 'badge-chemist' : 'badge-muted')}>
                              {o.is_allowed ? '✓ Allowed' : '✗ Denied'}
                            </span>
                            <span className="text-sm text-primary">{o.feature.replace(/_/g,' ')}</span>
                          </div>
                          <button
                            onClick={async () => {
                              await supabase.from('permission_overrides').delete().eq('id', o.id)
                              await loadData()
                            }}
                            className="text-muted hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
