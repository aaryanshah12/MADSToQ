'use client'
import { useEffect, useState } from 'react'
import { X, Save } from 'lucide-react'
import type { SalesLead, LeadStatus } from '@madstoq/sales-system/types'
import { saveLead, fetchOrgUsers } from '@madstoq/sales-system/api'
import type { SalesUser } from '@madstoq/sales-system/types'

const STATUSES: LeadStatus[] = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost', 'on_hold']

const empty = (): Partial<SalesLead> => ({
  company_name: '', contact_person: '', email: '', phone: '',
  address: '', city: '', state: '', country: 'India', pincode: '',
  source: '', status: 'new', expected_value: undefined, expected_close_date: '',
  notes: '', assigned_to: null,
})

export default function LeadFormModal({
  orgId, current, onClose, onSaved, currentUserId,
}: {
  orgId: string
  current: SalesLead | null
  currentUserId?: string
  onClose: () => void
  onSaved: (l: SalesLead) => void
}) {
  const [form, setForm] = useState<Partial<SalesLead>>(current ?? empty())
  const [users, setUsers] = useState<SalesUser[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { (async () => setUsers(await fetchOrgUsers(orgId)))() }, [orgId])

  const set = (k: keyof SalesLead) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const v: any = e.target.value
    setForm(f => ({ ...f, [k]: v === '' ? null : v }))
  }

  async function handleSave() {
    if (!form.company_name?.trim()) { setError('Company name is required.'); return }
    setError('')
    setSaving(true)
    try {
      const saved = await saveLead({
        ...form,
        org_id: orgId,
        company_name: form.company_name!,
        created_by: current ? form.created_by ?? null : (currentUserId ?? null),
        expected_value: form.expected_value === undefined ? null : Number(form.expected_value),
        expected_close_date: form.expected_close_date || null,
      } as any)
      onSaved(saved)
      onClose()
    } catch (e: any) {
      setError(e.message ?? 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rounded-2xl shadow-2xl w-full max-w-2xl my-6 border border-border" style={{ background: 'var(--color-panel)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-bold text-primary">{current ? 'Edit Lead' : 'New Lead'}</h2>
          <button onClick={onClose} className="text-muted hover:text-primary"><X size={18}/></button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Company *</label>
              <input value={form.company_name ?? ''} onChange={set('company_name')} className="input w-full" placeholder="Acme Corp"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Contact Person</label>
              <input value={form.contact_person ?? ''} onChange={set('contact_person')} className="input w-full"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Source</label>
              <input value={form.source ?? ''} onChange={set('source')} placeholder="referral, web, event…" className="input w-full"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Email</label>
              <input type="email" value={form.email ?? ''} onChange={set('email')} className="input w-full"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Phone</label>
              <input value={form.phone ?? ''} onChange={set('phone')} className="input w-full"/>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Address</label>
              <input value={form.address ?? ''} onChange={set('address')} className="input w-full"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">City</label>
              <input value={form.city ?? ''} onChange={set('city')} className="input w-full"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">State</label>
              <input value={form.state ?? ''} onChange={set('state')} className="input w-full"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Country</label>
              <input value={form.country ?? ''} onChange={set('country')} className="input w-full"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Pincode</label>
              <input value={form.pincode ?? ''} onChange={set('pincode')} className="input w-full"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Status</label>
              <select value={form.status ?? 'new'} onChange={set('status')} className="input w-full">
                {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Assigned To</label>
              <select value={form.assigned_to ?? ''} onChange={set('assigned_to')} className="input w-full">
                <option value="">— Unassigned —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Expected Value (₹)</label>
              <input type="number" value={form.expected_value ?? ''} onChange={set('expected_value')} className="input w-full"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Expected Close</label>
              <input type="date" value={form.expected_close_date ?? ''} onChange={set('expected_close_date')} className="input w-full"/>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Notes</label>
              <textarea rows={3} value={form.notes ?? ''} onChange={set('notes')} className="input w-full"/>
            </div>
          </div>
          {error && <div className="text-xs text-red-400">{error}</div>}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-owner">
            {saving ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/> : <Save size={14}/>}
            {current ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
