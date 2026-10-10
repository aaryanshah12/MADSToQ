'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { QcLogEntry } from '@/components/inventory/QcLabResultForm'
import CoaSheet, {
  EMPTY_COA_CERTIFICATE,
  printCoaSheet,
  type CoaCertificate,
} from '@/components/inventory/CoaSheet'
import { useToast } from '@/components/providers/ToastProvider'
import { useAuth } from '@/components/providers/AppProviders'
import { dispatchScheduleApi } from '@/lib/api'

export type { CoaCertificate }

export type DispatchScheduleLot = {
  id: string
  invoice_number: string
  qty: number
  coa_no?: string | null
  coa_issued_at?: string | null
  coa_issued_by_name?: string | null
  signed_coa_file_name?: string | null
  signed_coa_uploaded_at?: string | null
  signed_coa_uploaded_by_name?: string | null
}

export type FgStockLot = {
  invoice_number: string
  material_type: string
  tons_remaining: number
  source?: string | null
  supplier_name?: string | null
  purity?: number | null
  stock_grade?: string | null
}

export function fgLotsForProduct(stock: FgStockLot[], productName: string, productCode?: string) {
  const name = productName.toLowerCase()
  const code = (productCode || '').toLowerCase()
  return stock.filter((r) => {
    const mat = r.material_type.toLowerCase()
    return mat === name || (code && mat === code)
  })
}

export type DispatchSchedule = {
  id: string
  factory_id?: string
  sale_no: string
  customer_id: string
  customer_name: string | null
  customer_gst?: string | null
  customer_address?: string | null
  product_id: string | null
  product_code: string
  product_name: string
  qty: number
  unit: string
  rate: number
  is_discounted?: boolean
  purity_spec: number | null
  client_po_no: string | null
  preferred_batch_nos: string[]
  schedule_kind?: 'fg' | 'byproduct'
  status: string
  tally_invoice_no: string | null
  vehicle_no: string | null
  drum_count?: number | null
  coa_no: string | null
  coa_issued_at: string | null
  coa_issued_by_name?: string | null
  created_by_name?: string | null
  invoiced_by_name?: string | null
  picked_by_name?: string | null
  invoiced_at?: string | null
  dispatched_at?: string | null
  created_at?: string | null
  lots: DispatchScheduleLot[]
}

export function saleStatusLabel(status: string, scheduleKind?: string) {
  if (scheduleKind === 'byproduct') {
    if (status === 'instructed') return 'Ready to invoice'
    if (status === 'invoiced') return 'Ready to load'
    if (status === 'dispatched') return 'Dispatched'
  }
  if (status === 'instructed') return 'Awaiting lot allocation'
  if (status === 'allocated') return 'Ready to invoice'
  if (status === 'coa_issued') return 'Awaiting vehicle'
  if (status === 'invoiced') return 'Ready to load'
  if (status === 'dispatched') return 'Dispatched'
  // legacy labels
  if (status === 'picked') return 'Allocated (legacy)'
  if (status === 'coa_pending') return 'COA in progress (legacy)'
  return status.replace(/_/g, ' ')
}

export function saleStatusBadge(status: string) {
  if (status === 'dispatched') return 'badge-chemist'
  if (status === 'coa_issued') return 'badge-chemist'
  if (status === 'allocated' || status === 'coa_pending' || status === 'picked') return 'badge-pmc'
  if (status === 'invoiced') return 'badge-owner'
  return 'badge-owner'
}

