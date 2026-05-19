'use client'
import { useEffect, useMemo, useState } from 'react'
import { X, Save, Plus, Trash2 } from 'lucide-react'
import {
  fetchOrgUsers, saveExpense, today,
} from '@madstoq/sales-system/api'
import type {
  SalesExpenseWithSplits, SalesUser, SplitMethod,
} from '@madstoq/sales-system/types'

interface SplitInput {
  user_id: string
  share_amount: number
  share_percent?: number | null
}

const SPLIT_METHODS: { value: SplitMethod; label: string }[] = [
  { value: 'equal',   label: 'Equal split' },
  { value: 'percent', label: 'By percent' },
  { value: 'custom',  label: 'Custom amounts' },
]

function round2(n: number) { return Math.round(n * 100) / 100 }

export default function ExpenseFormModal({
  orgId, currentUserId, current, onClose, onSaved,
}: {
  orgId: string
  currentUserId: string
  current: SalesExpenseWithSplits | null
  onClose: () => void
  onSaved: () => void
}) {
  const [users, setUsers] = useState<SalesUser[]>([])

  const [title, setTitle]               = useState(current?.title ?? '')
  const [description, setDescription]   = useState(current?.description ?? '')
  const [amount, setAmount]             = useState<string>(current ? String(current.amount) : '')
  const [currency]                      = useState(current?.currency ?? 'INR')
  const [date, setDate]                 = useState(current?.expense_date ?? today())
  const [paidBy, setPaidBy]             = useState(current?.paid_by ?? currentUserId)
  const [method, setMethod]             = useState<SplitMethod>(current?.split_method ?? 'equal')
  const [participants, setParticipants] = useState<string[]>(
    current?.splits?.map(s => s.user_id) ?? [currentUserId],
  )
  const [percentByUser, setPercentByUser] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {}
    current?.splits?.forEach(s => { if (s.share_percent != null) m[s.user_id] = Number(s.share_percent) })
    return m
  })
  const [customByUser, setCustomByUser]   = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {}
    if (current?.split_method === 'custom') {
      current?.splits?.forEach(s => { m[s.user_id] = Number(s.share_amount) })
    }
    return m
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  useEffect(() => { (async () => setUsers(await fetchOrgUsers(orgId)))() }, [orgId])

  const total = Number(amount || 0)

  const splits: SplitInput[] = useMemo(() => {
    if (participants.length === 0 || !total) return []

    if (method === 'equal') {
      const each = round2(total / participants.length)
      const drift = round2(total - each * participants.length)
      return participants.map((u, i) => ({
        user_id: u,
        share_amount: i === 0 ? round2(each + drift) : each,
      }))
    }

    if (method === 'percent') {
      return participants.map(u => {
        const pct = percentByUser[u] ?? 0
        return {
          user_id: u,
          share_amount: round2(total * pct / 100),
          share_percent: pct,
        }
      })
    }

    return participants.map(u => ({
      user_id: u,
      share_amount: round2(customByUser[u] ?? 0),
    }))
  }, [participants, total, method, percentByUser, customByUser])

  const splitTotal = round2(splits.reduce((s, x) => s + x.share_amount, 0))
  const totalsMatch = total > 0 && Math.abs(splitTotal - total) < 0.05

  function toggleParticipant(uid: string) {
    setParticipants(p => p.includes(uid) ? p.filter(x => x !== uid) : [...p, uid])
  }

  async function handleSave() {
    if (!title.trim())       { setError('Title is required.'); return }
    if (!total)              { setError('Amount must be > 0.'); return }
    if (!participants.length){ setError('Pick at least one participant.'); return }
    if (!totalsMatch)        { setError(`Splits total ${splitTotal} doesn't match expense total ${total}.`); return }
    setError('')
    setSaving(true)
    try {
      await saveExpense({
        id: current?.id,
        org_id: orgId,
        title: title.trim(),
        description: description.trim() || null,
        amount: total,
        currency,
        expense_date: date,
        paid_by: paidBy,
        split_method: method,
        created_by: currentUserId,
        splits,
      })
      onSaved()
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
          <h2 className="text-base font-bold text-primary">{current ? 'Edit Expense' : 'New Expense'}</h2>
          <button onClick={onClose} className="text-muted hover:text-primary"><X size={18}/></button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Title *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} className="input w-full" placeholder="e.g. Client lunch — Acme"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Amount (₹) *</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="input w-full"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input w-full"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Paid By</label>
              <select value={paidBy} onChange={e => setPaidBy(e.target.value)} className="input w-full">
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Split Method</label>
              <select value={method} onChange={e => setMethod(e.target.value as SplitMethod)} className="input w-full">
                {SPLIT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Description</label>
              <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} className="input w-full"/>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-muted uppercase tracking-wider">Participants</div>
              <div className={`text-[11px] ${totalsMatch ? 'text-chemist' : 'text-red-400'}`}>
                Splits total: ₹{splitTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} / ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="border border-border rounded-lg divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {users.map(u => {
                const checked = participants.includes(u.id)
                const sp = splits.find(s => s.user_id === u.id)
                return (
                  <label key={u.id} className="flex items-center gap-3 px-3 py-2 hover:bg-layer-sm cursor-pointer">
                    <input type="checkbox" checked={checked} onChange={() => toggleParticipant(u.id)} className="accent-current text-owner"/>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-primary truncate">{u.full_name}{u.id === currentUserId ? ' (you)' : ''}</div>
                      <div className="text-[10px] font-mono text-muted truncate">{u.email}</div>
                    </div>
                    {checked && method === 'percent' && (
                      <input
                        type="number" min={0} max={100} step="0.01"
                        value={percentByUser[u.id] ?? ''}
                        onChange={e => setPercentByUser(p => ({ ...p, [u.id]: Number(e.target.value || 0) }))}
                        className="input w-20 text-xs" placeholder="%"
                      />
                    )}
                    {checked && method === 'custom' && (
                      <input
                        type="number" min={0} step="0.01"
                        value={customByUser[u.id] ?? ''}
                        onChange={e => setCustomByUser(p => ({ ...p, [u.id]: Number(e.target.value || 0) }))}
                        className="input w-28 text-xs" placeholder="₹"
                      />
                    )}
                    {checked && method === 'equal' && (
                      <span className="text-xs font-mono text-muted">₹{(sp?.share_amount ?? 0).toFixed(2)}</span>
                    )}
                  </label>
                )
              })}
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
