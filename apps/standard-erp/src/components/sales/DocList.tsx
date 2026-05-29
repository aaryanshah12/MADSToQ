'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Trash2, Send, FileText } from 'lucide-react'
import { ListSearchField, ListSearchToolbar, listSearchBtnClass } from '@/components/layout/ListSearchToolbar'
import { useSalesUser } from '@/contexts/SalesUserContext'
import { fetchDocuments, deleteDocument, fmtDate } from '@madstoq/sales-system/api'
import type { SalesDocument, SalesDocType } from '@madstoq/sales-system/types'

const BASE_BY_TYPE: Record<SalesDocType, string> = {
  quotation: '/personal/sales/quotations',
  purchase_order: '/personal/sales/purchase-orders',
  invoice: '/personal/sales/invoices',
}

const TITLE: Record<SalesDocType, string> = {
  quotation: 'Quotations',
  purchase_order: 'Purchase Orders',
  invoice: 'Invoices',
}

export default function DocList({ docType }: { docType: SalesDocType }) {
  const { org } = useSalesUser()
  const [rows, setRows] = useState<SalesDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(60)
  const base = BASE_BY_TYPE[docType]

  useEffect(() => { if (org) load() }, [org?.id, docType])

  async function load() {
    if (!org) return
    setLoading(true)
    try { setRows(await fetchDocuments(org.id, docType)) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this document?')) return
    await deleteDocument(id); load()
  }

  const filtered = rows.filter(r => !search ||
    r.doc_number.toLowerCase().includes(search.toLowerCase()) ||
    (r.to_company ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (r.subject ?? '').toLowerCase().includes(search.toLowerCase()))
  const visibleRows = filtered.slice(0, visibleCount)

  useEffect(() => {
    setVisibleCount(60)
  }, [search, docType])

  const statusClass = (s: string) => (
    s === 'sent'      ? 'border-inputer/40 text-inputer' :
    s === 'accepted'  ? 'border-chemist/40 text-chemist' :
    s === 'cancelled' ? 'border-red-500/40 text-red-400' :
                        'border-border text-muted'
  )

  const contactMeta = (email?: string | null, phone?: string | null) => {
    const parts = [email, phone].filter(Boolean) as string[]
    return parts.length ? parts.join(' · ') : ''
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-primary">{TITLE[docType]}</h1>
          <p className="text-sm text-muted mt-0.5">{filtered.length} of {rows.length}</p>
        </div>
      </div>

      <ListSearchToolbar className="mb-4">
        <ListSearchField
          value={search}
          onChange={setSearch}
          placeholder="Search number, company, subject…"
          inputClassName="owner-focus"
        />
        <Link href={`${base}/new`} className={listSearchBtnClass('btn-owner')}>
          <Plus size={15} /> New {docType === 'quotation' ? 'Quotation' : 'PO'}
        </Link>
      </ListSearchToolbar>

      <div className="card overflow-hidden">
        {/* Mobile cards */}
        <div className="sm:hidden divide-y" style={{ borderColor: 'var(--color-border)' }}>
          {loading ? <div className="py-12 text-center"><div className="inline-block w-6 h-6 border-2 border-owner border-t-transparent rounded-full animate-spin"/></div>
          : filtered.length === 0 ? <div className="py-12 text-center text-muted text-sm">No documents</div>
          : visibleRows.map(r => (
            <div key={r.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`${base}/${r.id}`} className="text-xs font-mono font-semibold text-primary hover:text-owner truncate block">{r.doc_number}</Link>
                  <div className="text-sm text-primary truncate">{r.to_company ?? '—'}</div>
                  {!!contactMeta(r.to_email, r.to_phone) && (
                    <div className="text-[11px] text-muted truncate">{contactMeta(r.to_email, r.to_phone)}</div>
                  )}
                  <div className="text-[11px] text-muted">{fmtDate(r.doc_date)}</div>
                </div>
                <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border ${statusClass(r.status)} flex-shrink-0`}>{r.status}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Date</th>
                <th>To</th>
                <th>Subject</th>
                <th className="text-right">Total</th>
                <th>Status</th>
                <th/>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="py-12 text-center"><div className="inline-block w-6 h-6 border-2 border-owner border-t-transparent rounded-full animate-spin"/></td></tr>
              : filtered.length === 0 ? <tr><td colSpan={7} className="py-12 text-center text-muted text-sm">No documents</td></tr>
              : visibleRows.map(r => (
                <tr key={r.id}>
                  <td><Link href={`${base}/${r.id}`} className="font-mono text-xs font-semibold text-primary hover:text-owner">{r.doc_number}</Link></td>
                  <td className="text-xs text-muted">{fmtDate(r.doc_date)}</td>
                  <td className="text-sm">
                    <div className="text-primary">{r.to_company ?? '—'}</div>
                    <div className="text-xs text-muted">{r.to_contact_person ?? ''}</div>
                    <div className="text-xs text-muted">{contactMeta(r.to_email, r.to_phone)}</div>
                  </td>
                  <td className="text-xs text-muted truncate max-w-[220px]">{r.subject ?? '—'}</td>
                  <td className="text-right font-semibold text-xs">{r.total_amount != null ? `₹${Number(r.total_amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}</td>
                  <td><span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border ${statusClass(r.status)}`}>{r.status}</span></td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`${base}/${r.id}`} className="p-1.5 rounded hover:bg-layer-sm text-muted hover:text-owner" title="Open"><FileText size={13}/></Link>
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
    </div>
  )
}
