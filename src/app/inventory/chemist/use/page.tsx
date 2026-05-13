'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'
import { usageApi } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { CheckCircle, Search, Lock, Hash, CalendarDays, Plus, Trash2 } from 'lucide-react'

type LookupMode = 'inv' | 'date'
const months = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

export default function ChemistUsagePage() {
  const { profile } = useAuth()
  const router = useRouter()
  const [form, setForm] = useState({
    factory_id:     '',
    invoice_number: '',
    process_id:     '',
    batch_notes:    '',
    shift:          '',
    usage_date:     new Date().toISOString().split('T')[0],
    batch_month:    new Date().toLocaleString('en-US', { month: 'long' }),
    batch_id:       '',
  })
  const [factories, setFactories]         = useState<any[]>([])
  const [invoiceInfo, setInvoiceInfo]     = useState<any>(null)
  const [invoiceError, setInvoiceError]   = useState('')
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')
  const [success, setSuccess]             = useState(false)

  // Lookup mode state
  const [lookupMode, setLookupMode]       = useState<LookupMode>('inv')
  const [lookupDate, setLookupDate]       = useState(new Date().toISOString().split('T')[0])
  const [dateInvoices, setDateInvoices]   = useState<any[]>([])
  const [dateLoading, setDateLoading]     = useState(false)

  // Multiple invoice selection
  const [selections, setSelections] = useState<Array<{
    invoice_number: string
    factory_id: string
    material_type: string
    supplier_name: string
    tons_remaining: number
    tons_used: string
  }>>([])

  useEffect(() => {
    if (profile?.factories) {
      setFactories(profile.factories)
      if (profile.factories.length === 1)
        setForm(f => ({ ...f, factory_id: (profile.factories as any)[0].id }))
    }
  }, [profile])

  // ── Lookup by INV number ─────────────────────────────
  async function lookupByInv() {
    if (!form.invoice_number) return
    setInvoiceError(''); setInvoiceInfo(null)
    const { data, error } = await supabase
      .from('stock_entries_safe')
      .select('*')
      .eq('invoice_number', form.invoice_number)
      .single()

    if (error || !data) {
      setInvoiceError('Invoice not found. Please check the number.')
      return
    }
    const { data: bal } = await supabase
      .from('stock_balance')
      .select('tons_remaining')
      .eq('invoice_number', form.invoice_number)
      .single()

    setInvoiceInfo({ ...data, tons_remaining: bal?.tons_remaining ?? data.tons_loaded })
  }

  // ── Lookup by date: fetch all invoices for that date ─
  async function lookupByDate() {
    if (!lookupDate) return
    setDateLoading(true); setInvoiceError(''); setDateInvoices([]); setInvoiceInfo(null)

    const { data: entries } = await supabase
      .from('stock_entries_safe')
      .select('*')
      .eq('entry_date', lookupDate)
      .order('invoice_number')

    if (!entries || entries.length === 0) {
      setInvoiceError(`No invoices found for ${new Date(lookupDate + 'T00:00:00').toLocaleDateString('en-IN')}.`)
      setDateLoading(false)
      return
    }

    // Fetch balances for all found invoices
    const { data: balances } = await supabase
      .from('stock_balance')
      .select('invoice_number, tons_remaining')
      .in('invoice_number', entries.map(e => e.invoice_number))

    const balMap: Record<string, number> = {}
    ;(balances ?? []).forEach((b: any) => { balMap[b.invoice_number] = b.tons_remaining })

    setDateInvoices(entries.map(e => ({
      ...e,
      tons_remaining: balMap[e.invoice_number] ?? e.tons_loaded,
    })))
    setDateLoading(false)
  }

  // ── Select an invoice from the date picklist ─────────
  function selectInvoice(inv: any) {
    setInvoiceInfo(inv)
    setForm(f => ({ ...f, invoice_number: inv.invoice_number }))
    setInvoiceError('')
  }

  function addInvoiceToSelections() {
    if (!invoiceInfo) return
    if (Number(invoiceInfo.tons_remaining) <= 0) {
      setInvoiceError('This invoice has no remaining stock.')
      return
    }
    if (selections.some(s => s.invoice_number === invoiceInfo.invoice_number)) {
      setInvoiceError('Invoice already added to the list.')
      return
    }
    setSelections(prev => [
      ...prev,
      {
        invoice_number: invoiceInfo.invoice_number,
        factory_id:     invoiceInfo.factory_id,
        material_type:  invoiceInfo.material_type,
        supplier_name:  invoiceInfo.supplier_name,
        tons_remaining: Number(invoiceInfo.tons_remaining),
        tons_used:      '',
      }
    ])
    setInvoiceInfo(null)
    setForm(f => ({ ...f, invoice_number: '' }))
    setInvoiceError('')
  }

  function removeSelection(invoice_number: string) {
    setSelections(prev => prev.filter(s => s.invoice_number !== invoice_number))
  }

  function updateSelectionAmount(invoice_number: string, value: string) {
    setSelections(prev => prev.map(s => s.invoice_number === invoice_number ? { ...s, tons_used: value } : s))
  }

  const hasInvalidAmounts = selections.some(s =>
    !s.tons_used ||
    Number(s.tons_used) <= 0 ||
    Number(s.tons_used) > Number(s.tons_remaining)
  )
  const totalUsed = selections.reduce((sum, s) => sum + (Number(s.tons_used) || 0), 0)

  // ── Submit ───────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (selections.length === 0) { setError('Add at least one invoice to use.'); return }

    const invalid = selections.some(s => !s.tons_used || Number(s.tons_used) <= 0 || Number(s.tons_used) > Number(s.tons_remaining))
    if (invalid) { setError('Please enter valid KGS for each invoice.'); return }
    if (!form.batch_month || !form.batch_id.trim()) { setError('Batch month and Batch ID are required.'); return }

    setLoading(true); setError('')

    const payload = {
      usages: selections.map(s => ({
        factory_id:     s.factory_id || form.factory_id,
        invoice_number: s.invoice_number,
        tons_used:      Number(s.tons_used),
      })),
      process_id:  form.process_id  || undefined,
      batch_notes: form.batch_notes || undefined,
      shift:       form.shift       || undefined,
      usage_date:  form.usage_date,
      batch_month: form.batch_month,
      batch_id:    form.batch_id.trim(),
      created_by:  profile!.id,
    }

    const result = await usageApi.createBatch(payload)

    if (result.error) { setError(result.error); setLoading(false); return }
    setSuccess(true)
    setTimeout(() => router.push('/inventory/chemist'), 1500)
  }

  function update(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  function switchMode(mode: LookupMode) {
    setLookupMode(mode)
    setInvoiceInfo(null)
    setInvoiceError('')
    setDateInvoices([])
    setForm(f => ({ ...f, invoice_number: '' }))
  }

  if (success) return (
    <AppLayout>
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center animate-fade-up">
          <CheckCircle size={56} className="text-chemist mx-auto mb-4" />
          <h2 className="font-display text-2xl font-bold text-primary mb-2">Usage Logged!</h2>
          <p className="text-muted">Stock has been updated automatically.</p>
        </div>
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-2xl mx-auto w-full">
        <PageHeader title="Log Material Usage" subtitle="Chemist · Consumption Entry" accent="chemist" />

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── Step 1: Invoice lookup ── */}
          <div className="card p-6">
            <div className="font-mono text-xs text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
              <Search size={12}/> Step 1 — Find Invoice
            </div>

            {/* Mode toggle */}
            <div className="flex gap-2 mb-4 p-1 bg-layer-sm rounded-lg">
              <button
                type="button"
                onClick={() => switchMode('inv')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                  lookupMode === 'inv'
                    ? 'bg-chemist/15 text-chemist border border-chemist/30'
                    : 'text-muted hover:text-primary'
                }`}
              >
                <Hash size={14}/> By Invoice No.
              </button>
              <button
                type="button"
                onClick={() => switchMode('date')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                  lookupMode === 'date'
                    ? 'bg-chemist/15 text-chemist border border-chemist/30'
                    : 'text-muted hover:text-primary'
                }`}
              >
                <CalendarDays size={14}/> By Invoice Date
              </button>
            </div>

            {/* By INV number */}
            {lookupMode === 'inv' && (
              <div className="flex gap-3">
                <input
                  className="input-field chemist-focus flex-1"
                  value={form.invoice_number}
                  onChange={e => { update('invoice_number', e.target.value); setInvoiceInfo(null) }}
                  placeholder="INV-2024-001"
                />
                <button type="button" onClick={lookupByInv} className="btn btn-chemist flex-shrink-0">
                  Look Up
                </button>
              </div>
            )}

            {/* By date */}
            {lookupMode === 'date' && (
              <div className="space-y-3">
                <div className="flex gap-3">
                  <input
                    type="date"
                    className="input-field chemist-focus flex-1"
                    value={lookupDate}
                    onChange={e => { setLookupDate(e.target.value); setDateInvoices([]); setInvoiceInfo(null) }}
                  />
                  <button
                    type="button"
                    onClick={lookupByDate}
                    disabled={dateLoading}
                    className="btn btn-chemist flex-shrink-0"
                  >
                    {dateLoading ? 'Searching...' : 'Find Invoices'}
                  </button>
                </div>

                {/* Picklist of invoices for that date */}
                {dateInvoices.length > 0 && !invoiceInfo && (
                  <div className="space-y-2 animate-fade-down">
                    <p className="font-mono text-[10px] text-muted uppercase tracking-widest">
                      {dateInvoices.length} invoice{dateInvoices.length > 1 ? 's' : ''} found — select one:
                    </p>
                    {dateInvoices.map(inv => (
                      <button
                        key={inv.invoice_number}
                        type="button"
                        onClick={() => selectInvoice(inv)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-border hover:border-chemist/40 hover:bg-chemist/5 transition-all text-left"
                      >
                        <div>
                      <div className="text-sm font-semibold text-chemist">{inv.supplier_name}</div>
                      <div className="text-xs text-primary">{inv.material_type}</div>
                      <div className="font-mono text-[11px] text-muted mt-0.5">{inv.invoice_number}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-xs text-muted">Available</div>
                          <div className={`font-mono text-sm font-bold ${Number(inv.tons_remaining) <= 0 ? 'text-red-400' : 'text-chemist'}`}>
                            {Number(inv.tons_remaining).toFixed(3)} KGS
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {invoiceError && (
              <div className="mt-3 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2">{invoiceError}</div>
            )}

            {/* Invoice info card — shown after selection either way */}
            {invoiceInfo && (
              <div className="mt-4 bg-chemist/8 border border-chemist/25 rounded-lg p-4 animate-fade-up">
                <div className="flex items-start gap-3 mb-3">
                  <CheckCircle size={14} className="text-chemist mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-chemist">{invoiceInfo.supplier_name}</div>
                    <div className="text-xs text-primary">{invoiceInfo.material_type}</div>
                    <div className="font-mono text-[11px] text-muted mt-0.5">{invoiceInfo.invoice_number}</div>
                  </div>
                  <Lock size={11} className="text-muted mt-1" />
                  <button
                    type="button"
                    onClick={() => { setInvoiceInfo(null); setForm(f => ({ ...f, invoice_number: '' })) }}
                    className="text-muted hover:text-primary text-lg leading-none ml-1"
                  >×</button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['Supplier',   invoiceInfo.supplier_name],
                    ['Material',   invoiceInfo.material_type],
                    ['Invoice',    invoiceInfo.invoice_number],
                    ['Total Load', `${invoiceInfo.tons_loaded} KGS`],
                    ['Date',       new Date(invoiceInfo.entry_date + 'T00:00:00').toLocaleDateString('en-IN')],
                    ['Available',  `${Number(invoiceInfo.tons_remaining).toFixed(3)} KGS`],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div className="font-mono text-[10px] text-muted uppercase">{k}</div>
                      <div className={`text-sm font-semibold ${k === 'Available' ? 'text-chemist' : 'text-primary'}`}>{v}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={addInvoiceToSelections}
                    className="btn btn-chemist px-4 py-2"
                    disabled={Number(invoiceInfo.tons_remaining) <= 0}
                  >
                    <Plus size={14}/> Add to usage list
                  </button>
                  <div className="text-[11px] text-muted">It will appear in Step 2 below</div>
                </div>
                <div className="mt-2 text-[10px] text-muted font-mono">Rate & cost information is hidden from this view</div>
              </div>
            )}
          </div>

          {/* ── Step 2: Usage details ── */}
          <div className="card p-6 space-y-5">
            <div className="font-mono text-xs text-muted uppercase tracking-widest flex items-center gap-2">
              <span>⚗</span> Step 2 — Enter Usage Details
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block font-mono text-xs text-muted uppercase tracking-widest">Selected Invoices</label>
                <span className="text-xs text-muted">{selections.length} added</span>
              </div>

              {selections.length === 0 && (
                <div className="text-sm text-muted bg-layer-sm border border-border rounded-lg px-4 py-3">
                  Add invoices in Step 1 to allocate usage amounts.
                </div>
              )}

              {selections.length > 0 && (
                <div className="space-y-3">
                  {selections.map(sel => (
                    <div key={sel.invoice_number} className="border border-border rounded-lg p-4 bg-layer-sm space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-chemist">{sel.supplier_name}</div>
                          <div className="text-xs text-primary">{sel.material_type}</div>
                          <div className="font-mono text-[11px] text-muted mt-0.5">{sel.invoice_number}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] text-muted uppercase">Available</div>
                          <div className="font-mono font-bold text-chemist">{Number(sel.tons_remaining).toFixed(3)} KGS</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          type="number" step="0.001" min="0.001"
                          max={sel.tons_remaining}
                          className="input-field chemist-focus"
                          value={sel.tons_used}
                          onChange={e => updateSelectionAmount(sel.invoice_number, e.target.value)}
                          placeholder="KGS to use"
                        />
                        <button
                          type="button"
                          onClick={() => removeSelection(sel.invoice_number)}
                          className="btn btn-ghost text-red-400 border-red-500/30 hover:text-red-300 hover:border-red-500/50"
                        >
                          <Trash2 size={14}/> Remove
                        </button>
                      </div>

                      {sel.tons_used && Number(sel.tons_used) > Number(sel.tons_remaining) && (
                        <div className="text-red-400 text-xs">Exceeds available stock.</div>
                      )}
                    </div>
                  ))}

                  <div className="flex items-center justify-between text-xs text-muted font-mono">
                    <span>Total to consume</span>
                    <span className="text-chemist font-semibold">{totalUsed.toFixed(3)} KGS</span>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">Shift</label>
                <select className="input-field chemist-focus" value={form.shift} onChange={e => update('shift', e.target.value)}>
                  <option value="">Select shift</option>
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="night">Night</option>
                </select>
              </div>
              <div>
                <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">Usage Date *</label>
                <input type="date" className="input-field chemist-focus" value={form.usage_date} onChange={e => update('usage_date', e.target.value)} required />
              </div>
              <div>
                <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">Batch Month *</label>
                <select
                  className="input-field chemist-focus"
                  value={form.batch_month}
                  onChange={e => update('batch_month', e.target.value)}
                  required
                >
                  <option value="">Select month</option>
                  {months.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">Batch ID *</label>
                <input
                  className="input-field chemist-focus"
                  value={form.batch_id}
                  onChange={e => update('batch_id', e.target.value)}
                  placeholder="Enter batch ID"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">Process ID (optional)</label>
              <input className="input-field chemist-focus" value={form.process_id} onChange={e => update('process_id', e.target.value)} placeholder="PROC-001" />
            </div>

            <div>
              <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">Batch Notes (optional)</label>
              <textarea className="input-field chemist-focus resize-none" rows={2} value={form.batch_notes} onChange={e => update('batch_notes', e.target.value)} placeholder="Any notes about this usage..." />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">{error}</div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || selections.length === 0 || hasInvalidAmounts}
              className="btn btn-chemist flex-1 justify-center py-3 text-base"
            >
              {loading ? 'Saving...' : '✓ Submit Usage'}
            </button>
            <button type="button" onClick={() => router.back()} className="btn btn-ghost px-6">Cancel</button>
          </div>
        </form>
      </div>
    </AppLayout>
  )
}
