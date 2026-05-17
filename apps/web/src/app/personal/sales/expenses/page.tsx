'use client'
import { useEffect, useState, useMemo } from 'react'
import {
  Plus, Pencil, Trash2, Bell, Check, CheckCheck, Wallet, ChevronDown,
} from 'lucide-react'
import { useSalesUser } from '@/contexts/SalesUserContext'
import {
  fetchExpenses, deleteExpense, settleSplit, settleAllSplits, sendSplitReminder, fmtDate,
} from '@/lib/sales/api'
import type { SalesExpenseWithSplits } from '@/lib/sales/types'
import ExpenseFormModal from '@/components/sales/ExpenseFormModal'

export default function ExpensesPage() {
  const { org, membership } = useSalesUser()
  const [rows, setRows] = useState<SalesExpenseWithSplits[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<SalesExpenseWithSplits | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => { if (org) load() }, [org?.id])

  async function load() {
    if (!org) return
    setLoading(true)
    try { setRows(await fetchExpenses(org.id)) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this expense?')) return
    await deleteExpense(id); load()
  }

  async function doSettle(splitId: string) {
    setBusyId(splitId)
    try { await settleSplit(splitId); await load() }
    catch (e: any) { alert(e.message ?? 'Failed') }
    finally { setBusyId(null) }
  }
  async function doSettleAll(expenseId: string) {
    if (!confirm('Mark all participants as settled?')) return
    setBusyId(expenseId)
    try { await settleAllSplits(expenseId); await load() }
    catch (e: any) { alert(e.message ?? 'Failed') }
    finally { setBusyId(null) }
  }
  async function doRemind(splitId: string) {
    setBusyId(splitId)
    try { await sendSplitReminder(splitId); await load() }
    catch (e: any) { alert(e.message ?? 'Failed') }
    finally { setBusyId(null) }
  }

  // Personal balances
  const summary = useMemo(() => {
    if (!membership) return { youOwe: 0, owedToYou: 0, total: 0 }
    let youOwe = 0, owedToYou = 0, total = 0
    for (const e of rows) {
      total += Number(e.amount || 0)
      const splits = e.splits ?? []
      const mine = splits.find(s => s.user_id === membership.id)
      if (mine && !mine.is_settled && e.paid_by !== membership.id) youOwe += Number(mine.share_amount || 0)
      if (e.paid_by === membership.id) {
        owedToYou += splits.filter(s => s.user_id !== membership.id && !s.is_settled).reduce((s, x) => s + Number(x.share_amount || 0), 0)
      }
    }
    return { youOwe, owedToYou, total }
  }, [rows, membership?.id])

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-primary">Expenses</h1>
          <p className="text-sm text-muted mt-0.5">{rows.length} expenses · ₹{summary.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })} total</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true) }} className="btn btn-owner"><Plus size={15}/> New Expense</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <SummaryCard label="You owe"     value={`₹${summary.youOwe.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}     accent="#dc2626"/>
        <SummaryCard label="Owed to you" value={`₹${summary.owedToYou.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} accent="#16a34a"/>
        <SummaryCard label="Net" value={`₹${(summary.owedToYou - summary.youOwe).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} accent="var(--color-owner)"/>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="card py-12 text-center"><div className="inline-block w-6 h-6 border-2 border-owner border-t-transparent rounded-full animate-spin"/></div>
        ) : rows.length === 0 ? (
          <div className="card py-12 text-center text-sm text-muted">No expenses yet. Add one to start splitting.</div>
        ) : rows.map(e => {
          const isCreator = e.created_by === membership?.id
          const isPayer   = e.paid_by    === membership?.id
          const open      = !!openIds[e.id]
          const splits    = e.splits ?? []
          const remaining = splits.filter(s => !s.is_settled).length
          const settled   = splits.length - remaining
          return (
            <div key={e.id} className="card overflow-hidden">
              <button
                onClick={() => setOpenIds(s => ({ ...s, [e.id]: !s[e.id] }))}
                className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-layer-sm"
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-owner/10 text-owner flex-shrink-0">
                  <Wallet size={16}/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-primary truncate">{e.title}</div>
                  <div className="text-[11px] text-muted truncate">
                    {fmtDate(e.expense_date)} · Paid by <span className="text-primary">{e.payer?.full_name ?? '—'}</span> · {settled}/{splits.length} settled
                  </div>
                </div>
                <div className="text-sm font-bold text-primary">₹{Number(e.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                <ChevronDown size={16} className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`}/>
              </button>

              {open && (
                <div className="border-t border-border">
                  {e.description && <div className="px-4 py-3 text-sm text-primary border-b border-border">{e.description}</div>}

                  <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                    {splits.map(s => (
                      <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-layer-sm text-sm font-bold flex-shrink-0">
                          {s.user?.full_name?.charAt(0) ?? '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-primary truncate">{s.user?.full_name ?? '—'}{s.user_id === membership?.id ? ' (you)' : ''}</div>
                          <div className="text-[11px] text-muted">
                            {s.is_settled
                              ? <>Settled {fmtDate(s.settled_at)}</>
                              : (s.last_reminder_at
                                  ? <>Last reminded {fmtDate(s.last_reminder_at)} · {s.reminder_count ?? 0}×</>
                                  : 'Pending')
                            }
                          </div>
                        </div>
                        <div className="text-sm font-mono font-semibold text-primary">₹{Number(s.share_amount).toFixed(2)}</div>
                        {s.is_settled ? (
                          <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border border-chemist/40 text-chemist">settled</span>
                        ) : (
                          <div className="flex items-center gap-1">
                            {isCreator && s.user_id !== e.paid_by && (
                              <>
                                <button onClick={() => doRemind(s.id)} disabled={busyId === s.id} className="p-1.5 rounded hover:bg-layer-sm text-muted hover:text-owner" title="Send reminder">
                                  <Bell size={13}/>
                                </button>
                                <button onClick={() => doSettle(s.id)} disabled={busyId === s.id} className="p-1.5 rounded hover:bg-layer-sm text-muted hover:text-chemist" title="Mark settled">
                                  <Check size={13}/>
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
                    {isCreator && remaining > 0 && (
                      <button onClick={() => doSettleAll(e.id)} disabled={busyId === e.id} className="btn btn-chemist text-xs">
                        <CheckCheck size={13}/> Settle all
                      </button>
                    )}
                    {isCreator && (
                      <>
                        <button onClick={() => { setEditing(e); setShowForm(true) }} className="btn btn-ghost text-xs"><Pencil size={13}/> Edit</button>
                        <button onClick={() => handleDelete(e.id)} className="btn btn-ghost text-xs text-red-400"><Trash2 size={13}/> Delete</button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showForm && org && membership && (
        <ExpenseFormModal
          orgId={org.id}
          currentUserId={membership.id}
          current={editing}
          onClose={() => setShowForm(false)}
          onSaved={load}
        />
      )}
    </div>
  )
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="card p-4">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3 bg-layer-sm">
        <Wallet size={17} style={{ color: accent }}/>
      </div>
      <div className="text-xl font-bold text-primary truncate">{value}</div>
      <div className="text-xs text-muted mt-0.5">{label}</div>
    </div>
  )
}
