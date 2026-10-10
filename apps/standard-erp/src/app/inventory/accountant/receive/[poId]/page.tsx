'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@madstoq/ui/erp-page-header'
import { useAuth } from '@/hooks/useAuth'
import { useInventoryFactory } from '@/contexts/InventoryFactoryContext'
import { procurementApi } from '@/lib/api'
import {
  receiptCountsAsApprovedQty,
  receiptCountsAsPendingQty,
  receiptCountsAsRejectedHoldQty,
} from '@/lib/procurement-receipt'
import { CheckCircle } from 'lucide-react'
import { MgmtDrawer } from '@/components/inventory/MgmtDrawer'

type ProcurementOrder = {
  id: string
  po_number: string
  supplier_name: string
  material_type: string
  qty: number | null
  unit: string
  price_per_unit?: number | null
  delivery_date: string | null
  status: string
}

export type SavedReceipt = {
  id: string
  receipt_number: string
  received_qty: number
  unit: string
  material_type: string
  vendor_name: string
  status: string
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000
}

export function RecordArrivalForm({
  poId,
  onClose,
  onSaved,
}: {
  poId: string
  onClose?: () => void
  onSaved?: (receipt: SavedReceipt) => void
}) {
  const inDrawer = Boolean(onClose)
  const { profile } = useAuth()
  const { factoryId: ctxFactoryId } = useInventoryFactory()
  const factoryId = ctxFactoryId || profile?.factories?.[0]?.id || ''

  const [po, setPo] = useState<ProcurementOrder | null>(null)
  const [remainingQty, setRemainingQty] = useState<number | null>(null)
  const [rejectedHoldQty, setRejectedHoldQty] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<SavedReceipt | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    received_qty: '',
    received_price_per_unit: '',
    supplier_invoice_no: '',
    vehicle_number: '',
    received_date: new Date().toISOString().slice(0, 10),
    notes: '',
  })

  useEffect(() => {
    async function load() {
      if (!factoryId || !poId) return
      setLoading(true)
      setError('')
      setSaved(null)
      const [ordRes, recRes] = await Promise.all([
        procurementApi.listOrders(factoryId),
        procurementApi.listReceipts(factoryId),
      ])
      const found = ((ordRes.orders ?? []) as ProcurementOrder[]).find((o) => o.id === poId)
      if (!found) {
        setError('Purchase order not found')
        setPo(null)
        setLoading(false)
        return
      }
      if (found.status !== 'issued' && found.status !== 'partial') {
        setError(`PO is ${found.status} — cannot receive`)
        setPo(found)
        setLoading(false)
        return
      }

      let approved = 0
      let pending = 0
      let rejectedHold = 0
      for (const r of (recRes.receipts ?? []) as {
        po_id: string
        received_qty: number
        status: string
      }[]) {
        if (r.po_id !== found.id) continue
        const qty = Number(r.received_qty) || 0
        if (receiptCountsAsApprovedQty(r.status)) approved += qty
        else if (receiptCountsAsPendingQty(r.status)) pending += qty
        else if (receiptCountsAsRejectedHoldQty(r.status)) rejectedHold += qty
      }
      const ordered = Number(found.qty) || 0
      const remaining = round3(Math.max(0, ordered - approved - pending - rejectedHold))
      setRemainingQty(remaining)
      setRejectedHoldQty(round3(rejectedHold))
      setPo(found)
      setForm({
        received_qty: remaining > 0 ? String(remaining) : found.qty != null ? String(found.qty) : '',
        received_price_per_unit:
          found.price_per_unit != null ? String(found.price_per_unit) : '',
        supplier_invoice_no: '',
        vehicle_number: '',
        received_date: new Date().toISOString().slice(0, 10),
        notes: '',
      })
      setLoading(false)
    }
    void load()
  }, [factoryId, poId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profile?.id || !po) return
    setSaving(true)
    setError('')
    const result = await procurementApi.createReceipt({
      po_id: po.id,
      received_qty: Number(form.received_qty),
      received_price_per_unit: Number(form.received_price_per_unit),
      vendor_name: po.supplier_name,
      supplier_invoice_no: form.supplier_invoice_no.trim() || undefined,
      vehicle_number: form.vehicle_number.trim() || undefined,
      received_date: form.received_date,
      notes: form.notes.trim() || undefined,
      created_by: profile.id,
    })
    if (result.error) {
      setError(result.error)
      setSaving(false)
      return
    }
    const receipt = result.receipt as SavedReceipt
    setSaving(false)
    if (onSaved) onSaved(receipt)
    if (onClose) {
      onClose()
      return
    }
    setSaved(receipt)
  }

  const canReceive =
    po &&
    (po.status === 'issued' || po.status === 'partial') &&
    (remainingQty == null || remainingQty > 0)

  const fields = (
    <>
      {po && (
        <div className="space-y-2 rounded-lg border border-border bg-layer-sm px-4 py-3 text-sm">
          <p>
            <span className="text-muted">PO:</span>{' '}
            <strong className="font-mono text-primary max-md:font-body">{po.po_number}</strong>
          </p>
          <p>
            <span className="text-muted">Vendor:</span>{' '}
            <strong className="text-primary">{po.supplier_name}</strong>
          </p>
          <p>
            <span className="text-muted">Material:</span>{' '}
            <strong className="text-primary">{po.material_type}</strong>
          </p>
          <p>
            <span className="text-muted">Ordered:</span>{' '}
            <strong className="text-primary">
              {po.qty} {po.unit}
            </strong>
            {po.price_per_unit != null ? (
              <span className="text-muted"> @ ₹{po.price_per_unit}</span>
            ) : null}
          </p>
          {remainingQty != null && (
            <p>
              <span className="text-muted">Still to record:</span>{' '}
              <strong className="text-primary">
                {remainingQty} {po.unit}
              </strong>
            </p>
          )}
          {rejectedHoldQty > 0 && (
            <p className="text-xs text-red-600">
              {rejectedHoldQty} {po.unit} rejected and still on site — replacement qty opens
              after admin sends the lot back.
            </p>
          )}
        </div>
      )}

      {remainingQty != null && remainingQty <= 0 && (
        <div className="rounded-lg border border-border px-4 py-3 text-sm text-primary">
          {rejectedHoldQty > 0 ? (
            <>
              Rejected lots still hold this PO qty until admin sends them back to the vendor.
              After return you can record a replacement receipt.{' '}
            </>
          ) : (
            <>Full ordered qty is already recorded and waiting on QC. </>
          )}
          <Link href="/inventory/accountant/receipts" className="text-primary underline">
            View receipts
          </Link>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="min-w-0">
          <label htmlFor="received-qty" className="mb-2 block text-xs text-muted">
            Received qty *
          </label>
          <input
            id="received-qty"
            className="input-field"
            type="number"
            inputMode="decimal"
            min="0.001"
            step="any"
            required
            disabled={!canReceive}
            value={form.received_qty}
            onChange={(e) => setForm((f) => ({ ...f, received_qty: e.target.value }))}
          />
        </div>
        <div className="min-w-0">
          <label htmlFor="price-unit" className="mb-2 block text-xs text-muted">
            Price / unit *
          </label>
          <input
            id="price-unit"
            className="input-field"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            required
            disabled={!canReceive}
            value={form.received_price_per_unit}
            onChange={(e) =>
              setForm((f) => ({ ...f, received_price_per_unit: e.target.value }))
            }
          />
        </div>
      </div>

      <div>
        <label htmlFor="supplier-invoice-no" className="mb-2 block text-xs text-muted">
          Supplier invoice no.
        </label>
        <input
          id="supplier-invoice-no"
          className="input-field"
          disabled={!canReceive}
          value={form.supplier_invoice_no}
          onChange={(e) => setForm((f) => ({ ...f, supplier_invoice_no: e.target.value }))}
          placeholder="Optional — used as stock invoice on QC approve"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="min-w-0">
          <label htmlFor="vehicle-no" className="mb-2 block text-xs text-muted">
            Vehicle no.
          </label>
          <input
            id="vehicle-no"
            className="input-field"
            disabled={!canReceive}
            value={form.vehicle_number}
            onChange={(e) => setForm((f) => ({ ...f, vehicle_number: e.target.value }))}
          />
        </div>
        <div className="min-w-0">
          <label htmlFor="received-date" className="mb-2 block text-xs text-muted">
            Received date *
          </label>
          <input
            id="received-date"
            className="input-field"
            type="date"
            required
            disabled={!canReceive}
            value={form.received_date}
            onChange={(e) => setForm((f) => ({ ...f, received_date: e.target.value }))}
          />
        </div>
      </div>

      <div>
        <label htmlFor="notes" className="mb-2 block text-xs text-muted">
          Notes
        </label>
        <textarea
          id="notes"
          className="input-field min-h-[72px]"
          disabled={!canReceive}
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />
      </div>
    </>
  )

  if (saved && po && !inDrawer) {
    return (
      <div className="card w-full space-y-5 p-8 text-center">
        <CheckCircle size={56} className="mx-auto text-pmc" />
        <div>
          <h2 className="font-display text-2xl font-bold text-primary">Sent for QC</h2>
          <p className="mt-2 text-sm text-muted">
            {saved.material_type} · {saved.received_qty} {saved.unit} from {saved.vendor_name}
          </p>
          <p className="mt-1 font-mono text-xs text-primary">Lot / GRN {saved.receipt_number}</p>
          <p className="mt-3 text-sm text-muted">
            Lab must enter QC and Owner approve before stock is created. PO {po.po_number} stays open until fully received.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/inventory/accountant/receipts"
            className="inline-flex h-11 items-center justify-center rounded-full bg-pmc px-4 text-sm font-medium text-white hover:opacity-90"
          >
            View receipt
          </Link>
          <Link href="/inventory/accountant/receive" className="btn btn-ghost h-11 justify-center">
            Back to queue
          </Link>
        </div>
      </div>
    )
  }

  if (inDrawer) {
    return (
      <MgmtDrawer
        title="Record arrival"
        eyebrow="Accountant"
        mobileSheet
        onClose={onClose!}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              form="record-arrival-form"
              disabled={saving || !canReceive || loading}
              className="btn border border-pmc bg-pmc text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save & send for QC'}
            </button>
          </>
        }
      >
        <form id="record-arrival-form" onSubmit={handleSubmit} className="space-y-6">
          {loading ? <p className="text-sm text-muted">Loading PO…</p> : fields}
        </form>
      </MgmtDrawer>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-6 p-8">
      {loading ? <p className="text-sm text-muted">Loading PO…</p> : fields}
      <div className="flex justify-end gap-2">
        <button type="submit" disabled={saving || !canReceive} className="btn border border-pmc bg-pmc text-white hover:opacity-90 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save & send for QC'}
        </button>
      </div>
    </form>
  )
}

export default function AccountantReceivePoPage() {
  const { poId } = useParams<{ poId: string }>()

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-2xl p-4 md:p-8">
        <PageHeader
          title="Record arrival"
          subtitle="Accountant · confirm qty / price vs PO — no stock until QC"
          accent="accountant"
        />
        <RecordArrivalForm poId={poId} />
      </div>
    </AppLayout>
  )
}
