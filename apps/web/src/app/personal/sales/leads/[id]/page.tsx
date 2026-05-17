'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Pencil, FileText, ClipboardList, Phone, Mail, MapPin,
  MessageSquare, Plus,
} from 'lucide-react'
import { useSalesUser } from '@/contexts/SalesUserContext'
import {
  fetchLead, fetchLeadActivities, addLeadActivity, fmtDate,
} from '@/lib/sales/api'
import type { SalesLead, SalesLeadActivity, ActivityType } from '@/lib/sales/types'
import LeadFormModal from '@/components/sales/LeadFormModal'

const BASE = '/personal/sales'
const ACTIVITY_TYPES: ActivityType[] = ['note', 'call', 'meeting', 'email', 'other']

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { org, membership } = useSalesUser()

  const [lead, setLead] = useState<SalesLead | null>(null)
  const [activities, setActivities] = useState<SalesLeadActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [aType, setAType] = useState<ActivityType>('note')
  const [aBody, setABody] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => { load() }, [params.id])

  async function load() {
    setLoading(true)
    try {
      const [l, acts] = await Promise.all([
        fetchLead(params.id),
        fetchLeadActivities(params.id),
      ])
      setLead(l); setActivities(acts)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function handlePostActivity() {
    if (!lead || !membership || !aBody.trim()) return
    setPosting(true)
    try {
      const created = await addLeadActivity({
        lead_id: lead.id,
        activity_type: aType,
        body: aBody.trim(),
        created_by: membership.id,
      })
      setActivities(prev => [
        { ...created, author: { id: membership.id, full_name: membership.full_name } },
        ...prev,
      ])
      setABody('')
    } catch (e: any) { alert(e.message) }
    finally { setPosting(false) }
  }

  const startQuotation = () => {
    if (!lead) return
    const params = new URLSearchParams({ lead: lead.id })
    router.push(`${BASE}/quotations/new?${params}`)
  }

  const startPO = () => {
    if (!lead) return
    const params = new URLSearchParams({ lead: lead.id })
    router.push(`${BASE}/purchase-orders/new?${params}`)
  }

  if (loading) {
    return <div className="p-6 flex items-center justify-center"><div className="w-6 h-6 border-2 border-owner border-t-transparent rounded-full animate-spin"/></div>
  }
  if (!lead) return <div className="p-6 text-sm text-muted">Lead not found.</div>

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-2">
        <Link href={`${BASE}/leads`} className="text-muted hover:text-primary"><ArrowLeft size={18}/></Link>
        <h1 className="text-xl font-bold text-primary truncate">{lead.company_name}</h1>
        <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border border-border text-muted ml-2">{lead.status.replace('_', ' ')}</span>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowForm(true)} className="btn btn-ghost"><Pencil size={14}/> Edit</button>
          <button onClick={startQuotation} className="btn btn-inputer"><FileText size={14}/> Quotation</button>
          <button onClick={startPO} className="btn btn-owner"><ClipboardList size={14}/> Purchase Order</button>
        </div>
      </div>

      {/* Contact summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="card p-4 space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted">Contact</div>
          <div className="text-sm font-semibold text-primary">{lead.contact_person ?? '—'}</div>
          {lead.email && <div className="flex items-center gap-2 text-xs text-muted"><Mail size={12}/> {lead.email}</div>}
          {lead.phone && <div className="flex items-center gap-2 text-xs text-muted"><Phone size={12}/> {lead.phone}</div>}
        </div>
        <div className="card p-4 space-y-2 md:col-span-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted">Address</div>
          <div className="flex items-start gap-2 text-sm text-primary">
            <MapPin size={14} className="mt-0.5 text-muted flex-shrink-0"/>
            <div>
              {[lead.address, lead.city, lead.state, lead.country, lead.pincode].filter(Boolean).join(', ') || '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline meta */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Meta label="Source"            value={lead.source ?? '—'}/>
        <Meta label="Assigned To"       value={lead.assigned_user?.full_name ?? '—'}/>
        <Meta label="Expected Value"    value={lead.expected_value ? `₹${Number(lead.expected_value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}/>
        <Meta label="Expected Close"    value={fmtDate(lead.expected_close_date) || '—'}/>
      </div>

      {lead.notes && (
        <div className="card p-4">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted mb-2">Notes</div>
          <p className="text-sm text-primary whitespace-pre-wrap">{lead.notes}</p>
        </div>
      )}

      {/* Activity timeline */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <MessageSquare size={14} className="text-owner"/>
          <div className="text-sm font-semibold text-primary">Activity</div>
        </div>

        {/* New activity */}
        <div className="px-4 py-4 border-b border-border space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <select value={aType} onChange={e => setAType(e.target.value as ActivityType)} className="input text-xs w-full sm:w-24">
              {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <textarea
              value={aBody}
              onChange={e => setABody(e.target.value)}
              rows={2}
              placeholder="Add a note, log a call, record a meeting…"
              className="input w-full flex-1 text-sm resize-y min-h-[44px]"
            />
            <button onClick={handlePostActivity} disabled={posting || !aBody.trim()} className="btn btn-owner">
              {posting ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/> : <Plus size={14}/>}
              Post
            </button>
          </div>
        </div>

        {activities.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">No activity yet.</div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {activities.map(a => (
              <div key={a.id} className="px-4 py-3">
                <div className="flex items-center gap-2 text-[11px] mb-1">
                  <span className="font-mono uppercase tracking-widest text-owner">{a.activity_type}</span>
                  <span className="text-muted">·</span>
                  <span className="text-muted">{a.author?.full_name ?? '—'}</span>
                  <span className="text-muted ml-auto">{fmtDate(a.created_at)}</span>
                </div>
                {a.title && <div className="text-sm font-semibold text-primary">{a.title}</div>}
                {a.body && <div className="text-sm text-primary whitespace-pre-wrap">{a.body}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && org && (
        <LeadFormModal
          orgId={org.id}
          current={lead}
          currentUserId={membership?.id}
          onClose={() => setShowForm(false)}
          onSaved={(saved) => setLead(saved)}
        />
      )}
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted">{label}</div>
      <div className="text-sm font-medium text-primary mt-1 truncate">{value}</div>
    </div>
  )
}
