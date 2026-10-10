import { getAuthHeaders } from '@/lib/client/api-fetch'
import { poFilename, type ProcurementPoDocData } from '@/lib/procurement-po-format'

async function fetchPoPdfBlob(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { ...(await getAuthHeaders()), ...(init?.headers ?? {}) },
    credentials: 'same-origin',
  })
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(
      typeof json.error === 'string' ? json.error : `PDF failed (${res.status})`,
    )
  }
  return res.blob()
}

/** Download the purchase order as a PDF (same layout as Review and vendor email). */
export async function downloadProcurementPo(data: ProcurementPoDocData) {
  const blob = await fetchPoPdfBlob('/api/inventory/procurement/pdf', {
    method: 'POST',
    body: JSON.stringify({ po_document: data }),
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = poFilename(data.poNumber, 'pdf')
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
  return true
}

/** Open the saved PO PDF in a new tab. */
export async function viewProcurementPoPdf(orderId: string) {
  const blob = await fetchPoPdfBlob(
    `/api/inventory/procurement/pdf?order_id=${encodeURIComponent(orderId)}`,
  )
  const url = URL.createObjectURL(blob)
  const opened = window.open(url, '_blank', 'noopener,noreferrer')
  if (!opened) {
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
