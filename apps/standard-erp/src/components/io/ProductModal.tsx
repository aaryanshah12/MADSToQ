'use client'
import { useState, useEffect } from 'react'
import { saveProduct, fetchUnits } from '@madstoq/io-system/api'
import type { IOProduct, IOUnit } from '@madstoq/io-system/types'
import { X, Save } from 'lucide-react'
import { useIOFactory } from '@/contexts/IOFactoryContext'

interface Props {
  editing?: IOProduct | null
  factoryId?: string | null
  onClose: () => void
  onSaved: (product: IOProduct) => void
}

export default function ProductModal({ editing, factoryId: factoryIdProp, onClose, onSaved }: Props) {
  const { factoryId: ctxFactoryId, factories } = useIOFactory()
  const factoryId = factoryIdProp ?? (factories.length === 1 ? ctxFactoryId : null)
  const [units, setUnits] = useState<IOUnit[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    product_name: editing?.product_name ?? '',
    description:  editing?.description ?? '',
    hsn_code:     editing?.hsn_code ?? '',
    unit_id:      editing?.unit_id?.toString() ?? '',
    rate:         editing?.rate?.toString() ?? '',
  })

  useEffect(() => {
    fetchUnits().then(u => {
      setUnits(u)
      if (editing) return
      setForm(f => {
        if (f.unit_id) return f
        const kg = u.find(x => (x.abbreviation ?? '').toLowerCase() === 'kg')
          ?? u.find(x => x.name.toLowerCase().includes('kg') || x.name.toLowerCase().includes('kilo'))
        return kg ? { ...f, unit_id: String(kg.id) } : f
      })
    }).catch(console.error)
  }, [])

  async function handleSave() {
    if (!form.product_name.trim()) { alert('Product name is required'); return }
    setSaving(true)
    try {
      const saved = await saveProduct({
        id:           editing?.id,
        factory_id:   editing ? editing.factory_id : (factoryId ?? null),
        product_name: form.product_name.trim(),
        description:  form.description || null,
        hsn_code:     form.hsn_code || null,
        unit_id:      form.unit_id ? parseInt(form.unit_id) : null,
        rate:         form.rate ? parseFloat(form.rate) : null,
        is_active:    true,
      })
      onSaved(saved)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  const f = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="rounded-2xl shadow-2xl w-full max-w-md border border-border"
        style={{ background: 'var(--color-panel)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-bold text-primary">{editing ? 'Edit Product' : 'Add Product'}</h2>
          <button onClick={onClose} className="text-muted hover:text-primary transition-colors"><X size={18}/></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Product Name *</label>
            <input
              value={form.product_name} onChange={f('product_name')}
              placeholder="Enter product name"
              className="input w-full"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">HSN Code</label>
              <input value={form.hsn_code} onChange={f('hsn_code')} placeholder="e.g. 8471" className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Unit</label>
              <select value={form.unit_id} onChange={f('unit_id')} className="input w-full">
                <option value="">— Select —</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.name} {u.abbreviation ? `(${u.abbreviation})` : ''}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Default Rate (₹)</label>
            <input type="number" min={0} value={form.rate} onChange={f('rate')} placeholder="0.00" className="input w-full" />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={2} placeholder="Optional description"
              className="input w-full resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-inputer">
            {saving
              ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/>
              : <Save size={14}/>}
            {editing ? 'Update' : 'Add Product'}
          </button>
        </div>
      </div>
    </div>
  )
}