export function DispatchScheduleSummary({
  sale,
  hideCommercial = false,
}: {
  sale: DispatchSchedule
  /** Hide client and rate (lab / warehouse). */
  hideCommercial?: boolean
}) {
  return (
    <div className="grid gap-3 text-sm sm:grid-cols-2">
      <p>
        <span className="text-muted">Sale</span> {sale.sale_no}
      </p>
      {!hideCommercial && (
        <p>
          <span className="text-muted">Client</span> {sale.customer_name || '—'}
        </p>
      )}
      <p>
        <span className="text-muted">
          {sale.schedule_kind === 'byproduct' ? 'Byproduct' : 'Product'}
        </span>{' '}
        {sale.schedule_kind === 'byproduct'
          ? sale.product_name
          : `${sale.product_code} · ${sale.product_name}`}
      </p>
      <p>
        <span className="text-muted">Qty</span> {sale.qty} {sale.unit}
        {!hideCommercial && (
          <>
            <span className="mx-2 text-muted">·</span>
            <span className="text-muted">Rate</span> {sale.rate}
            {sale.is_discounted ? (
              <span className="ml-2 text-xs text-owner">Discounted</span>
            ) : null}
          </>
        )}
      </p>
      {sale.schedule_kind !== 'byproduct' && (
        <p>
          <span className="text-muted">Purity spec</span>{' '}
          {sale.purity_spec != null ? `${sale.purity_spec}%` : '—'}
        </p>
      )}
      {!hideCommercial && (
        <p>
          <span className="text-muted">Client PO</span> {sale.client_po_no || '—'}
        </p>
      )}
      {sale.schedule_kind !== 'byproduct' && (
        <p className="sm:col-span-2">
          <span className="text-muted">Admin suggested batches</span>{' '}
          {sale.preferred_batch_nos.length > 0
            ? sale.preferred_batch_nos.join(', ')
            : 'Lab chooses'}
        </p>
      )}
      <p>
        <span className="text-muted">Tally invoice</span> {sale.tally_invoice_no || '—'}
      </p>
      <p>
        <span className="text-muted">Vehicle</span> {sale.vehicle_no || '—'}
      </p>
      <p>
        <span className="text-muted">Drums</span>{' '}
        {sale.drum_count != null ? sale.drum_count : '—'}
      </p>
      {sale.lots.length > 0 && (
        <p className="sm:col-span-2">
          <span className="text-muted">
            {sale.status === 'dispatched'
              ? 'Dispatched lots'
              : sale.schedule_kind === 'byproduct'
                ? 'FIFO lots'
                : 'Allocated lots'}
          </span>{' '}
          {sale.lots
            .map((l) =>
              `${l.invoice_number} (${l.qty} ${sale.unit})${l.coa_no ? ` · ${l.coa_no}` : ''}`,
            )
            .join(', ')}
        </p>
      )}
    </div>
  )
}

