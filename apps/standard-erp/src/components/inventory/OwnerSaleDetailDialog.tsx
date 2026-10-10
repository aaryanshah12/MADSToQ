'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useToast } from '@/components/providers/ToastProvider'
import { dispatchScheduleApi, warehouseApi } from '@/lib/api'
import {
  DispatchScheduleLotCoaBody,
  DispatchSchedulePickLots,
  DispatchScheduleSummary,
  DispatchScheduleViewLotCoa,
  fgLotsForProduct,
  saleLotHasCoa,
  saleStatusBadge,
  saleStatusLabel,
  useLotCoa,
  type CoaCertificate,
  type DispatchSchedule,
  type FgStockLot,
} from '@/components/inventory/DispatchScheduleShared'
import type { QcLogEntry } from '@/components/inventory/QcLabResultForm'
import { MgmtDrawer } from '@/components/inventory/MgmtDrawer'

function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

function formatWhen(value: string | null | undefined) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[11px] uppercase tracking-wider text-muted">{label}</p>
      <p className="break-words text-sm font-medium text-primary">{children}</p>
    </div>
  )
}

export function SaleDetailFields({
  sale,
  hideCommercial = false,
  mobileCoa,
}: {
  sale: DispatchSchedule
  hideCommercial?: boolean
  mobileCoa?: {
    lotId: string
    open: boolean
    loading: boolean
    logs: QcLogEntry[]
    certificate?: CoaCertificate | null
  }
}) {
  const amount = Number(sale.qty || 0) * Number(sale.rate || 0)
  return (
    <>
      <section className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <span className={`badge ${saleStatusBadge(sale.status)}`}>
          {saleStatusLabel(sale.status, sale.schedule_kind)}
        </span>
        {!hideCommercial ? (
          <span className="text-sm font-semibold text-primary">{formatInr(amount)}</span>
        ) : null}
        {sale.is_discounted ? <span className="text-xs text-muted">Discounted FG</span> : null}
      </section>

      <section className="grid gap-4 border-b border-border px-4 py-4 max-sm:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3">
        {!hideCommercial ? <Field label="Customer">{sale.customer_name || '—'}</Field> : null}
        <Field label="Kind">
          {sale.schedule_kind === 'byproduct' ? 'Byproduct' : 'Finished goods'}
        </Field>
        <Field label="Product">{sale.product_name}</Field>
        <Field label="Qty">
          {sale.qty} {sale.unit || 'Kg'}
        </Field>
        {!hideCommercial ? (
          <>
            <Field label="Rate">
              {formatInr(Number(sale.rate))} / {sale.unit || 'Kg'}
            </Field>
            <Field label="Amount">{formatInr(amount)}</Field>
          </>
        ) : null}
        <Field label="Tally invoice">{sale.tally_invoice_no || '—'}</Field>
        <Field label="Invoice date">{formatWhen(sale.invoiced_at || sale.dispatched_at)}</Field>
        {!hideCommercial ? <Field label="Client PO">{sale.client_po_no || '—'}</Field> : null}
        <Field label="Vehicle">{sale.vehicle_no || '—'}</Field>
        <Field label="Drums">{sale.drum_count != null ? sale.drum_count : '—'}</Field>
        <Field label="Recorded by">{sale.created_by_name || '—'}</Field>
      </section>

      <section>
        <h2 className="px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted">
          Lots
        </h2>
        {(sale.lots ?? []).length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted">No lots allocated yet.</p>
        ) : (
          <>
          <ul className="divide-y divide-border border-t border-border md:hidden">
            {(sale.lots ?? []).map((lot) => (
              <li key={lot.id} className="space-y-2 px-4 py-3">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 break-words font-medium text-primary">{lot.invoice_number}</span>
                  <span className="shrink-0 tabular-nums text-primary">
                    {lot.qty} {sale.unit || 'Kg'}
                  </span>
                </div>
                {mobileCoa?.lotId === lot.id ? (
                  mobileCoa.open ? (
                    <div id="sale-detail-mobile-coa" className="scroll-mt-2">
                      <DispatchScheduleLotCoaBody
                        sale={sale}
                        lot={lot}
                        loading={mobileCoa.loading}
                        logs={mobileCoa.logs}
                        certificate={mobileCoa.certificate}
                        hideCommercial={hideCommercial}
                      />
                    </div>
                  ) : lot.coa_no ? (
                    <p className="text-xs text-muted">COA {lot.coa_no}</p>
                  ) : null
                ) : lot.coa_no ? (
                  <DispatchScheduleViewLotCoa
                    sale={sale}
                    lot={lot}
                    factoryId={sale.factory_id || ''}
                    hideCommercial={hideCommercial}
                    className="btn w-full border border-text bg-panel text-primary"
                  />
                ) : (
                  <p className="text-xs text-muted">COA —</p>
                )}
              </li>
            ))}
          </ul>
          <div className="overflow-x-auto max-md:hidden">
            <table className="data-table min-w-full">
              <thead>
                <tr>
                  <th>Lot</th>
                  <th>Qty</th>
                  <th>COA</th>
                </tr>
              </thead>
              <tbody>
                {(sale.lots ?? []).map((lot) => (
                  <tr key={lot.id}>
                    <td>{lot.invoice_number}</td>
                    <td>
                      {lot.qty} {sale.unit || 'Kg'}
                    </td>
                    <td>
                      {lot.coa_no ? (
                        <DispatchScheduleViewLotCoa
                          sale={sale}
                          lot={lot}
                          factoryId={sale.factory_id || ''}
                          hideCommercial={hideCommercial}
                        />
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>
    </>
  )
}

function SalePopupShell({
  eyebrow,
  title,
  subtitle,
  onClose,
  footer,
  children,
}: {
  eyebrow: string
  title: string
  subtitle?: string
  onClose: () => void
  footer: ReactNode
  children: ReactNode
}) {
  return (
    <MgmtDrawer
      eyebrow={eyebrow}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      footer={footer}
      padded={false}
      size="lg"
    >
      {children}
    </MgmtDrawer>
  )
}

export function OwnerSaleDetailDialog({
  saleId,
  onClose,
  hideCommercial = false,
}: {
  saleId: string
  onClose: () => void
  hideCommercial?: boolean
}) {
  const toast = useToast()
  const [sale, setSale] = useState<DispatchSchedule | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    const res = await dispatchScheduleApi.get(saleId)
    if (res.error) toast.error(res.error)
    setSale((res.sale as DispatchSchedule) ?? null)
    setLoading(false)
  }, [saleId, toast])

  useEffect(() => {
    void reload()
  }, [reload])

  const subtitle = useMemo(() => {
    if (!sale) return ''
    if (hideCommercial) return sale.product_name
    return `${sale.customer_name || 'Customer'} · ${sale.product_name}`
  }, [sale, hideCommercial])

  const singleCoaLot = useMemo(() => {
    const coaLots = (sale?.lots ?? []).filter((l) => l.coa_no && saleLotHasCoa(l))
    return coaLots.length === 1 ? (coaLots[0] ?? null) : null
  }, [sale])
  const footerCoa = useLotCoa(sale, singleCoaLot)

  useEffect(() => {
    if (footerCoa.open) {
      document.getElementById('sale-detail-mobile-coa')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }
  }, [footerCoa.open])

  return (
    <SalePopupShell
      eyebrow="Dispatch schedule"
      title={sale?.sale_no || 'Sale'}
      subtitle={subtitle || undefined}
      onClose={onClose}
      footer={
        <>
          {singleCoaLot ? (
            <div className="flex-1 md:hidden">
              <button
                type="button"
                onClick={() => void footerCoa.toggle()}
                className="btn w-full border border-text bg-panel text-primary"
              >
                {footerCoa.open ? 'Hide COA' : 'View COA'}
              </button>
            </div>
          ) : null}
          <button type="button" onClick={onClose} className="btn btn-ghost max-md:flex-1">
            Close
          </button>
        </>
      }
    >
      {loading || !sale ? (
        <p className="p-4 text-sm text-muted">{loading ? 'Loading…' : 'Not found'}</p>
      ) : (
        <SaleDetailFields
          sale={sale}
          hideCommercial={hideCommercial}
          mobileCoa={
            singleCoaLot
              ? {
                  lotId: singleCoaLot.id,
                  open: footerCoa.open,
                  loading: footerCoa.loading,
                  logs: footerCoa.logs,
                  certificate: footerCoa.certificate,
                }
              : undefined
          }
        />
      )}
    </SalePopupShell>
  )
}

export function AccountantSaleDetailDialog({
  hideCommercial,
  ...props
}: {
  saleId: string
  onClose: () => void
  hideCommercial?: boolean
}) {
  return <OwnerSaleDetailDialog {...props} hideCommercial={hideCommercial} />
}

export function AccountantInvoiceDrawer({
  saleId,
  onClose,
  onSaved,
}: {
  saleId: string
  onClose: () => void
  onSaved?: () => void
}) {
  const toast = useToast()
  const [sale, setSale] = useState<DispatchSchedule | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [invoiceNo, setInvoiceNo] = useState('')
  const [vehicleNo, setVehicleNo] = useState('')
  const [drumCount, setDrumCount] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const res = await dispatchScheduleApi.get(saleId)
      if (res.error) toast.error(res.error)
      const next = (res.sale as DispatchSchedule) ?? null
      setSale(next)
      setInvoiceNo(next?.tally_invoice_no ?? '')
      setVehicleNo(next?.vehicle_no ?? '')
      setDrumCount(next?.drum_count != null ? String(next.drum_count) : '')
      setLoading(false)
    }
    void load()
  }, [saleId, toast])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!sale) return
    setSaving(true)
    const drums = Number(drumCount)
    if (!Number.isInteger(drums) || drums < 1) {
      setSaving(false)
      toast.error('Enter the number of drums')
      return
    }
    const res = await dispatchScheduleApi.recordInvoice(sale.id, {
      tally_invoice_no: invoiceNo.trim(),
      vehicle_no: vehicleNo.trim(),
      drum_count: drums,
    })
    setSaving(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success(
      res.generated_coa
        ? 'Invoice recorded and COA generated'
        : 'Invoice, vehicle, and drums recorded',
    )
    onSaved?.()
    onClose()
  }

  return (
    <SalePopupShell
      eyebrow="Dispatch schedule"
      title="Add details"
      subtitle={
        sale
          ? `${sale.sale_no} · ${sale.customer_name || 'Customer'} · ${sale.product_name}`
          : undefined
      }
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="accountant-invoice-form"
            disabled={saving || loading || !sale}
            className="btn border border-pmc bg-pmc text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      {loading || !sale ? (
        <p className="p-4 text-sm text-muted">{loading ? 'Loading…' : 'Not found'}</p>
      ) : (
        <form id="accountant-invoice-form" onSubmit={(e) => void submit(e)} className="space-y-4 p-4 sm:p-6">
          <p className="text-sm text-muted">
            {sale.qty} {sale.unit}
          </p>
          <label className="block">
            <span className="mb-2 block text-xs text-muted">Tally invoice #</span>
            <input
              className="input-field"
              required
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs text-muted">Vehicle #</span>
            <input
              className="input-field"
              required
              value={vehicleNo}
              onChange={(e) => setVehicleNo(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs text-muted">Number of drums</span>
            <input
              className="input-field"
              required
              inputMode="numeric"
              min={1}
              step={1}
              value={drumCount}
              onChange={(e) => setDrumCount(e.target.value)}
            />
          </label>
        </form>
      )}
    </SalePopupShell>
  )
}

