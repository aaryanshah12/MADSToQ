'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Eye } from 'lucide-react'
import { ListSearchField, ListSearchToolbar, listSearchBtnClass } from '@/components/layout/ListSearchToolbar'
import { useSalesUser } from '@/contexts/SalesUserContext'
import { fetchLeads, deleteLead, fmtDate } from '@madstoq/sales-system/api'
import type { SalesLead, LeadStatus } from '@madstoq/sales-system/types'
import LeadFormModal from '@/components/sales/LeadFormModal'

const BASE = '/personal/sales'
const ALL_STATUSES: LeadStatus[] = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost', 'on_hold']

export default function LeadsPage() {
  const router = useRouter()
  const { org, membership } = useSalesUser()
  const [rows, setRows] = useState<SalesLead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all')
  const [visibleCount, setVisibleCount] = useState(60)
  const [editing, setEditing] = useState<SalesLead | null>(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => { if (org) load() }, [org?.id])

  async function load() {
    if (!org) return
    setLoading(true)
    try { setRows(await fetchLeads(org.id)) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this lead?')) return
    await deleteLead(id)
    load()
  }

  const filtered = rows.filter(r => {
    const matchSearch = !search ||
      r.company_name.toLowerCase().includes(search.toLowerCase()) ||
      (r.contact_person ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (r.email ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || r.status === statusFilter
    return matchSearch && matchStatus
  })
  const visibleRows = filtered.slice(0, visibleCount)

  useEffect(() => {
    setVisibleCount(60)
  }, [search, statusFilter])

  const statusBadge = (s: LeadStatus) => {
    const map: Record<LeadStatus, string> = {
      new: 'border-border text-muted',
      contacted: 'border-inputer/40 text-inputer',
      qualified: 'border-inputer/40 text-inputer',
      proposal: 'border-owner/40 text-owner',
      negotiation: 'border-owner/40 text-owner',
      won: 'border-chemist/40 text-chemist',
      lost: 'border-red-500/40 text-red-400',
      on_hold: 'border-border text-muted',
    }
    return `text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border ${map[s]}`
  }

  const contactMeta = (email?: string | null, phone?: string | null) => {
    const parts = [email, phone].filter(Boolean) as string[]
    return parts.length ? parts.join(' · ') : ''
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-primary">Leads</h1>
          <p className="text-sm text-muted mt-0.5">{filtered.length} of {rows.length} leads</p>
        </div>
      </div>

      <ListSearchToolbar className="mb-4 flex-wrap">
        <ListSearchField
          value={search}
          onChange={setSearch}
          placeholder="Search company, contact, email…"
          inputClassName="owner-focus"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as LeadStatus | 'all')}
          className="input list-search-side w-full sm:w-[200px] text-sm owner-focus"
        >
          <option value="all">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => { setEditing(null); setShowForm(true) }}
          className={listSearchBtnClass('btn-owner')}
        >
          <Plus size={15} /> New Lead
        </button>
      </ListSearchToolbar>

      <div className="card overflow-hidden">
        {/* Mobile cards */}
        <div className="sm:hidden divide-y" style={{ borderColor: 'var(--color-border)' }}>
          {loading ? <div className="py-12 text-center"><div className="inline-block w-6 h-6 border-2 border-owner border-t-transparent rounded-full animate-spin"/></div>
          : filtered.length === 0 ? <div className="py-12 text-center text-muted text-sm">No leads</div>
          : visibleRows.map(r => (
            <div
              key={r.id}
              className="p-4 space-y-2 cursor-pointer"
              role="button"
              tabIndex={0}
              onClick={() => router.push(`${BASE}/leads/${r.id}`)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  router.push(`${BASE}/leads/${r.id}`)
                }
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`${BASE}/leads/${r.id}`} className="text-sm font-semibold text-primary hover:text-owner truncate block py-1">
                    {r.company_name}
                  </Link>
                  <div className="text-xs text-muted truncate">
                    {r.contact_person ?? '—'}
                    {contactMeta(r.email, r.phone) ? ` · ${contactMeta(r.email, r.phone)}` : ''}
                  </div>
                </div>
                <span className={statusBadge(r.status)}>{r.status.replace('_', ' ')}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">{fmtDate(r.created_at)}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation()
                      router.push(`${BASE}/leads/${r.id}`)
                    }}
                    className="p-2 rounded hover:bg-layer-sm text-muted hover:text-owner"
                    title="Open"
                  >
                    <Eye size={13}/>
                  </button>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setEditing(r); setShowForm(true) }}
                    className="p-2 rounded hover:bg-layer-sm text-muted hover:text-owner"
                  >
                    <Pencil size={13}/>
                  </button>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); handleDelete(r.id) }}
                    className="p-2 rounded hover:bg-layer-sm text-muted hover:text-red-400"
                  >
                    <Trash2 size={13}/>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Assigned</th>
                <th className="text-right">Expected</th>
                <th>Created</th>
                <th/>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="py-12 text-center"><div className="inline-block w-6 h-6 border-2 border-owner border-t-transparent rounded-full animate-spin"/></td></tr>
              : filtered.length === 0 ? <tr><td colSpan={7} className="py-12 text-center text-muted text-sm">No leads</td></tr>
              : visibleRows.map(r => (
                <tr key={r.id}>
                  <td>
                    <Link href={`${BASE}/leads/${r.id}`} className="font-semibold text-primary hover:text-owner">{r.company_name}</Link>
                    <div className="text-xs text-muted">{r.source ?? '—'}</div>
                  </td>
                  <td>
                    <div className="text-sm text-primary">{r.contact_person ?? '—'}</div>
                    <div className="text-xs text-muted">{contactMeta(r.email, r.phone)}</div>
                  </td>
                  <td><span className={statusBadge(r.status)}>{r.status.replace('_', ' ')}</span></td>
                  <td className="text-xs">{r.assigned_user?.full_name ?? <span className="text-muted">—</span>}</td>
                  <td className="text-right font-semibold text-xs">{r.expected_value ? `₹${Number(r.expected_value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}</td>
                  <td className="text-xs text-muted">{fmtDate(r.created_at)}</td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setEditing(r); setShowForm(true) }} className="p-1.5 rounded hover:bg-layer-sm text-muted hover:text-owner"><Pencil size={13}/></button>
                      <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded hover:bg-layer-sm text-muted hover:text-red-400"><Trash2 size={13}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {!loading && visibleRows.length < filtered.length && (
        <div className="mt-3 flex justify-center">
          <button className="btn btn-ghost" onClick={() => setVisibleCount(v => v + 60)}>
            Load More ({filtered.length - visibleRows.length} remaining)
          </button>
        </div>
      )}

      {showForm && org && (
        <LeadFormModal
          orgId={org.id}
          current={editing}
          currentUserId={membership?.id}
          onClose={() => setShowForm(false)}
          onSaved={() => load()}
        />
      )}
    </div>
  )
}
