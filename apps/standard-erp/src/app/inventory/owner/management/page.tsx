'use client'
import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@madstoq/ui/page-header'
import { factoriesApi, usersApi } from '@/lib/api'
import { inventoryApi } from '@madstoq/inventory-system/api'
import { Factory, Profile, PermissionOverride } from '@/types'
import clsx from 'clsx'
import {
  Plus, Pencil, ToggleLeft, ToggleRight,
  Factory as FactoryIcon, MapPin, CheckCircle, Users,
  UserCheck, UserX, Shield, Trash2, X, Package,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

// ─── Constants ──────────────────────────────────────────────────────────────
const FEATURES = [
  { key: 'view_stock_balance',   label: 'View Stock Balance',   roles: ['inputer', 'chemist'] },
  { key: 'edit_past_entries',    label: 'Edit Past Entries',    roles: ['inputer'] },
  { key: 'view_invoice_details', label: 'View Invoice Details', roles: ['inputer'] },
  { key: 'export_data',          label: 'Export Data',          roles: ['inputer', 'chemist'] },
  { key: 'view_all_factories',   label: 'View All Factories',   roles: ['inputer', 'chemist'] },
]

const EMPTY_NEW_USER = {
  full_name: '', email: '', phone: '', role: 'inputer', password: '', factory_ids: [] as string[],
}

type Tab = 'factories' | 'users' | 'suppliers' | 'permissions'

export default function ManagementPage() {
  const { loading: authLoading } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('factories')

  // ─── Shared data ─────────────────────────────────────────────────────────
  const [factories, setFactories]               = useState<Factory[]>([])
  const [profiles, setProfiles]                 = useState<Profile[]>([])
  const [factoryUsersMap, setFactoryUsersMap]   = useState<Record<string, string[]>>({})
  const [pfMap, setPfMap]                       = useState<Record<string, string[]>>({})
  const [assignedFactoryIds, setAssignedFactoryIds] = useState<string[]>([])
  const [overrides, setOverrides]               = useState<PermissionOverride[]>([])
  const [loading, setLoading]                   = useState(true)
  const [loadError, setLoadError]               = useState('')
  const [success, setSuccess]                   = useState('')

  // ─── Factories tab state ─────────────────────────────────────────────────
  const [showFactoryForm, setShowFactoryForm]     = useState(false)
  const [editingFactoryId, setEditingFactoryId]   = useState<string | null>(null)
  const [factoryForm, setFactoryForm]             = useState({ name: '', location: '', materials: [] as string[] })
  const [materialInput, setMaterialInput]         = useState('')
  const [expandedFactory, setExpandedFactory]     = useState<string | null>(null)
  const [factorySaving, setFactorySaving]         = useState(false)
  const [assignSaving, setAssignSaving]           = useState(false)
  const [factoryError, setFactoryError]           = useState('')

  // ─── Users tab state ─────────────────────────────────────────────────────
  const [showUserForm, setShowUserForm]   = useState(false)
  const [newUser, setNewUser]             = useState(EMPTY_NEW_USER)
  const [userSaving, setUserSaving]       = useState(false)
  const [userError, setUserError]         = useState('')
  const [editUser, setEditUser]           = useState<Profile | null>(null)
  const [editForm, setEditForm]           = useState({ full_name: '', phone: '', role: '', factory_ids: [] as string[] })
  const [editError, setEditError]         = useState('')
  const [editSaving, setEditSaving]       = useState(false)

  // ─── Permissions tab state ────────────────────────────────────────────────
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [permSaving, setPermSaving]         = useState(false)

  // ─── Suppliers tab state ──────────────────────────────────────────────────
  const [suppliers, setSuppliers]               = useState<any[]>([])
  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [supplierFactoryId, setSupplierFactoryId] = useState('')
  const [supplierName, setSupplierName]         = useState('')
  const [supplierSaving, setSupplierSaving]     = useState(false)
  const [supplierError, setSupplierError]       = useState('')

  useEffect(() => {
    if (!authLoading) loadAll()
  }, [authLoading])

  async function loadAll() {
    setLoading(true); setLoadError('')

    const [factData, userData] = await Promise.all([
      factoriesApi.getAll(),
      usersApi.getAll(),
    ])

    if (factData.error || userData.error) {
      setLoadError(factData.error || userData.error)
      setLoading(false)
      return
    }

    const allFactories  = factData.factories      ?? []
    const allProfiles   = factData.profiles        ?? []
    const factUsersMap  = factData.factoryUsersMap ?? {}
    const assignedIds   = factData.assignedFactories ?? []
    const profileMap    = userData.pfMap           ?? {}

    setFactories(allFactories)
    setProfiles(allProfiles)
    setFactoryUsersMap(factUsersMap)
    setAssignedFactoryIds(assignedIds)
    setPfMap(profileMap)

    const userIds = allProfiles.filter((p: Profile) => p.role !== 'owner').map((p: Profile) => p.id)
    let overrideRows: PermissionOverride[] = []
    if (userIds.length > 0) {
      const extras = await inventoryApi.getManagementExtras(userIds, assignedIds)
      overrideRows = (extras.overrides as PermissionOverride[]) ?? []
      setSuppliers(extras.suppliers ?? [])
    } else {
      setSuppliers([])
    }
    setOverrides(overrideRows)
    setSelectedUserId(prev => (prev && userIds.includes(prev) ? prev : null))

    setLoading(false)
  }

  // ─── Factory helpers ──────────────────────────────────────────────────────
  function resetFactoryForm() {
    setShowFactoryForm(false); setEditingFactoryId(null)
    setFactoryForm({ name: '', location: '', materials: [] })
    setMaterialInput(''); setFactoryError('')
  }

  function startEditFactory(factory: Factory) {
    setEditingFactoryId(factory.id)
    setFactoryForm({ name: factory.name, location: factory.location ?? '', materials: (factory.materials ?? []) as string[] })
    setMaterialInput('')
    setShowFactoryForm(true)
    setFactoryError('')
  }

  function addMaterialChip() {
    const value = materialInput.trim()
    if (!value || factoryForm.materials.includes(value)) { setMaterialInput(''); return }
    setFactoryForm(f => ({ ...f, materials: [...f.materials, value] }))
    setMaterialInput('')
  }

  async function handleFactorySubmit(e: React.FormEvent) {
    e.preventDefault()
    setFactorySaving(true); setFactoryError('')
    const result = editingFactoryId
      ? await factoriesApi.update({ id: editingFactoryId, ...factoryForm })
      : await factoriesApi.create(factoryForm)
    if (result.error) { setFactoryError(result.error); setFactorySaving(false); return }
    setSuccess(`Factory "${factoryForm.name}" ${editingFactoryId ? 'updated' : 'created'} successfully!`)
    await loadAll()
    resetFactoryForm()
    setFactorySaving(false)
  }

  async function toggleFactoryActive(factory: Factory) {
    await factoriesApi.update({ id: factory.id, is_active: !factory.is_active })
    setFactories(prev => prev.map(f => f.id === factory.id ? { ...f, is_active: !f.is_active } : f))
  }

  async function toggleUserAssignment(factoryId: string, profileId: string) {
    setAssignSaving(true)
    const isAssigned = (factoryUsersMap[factoryId] ?? []).includes(profileId)
    if (isAssigned) {
      await inventoryApi.toggleProfileFactory(profileId, factoryId, false)
    } else {
      await inventoryApi.toggleProfileFactory(profileId, factoryId, true)
    }
    await loadAll()
    setAssignSaving(false)
  }

  // ─── Users helpers ────────────────────────────────────────────────────────
  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault()
    setUserError(''); setUserSaving(true)
    const result = await usersApi.create(newUser)
    if (result.error) { setUserError(result.error); setUserSaving(false); return }
    setSuccess(`User "${newUser.full_name}" created successfully!`)
    setNewUser(EMPTY_NEW_USER); setShowUserForm(false)
    await loadAll()
    setUserSaving(false)
  }

  function openEditUser(user: Profile) {
    setEditUser(user)
    setEditForm({ full_name: user.full_name, phone: user.phone ?? '', role: user.role, factory_ids: pfMap[user.id] ?? [] })
    setEditError('')
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editUser) return
    setEditError(''); setEditSaving(true)
    const result = await usersApi.update({ id: editUser.id, ...editForm })
    if (result.error) { setEditError(result.error); setEditSaving(false); return }
    setSuccess(`User "${editForm.full_name}" updated successfully!`)
    setEditUser(null)
    await loadAll()
    setEditSaving(false)
  }

  async function toggleUserActive(user: Profile) {
    await usersApi.update({ id: user.id, is_active: !user.is_active })
    setProfiles(prev => prev.map(u => u.id === user.id ? { ...u, is_active: !u.is_active } : u))
  }

  // ─── Permissions helpers ──────────────────────────────────────────────────
  const nonOwnerUsers = profiles.filter(p => p.role !== 'owner')
  const selectedUser  = nonOwnerUsers.find(u => u.id === selectedUserId)

  function getOverride(userId: string, feature: string) {
    return overrides.find(o => o.profile_id === userId && o.feature === feature)
  }

  function getUserOverrides(userId: string) {
    return overrides.filter(o => o.profile_id === userId)
  }

  async function toggleFeature(userId: string, feature: string, currentAllowed: boolean) {
    setPermSaving(true)
    const existing = getOverride(userId, feature)
    if (existing) {
      await inventoryApi.upsertPermissionOverride({ userId, feature, existingId: existing.id, currentAllowed })
    } else {
      await inventoryApi.upsertPermissionOverride({ userId, feature })
    }
    await loadAll()
    setPermSaving(false)
  }

  async function togglePermUserActive(user: Profile) {
    await inventoryApi.setProfileActive(user.id, !user.is_active)
    setProfiles(prev => prev.map(u => u.id === user.id ? { ...u, is_active: !u.is_active } : u))
  }

  // ─── Suppliers helpers ────────────────────────────────────────────────────
  async function handleAddSupplier(e: React.FormEvent) {
    e.preventDefault()
    setSupplierSaving(true); setSupplierError('')
    try {
      await inventoryApi.createSupplier(supplierFactoryId, supplierName)
    } catch (e: unknown) {
      setSupplierError(e instanceof Error ? e.message : 'Failed to create supplier')
      setSupplierSaving(false)
      return
    }
    setSuccess('Supplier added successfully!')
    setSupplierName(''); setShowSupplierForm(false); setSupplierFactoryId('')
    await loadAll()
    setSupplierSaving(false)
  }

  async function handleDeleteSupplier(id: string, name: string) {
    if (!confirm(`Delete supplier "${name}"?`)) return
    await inventoryApi.deleteSupplier(id)
    setSuppliers(prev => prev.filter(s => s.id !== id))
    setSuccess(`Supplier "${name}" deleted.`)
  }

  // ─── Shared factory checkbox component ───────────────────────────────────
  function FactoryCheckboxes({ selected, onToggle }: { selected: string[]; onToggle: (id: string) => void }) {
    if (factories.length === 0) return <p className="text-xs text-muted italic">No active factories found.</p>
    return (
      <div className="flex flex-wrap gap-2">
        {factories.map(f => {
          const checked = selected.includes(f.id)
          return (
            <button key={f.id} type="button" onClick={() => onToggle(f.id)}
              className={clsx(
                'flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg border transition-all',
                checked ? 'bg-owner/15 text-owner border-owner/40' : 'bg-transparent text-muted border-border hover:border-white/30'
              )}
            >
              <span className={clsx('w-3 h-3 rounded-sm border flex items-center justify-center flex-shrink-0', checked ? 'bg-owner border-owner' : 'border-muted')}>
                {checked && <span className="text-[8px] text-black font-bold">✓</span>}
              </span>
              {f.name}
            </button>
          )
        })}
      </div>
    )
  }

  const assignableUsers = profiles.filter(p => p.role !== 'owner' && p.is_active)

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'factories',   label: 'Factories',   icon: <FactoryIcon size={16} /> },
    { key: 'users',       label: 'Users',        icon: <Users size={16} /> },
    { key: 'suppliers',   label: 'Suppliers',    icon: <Package size={16} /> },
    { key: 'permissions', label: 'Permissions',  icon: <Shield size={16} /> },
  ]

  return (
    <AppLayout>
      <div className="p-4 md:p-8">
        <PageHeader
          title="Management"
          subtitle="Owner · Factories, Users & Permissions"
          accent="owner"
        />

        {loadError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-300 mb-4">
            {loadError}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-3 bg-chemist/10 border border-chemist/30 rounded-xl px-5 py-3 mb-6 animate-fade-down">
            <CheckCircle size={16} className="text-chemist flex-shrink-0" />
            <span className="text-sm text-chemist">{success}</span>
            <button onClick={() => setSuccess('')} className="ml-auto text-muted hover:text-primary text-xl leading-none">×</button>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-layer-sm border border-border rounded-xl mb-6 w-fit">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                activeTab === tab.key
                  ? 'bg-owner/15 text-owner border border-owner/30'
                  : 'text-muted hover:text-primary'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-owner border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ══════════════════════════════════════════════════════════════
                FACTORIES TAB
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'factories' && (
              <div>
                <div className="flex justify-end mb-4">
                  <button onClick={() => { resetFactoryForm(); setShowFactoryForm(true) }} className="btn btn-owner gap-2">
                    <Plus size={16} /> Add Factory
                  </button>
                </div>

                {!loadError && assignedFactoryIds.length === 0 && (
                  <div className="card p-6 mb-4">
                    <p className="text-sm text-muted">No factories are assigned to your owner account yet.</p>
                  </div>
                )}

                {showFactoryForm && (
                  <div className="card border-owner/30 p-6 mb-6 animate-fade-down">
                    <h3 className="font-display text-lg font-semibold text-owner uppercase tracking-wide mb-5">
                      {editingFactoryId ? 'Edit Factory' : 'New Factory'}
                    </h3>
                    <form onSubmit={handleFactorySubmit} className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">Factory Name *</label>
                        <input className="input-field owner-focus" value={factoryForm.name} onChange={e => setFactoryForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Factory Alpha" />
                      </div>
                      <div>
                        <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">Location</label>
                        <input className="input-field owner-focus" value={factoryForm.location} onChange={e => setFactoryForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Ahmedabad, Gujarat" />
                      </div>
                      <div className="col-span-2">
                        <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">Materials</label>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {factoryForm.materials.map(m => (
                            <span key={m} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-owner/10 border border-owner/30 text-xs font-mono">
                              {m}
                              <button type="button" onClick={() => setFactoryForm(f => ({ ...f, materials: f.materials.filter(x => x !== m) }))} className="text-muted hover:text-white">×</button>
                            </span>
                          ))}
                          {factoryForm.materials.length === 0 && <span className="text-xs text-muted">No materials added</span>}
                        </div>
                        <div className="flex gap-2">
                          <input
                            className="input-field owner-focus flex-1"
                            value={materialInput}
                            onChange={e => setMaterialInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addMaterialChip() } }}
                            placeholder="Type a material and press Enter"
                          />
                          <button type="button" onClick={addMaterialChip} className="btn btn-owner whitespace-nowrap">Add</button>
                        </div>
                      </div>
                      {factoryError && (
                        <div className="col-span-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">{factoryError}</div>
                      )}
                      <div className="col-span-2 flex gap-3 pt-2">
                        <button type="submit" disabled={factorySaving} className="btn btn-owner flex-1 justify-center py-3">
                          {factorySaving ? 'Saving...' : editingFactoryId ? 'Update Factory' : 'Create Factory'}
                        </button>
                        <button type="button" onClick={resetFactoryForm} className="btn btn-ghost px-8">Cancel</button>
                      </div>
                    </form>
                  </div>
                )}

                {factories.length === 0 ? (
                  <div className="card flex flex-col items-center justify-center py-20 gap-4">
                    <FactoryIcon size={40} className="text-muted" />
                    <p className="text-muted">No factories yet.</p>
                    <button onClick={() => setShowFactoryForm(true)} className="btn btn-owner gap-2"><Plus size={15} /> Add your first factory</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {factories.map((factory, i) => {
                      const assignedIds   = factoryUsersMap[factory.id] ?? []
                      const assignedUsers = profiles.filter(p => assignedIds.includes(p.id))
                      const isExpanded    = expandedFactory === factory.id
                      return (
                        <div key={factory.id}
                          className={clsx('card border transition-all', factory.is_active ? 'border-owner/25 glow-border-owner' : 'border-border opacity-60')}
                          style={{ animationDelay: `${i * 0.05}s` }}
                        >
                          <div className="p-6">
                            <div className="flex items-start justify-between gap-3 mb-4">
                              <div className="w-12 h-12 rounded-xl bg-owner/10 border border-owner/25 flex items-center justify-center text-2xl flex-shrink-0">🏭</div>
                              <div className="flex-1 min-w-0">
                                <div className="font-display text-lg font-bold text-primary tracking-wide truncate">{factory.name}</div>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <MapPin size={11} className="text-muted flex-shrink-0" />
                                  <span className="text-xs text-muted truncate">{factory.location ?? 'No location set'}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mb-4">
                              <span className={clsx('badge', factory.is_active ? 'badge-chemist' : 'badge-muted')}>{factory.is_active ? '● Active' : '○ Inactive'}</span>
                              <span className="font-mono text-[10px] text-muted">{new Date(factory.created_at).toLocaleDateString('en-IN')}</span>
                            </div>
                            <div className="mb-3">
                              <div className="font-mono text-[10px] text-muted uppercase tracking-widest mb-1.5">Materials</div>
                              {factory.materials && factory.materials.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {factory.materials.map(m => (
                                    <span key={m} className="text-[10px] font-mono px-2 py-0.5 rounded bg-owner/15 text-owner border border-owner/30 whitespace-nowrap">{m}</span>
                                  ))}
                                </div>
                              ) : <span className="text-xs text-muted italic">No materials listed</span>}
                            </div>
                            <div className="bg-layer-sm rounded-lg px-3 py-2.5 mb-4">
                              <div className="font-mono text-[9px] text-muted uppercase tracking-widest mb-1.5">Assigned Users</div>
                              {assignedUsers.length === 0 ? (
                                <span className="text-xs text-muted italic">No users assigned yet</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {assignedUsers.map(u => (
                                    <span key={u.id} className={clsx(
                                      'text-[10px] font-mono px-2 py-0.5 rounded border whitespace-nowrap',
                                      u.role === 'inputer' ? 'bg-inputer/10 text-inputer border-inputer/25' : 'bg-chemist/10 text-chemist border-chemist/25'
                                    )}>{u.full_name}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => startEditFactory(factory)} className="btn btn-ghost flex-1 justify-center gap-1.5 py-2 text-xs"><Pencil size={13} /> Edit</button>
                              <button
                                onClick={() => setExpandedFactory(isExpanded ? null : factory.id)}
                                className={clsx('btn flex-1 justify-center gap-1.5 py-2 text-xs', isExpanded ? 'btn-owner' : 'btn-ghost')}
                              >
                                <Users size={13} />{isExpanded ? 'Done' : 'Assign Users'}
                              </button>
                              <button
                                onClick={() => toggleFactoryActive(factory)}
                                className={clsx('btn justify-center gap-1.5 py-2 px-3 text-xs', factory.is_active ? 'btn-danger' : 'btn-chemist')}
                                title={factory.is_active ? 'Deactivate' : 'Activate'}
                              >
                                {factory.is_active ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="border-t border-owner/20 px-6 py-4 bg-owner/3">
                              <p className="font-mono text-[10px] text-owner uppercase tracking-widest mb-3">Click to grant or remove access</p>
                              {assignableUsers.length === 0 ? (
                                <p className="text-xs text-muted italic">No active inputers or chemists found.</p>
                              ) : (
                                <div className="space-y-2">
                                  {assignableUsers.map(user => {
                                    const isAssigned = assignedIds.includes(user.id)
                                    return (
                                      <button key={user.id} onClick={() => toggleUserAssignment(factory.id, user.id)} disabled={assignSaving}
                                        className={clsx(
                                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all disabled:opacity-50',
                                          isAssigned ? 'bg-owner/10 border-owner/30 hover:bg-owner/15' : 'bg-transparent border-border hover:border-white/20'
                                        )}
                                      >
                                        <div className={clsx('w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all', isAssigned ? 'bg-owner border-owner' : 'border-muted')}>
                                          {isAssigned && <span className="text-[9px] text-black font-bold">✓</span>}
                                        </div>
                                        <div className={clsx('w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0', user.role === 'inputer' ? 'bg-inputer/15 text-inputer' : 'bg-chemist/15 text-chemist')}>
                                          {user.full_name.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="text-sm text-primary font-medium truncate">{user.full_name}</div>
                                        </div>
                                        <span className={clsx('text-[9px] font-mono px-2 py-0.5 rounded border flex-shrink-0',
                                          user.role === 'inputer' ? 'text-inputer border-inputer/30 bg-inputer/5' : 'text-chemist border-chemist/30 bg-chemist/5'
                                        )}>{user.role}</span>
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                USERS TAB
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'users' && (
              <div>
                <div className="flex justify-end mb-4">
                  <button onClick={() => { setShowUserForm(!showUserForm); setUserError('') }} className="btn btn-owner gap-2">
                    <Plus size={16} /> Add User
                  </button>
                </div>

                {!loadError && assignedFactoryIds.length === 0 && (
                  <div className="card p-6 mb-4">
                    <p className="text-sm text-muted">No factories assigned to your account yet. Ask the platform admin to assign factories first.</p>
                  </div>
                )}

                {showUserForm && (
                  <div className="card border-owner/30 p-6 mb-6 animate-fade-down">
                    <h3 className="font-display text-lg font-semibold text-owner uppercase tracking-wide mb-5">Create New User</h3>
                    <form onSubmit={handleAddUser} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">Full Name *</label>
                          <input className="input-field owner-focus" value={newUser.full_name} onChange={e => setNewUser({ ...newUser, full_name: e.target.value })} required placeholder="e.g. Ramesh Kumar" />
                        </div>
                        <div>
                          <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">Email *</label>
                          <input type="email" className="input-field owner-focus" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} required placeholder="user@factory.com" />
                        </div>
                        <div>
                          <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">Phone</label>
                          <input className="input-field owner-focus" value={newUser.phone} onChange={e => setNewUser({ ...newUser, phone: e.target.value })} placeholder="+91 99999 00000" />
                        </div>
                        <div>
                          <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">Role *</label>
                          <select className="input-field owner-focus" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                            <option value="owner">Owner</option>
                            <option value="inputer">Inputer</option>
                            <option value="chemist">Chemist</option>
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">Password *</label>
                          <input type="password" className="input-field owner-focus" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} required placeholder="Minimum 8 characters" minLength={8} />
                        </div>
                      </div>
                      <div>
                        <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-3">
                          Factory Access <span className="ml-2 normal-case text-[10px] text-muted/60">(select which factories this user can access)</span>
                        </label>
                        <FactoryCheckboxes
                          selected={newUser.factory_ids}
                          onToggle={id => setNewUser(u => ({ ...u, factory_ids: u.factory_ids.includes(id) ? u.factory_ids.filter(f => f !== id) : [...u.factory_ids, id] }))}
                        />
                      </div>
                      {userError && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">{userError}</div>}
                      <div className="flex gap-3 pt-2">
                        <button type="submit" disabled={userSaving} className="btn btn-owner flex-1 justify-center py-3">{userSaving ? 'Creating...' : '✓ Create User'}</button>
                        <button type="button" onClick={() => { setShowUserForm(false); setUserError(''); setNewUser(EMPTY_NEW_USER) }} className="btn btn-ghost px-6">Cancel</button>
                      </div>
                    </form>
                  </div>
                )}

                <div className="card overflow-hidden">
                  <div className="overflow-x-auto">
                    {profiles.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <p className="text-muted text-sm">No users yet.</p>
                        <button onClick={() => setShowUserForm(true)} className="btn btn-owner gap-2"><Plus size={15} /> Add your first user</button>
                      </div>
                    ) : (
                      <>
                        {/* Mobile cards */}
                        <div className="md:hidden divide-y divide-border">
                          {profiles.map(user => (
                            <div key={user.id} className="p-4 space-y-2">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0',
                                    user.role === 'owner' ? 'bg-owner/15 text-owner' : user.role === 'inputer' ? 'bg-inputer/15 text-inputer' : 'bg-chemist/15 text-chemist'
                                  )}>{user.full_name.charAt(0)}</div>
                                  <div>
                                    <div className="text-sm text-primary font-semibold">{user.full_name}</div>
                                    <div className="text-xs text-muted">{user.email}</div>
                                  </div>
                                </div>
                                <span className={clsx('badge', user.role === 'owner' ? 'badge-owner' : user.role === 'inputer' ? 'badge-inputer' : 'badge-chemist')}>{user.role}</span>
                              </div>
                              <div className="text-xs text-muted">{user.phone ?? 'No phone'}</div>
                              <div className="flex flex-wrap gap-1">
                                {(pfMap[user.id] ?? []).length === 0 ? (
                                  <span className="text-[11px] text-muted italic">No factories assigned</span>
                                ) : factories.filter(f => (pfMap[user.id] ?? []).includes(f.id)).map(f => (
                                  <span key={f.id} className="text-[10px] font-mono px-2 py-0.5 rounded bg-owner/15 text-owner border border-owner/30 whitespace-nowrap">{f.name}</span>
                                ))}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={clsx('badge', user.is_active ? 'badge-chemist' : 'badge-muted')}>{user.is_active ? '● Active' : '○ Inactive'}</span>
                                <div className="ml-auto flex items-center gap-2">
                                  <button onClick={() => openEditUser(user)} className="btn btn-ghost text-xs py-1.5 px-3 gap-1"><Pencil size={12} /> Edit</button>
                                  <button onClick={() => toggleUserActive(user)} className={clsx('btn text-xs py-1.5 px-3', user.is_active ? 'btn-danger' : 'btn-chemist')}>
                                    {user.is_active ? <><UserX size={12} /> Deactivate</> : <><UserCheck size={12} /> Activate</>}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Desktop table */}
                        <table className="data-table hidden md:table">
                          <thead>
                            <tr><th>User</th><th>Role</th><th>Contact</th><th>Assigned Factories</th><th>Status</th><th>Actions</th></tr>
                          </thead>
                          <tbody>
                            {profiles.map(user => (
                              <tr key={user.id}>
                                <td>
                                  <div className="flex items-center gap-3">
                                    <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0',
                                      user.role === 'owner' ? 'bg-owner/15 text-owner' : user.role === 'inputer' ? 'bg-inputer/15 text-inputer' : 'bg-chemist/15 text-chemist'
                                    )}>{user.full_name.charAt(0)}</div>
                                    <div>
                                      <div className="text-sm text-primary font-medium whitespace-nowrap">{user.full_name}</div>
                                      <div className="text-xs text-muted">{user.email}</div>
                                    </div>
                                  </div>
                                </td>
                                <td><span className={clsx('badge', user.role === 'owner' ? 'badge-owner' : user.role === 'inputer' ? 'badge-inputer' : 'badge-chemist')}>{user.role}</span></td>
                                <td className="text-muted text-xs whitespace-nowrap">{user.phone ?? '—'}</td>
                                <td>
                                  <div className="flex flex-wrap gap-1">
                                    {(pfMap[user.id] ?? []).length === 0 ? (
                                      <span className="text-xs text-muted italic">None assigned</span>
                                    ) : factories.filter(f => (pfMap[user.id] ?? []).includes(f.id)).map(f => (
                                      <span key={f.id} className="text-[10px] font-mono px-2 py-0.5 rounded bg-owner/15 text-owner border border-owner/30 whitespace-nowrap">{f.name}</span>
                                    ))}
                                  </div>
                                </td>
                                <td><span className={clsx('badge', user.is_active ? 'badge-chemist' : 'badge-muted')}>{user.is_active ? '● Active' : '○ Inactive'}</span></td>
                                <td>
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => openEditUser(user)} className="btn btn-ghost text-xs py-1.5 px-3 gap-1 whitespace-nowrap"><Pencil size={12} /> Edit</button>
                                    <button onClick={() => toggleUserActive(user)} className={clsx('btn text-xs py-1.5 px-3 whitespace-nowrap', user.is_active ? 'btn-danger' : 'btn-chemist')}>
                                      {user.is_active ? <><UserX size={12} /> Deactivate</> : <><UserCheck size={12} /> Activate</>}
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
            )}

            {/* ══════════════════════════════════════════════════════════════
                SUPPLIERS TAB
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'suppliers' && (
              <div>
                <div className="flex justify-end mb-4">
                  <button onClick={() => { setShowSupplierForm(v => !v); setSupplierError('') }} className="btn btn-owner gap-2">
                    <Plus size={16} /> Add Supplier
                  </button>
                </div>

                {showSupplierForm && (
                  <div className="card border-owner/30 p-6 mb-6 animate-fade-down">
                    <h3 className="font-display text-lg font-semibold text-owner uppercase tracking-wide mb-5">New Supplier</h3>
                    <form onSubmit={handleAddSupplier} className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">Factory *</label>
                        <select className="input-field owner-focus" value={supplierFactoryId} onChange={e => setSupplierFactoryId(e.target.value)} required>
                          <option value="">Select factory</option>
                          {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">Supplier Name *</label>
                        <input className="input-field owner-focus" value={supplierName} onChange={e => setSupplierName(e.target.value)} required placeholder="e.g. Acme Chemicals Ltd." />
                      </div>
                      {supplierError && (
                        <div className="col-span-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">{supplierError}</div>
                      )}
                      <div className="col-span-2 flex gap-3 pt-2">
                        <button type="submit" disabled={supplierSaving} className="btn btn-owner flex-1 justify-center py-3">
                          {supplierSaving ? 'Adding...' : '✓ Add Supplier'}
                        </button>
                        <button type="button" onClick={() => { setShowSupplierForm(false); setSupplierName(''); setSupplierFactoryId(''); setSupplierError('') }} className="btn btn-ghost px-8">Cancel</button>
                      </div>
                    </form>
                  </div>
                )}

                <div className="card overflow-hidden">
                  {suppliers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                      <Package size={36} className="text-muted" />
                      <p className="text-muted text-sm">No suppliers yet. Add your first supplier above.</p>
                      <button onClick={() => setShowSupplierForm(true)} className="btn btn-owner gap-2"><Plus size={15} /> Add Supplier</button>
                    </div>
                  ) : (
                    <>
                      <div className="hidden md:block overflow-x-auto">
                        <table className="data-table">
                          <thead>
                            <tr><th>Supplier Name</th><th>Factory</th><th>Added On</th><th>Actions</th></tr>
                          </thead>
                          <tbody>
                            {suppliers.map(s => (
                              <tr key={s.id}>
                                <td className="font-medium text-primary">{s.name}</td>
                                <td className="text-xs text-muted">{(s as any).factories?.name ?? '—'}</td>
                                <td className="text-xs text-muted">{new Date(s.created_at).toLocaleDateString('en-IN')}</td>
                                <td>
                                  <button onClick={() => handleDeleteSupplier(s.id, s.name)} className="text-muted hover:text-red-400 transition-colors p-1">
                                    <Trash2 size={15} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="md:hidden divide-y divide-border">
                        {suppliers.map(s => (
                          <div key={s.id} className="flex items-center justify-between px-4 py-3">
                            <div>
                              <div className="text-sm font-medium text-primary">{s.name}</div>
                              <div className="text-xs text-muted">{(s as any).factories?.name ?? '—'}</div>
                            </div>
                            <button onClick={() => handleDeleteSupplier(s.id, s.name)} className="text-muted hover:text-red-400 transition-colors p-2">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                PERMISSIONS TAB
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'permissions' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* User list */}
                <div className="col-span-1 card overflow-hidden">
                  <div className="px-5 py-4 border-b border-border">
                    <div className="font-mono text-xs text-muted uppercase tracking-widest">Users ({nonOwnerUsers.length})</div>
                  </div>
                  <div className="divide-y divide-border">
                    {nonOwnerUsers.map(user => (
                      <button key={user.id} onClick={() => setSelectedUserId(user.id)}
                        className={clsx(
                          'w-full flex items-center gap-3 px-5 py-4 text-left transition-all',
                          selectedUserId === user.id ? 'bg-owner/10 border-l-2 border-owner' : 'hover:bg-layer-sm border-l-2 border-transparent'
                        )}
                      >
                        <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0',
                          user.role === 'inputer' ? 'bg-inputer/15 text-inputer' : 'bg-chemist/15 text-chemist'
                        )}>{user.full_name.charAt(0)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-primary font-medium truncate">{user.full_name}</div>
                          <div className={clsx('font-mono text-[10px] uppercase tracking-widest', user.role === 'inputer' ? 'text-inputer' : 'text-chemist')}>{user.role}</div>
                        </div>
                        {!user.is_active && <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" title="Inactive" />}
                      </button>
                    ))}
                    {nonOwnerUsers.length === 0 && <div className="px-5 py-8 text-center text-sm text-muted">No users yet</div>}
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
                      <div className="card p-5 border-owner/25">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold',
                              selectedUser.role === 'inputer' ? 'bg-inputer/15 text-inputer' : 'bg-chemist/15 text-chemist'
                            )}>{selectedUser.full_name.charAt(0)}</div>
                            <div>
                              <div className="text-lg font-semibold text-primary">{selectedUser.full_name}</div>
                              <div className="text-sm text-muted">{selectedUser.email}</div>
                              <div className={clsx('font-mono text-xs uppercase tracking-widest mt-0.5', selectedUser.role === 'inputer' ? 'text-inputer' : 'text-chemist')}>{selectedUser.role}</div>
                            </div>
                          </div>
                          <button onClick={() => togglePermUserActive(selectedUser)} className={clsx('btn gap-2', selectedUser.is_active ? 'btn-danger' : 'btn-chemist')}>
                            {selectedUser.is_active ? <><UserX size={15} /> Deactivate</> : <><UserCheck size={15} /> Activate</>}
                          </button>
                        </div>
                      </div>

                      <div className="card overflow-hidden">
                        <div className="px-6 py-4 border-b border-border">
                          <div className="font-mono text-xs text-muted uppercase tracking-widest">Feature Permissions</div>
                          <div className="text-xs text-muted mt-1">Toggle to override default role permissions</div>
                        </div>
                        <div className="divide-y divide-border">
                          {FEATURES.filter(f => f.roles.includes(selectedUser.role)).map(feature => {
                            const override   = getOverride(selectedUser.id, feature.key)
                            const isAllowed  = override ? override.is_allowed : true
                            return (
                              <div key={feature.key} className="flex items-center justify-between px-6 py-4">
                                <div>
                                  <div className="text-sm text-primary">{feature.label}</div>
                                  {override && <div className="font-mono text-[10px] text-owner mt-0.5">⚠ Override active</div>}
                                </div>
                                <button onClick={() => toggleFeature(selectedUser.id, feature.key, isAllowed)} disabled={permSaving} className={clsx('transition-all', isAllowed ? 'text-chemist' : 'text-muted')}>
                                  {isAllowed ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {getUserOverrides(selectedUser.id).length > 0 && (
                        <div className="card overflow-hidden">
                          <div className="px-6 py-4 border-b border-border">
                            <div className="font-mono text-xs text-muted uppercase tracking-widest">Active Overrides</div>
                          </div>
                          <div className="divide-y divide-border">
                            {getUserOverrides(selectedUser.id).map(o => (
                              <div key={o.id} className="flex items-center justify-between px-6 py-3">
                                <div className="flex items-center gap-3">
                                  <span className={clsx('badge', o.is_allowed ? 'badge-chemist' : 'badge-muted')}>{o.is_allowed ? '✓ Allowed' : '✗ Denied'}</span>
                                  <span className="text-sm text-primary">{o.feature.replace(/_/g, ' ')}</span>
                                </div>
                                <button onClick={async () => { await inventoryApi.deletePermissionOverride(o.id); await loadAll() }} className="text-muted hover:text-red-400 transition-colors">
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
            )}
          </>
        )}
      </div>

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-down">
          <div className="card border-owner/30 w-full max-w-lg p-6 relative">
            <button onClick={() => setEditUser(null)} className="absolute top-4 right-4 text-muted hover:text-primary transition-colors"><X size={20} /></button>
            <h3 className="font-display text-lg font-semibold text-owner uppercase tracking-wide mb-1">Edit User</h3>
            <p className="text-xs text-muted mb-5">{editUser.email}</p>
            <form onSubmit={handleEditSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">Full Name *</label>
                  <input className="input-field owner-focus" value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} required />
                </div>
                <div>
                  <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">Phone</label>
                  <input className="input-field owner-focus" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} placeholder="+91 99999 00000" />
                </div>
                {editUser.role !== 'owner' && (
                  <div className="md:col-span-2">
                    <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">Role *</label>
                    <select className="input-field owner-focus" value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
                      <option value="inputer">Inputer</option>
                      <option value="chemist">Chemist</option>
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-3">
                  Factory Access <span className="ml-2 normal-case text-[10px] text-muted/60">(toggle to grant or remove access)</span>
                </label>
                <FactoryCheckboxes
                  selected={editForm.factory_ids}
                  onToggle={id => setEditForm(f => ({ ...f, factory_ids: f.factory_ids.includes(id) ? f.factory_ids.filter(x => x !== id) : [...f.factory_ids, id] }))}
                />
              </div>
              {editError && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">{editError}</div>}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={editSaving} className="btn btn-owner flex-1 justify-center py-3">{editSaving ? 'Saving...' : '✓ Save Changes'}</button>
                <button type="button" onClick={() => setEditUser(null)} className="btn btn-ghost px-6">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
