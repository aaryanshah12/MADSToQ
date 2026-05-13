'use client'
import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@/components/ui/PageHeader'
import { factoriesApi } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { Factory } from '@/types'
import { Plus, Pencil, ToggleLeft, ToggleRight, Factory as FactoryIcon, MapPin, CheckCircle, Users } from 'lucide-react'
import clsx from 'clsx'

export default function FactoriesPage() {
  const [factories, setFactories]             = useState<Factory[]>([])
  const [profiles, setProfiles]               = useState<any[]>([])
  const [factoryUsersMap, setFactoryUsersMap] = useState<Record<string, string[]>>({})
  const [loading, setLoading]                 = useState(true)
  const [saving, setSaving]                   = useState(false)
  const [showForm, setShowForm]               = useState(false)
  const [editingId, setEditingId]             = useState<string | null>(null)
  const [success, setSuccess]                 = useState('')
  const [error, setError]                     = useState('')
  const [form, setForm]                       = useState({ name: '', location: '', materials: [] as string[] })
  const [materialInput, setMaterialInput]     = useState('')
  const [expandedFactory, setExpandedFactory] = useState<string | null>(null)
  const [assignSaving, setAssignSaving]       = useState(false)
  const [loadError, setLoadError]             = useState('')
  const [assignedFactoryIds, setAssignedFactoryIds] = useState<string[]>([])

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true); setLoadError('')
    const data = await factoriesApi.getAll()
    if (data.error) {
      setLoadError(data.error)
      setFactories([]); setProfiles([]); setFactoryUsersMap({})
      setLoading(false)
      return
    }
    setFactories(data.factories ?? [])
    setProfiles(data.profiles ?? [])
    setFactoryUsersMap(data.factoryUsersMap ?? {})
    setAssignedFactoryIds(data.assignedFactories ?? [])
    setLoading(false)
  }

  function update(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  function startEdit(factory: Factory) {
    setEditingId(factory.id)
    setForm({
      name: factory.name,
      location: factory.location ?? '',
      materials: (factory.materials ?? []) as string[],
    })
    setMaterialInput('')
    setShowForm(true)
    setError(''); setSuccess('')
  }

  function resetForm() {
    setShowForm(false); setEditingId(null)
    setForm({ name: '', location: '', materials: [] })
    setMaterialInput('')
    setError(''); setSuccess('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(''); setSuccess('')
    const result = editingId
      ? await factoriesApi.update({ id: editingId, name: form.name, location: form.location, materials: form.materials })
      : await factoriesApi.create({ name: form.name, location: form.location, materials: form.materials })
    if (result.error) { setError(result.error); setSaving(false); return }
    setSuccess(`Factory "${form.name}" ${editingId ? 'updated' : 'created'} successfully!`)
    await loadAll()
    resetForm()
    setSaving(false)
  }

  async function toggleActive(factory: Factory) {
    await factoriesApi.update({ id: factory.id, is_active: !factory.is_active })
    setFactories(prev => prev.map(f => f.id === factory.id ? { ...f, is_active: !f.is_active } : f))
  }

  async function toggleUserAssignment(factoryId: string, profileId: string) {
    setAssignSaving(true)
    const isAssigned = (factoryUsersMap[factoryId] ?? []).includes(profileId)
    if (isAssigned) {
      await supabase.from('profile_factories').delete().match({ profile_id: profileId, factory_id: factoryId })
    } else {
      await supabase.from('profile_factories').insert({ profile_id: profileId, factory_id: factoryId })
    }
    await loadAll()
    setAssignSaving(false)
  }

  const assignableUsers = profiles.filter(p => p.role !== 'owner' && p.is_active)

  function addMaterialChip() {
    const value = materialInput.trim()
    if (!value) return
    if (form.materials.includes(value)) { setMaterialInput(''); return }
    setForm(f => ({ ...f, materials: [...f.materials, value] }))
    setMaterialInput('')
  }

  function removeMaterialChip(value: string) {
    setForm(f => ({ ...f, materials: f.materials.filter(m => m !== value) }))
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-8">
        <PageHeader
          title="Factories"
          subtitle="Owner · Manage Factory Locations & User Access"
          accent="owner"
          actions={
            <button onClick={() => { resetForm(); setShowForm(true) }} className="btn btn-owner gap-2">
              <Plus size={16}/> Add Factory
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
              No factories are assigned to your owner account. You need factory access before you can view or manage them.
            </p>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-3 bg-chemist/10 border border-chemist/30 rounded-xl px-5 py-3 mb-6 animate-fade-down">
            <CheckCircle size={16} className="text-chemist flex-shrink-0" />
            <span className="text-sm text-chemist">{success}</span>
            <button onClick={() => setSuccess('')} className="ml-auto text-muted hover:text-primary text-lg leading-none">x</button>
          </div>
        )}

        {showForm && (
          <div className="card border-owner/30 p-6 mb-6 animate-fade-down">
            <h3 className="font-display text-lg font-semibold text-owner uppercase tracking-wide mb-5">
              {editingId ? 'Edit Factory' : 'New Factory'}
            </h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">Factory Name *</label>
                <input className="input-field owner-focus" value={form.name} onChange={e => update('name', e.target.value)} required placeholder="e.g. Factory Alpha" />
              </div>
              <div>
                <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">Location</label>
                <input className="input-field owner-focus" value={form.location} onChange={e => update('location', e.target.value)} placeholder="e.g. Ahmedabad, Gujarat" />
              </div>
              <div className="col-span-2">
                <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">Materials (chip list)</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {form.materials.map(m => (
                    <span key={m} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-owner/10 border border-owner/30 text-xs font-mono">
                      {m}
                      <button type="button" onClick={() => removeMaterialChip(m)} className="text-muted hover:text-white">×</button>
                    </span>
                  ))}
                  {form.materials.length === 0 && (
                    <span className="text-xs text-muted">No materials added</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    className="input-field owner-focus flex-1"
                    value={materialInput}
                    onChange={e => setMaterialInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); addMaterialChip() }
                      if (e.key === ',' ) { e.preventDefault(); addMaterialChip() }
                    }}
                    placeholder="Type a material and press Enter"
                  />
                  <button type="button" onClick={addMaterialChip} className="btn btn-owner whitespace-nowrap">Add</button>
                </div>
              </div>
              {error && (
                <div className="col-span-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">{error}</div>
              )}
              <div className="col-span-2 flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="btn btn-owner flex-1 justify-center py-3">
                  {saving ? 'Saving...' : editingId ? 'Update Factory' : 'Create Factory'}
                </button>
                <button type="button" onClick={resetForm} className="btn btn-ghost px-8">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-owner border-t-transparent rounded-full animate-spin" />
          </div>
        ) : factories.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-20 gap-4">
            <FactoryIcon size={40} className="text-muted" />
            <p className="text-muted">No factories yet.</p>
            <button onClick={() => setShowForm(true)} className="btn btn-owner gap-2">
              <Plus size={15}/> Add your first factory
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {factories.map((factory, i) => {
              const assignedIds   = factoryUsersMap[factory.id] ?? []
              const assignedUsers = profiles.filter(p => assignedIds.includes(p.id))
              const isExpanded    = expandedFactory === factory.id

              return (
                <div
                  key={factory.id}
                  className={clsx(
                    'card border transition-all',
                    factory.is_active ? 'border-owner/25 glow-border-owner' : 'border-border opacity-60'
                  )}
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-owner/10 border border-owner/25 flex items-center justify-center text-2xl flex-shrink-0">
                        🏭
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-display text-lg font-bold text-primary tracking-wide truncate">{factory.name}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <MapPin size={11} className="text-muted flex-shrink-0" />
                          <span className="text-xs text-muted truncate">{factory.location ?? 'No location set'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status row */}
                    <div className="flex items-center justify-between mb-4">
                      <span className={clsx('badge', factory.is_active ? 'badge-chemist' : 'badge-muted')}>
                        {factory.is_active ? '● Active' : '○ Inactive'}
                      </span>
                      <span className="font-mono text-[10px] text-muted">
                        {new Date(factory.created_at).toLocaleDateString('en-IN')}
                      </span>
                    </div>

                    {/* Materials */}
                    <div className="mb-3">
                      <div className="font-mono text-[10px] text-muted uppercase tracking-widest mb-1.5">Materials</div>
                      {factory.materials && factory.materials.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {factory.materials.map(m => (
                            <span key={m} className="text-[10px] font-mono px-2 py-0.5 rounded bg-owner/15 text-owner border border-owner/30 whitespace-nowrap">
                              {m}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted italic">No materials listed</span>
                      )}
                    </div>

                    {/* Assigned users summary */}
                    <div className="bg-layer-sm rounded-lg px-3 py-2.5 mb-4">
                      <div className="font-mono text-[9px] text-muted uppercase tracking-widest mb-1.5">Assigned Users</div>
                      {assignedUsers.length === 0 ? (
                        <span className="text-xs text-muted italic">No users assigned yet</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {assignedUsers.map(u => (
                            <span key={u.id} className={clsx(
                              'text-[10px] font-mono px-2 py-0.5 rounded border whitespace-nowrap',
                              u.role === 'inputer'
                                ? 'bg-inputer/10 text-inputer border-inputer/25'
                                : 'bg-chemist/10 text-chemist border-chemist/25'
                            )}>
                              {u.full_name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(factory)} className="btn btn-ghost flex-1 justify-center gap-1.5 py-2 text-xs">
                        <Pencil size={13}/> Edit
                      </button>
                      <button
                        onClick={() => setExpandedFactory(isExpanded ? null : factory.id)}
                        className={clsx('btn flex-1 justify-center gap-1.5 py-2 text-xs', isExpanded ? 'btn-owner' : 'btn-ghost')}
                      >
                        <Users size={13}/>
                        {isExpanded ? 'Done' : 'Assign Users'}
                      </button>
                      <button
                        onClick={() => toggleActive(factory)}
                        className={clsx('btn justify-center gap-1.5 py-2 px-3 text-xs', factory.is_active ? 'btn-danger' : 'btn-chemist')}
                        title={factory.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {factory.is_active ? <ToggleLeft size={14}/> : <ToggleRight size={14}/>}
                      </button>
                    </div>
                  </div>

                  {/* ── Assign Users Panel (expands inline) ── */}
                  {isExpanded && (
                    <div className="border-t border-owner/20 px-6 py-4 bg-owner/3">
                      <p className="font-mono text-[10px] text-owner uppercase tracking-widest mb-3">
                        Click to grant or remove access
                      </p>
                      {assignableUsers.length === 0 ? (
                        <p className="text-xs text-muted italic">
                          No active inputers or chemists found. Create users first.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {assignableUsers.map(user => {
                            const isAssigned = assignedIds.includes(user.id)
                            return (
                              <button
                                key={user.id}
                                onClick={() => toggleUserAssignment(factory.id, user.id)}
                                disabled={assignSaving}
                                className={clsx(
                                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all disabled:opacity-50',
                                  isAssigned
                                    ? 'bg-owner/10 border-owner/30 hover:bg-owner/15'
                                    : 'bg-transparent border-border hover:border-white/20'
                                )}
                              >
                                {/* Checkbox */}
                                <div className={clsx(
                                  'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all',
                                  isAssigned ? 'bg-owner border-owner' : 'border-muted'
                                )}>
                                  {isAssigned && <span className="text-[9px] text-black font-bold">✓</span>}
                                </div>

                                {/* Avatar */}
                                <div className={clsx(
                                  'w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0',
                                  user.role === 'inputer' ? 'bg-inputer/15 text-inputer' : 'bg-chemist/15 text-chemist'
                                )}>
                                  {user.full_name.charAt(0)}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="text-sm text-primary font-medium truncate">{user.full_name}</div>
                                </div>

                                <span className={clsx(
                                  'text-[9px] font-mono px-2 py-0.5 rounded border flex-shrink-0',
                                  user.role === 'inputer'
                                    ? 'text-inputer border-inputer/30 bg-inputer/5'
                                    : 'text-chemist border-chemist/30 bg-chemist/5'
                                )}>
                                  {user.role}
                                </span>
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
    </AppLayout>
  )
}
