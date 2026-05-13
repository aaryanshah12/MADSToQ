'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft, Save, Send, Download, Loader2, FileText, ClipboardList,
} from 'lucide-react'
import { useSalesUser } from '@/contexts/SalesUserContext'
import {
  fetchDocument, saveDocument, fetchLead, setDocumentStatus, today, fmtDate,
} from '@/lib/sales/api'
import type { SalesDocument, SalesDocType } from '@/lib/sales/types'
import RichTextEditor from '@/components/sales/RichTextEditor'

const BASE_BY_TYPE: Record<SalesDocType, string> = {
  quotation: '/personal/sales/quotations',
  purchase_order: '/personal/sales/purchase-orders',
  invoice: '/personal/sales/invoices',
}

const HEADING_BY_TYPE: Record<SalesDocType, string> = {
  quotation: 'Quotation',
  purchase_order: 'Purchase Order',
  invoice: 'Invoice',
}

export default function DocEditor({ docType, docId }: { docType: SalesDocType; docId: string }) {
  const isNew = docId === 'new'
  const router = useRouter()
  const params = useSearchParams()
  const { org, membership } = useSalesUser()

  const [doc, setDoc] = useState<Partial<SalesDocument>>({
    doc_type: docType,
    doc_date: today(),
    status: 'draft',
    currency: 'INR',
    body_html: '',
    subject: '',
  })
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    (async () => {
      if (!isNew) {
        setLoading(true)
        try {
          const d = await fetchDocument(docId)
          if (d) setDoc(d)
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
      } else if (params.get('lead')) {
        // Pre-fill recipient from a lead.
        try {
          const lead = await fetchLead(params.get('lead')!)
          if (lead) {
            setDoc(d => ({
              ...d,
              lead_id: lead.id,
              to_company: lead.company_name,
              to_contact_person: lead.contact_person ?? null,
              to_email: lead.email ?? null,
              to_phone: lead.phone ?? null,
              to_address: [lead.address, lead.city, lead.state, lead.country, lead.pincode].filter(Boolean).join(', '),
              subject: `${HEADING_BY_TYPE[docType]} for ${lead.company_name}`,
            }))
          }
        } catch (e) { console.error(e) }
      }
    })()
  }, [docId, docType])

  const set = (k: keyof SalesDocument, v: any) => setDoc(d => ({ ...d, [k]: v === '' ? null : v }))

  async function handleSave(thenSend = false): Promise<SalesDocument | null> {
    if (!org || !membership) return null
    if (!doc.to_company?.trim()) { setError('Recipient company name is required.'); return null }
    setError('')
    setSaving(true)
    try {
      const saved = await saveDocument({
        ...(doc as any),
        org_id: org.id,
        doc_type: docType,
        doc_date: doc.doc_date || today(),
        created_by: doc.created_by ?? membership.id,
        total_amount: doc.total_amount === undefined ? null : (doc.total_amount === null ? null : Number(doc.total_amount)),
      })
      setDoc(saved)
      if (isNew) {
        // Replace URL so refresh stays on this doc.
        const base = BASE_BY_TYPE[docType]
        router.replace(`${base}/${saved.id}`)
      }
      if (!thenSend) {
        // brief feedback inline; no nav.
      }
      return saved
    } catch (e: any) {
      setError(e.message ?? 'Failed to save')
      return null
    } finally {
      setSaving(false)
    }
  }

  async function handleSend() {
    const saved = await handleSave(true)
    if (!saved || !org) return
    if (!saved.to_email?.trim()) { setError('Recipient email is required to send.'); return }
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/personal/sales/send-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: saved.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Failed to send')
      await setDocumentStatus(saved.id, 'sent')
      const refreshed = await fetchDocument(saved.id)
      if (refreshed) setDoc(refreshed)
      alert('Sent.')
    } catch (e: any) {
      setError(e.message ?? 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  async function handlePreviewPdf() {
    const saved = await handleSave()
    if (!saved) return
    const url = `/api/personal/sales/render-pdf?document_id=${saved.id}`
    window.open(url, '_blank')
  }

  if (loading) {
    return <div className="p-6 flex items-center justify-center"><div className="w-6 h-6 border-2 border-owner border-t-transparent rounded-full animate-spin"/></div>
  }

  const base = BASE_BY_TYPE[docType]
  const Icon = docType === 'quotation' ? FileText : ClipboardList

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <Link href={base} className="text-muted hover:text-primary"><ArrowLeft size={18}/></Link>
        <h1 className="text-xl font-bold text-primary flex items-center gap-2">
          <Icon size={18} className="text-owner"/>
          {isNew ? `New ${HEADING_BY_TYPE[docType]}` : doc.doc_number ?? HEADING_BY_TYPE[docType]}
        </h1>
        {!isNew && (
          <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border ${
            doc.status === 'sent'      ? 'border-inputer/40 text-inputer' :
            doc.status === 'accepted'  ? 'border-chemist/40 text-chemist' :
            doc.status === 'cancelled' ? 'border-red-500/40 text-red-400' :
                                         'border-border text-muted'
          }`}>{doc.status}</span>
        )}
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <button onClick={handlePreviewPdf} disabled={saving} className="btn btn-ghost"><Download size={14}/> Preview PDF</button>
          <button onClick={() => handleSave()} disabled={saving} className="btn btn-ghost">{saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Save Draft</button>
          <button onClick={handleSend} disabled={saving || sending} className="btn btn-owner">
            {sending ? <Loader2 size={14} className="animate-spin"/> : <Send size={14}/>} Save & Send
          </button>
        </div>
      </div>

      {/* Recipient + meta */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Subject</label>
            <input value={doc.subject ?? ''} onChange={e => set('subject', e.target.value)} className="input w-full" placeholder={`${HEADING_BY_TYPE[docType]} for…`}/>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Date</label>
            <input type="date" value={doc.doc_date ?? today()} onChange={e => set('doc_date', e.target.value)} className="input w-full"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Total Amount (optional)</label>
            <input type="number" value={doc.total_amount ?? ''} onChange={e => set('total_amount', e.target.value === '' ? null : Number(e.target.value))} className="input w-full"/>
          </div>
        </div>

        <div className="mt-5 pt-5 border-t border-border">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted mb-2">Recipient</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Company *</label>
              <input value={doc.to_company ?? ''} onChange={e => set('to_company', e.target.value)} className="input w-full"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Contact Person</label>
              <input value={doc.to_contact_person ?? ''} onChange={e => set('to_contact_person', e.target.value)} className="input w-full"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Email</label>
              <input type="email" value={doc.to_email ?? ''} onChange={e => set('to_email', e.target.value)} className="input w-full" placeholder="customer@example.com"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Phone</label>
              <input value={doc.to_phone ?? ''} onChange={e => set('to_phone', e.target.value)} className="input w-full"/>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-muted mb-1.5">Address</label>
              <textarea rows={2} value={doc.to_address ?? ''} onChange={e => set('to_address', e.target.value)} className="input w-full"/>
            </div>
          </div>
        </div>
      </div>

      {/* RTE body */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-primary">Body</div>
          <div className="text-[11px] text-muted">Header & footer come from billing.pdf — only the body is editable.</div>
        </div>
        <RichTextEditor
          value={doc.body_html ?? ''}
          json={doc.body_json}
          onChange={(html, json) => setDoc(d => ({ ...d, body_html: html, body_json: json }))}
        />
      </div>

      {error && <div className="text-xs text-red-400">{error}</div>}

      {!isNew && doc.sent_at && (
        <div className="text-xs text-muted">
          Last sent {fmtDate(doc.sent_at)} to <span className="text-primary">{doc.sent_to}</span>
          {doc.sent_cc ? <> (cc: <span className="text-primary">{doc.sent_cc}</span>)</> : null}
        </div>
      )}
    </div>
  )
}