export function WarehouseConfirmDispatchDrawer({
  saleId,
  onClose,
  onSaved,
}: {
  saleId: string
  onClose: () => void
  onSaved?: () => void
}) {
  const toast = useToast()
  const [sale, setSale] = useState<DispatchSchedule | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const res = await dispatchScheduleApi.get(saleId)
      if (res.error) toast.error(res.error)
      setSale((res.sale as DispatchSchedule) ?? null)
      setLoading(false)
    }
    void load()
  }, [saleId, toast])

  async function confirm() {
    if (!sale) return
    setSaving(true)
    const res = await dispatchScheduleApi.confirmDispatch(sale.id)
    setSaving(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success('Dispatch confirmed')
    onSaved?.()
    onClose()
  }

  const canConfirm = sale?.status === 'invoiced'

  return (
    <MgmtDrawer
      eyebrow="Warehouse dispatch"
      title="Confirm loaded"
      onClose={onClose}
      mobileSheet
      titleAside={
        sale ? (
          <span className="md:hidden">
            <span className={`badge ${saleStatusBadge(sale.status)}`}>
              {saleStatusLabel(sale.status, sale.schedule_kind)}
            </span>
          </span>
        ) : null
      }
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            {canConfirm ? 'Cancel' : 'Close'}
          </button>
          {canConfirm ? (
            <button
              type="button"
              disabled={saving || loading || !sale}
              className="btn border border-pmc bg-pmc text-white hover:opacity-90 disabled:opacity-50"
              onClick={() => void confirm()}
            >
              {saving ? 'Confirming…' : 'Confirm loaded'}
            </button>
          ) : null}
        </>
      }
    >
      {loading || !sale ? (
        <p className="text-sm text-muted">{loading ? 'Loading…' : 'Not found'}</p>
      ) : (
        <>
        <div className="space-y-5 md:hidden">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-4 rounded-xl bg-surface p-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted">Vehicle</p>
              <p className="mt-0.5 break-words text-base font-medium text-primary">
                {sale.vehicle_no || '—'}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted">
                {sale.schedule_kind === 'byproduct' ? 'Byproduct' : 'Product'}
              </p>
              <p className="mt-0.5 break-words text-base font-medium text-primary">
                {sale.schedule_kind === 'byproduct'
                  ? sale.product_name
                  : `${sale.product_code} · ${sale.product_name}`}
              </p>
            </div>
            <div className="min-w-0 text-right">
              <p className="text-[11px] uppercase tracking-wider text-muted">Qty</p>
              <p className="mt-0.5 text-base font-medium tabular-nums text-primary">
                {sale.qty} {sale.unit}
              </p>
            </div>
          </div>
          <dl className="space-y-2 text-sm">
            {[
              { label: 'Sale', value: sale.sale_no },
              {
                label: 'Kind',
                value: sale.schedule_kind === 'byproduct' ? 'Byproduct' : 'Finished goods',
              },
              { label: 'Tally invoice', value: sale.tally_invoice_no || '—' },
              { label: 'Drums', value: sale.drum_count != null ? String(sale.drum_count) : '—' },
              { label: 'Invoice date', value: formatWhen(sale.invoiced_at || sale.dispatched_at) },
              { label: 'Recorded by', value: sale.created_by_name || '—' },
              ...(sale.schedule_kind !== 'byproduct'
                ? [
                    {
                      label: 'Purity spec',
                      value: sale.purity_spec != null ? `${sale.purity_spec}%` : '—',
                    },
                    {
                      label: 'Admin suggested batches',
                      value:
                        sale.preferred_batch_nos.length > 0
                          ? sale.preferred_batch_nos.join(', ')
                          : 'Lab chooses',
                    },
                  ]
                : []),
            ].map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-4">
                <dt className="text-muted">{row.label}</dt>
                <dd className="min-w-0 break-words text-right text-primary">{row.value}</dd>
              </div>
            ))}
          </dl>
          {sale.lots.length > 0 ? (
            <section>
              <h3 className="mb-2 text-[11px] uppercase tracking-wider text-muted">
                {sale.status === 'dispatched'
                  ? 'Dispatched lots'
                  : sale.schedule_kind === 'byproduct'
                    ? 'FIFO lots'
                    : 'Allocated lots'}
              </h3>
              <ul className="space-y-3">
                {sale.lots.map((lot) => (
                  <li key={lot.id} className="space-y-2">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 break-words font-medium text-primary">
                        {lot.invoice_number}
                      </span>
                      <span className="shrink-0 tabular-nums text-primary">
                        {lot.qty} {sale.unit}
                      </span>
                    </div>
                    {lot.coa_no ? <p className="text-xs text-muted">COA {lot.coa_no}</p> : null}
                    <DispatchScheduleViewLotCoa
                      sale={sale}
                      lot={lot}
                      factoryId={sale.factory_id || ''}
                      hideCommercial
                      className="btn w-full border border-text bg-panel text-primary"
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
        <div className="space-y-5 max-md:hidden">
          <span className={`badge ${saleStatusBadge(sale.status)}`}>
            {saleStatusLabel(sale.status, sale.schedule_kind)}
          </span>
          <DispatchScheduleSummary sale={sale} hideCommercial />
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-muted">Vehicle</span> {sale.vehicle_no || '—'}
            </p>
            <p>
              <span className="text-muted">Drums</span>{' '}
              {sale.drum_count != null ? sale.drum_count : '—'}
            </p>
            <p>
              <span className="text-muted">Invoice</span> {sale.tally_invoice_no || '—'}
            </p>
          </div>
          {sale.lots.map((lot) => (
            <div key={lot.id} className="rounded-lg border border-border/60 p-3">
              <p className="font-mono text-xs">
                {lot.invoice_number} · {lot.qty} {sale.unit}
                {lot.coa_no ? ` · ${lot.coa_no}` : ''}
              </p>
              <DispatchScheduleViewLotCoa
                sale={sale}
                lot={lot}
                factoryId={sale.factory_id || ''}
                hideCommercial
              />
            </div>
          ))}
        </div>
        </>
      )}
    </MgmtDrawer>
  )
}

export function LabAllocateDrawer({
  saleId,
  factoryId,
  onClose,
  onSaved,
}: {
  saleId: string
  factoryId: string
  onClose: () => void
  onSaved?: () => void
}) {
  const toast = useToast()
  const [sale, setSale] = useState<DispatchSchedule | null>(null)
  const [stock, setStock] = useState<FgStockLot[]>([])
  const [qtyByLot, setQtyByLot] = useState<Record<string, string>>({})
  const [invoiceNo, setInvoiceNo] = useState('')
  const [drumCount, setDrumCount] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    if (!saleId || !factoryId) return
    setLoading(true)
    const [saleRes, approvedRes, rejectedRes] = await Promise.all([
      dispatchScheduleApi.get(saleId),
      warehouseApi.listStock(factoryId, undefined, 'approved', 'fg'),
      warehouseApi.listStock(factoryId, undefined, 'rejected', 'fg'),
    ])
    if (saleRes.error) toast.error(saleRes.error)
    if (approvedRes.error) toast.error(approvedRes.error)
    if (rejectedRes.error) toast.error(rejectedRes.error)
    setSale((saleRes.sale as DispatchSchedule) ?? null)
    setStock([
      ...((approvedRes.stock ?? []) as FgStockLot[]),
      ...((rejectedRes.stock ?? []) as FgStockLot[]),
    ])
    setLoading(false)
  }, [saleId, factoryId, toast])

  useEffect(() => {
    void reload()
  }, [reload])

  const availableLots = useMemo(() => {
    if (!sale) return []
    const matched = fgLotsForProduct(stock, sale.product_name, sale.product_code)
    if (sale.is_discounted) {
      return matched.filter((l) => l.stock_grade === 'rejected')
    }
    return matched.filter((l) => l.stock_grade !== 'rejected')
  }, [sale, stock])

  const canAllocate = sale?.status === 'instructed'

  async function confirmPick() {
    if (!sale) return
    const lines = Object.entries(qtyByLot)
      .map(([invoice_number, q]) => ({ invoice_number, qty: Number(q) }))
      .filter((l) => l.qty > 0)
    if (lines.length === 0) {
      toast.error('Select at least one lot with qty')
      return
    }
    const drums = Number(drumCount)
    if (!invoiceNo.trim()) {
      toast.error('Enter the Tally invoice number')
      return
    }
    if (!Number.isInteger(drums) || drums < 1) {
      toast.error('Enter the number of drums')
      return
    }
    setSaving(true)
    const res = await dispatchScheduleApi.pickLots(sale.id, {
      lines,
      tally_invoice_no: invoiceNo.trim(),
      drum_count: drums,
    })
    setSaving(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success('Lots allocated and COA generated')
    setQtyByLot({})
    onSaved?.()
    await reload()
  }

  return (
    <MgmtDrawer
      size="lg"
      eyebrow="Dispatch COA"
      title="Allocate lot"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {canAllocate ? 'Cancel' : 'Close'}
          </button>
          {canAllocate ? (
            <button
              type="button"
              disabled={saving || loading || !sale}
              className="btn border border-pmc bg-pmc text-white hover:opacity-90 disabled:opacity-50"
              onClick={() => void confirmPick()}
            >
              {saving ? 'Saving…' : 'Allocate and generate COA'}
            </button>
          ) : null}
        </>
      }
    >
      {loading || !sale ? (
        <p className="text-sm text-muted">{loading ? 'Loading…' : 'Not found'}</p>
      ) : sale.schedule_kind === 'byproduct' ? (
        <p className="text-sm text-muted">
          Byproduct schedules have no COA. Accountant invoices them and FIFO stock is deducted then.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {sale.sale_no} · {sale.customer_name || 'Customer'} · {sale.product_name} · {sale.qty}{' '}
            {sale.unit}
          </p>
          {canAllocate ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block text-muted">Tally invoice #</span>
                  <input
                    className="input-field"
                    required
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-muted">Number of drums</span>
                  <input
                    className="input-field"
                    required
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={drumCount}
                    onChange={(e) => setDrumCount(e.target.value)}
                  />
                </label>
              </div>
              <DispatchSchedulePickLots
                sale={sale}
                lots={availableLots}
                qtyByLot={qtyByLot}
                onQtyChange={(lot, qty) => setQtyByLot((prev) => ({ ...prev, [lot]: qty }))}
                onConfirm={() => void confirmPick()}
                saving={saving}
                confirmLabel="Allocate lots and generate COA"
                hideConfirm
              />
            </>
          ) : sale.status === 'coa_issued' ? (
            <p className="text-sm text-muted">
              COA generated. The accountant records the vehicle to finish the invoice.
            </p>
          ) : sale.status === 'allocated' ? (
            <p className="text-sm text-muted">
              Lots are allocated. The accountant records the vehicle, and generates the COA if it
              was not issued with the lots.
            </p>
          ) : (
            <p className="text-sm text-muted">This schedule is not waiting on lab allocation.</p>
          )}
        </div>
      )}
    </MgmtDrawer>
  )
}