export function DispatchSchedulePickLots({
  sale,
  lots,
  qtyByLot,
  onQtyChange,
  onConfirm,
  saving,
  confirmLabel = 'Allocate lots',
  hideConfirm = false,
}: {
  sale: DispatchSchedule
  lots: FgStockLot[]
  qtyByLot: Record<string, string>
  onQtyChange: (lot: string, qty: string) => void
  onConfirm: () => void
  saving?: boolean
  confirmLabel?: string
  hideConfirm?: boolean
}) {
  const preferred = useMemo(() => new Set(sale.preferred_batch_nos), [sale.preferred_batch_nos])
  const lotByNo = useMemo(
    () => new Map(lots.map((l) => [l.invoice_number, l])),
    [lots],
  )
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])

  useEffect(() => {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const [no, qty] of Object.entries(qtyByLot)) {
        if (qty && lotByNo.has(no)) next.add(no)
      }
      if (prev.length === 0 && lots.length > 0 && lots.length <= 3) {
        for (const lot of lots) next.add(lot.invoice_number)
      }
      return next.size === prev.length && prev.every((n) => next.has(n))
        ? prev
        : [...next]
    })
  }, [qtyByLot, lotByNo, lots])

  const pickedSum = Object.values(qtyByLot).reduce((s, v) => s + (Number(v) || 0), 0)
  const remainingNeed = Math.max(0, Number(sale.qty) - pickedSum)
  const selectedLots = selected
    .map((no) => lotByNo.get(no))
    .filter((l): l is FgStockLot => Boolean(l))
  const unselected = lots.filter((l) => !selected.includes(l.invoice_number))
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows = q
      ? unselected.filter(
          (l) =>
            l.invoice_number.toLowerCase().includes(q) ||
            String(l.purity ?? '').includes(q),
        )
      : [...unselected].sort((a, b) => {
          const ap = preferred.has(a.invoice_number) ? 0 : 1
          const bp = preferred.has(b.invoice_number) ? 0 : 1
          if (ap !== bp) return ap - bp
          return b.tons_remaining - a.tons_remaining
        })
    return rows.slice(0, 8)
  }, [query, unselected, preferred])
  const suggested = unselected.filter((l) => preferred.has(l.invoice_number))

  function addLot(no: string) {
    const lot = lotByNo.get(no)
    if (!lot) return
    setSelected((prev) => (prev.includes(no) ? prev : [...prev, no]))
    if (!(qtyByLot[no] || '').trim() && remainingNeed > 0) {
      const fill = Math.min(remainingNeed, lot.tons_remaining)
      if (fill > 0) onQtyChange(no, String(fill))
    }
    setQuery('')
    setOpen(false)
  }

  function removeLot(no: string) {
    setSelected((prev) => prev.filter((x) => x !== no))
    onQtyChange(no, '')
  }

  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        Select finished-goods lots for this schedule. Need {sale.qty} {sale.unit}. Selected{' '}
        <span className="tabular-nums text-primary">{pickedSum || 0}</span> {sale.unit}
        {remainingNeed > 0 ? ` · still ${remainingNeed} ${sale.unit}` : ''}.
        {lots.length > 0 ? ` ${lots.length} FG lots available.` : ''}
      </p>

      {lots.length === 0 ? (
        <p className="text-sm text-muted">No remaining FG lots for {sale.product_name}.</p>
      ) : (
        <div className="space-y-3">
          {suggested.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted">
                Admin suggested
              </span>
              {suggested.map((lot) => (
                <button
                  key={lot.invoice_number}
                  type="button"
                  className="rounded-full border border-owner/40 bg-owner/10 px-2.5 py-0.5 font-mono text-[11px] text-owner"
                  onClick={() => addLot(lot.invoice_number)}
                >
                  {lot.invoice_number}
                </button>
              ))}
            </div>
          )}

          <div className="relative">
            <input
              className="input-field w-full"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder="Search batch no. to add…"
            />
            {open && (
              <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-panel shadow-lg">
                {matches.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted">No matching unused lots.</p>
                ) : (
                  matches.map((lot) => (
                    <button
                      key={lot.invoice_number}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addLot(lot.invoice_number)}
                    >
                      <span className="font-mono text-xs">
                        {lot.invoice_number}
                        {preferred.has(lot.invoice_number) ? (
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-owner">
                            suggested
                          </span>
                        ) : null}
                      </span>
                      <span className="text-xs text-muted">
                        {lot.tons_remaining} {sale.unit}
                        {lot.purity != null ? ` · ${lot.purity}%` : ''}
                      </span>
                    </button>
                  ))
                )}
                {unselected.length > matches.length ? (
                  <p className="border-t border-border px-3 py-1.5 text-[11px] text-muted">
                    Showing {matches.length} of {unselected.length} — type to filter
                  </p>
                ) : null}
              </div>
            )}
          </div>

          {selectedLots.length === 0 ? (
            <p className="text-xs text-muted">No lots added yet. Search above and pick a batch.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="py-2 text-left">Batch</th>
                  <th className="py-2 text-left">Remaining</th>
                  <th className="py-2 text-left">Purity</th>
                  <th className="py-2 text-left">Pick qty ({sale.unit})</th>
                  <th className="py-2 text-left" />
                </tr>
              </thead>
              <tbody>
                {selectedLots.map((lot) => (
                  <tr key={lot.invoice_number} className="border-t border-border/60">
                    <td className="py-2 font-mono text-xs">
                      {lot.invoice_number}
                      {preferred.has(lot.invoice_number) ? (
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-owner">
                          suggested
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 tabular-nums text-muted">
                      {lot.tons_remaining} {sale.unit}
                    </td>
                    <td className="py-2 text-muted">
                      {lot.purity != null ? `${lot.purity}%` : '—'}
                    </td>
                    <td className="py-2">
                      <input
                        className="input-field w-28"
                        type="number"
                        step="any"
                        min={0}
                        max={lot.tons_remaining}
                        value={qtyByLot[lot.invoice_number] ?? ''}
                        onChange={(e) => onQtyChange(lot.invoice_number, e.target.value)}
                      />
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        className="text-xs text-muted hover:text-red-400"
                        onClick={() => removeLot(lot.invoice_number)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {hideConfirm ? null : (
      <button
        type="button"
        disabled={saving || lots.length === 0 || selectedLots.length === 0}
        className="btn btn-pmc mt-4"
        onClick={onConfirm}
      >
        {saving ? 'Saving…' : confirmLabel}
      </button>
      )}
    </div>
  )
}

export function DispatchScheduleLotCoaPanel({
  sale,
  lot,
  logs,
  certificate,
  loading,
}: {
  sale: DispatchSchedule
  lot: DispatchScheduleLot
  logs: QcLogEntry[]
  certificate?: CoaCertificate | null
  loading?: boolean
  hideCommercial?: boolean
}) {
  if (loading) return <p className="text-sm text-muted">Loading results…</p>
  return (
    <CoaSheet
      sale={sale}
      lot={lot}
      logs={logs}
      certificate={certificate ?? EMPTY_COA_CERTIFICATE}
    />
  )
}

async function loadFgLogsForLot(
  saleId: string,
  lotId: string,
): Promise<{ logs: QcLogEntry[]; certificate: CoaCertificate }> {
  const res = await dispatchScheduleApi.lotCoa(saleId, lotId)
  return {
    logs: (res.entries ?? []) as QcLogEntry[],
    certificate: { ...EMPTY_COA_CERTIFICATE, ...(res.certificate ?? {}) },
  }
}

type SignedCoaMeta = {
  file_name: string
  uploaded_at: string | null
  uploaded_by_name: string | null
}

const signedCoaCache = new Map<string, SignedCoaMeta>()

function signedCoaFromLot(lot: DispatchScheduleLot): SignedCoaMeta | null {
  const cached = signedCoaCache.get(lot.id)
  if (cached) return cached
  if (!lot.signed_coa_file_name) return null
  return {
    file_name: lot.signed_coa_file_name,
    uploaded_at: lot.signed_coa_uploaded_at ?? null,
    uploaded_by_name: lot.signed_coa_uploaded_by_name ?? null,
  }
}

function SignedCoaControls({ saleId, lot }: { saleId: string; lot: DispatchScheduleLot }) {
  const toast = useToast()
  const { profile } = useAuth()
  const canUpload = profile?.role === 'owner' || profile?.role === 'lab_incharge'
  const [signed, setSigned] = useState<SignedCoaMeta | null>(() => signedCoaFromLot(lot))
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setSigned(signedCoaFromLot(lot))
  }, [lot])

  if (!lot.coa_no) return null
  if (!canUpload && !signed) return null

  async function onFile(file: File | undefined) {
    if (!file) return
    const pdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!pdf) {
      toast.error('Only a PDF file is allowed')
      return
    }
    setUploading(true)
    const res = await dispatchScheduleApi.uploadSignedCoa(saleId, lot.id, file)
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
    if (res.error || !res.success) {
      toast.error(res.error || 'Could not upload the signed COA')
      return
    }
    const next: SignedCoaMeta = {
      file_name: String(res.signed_coa_file_name || file.name),
      uploaded_at: res.signed_coa_uploaded_at ? String(res.signed_coa_uploaded_at) : null,
      uploaded_by_name: res.signed_coa_uploaded_by_name
        ? String(res.signed_coa_uploaded_by_name)
        : null,
    }
    signedCoaCache.set(lot.id, next)
    setSigned(next)
    toast.success(signed ? 'Signed COA replaced' : 'Signed COA uploaded')
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {signed ? (
        <a
          href={`/api/inventory/dispatch-schedule/${saleId}/lots/${lot.id}/signed-coa?inline=1`}
          target="_blank"
          rel="noopener"
          className="btn btn-ghost"
        >
          Open signed COA
        </a>
      ) : null}
      {canUpload ? (
        <label
          className={`btn btn-ghost cursor-pointer ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        >
          {uploading ? 'Uploading…' : signed ? 'Replace signed COA' : 'Upload signed COA'}
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            disabled={uploading}
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </label>
      ) : null}
    </div>
  )
}

export function saleLotHasCoa(lot: DispatchScheduleLot) {
  return Boolean(lot.coa_no)
}

export function saleHasAllCoas(sale: DispatchSchedule) {
  return (
    sale.lots.length > 0 &&
    sale.lots.every((l) => Boolean(l.coa_no)) &&
    (sale.status === 'coa_issued' ||
      sale.status === 'invoiced' ||
      sale.status === 'dispatched' ||
      Boolean(sale.coa_no))
  )
}

export function DispatchScheduleViewLotCoa({
  sale,
  lot,
  factoryId: _factoryId,
  className = 'btn btn-ghost',
  hideCommercial = false,
}: {
  sale: DispatchSchedule
  lot: DispatchScheduleLot
  factoryId: string
  className?: string
  hideCommercial?: boolean
}) {
  const coa = useLotCoa(sale, lot)

  if (!saleLotHasCoa(lot)) return null

  return (
    <div>
      <button type="button" className={className} onClick={() => void coa.toggle()}>
        {coa.open ? 'Hide COA' : `View COA${lot.coa_no ? ` ${lot.coa_no}` : ''}`}
      </button>
      {coa.open ? (
        <DispatchScheduleLotCoaBody
          sale={sale}
          lot={lot}
          loading={coa.loading}
          logs={coa.logs}
          certificate={coa.certificate}
          hideCommercial={hideCommercial}
        />
      ) : (
        <div className="mt-2">
          <SignedCoaControls saleId={sale.id} lot={lot} />
        </div>
      )}
    </div>
  )
}

export function useLotCoa(sale: DispatchSchedule | null, lot: DispatchScheduleLot | null) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<QcLogEntry[]>([])
  const [certificate, setCertificate] = useState<CoaCertificate>(EMPTY_COA_CERTIFICATE)

  async function toggle() {
    if (open) {
      setOpen(false)
      return
    }
    if (!sale || !lot) return
    setLoading(true)
    const loaded = await loadFgLogsForLot(sale.id, lot.id)
    setLogs(loaded.logs)
    setCertificate(loaded.certificate)
    setLoading(false)
    setOpen(true)
  }

  return { open, loading, logs, certificate, toggle }
}

export function DispatchScheduleLotCoaBody({
  sale,
  lot,
  loading,
  logs,
  certificate,
  hideCommercial = false,
}: {
  sale: DispatchSchedule
  lot: DispatchScheduleLot
  loading: boolean
  logs: QcLogEntry[]
  certificate?: CoaCertificate | null
  hideCommercial?: boolean
}) {
  const sheetRef = useRef<HTMLDivElement>(null)
  return (
    <div className="mt-3 rounded-lg border border-border bg-white p-4 text-black">
      {loading ? (
        <p className="text-sm text-muted">Loading COA…</p>
      ) : (
        <>
          <div ref={sheetRef}>
            <DispatchScheduleLotCoaPanel
              sale={sale}
              lot={lot}
              logs={logs}
              certificate={certificate}
              hideCommercial={hideCommercial}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                if (sheetRef.current) printCoaSheet(sheetRef.current)
              }}
            >
              Print COA
            </button>
            <SignedCoaControls saleId={sale.id} lot={lot} />
          </div>
        </>
      )}
    </div>
  )
}

/** Lab reviews existing FG QC for a lot and issues COA number. */
export function DispatchScheduleLotIssueCoa({
  sale,
  lot,
  factoryId: _factoryId,
  onIssued,
  hideCommercial = true,
}: {
  sale: DispatchSchedule
  lot: DispatchScheduleLot
  factoryId: string
  onIssued: () => void
  hideCommercial?: boolean
}) {
  const [logs, setLogs] = useState<QcLogEntry[]>([])
  const [certificate, setCertificate] = useState<CoaCertificate>(EMPTY_COA_CERTIFICATE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const loaded = await loadFgLogsForLot(sale.id, lot.id)
      if (!cancelled) {
        setLogs(loaded.logs)
        setCertificate(loaded.certificate)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sale.id, lot.id])

  async function issue() {
    setSaving(true)
    setError(null)
    const res = await dispatchScheduleApi.issueCoa(sale.id, { lot_id: lot.id })
    setSaving(false)
    if (res.error) {
      setError(res.error)
      return
    }
    onIssued()
  }

  if (lot.coa_no) {
    return (
      <div className="rounded-lg border border-border p-4">
        <p className="mb-2 text-sm">
          <span className="font-mono text-xs">{lot.invoice_number}</span>
          <span className="ml-2 text-muted">COA {lot.coa_no}</span>
        </p>
        <DispatchScheduleViewLotCoa
          sale={sale}
          lot={lot}
          factoryId={_factoryId}
          hideCommercial={hideCommercial}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium">
          Lot <span className="font-mono text-sm">{lot.invoice_number}</span>
          <span className="ml-2 text-sm text-muted">
            {lot.qty} {sale.unit}
          </span>
        </h3>
      </div>
      <p className="text-sm text-muted">
        Review existing finished-goods QC results, then issue a COA number. No new tests are entered
        here.
      </p>
      {loading ? (
        <p className="text-sm text-muted">Loading FG QC…</p>
      ) : (
        <DispatchScheduleLotCoaPanel
          sale={sale}
          lot={lot}
          logs={logs}
          certificate={certificate}
          hideCommercial={hideCommercial}
        />
      )}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <button
        type="button"
        className="btn btn-chemist"
        disabled={saving || loading || logs.length === 0}
        onClick={() => void issue()}
      >
        {saving ? 'Issuing…' : 'Issue COA'}
      </button>
      {!loading && logs.length === 0 ? (
        <p className="text-xs text-muted">
          Cannot issue COA until FG QC tests exist for this production batch.
        </p>
      ) : null}
    </div>
  )
}
