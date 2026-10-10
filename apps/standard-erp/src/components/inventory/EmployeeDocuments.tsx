'use client'

import { useState } from 'react'
import { Download, Eye, Trash2, Upload } from 'lucide-react'
import { employeesApi } from '@/lib/api'
import {
  EMPLOYEE_DOC_ACCEPT,
  EMPLOYEE_DOC_TYPE_OPTIONS,
  employeeDocTypeLabel,
  isAllowedIdCardFile,
} from '@/lib/employee'
import { useToast } from '@/components/providers/ToastProvider'
import { useConfirm } from '@/components/ui'

export type EmployeeDocumentRow = {
  id: string
  doc_type: string
  title: string | null
  file_name: string
  mime_type: string
  size_bytes: number
  created_at: string | null
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function EmployeeDocuments({
  employeeId,
  documents,
  onChanged,
}: {
  employeeId: string
  documents: EmployeeDocumentRow[]
  onChanged: () => void
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const [docType, setDocType] = useState('other')
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function upload() {
    if (!file) {
      toast.error('Choose a file')
      return
    }
    const err = isAllowedIdCardFile(file)
    if (err) {
      toast.error(err)
      return
    }
    setUploading(true)
    const data = await employeesApi.uploadDocument(employeeId, file, docType, title.trim() || undefined)
    setUploading(false)
    if (data.error) {
      toast.error(data.error)
      return
    }
    toast.success('Document uploaded')
    setFile(null)
    setTitle('')
    onChanged()
  }

  async function download(doc: EmployeeDocumentRow) {
    setBusyId(doc.id)
    const data = await employeesApi.downloadDocument(employeeId, doc.id, doc.file_name)
    setBusyId(null)
    if (data.error) toast.error(data.error)
  }

  async function openFile(doc: EmployeeDocumentRow) {
    setBusyId(doc.id)
    const data = await employeesApi.openDocument(employeeId, doc.id, doc.mime_type)
    setBusyId(null)
    if (data.error) toast.error(data.error)
  }

  async function remove(doc: EmployeeDocumentRow) {
    const ok = await confirm({
      title: 'Delete document?',
      body: `"${doc.file_name}" will be permanently removed from this employee record.`,
      confirmLabel: 'Delete document',
      destructive: true,
    })
    if (!ok) return
    setBusyId(doc.id)
    const data = await employeesApi.deleteDocument(employeeId, doc.id)
    setBusyId(null)
    if (data.error) {
      toast.error(data.error)
      return
    }
    toast.success('Document deleted')
    onChanged()
  }

  return (
    <section className="card space-y-4 border-owner/20 p-5">
      <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-owner">Documents</h3>
      <p className="text-xs text-muted">PDF, JPEG, PNG, or WebP · max 5 MB each.</p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-center">
        <select
          className="input-field owner-focus"
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
        >
          {EMPLOYEE_DOC_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          className="input-field owner-focus"
          placeholder="Title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          type="file"
          accept={EMPLOYEE_DOC_ACCEPT}
          className="input-field owner-focus text-sm"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => void upload()}
          className="btn btn-owner w-11 shrink-0 justify-center px-0"
          title={uploading ? 'Uploading…' : 'Upload'}
          aria-label={uploading ? 'Uploading' : 'Upload'}
        >
          <Upload size={16} />
        </button>
      </div>

      {documents.length === 0 ? (
        <p className="text-sm text-muted">No documents yet.</p>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {documents.map((doc) => (
            <div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-primary">
                  {doc.title || doc.file_name}
                </div>
                <div className="text-xs text-muted">
                  {employeeDocTypeLabel(doc.doc_type)} · {doc.file_name} · {formatSize(doc.size_bytes)}
                </div>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={busyId === doc.id}
                  onClick={() => void openFile(doc)}
                  className="btn btn-ghost px-2.5"
                  title="View"
                  aria-label="View"
                >
                  <Eye size={15} />
                </button>
                <button
                  type="button"
                  disabled={busyId === doc.id}
                  onClick={() => void download(doc)}
                  className="btn btn-ghost px-2.5"
                  title="Download"
                  aria-label="Download"
                >
                  <Download size={15} />
                </button>
                <button
                  type="button"
                  disabled={busyId === doc.id}
                  onClick={() => void remove(doc)}
                  className="btn btn-ghost px-2.5 text-red-400"
                  title="Delete"
                  aria-label="Delete"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
