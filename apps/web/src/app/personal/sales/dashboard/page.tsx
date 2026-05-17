'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, FileText, ClipboardList, Wallet, TrendingUp } from 'lucide-react'
import { useSalesUser } from '@/contexts/SalesUserContext'
import { fetchLeads, fetchDocuments, fetchExpenses, fmtDate } from '@/lib/sales/api'
import type { SalesLead, SalesDocument, SalesExpenseWithSplits } from '@/lib/sales/types'

const BASE = '/personal/sales'

export default function SalesDashboard() {
  const { org, membership } = useSalesUser()

  const [leads, setLeads]         = useState<SalesLead[]>([])
  const [quotations, setQuotes]   = useState<SalesDocument[]>([])
  const [pos, setPos]             = useState<SalesDocument[]>([])
  const [expenses, setExpenses]   = useState<SalesExpenseWithSplits[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => { if (org) load() }, [org?.id])

  async function load() {
    if (!org) return
    setLoading(true)
    try {
      const [ls, qs, ps, es] = await Promise.all([
        fetchLeads(org.id),
        fetchDocuments(org.id, 'quotation'),
        fetchDocuments(org.id, 'purchase_order'),
        fetchExpenses(org.id),
      ])
      setLeads(ls); setQuotes(qs); setPos(ps); setExpenses(es)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  // KPIs
  const openLeads = leads.filter(l => !['won', 'lost'].includes(l.status)).length
  const wonLeads = leads.filter(l => l.status === 'won').length
  const pendingDue = (() => {
    if (!membership) return 0
    return expenses.reduce((sum, e) => {
      const mine = e.splits?.find(s => s.user_id === membership.id)
      if (mine && !mine.is_settled && e.paid_by !== membership.id) return sum + Number(mine.share_amount || 0)
      return sum
    }, 0)
  })()
  const owedToMe = (() => {
    if (!membership) return 0
    return expenses.reduce((sum, e) => {
      if (e.paid_by !== membership.id) return sum
      return sum + (e.splits ?? [])
        .filter(s => s.user_id !== membership.id && !s.is_settled)
        .reduce((s, x) => s + Number(x.share_amount || 0), 0)
    }, 0)
  })()

  const kpis = [
    { label: 'Open Leads',  value: openLeads,         icon: Users,         color: 'var(--color-owner)',   href: `${BASE}/leads` },
    { label: 'Won Leads',   value: wonLeads,          icon: TrendingUp,    color: 'var(--color-chemist)', href: `${BASE}/leads` },
    { label: 'Quotations',  value: quotations.length, icon: FileText,      color: 'var(--color-inputer)', href: `${BASE}/quotations` },
    { label: 'POs',         value: pos.length,        icon: ClipboardList, color: 'var(--color-owner)',   href: `${BASE}/purchase-orders` },
    { label: 'You owe',     value: `₹${pendingDue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, icon: Wallet, color: '#dc2626', href: `${BASE}/expenses` },
    { label: 'Owed to you', value: `₹${owedToMe.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,    icon: Wallet, color: '#16a34a', href: `${BASE}/expenses` },
  ]

  const recentLeads = leads.slice(0, 5)
  const recentDocs = [...quotations, ...pos].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')).slice(0, 5)

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-primary">Dashboard</h1>
        <p className="text-sm text-muted mt-0.5">{org?.name ?? '—'} · Welcome back, {membership?.full_name ?? ''}.</p>
      </div>

      {/* KPIs */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-8 w-8 bg-layer-sm rounded-lg mb-3" />
              <div className="h-6 w-16 bg-layer-sm rounded mb-1" />
              <div className="h-3 w-20 bg-layer-sm rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {kpis.map(({ label, value, icon: Icon, color, href }) => (
            <Link key={label} href={href} className="card p-4 hover:shadow-sm transition-all">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3 bg-layer-sm">
                <Icon size={17} style={{ color }} />
              </div>
              <div className="text-2xl font-bold text-primary truncate">{value}</div>
              <div className="text-xs text-muted mt-0.5">{label}</div>
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Leads */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Users size={14} className="text-owner"/> Recent Leads
            </div>
            <Link href={`${BASE}/leads`} className="text-xs text-owner hover:underline">View all</Link>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-8 bg-layer-sm rounded animate-pulse" />)}
            </div>
          ) : recentLeads.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted">No leads yet</div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {recentLeads.map(l => (
                <Link key={l.id} href={`${BASE}/leads/${l.id}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-layer-sm transition-colors">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-primary truncate">{l.company_name}</div>
                    <div className="text-[11px] text-muted">{l.contact_person ?? '—'} · {fmtDate(l.created_at)}</div>
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border border-border text-muted flex-shrink-0">
                    {l.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Documents */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <FileText size={14} className="text-inputer"/> Recent Documents
            </div>
            <div className="flex gap-2">
              <Link href={`${BASE}/quotations`} className="text-xs text-inputer hover:underline">Quotations</Link>
              <Link href={`${BASE}/purchase-orders`} className="text-xs text-owner hover:underline">POs</Link>
            </div>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-8 bg-layer-sm rounded animate-pulse" />)}
            </div>
          ) : recentDocs.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted">No documents yet</div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {recentDocs.map(d => (
                <Link
                  key={d.id}
                  href={d.doc_type === 'quotation' ? `${BASE}/quotations/${d.id}` : `${BASE}/purchase-orders/${d.id}`}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-layer-sm transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-mono font-semibold text-primary truncate">{d.doc_number}</div>
                    <div className="text-[11px] text-muted truncate">{d.to_company ?? '—'} · {fmtDate(d.doc_date)}</div>
                  </div>
                  <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border flex-shrink-0 ${
                    d.status === 'sent'      ? 'border-inputer/40 text-inputer' :
                    d.status === 'accepted'  ? 'border-chemist/40 text-chemist' :
                    d.status === 'cancelled' ? 'border-red-500/40 text-red-400' :
                                               'border-border text-muted'
                  }`}>{d.status}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
