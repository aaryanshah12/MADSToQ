'use client'

import { useEffect, useMemo, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@/components/ui/PageHeader'
import { useAuth } from '@/hooks/useAuth'
import { createInOutProduct, fetchInOutProducts, InOutKind, InOutProduct, updateInOutProduct } from '@/lib/inoutProducts'
import { Plus, ToggleLeft, ToggleRight } from 'lucide-react'
import clsx from 'clsx'

export default function OwnerInOutProductsPage() {
  const { profile } = useAuth()
  const factories = useMemo(() => profile?.factories ?? [], [profile])

  const [factoryId, setFactoryId] = useState('')
  const [kind, setKind] = useState<InOutKind>('inward')
  const [products, setProducts] = useState<InOutProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (factories.length > 0 && !factoryId) setFactoryId(factories[0].id)
  }, [factories, factoryId])

  const load = async () => {
    if (!profile || !factoryId) return
    setLoading(true)
    setError('')
    try {
      const rows = await fetchInOutProducts({ kind, factory_id: factoryId, include_inactive: true })
      setProducts(rows)
    } catch (e: any) {
      setProducts([])
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [profile, factoryId, kind])

  const active = products.filter(p => p.is_active)
  const inactive = products.filter(p => !p.is_active)

  const add = async () => {
    if (!factoryId) return
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    setError('')
    try {
      await createInOutProduct({ factory_id: factoryId, kind, name: trimmed })
      setName('')
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (p: InOutProduct) => {
    setSaving(true)
    setError('')
    try {
      await updateInOutProduct({ id: p.id, is_active: !p.is_active })
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-8">
        <PageHeader
          title="Inward/Outward Products"
          subtitle="Owner · Configure products for inward/outward modules"
          accent="owner"
        />

        <div className="card p-4 md:p-6 mb-4 grid gap-4 md:grid-cols-3 items-end">
          <div className="flex flex-col gap-2">
            <label className="text-xs text-muted font-mono">Factory</label>
            <select className="input" value={factoryId} onChange={e => setFactoryId(e.target.value)}>
              {factories.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs text-muted font-mono">Module</label>
            <select className="input" value={kind} onChange={e => setKind(e.target.value as InOutKind)}>
              <option value="inward">Inward</option>
              <option value="outward">Outward</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs text-muted font-mono">Add Product</label>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={kind === 'inward' ? 'e.g. Acid Grade A' : 'e.g. Finished Batch X'}
                onKeyDown={e => { if (e.key === 'Enter') add() }}
              />
              <button className="btn btn-owner gap-2" onClick={add} disabled={saving || !name.trim()}>
                <Plus size={16}/> Add
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-300 mb-4">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="card overflow-hidden">
            <div className="px-4 md:px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="font-mono text-xs text-muted uppercase tracking-widest">Active</div>
              {loading && <div className="text-xs text-muted">Loading…</div>}
            </div>
            <div className="p-4 md:p-6 space-y-2">
              {active.length === 0 && !loading && (
                <div className="text-sm text-muted">No active products.</div>
              )}
              {active.map(p => (
                <div key={p.id} className="flex items-center justify-between gap-3 border border-border rounded-lg px-3 py-2">
                  <div className="text-primary">{p.name}</div>
                  <button
                    className={clsx('btn gap-2', 'btn-danger')}
                    onClick={() => toggle(p)}
                    disabled={saving}
                  >
                    <ToggleLeft size={16}/> Disable
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-4 md:px-6 py-4 border-b border-border">
              <div className="font-mono text-xs text-muted uppercase tracking-widest">Inactive</div>
            </div>
            <div className="p-4 md:p-6 space-y-2">
              {inactive.length === 0 && !loading && (
                <div className="text-sm text-muted">No inactive products.</div>
              )}
              {inactive.map(p => (
                <div key={p.id} className="flex items-center justify-between gap-3 border border-border rounded-lg px-3 py-2 opacity-80">
                  <div className="text-muted">{p.name}</div>
                  <button
                    className={clsx('btn gap-2', 'btn-owner')}
                    onClick={() => toggle(p)}
                    disabled={saving}
                  >
                    <ToggleRight size={16}/> Enable
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

