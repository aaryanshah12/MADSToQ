'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, MessageSquarePlus } from 'lucide-react'
import { EmptyState, SkeletonPanel, useSmartFilter } from '@/components/ui'
import AppLayout from '@/components/layout/AppLayout'
import QcApproveShell from '@/components/inventory/QcApproveShell'
import { useAuth } from '@/hooks/useAuth'
import { useInventoryFactory } from '@/contexts/InventoryFactoryContext'
import { useToast } from '@/components/providers/ToastProvider'
import { procurementApi, qcLabApi } from '@/lib/api'
import QcResultsTable from '@/components/inventory/QcResultsTable'
import type { QcLogEntry } from '@/components/inventory/QcLabResultForm'
import RejectReasonSummary from '@/components/inventory/RejectReasonSummary'
import { inDateRange } from '@/components/inventory/DateRangeChip'
import { MobileCard, MobileListToolbar, MobileTabs } from '@/components/inventory/MobileList'
import {
  PrintStickerButton,
  QcRmStickerDrawer,
} from '@/components/inventory/QcStickerPrint'
import { printRmQcSticker } from '@/lib/qc-sticker-print'
import { qcStatusBadgeClass, qcStatusLabel, type RmQcStickerData } from '@/lib/qc-sticker'

const REJECTION_CRITERIA = [
  'Assay / purity out of spec',
  'Wrong material or grade',
  'Contamination / foreign matter',
  'Moisture / appearance fail',
  'Packaging damaged / seal broken',
  'COA missing or mismatch',
  'Qty / weight discrepancy',
  'Other',
] as const

const PARAM_TYPES = [
  { id: 'density', label: 'Density' },
  { id: 'boiling_point', label: 'Boiling point' },
  { id: 'karl_fisher', label: 'Karl Fisher' },
  { id: 'gc', label: 'GC' },
] as const

type Receipt = {
  id: string
  receipt_number: string
  po_number: string | null
  material_type: string
  vendor_name: string
  ordered_qty: number
  received_qty: number
  unit: string
  received_date: string | null
  received_price_per_unit: number
  po_price_per_unit: number | null
  accepted_price_per_unit: number | null
  debit_note_ref: string | null
  status: string
  qc_notes: string | null
  qc_at?: string | null
  sticker_printed_at?: string | null
  sticker_data?: unknown
}

type RmQcSort = 'material' | 'vendor' | 'receipt' | 'qty' | 'date' | 'status'

const PENDING_STATUS_OPTIONS = [
  { id: 'awaiting_admin', label: 'Ready' },
  { id: 'needs_info', label: 'On lab' },
] as const

function approveStatusLabel(status: string) {
  if (status === 'needs_info') return 'on lab'
  if (status === 'awaiting_admin') return 'ready'
  return status.replaceAll('_', ' ')
}

export default function OwnerRmQcPage() {
  const { profile, loading: authLoading } = useAuth()
  const toast = useToast()
  const { factoryId: ctxFactoryId } = useInventoryFactory()
  const factoryId = ctxFactoryId || profile?.factories?.[0]?.id || ''
  const [queue, setQueue] = useState<Receipt[]>([])
  const [approved, setApproved] = useState<Receipt[]>([])
  const [rejected, setRejected] = useState<Receipt[]>([])
  const [logsById, setLogsById] = useState<Record<string, QcLogEntry[]>>({})
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)
  const [rejectOpenId, setRejectOpenId] = useState<string | null>(null)
  const [reasonsById, setReasonsById] = useState<Record<string, string[]>>({})
  const [rejectDetailById, setRejectDetailById] = useState<Record<string, string>>({})
  const [requestOpenId, setRequestOpenId] = useState<string | null>(null)
  const [requestTypes, setRequestTypes] = useState<string[]>([])
  const [requestNote, setRequestNote] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [tab, setTab] = useState<'pending' | 'rejected' | 'approved'>('pending')
  const [sortCol, setSortCol] = useState<RmQcSort>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [logsLoadingId, setLogsLoadingId] = useState<string | null>(null)
  const [dispositionOpenId, setDispositionOpenId] = useState<string | null>(null)
  const [dispositionMode, setDispositionMode] = useState<'discount' | 'return' | null>(null)
  const [discountPriceById, setDiscountPriceById] = useState<Record<string, string>>({})
  const [debitNoteById, setDebitNoteById] = useState<Record<string, string>>({})
  const [returnDateById, setReturnDateById] = useState<Record<string, string>>({})
  const [returnVehicleById, setReturnVehicleById] = useState<Record<string, string>>({})
  const [returnNotesById, setReturnNotesById] = useState<Record<string, string>>({})
  const [stickerReceipt, setStickerReceipt] = useState<Receipt | null>(null)
  const [stickerSaving, setStickerSaving] = useState(false)


  const reload = useCallback(async (opts?: { silent?: boolean }) => {
    if (!factoryId) {
      setQueue([])
      setApproved([])
      setRejected([])
      setLoading(false)
      return
    }
    const silent = opts?.silent === true
    if (!silent) setLoading(true)
    const [waitingAdminRes, needsInfoRes, doneRes, rejectedRes] = await Promise.all([
      procurementApi.listReceipts(factoryId, 'awaiting_admin'),
      procurementApi.listReceipts(factoryId, 'needs_info'),
      procurementApi.listReceipts(factoryId, 'approved,approved_printed'),
      procurementApi.listReceipts(factoryId, 'rejected'),
    ])
    if (waitingAdminRes.error) toast.error(waitingAdminRes.error)
    if (needsInfoRes.error) toast.error(needsInfoRes.error)
    if (doneRes.error) toast.error(doneRes.error)
    if (rejectedRes.error) toast.error(rejectedRes.error)
    const waiting = (
      [
        ...((waitingAdminRes.receipts ?? []) as Receipt[]),
        ...((needsInfoRes.receipts ?? []) as Receipt[]),
      ]
    ).sort((a, b) => {
      if (a.status === b.status) return 0
      if (a.status === 'awaiting_admin') return -1
      if (b.status === 'awaiting_admin') return 1
      return 0
    })
    const done = ((doneRes.receipts ?? []) as Receipt[]).sort((a, b) =>
      String(b.received_date ?? '').localeCompare(String(a.received_date ?? '')),
    )
    const rejectedRows = ((rejectedRes.receipts ?? []) as Receipt[]).sort((a, b) =>
      String(b.received_date ?? '').localeCompare(String(a.received_date ?? '')),
    )
    setQueue(waiting)
    setApproved(done)
    setRejected(rejectedRows)
    if (!silent) setLoading(false)

    const ids = waiting.map((r) => r.id)
    const logMap: Record<string, QcLogEntry[]> = {}
    for (const id of ids) logMap[id] = []
    await Promise.all(
      ids.map(async (id) => {
        const logs = await qcLabApi.listLogs(factoryId, id, 'rm')
        logMap[id] = (logs.entries ?? []) as QcLogEntry[]
      }),
    )
    setLogsById((prev) => ({ ...prev, ...logMap }))
    setExpandedId((prev) => {
      if (!prev) return null
      if (
        waiting.some((r) => r.id === prev) ||
        done.some((r) => r.id === prev) ||
        rejectedRows.some((r) => r.id === prev)
      ) {
        return prev
      }
      return null
    })
  }, [factoryId])

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  async function ensureLogs(receiptId: string) {
    if (logsById[receiptId]) return
    setLogsLoadingId(receiptId)
    const logs = await qcLabApi.listLogs(factoryId, receiptId, 'rm')
    setLogsById((prev) => ({
      ...prev,
      [receiptId]: (logs.entries ?? []) as QcLogEntry[],
    }))
    setLogsLoadingId(null)
  }

  function toggleExpand(id: string) {
    setExpandedId((cur) => {
      if (cur === id) {
      setRejectOpenId(null)
      setRequestOpenId(null)
      setDispositionOpenId(null)
      setDispositionMode(null)
      return null
      }
    setRejectOpenId(null)
    setRequestOpenId(null)
    setDispositionOpenId(null)
    setDispositionMode(null)
    void ensureLogs(id)
    return id
    })
  }

  function toggleReason(id: string, reason: string) {
    setReasonsById((m) => {
      const cur = m[id] ?? []
      const next = cur.includes(reason) ? cur.filter((r) => r !== reason) : [...cur, reason]
      return { ...m, [id]: next }
    })
  }

  async function approve(id: string) {
    setActingId(id)
        const result = await procurementApi.qcReceipt({ id, action: 'approve' })
    setActingId(null)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Approved — stock created')
    setExpandedId(null)
    await reload({ silent: true })
  }

  function openRmSticker(r: Receipt) {
    setStickerReceipt(r)
    void ensureLogs(r.id)
  }

  async function printRmSticker(sticker: RmQcStickerData) {
    if (!stickerReceipt) return false
    setStickerSaving(true)
    const result = await procurementApi.printRmSticker({ id: stickerReceipt.id, sticker })
    setStickerSaving(false)
    if (result.error) {
      toast.error(result.error)
      return false
    }
    printRmQcSticker({
      ...sticker,
      purity:
        (result.receipt?.sticker_data as RmQcStickerData | undefined)?.purity || sticker.purity,
    })
    setStickerReceipt(null)
    await reload({ silent: true })
    return true
  }

  async function reject(id: string) {
    const reasons = reasonsById[id] ?? []
    if (reasons.length === 0) {
      toast.error('Select at least one rejection criterion')
      return
    }
    if (reasons.includes('Other') && !(rejectDetailById[id]?.trim())) {
      toast.error('Add detail notes when selecting Other')
      return
    }
    setActingId(id)
        const result = await procurementApi.qcReceipt({
      id,
      action: 'reject',
      rejection_reasons: reasons,
      qc_notes: rejectDetailById[id]?.trim() || undefined,
    })
    setActingId(null)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Rejected — accept at discount or send back')
    setRejectOpenId(null)
    setExpandedId(null)
    setTab('rejected')
    await reload({ silent: true })
  }

  async function requestParams(id: string) {
    if (requestTypes.length === 0) {
      toast.error('Select at least one parameter to request')
      return
    }
    setActingId(id)
        const result = await qcLabApi.requestParams({
      receipt_id: id,
      requested_types: requestTypes,
      note: requestNote.trim() || undefined,
    })
    setActingId(null)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Parameter request sent to lab')
    setRequestOpenId(null)
    setRequestTypes([])
    setRequestNote('')
    setExpandedId(null)
    await reload({ silent: true })
  }

  async function acceptDiscounted(r: Receipt) {
    const price = Number(discountPriceById[r.id])
    const original = Number(r.received_price_per_unit)
    if (!Number.isFinite(price) || price <= 0) {
      toast.error('Enter a discounted price greater than zero')
      return
    }
    if (!(price < original - 1e-9)) {
      toast.error('Discounted price must be less than the original received price')
      return
    }
    const debit = debitNoteById[r.id]?.trim() ?? ''
    if (!debit) {
      toast.error('Debit / credit note reference is required')
      return
    }
    setActingId(r.id)
    const result = await procurementApi.qcReceipt({
      id: r.id,
      action: 'accept_discounted',
      accepted_price_per_unit: price,
      debit_note_ref: debit,
    })
    setActingId(null)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Accepted at discount — stock created')
    setDispositionOpenId(null)
    setDispositionMode(null)
    setExpandedId(null)
    setTab('approved')
    await reload({ silent: true })
  }

  async function sendBack(r: Receipt) {
    const vehicle = returnVehicleById[r.id]?.trim() ?? ''
    if (!vehicle) {
      toast.error('Transporter / vehicle is required')
      return
    }
    const returnDate =
      returnDateById[r.id]?.trim() || new Date().toISOString().slice(0, 10)
    setActingId(r.id)
    const result = await procurementApi.qcReceipt({
      id: r.id,
      action: 'return_to_vendor',
      return_date: returnDate,
      return_vehicle_number: vehicle,
      return_notes: returnNotesById[r.id]?.trim() || undefined,
    })
    setActingId(null)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Sent back to vendor — accountant can receive a replacement')
    setDispositionOpenId(null)
    setDispositionMode(null)
    setExpandedId(null)
    await reload({ silent: true })
  }

  function mobileRejectPanel(id: string) {
    const selected = reasonsById[id] ?? []
    const busy = actingId === id
    return (
      <div className="space-y-3 border-t border-border pt-4 text-left">
        <p className="text-sm font-medium text-primary">Reject criteria</p>
        <div className="flex flex-wrap gap-2">
          {REJECTION_CRITERIA.map((c) => {
            const on = selected.includes(c)
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleReason(id, c)}
                className={`rounded-md px-2.5 py-1 text-xs ${
                  on ? 'bg-red-500/10 text-red-600' : 'bg-layer-sm text-muted'
                }`}
              >
                {c}
              </button>
            )
          })}
        </div>
        {selected.includes('Other') ? (
          <textarea
            className="input-field owner-focus min-h-[72px]"
            placeholder="Detail for Other"
            value={rejectDetailById[id] ?? ''}
            onChange={(e) => setRejectDetailById((m) => ({ ...m, [id]: e.target.value }))}
          />
        ) : null}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy || selected.length === 0}
            className="btn btn-danger h-9 flex-1 disabled:opacity-40"
            onClick={() => void reject(id)}
          >
            Confirm reject
          </button>
          <button type="button" className="btn btn-ghost h-9" onClick={() => setRejectOpenId(null)}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  function mobileRequestPanel(id: string) {
    const busy = actingId === id
    return (
      <div className="space-y-3 border-t border-border pt-4 text-left">
        <p className="text-sm font-medium text-primary">Request missing parameters</p>
        <div className="flex flex-wrap gap-2">
          {PARAM_TYPES.map((t) => {
            const on = requestTypes.includes(t.id)
            return (
              <button
                key={t.id}
                type="button"
                onClick={() =>
                  setRequestTypes((cur) => (on ? cur.filter((x) => x !== t.id) : [...cur, t.id]))
                }
                className={`rounded-md px-2.5 py-1 text-xs ${
                  on ? 'bg-owner/15 text-owner' : 'bg-layer-sm text-muted'
                }`}
              >
                {t.label}
              </button>
            )
          })}
        </div>
        <input
          className="input-field owner-focus"
          placeholder="Note to lab (optional)"
          value={requestNote}
          onChange={(e) => setRequestNote(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            className="btn btn-owner h-9 flex-1"
            onClick={() => void requestParams(id)}
          >
            Send request
          </button>
          <button type="button" className="btn btn-ghost h-9" onClick={() => setRequestOpenId(null)}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  function mobileDispositionPanel(r: Receipt) {
    const busy = actingId === r.id
    const discountOpen = dispositionOpenId === r.id && dispositionMode === 'discount'
    const returnOpen = dispositionOpenId === r.id && dispositionMode === 'return'
    return (
      <div className="space-y-3 border-t border-border pt-4 text-left">
        {discountOpen ? (
          <>
            <p className="text-sm font-medium text-primary">Accept at discounted price</p>
            <p className="text-xs text-muted">
              Original receive price ₹{r.received_price_per_unit}/{r.unit}
              {r.po_price_per_unit != null ? ` · PO ₹${r.po_price_per_unit}/${r.unit}` : ''}
            </p>
            <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted">
              Discounted price / {r.unit} *
            </label>
            <input
              aria-label={`Discounted price per ${r.unit}`}
              className="input-field owner-focus"
              type="number"
              min="0.01"
              step="any"
              value={discountPriceById[r.id] ?? ''}
              onChange={(e) => setDiscountPriceById((m) => ({ ...m, [r.id]: e.target.value }))}
            />
            <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted">
              Debit / credit note ref *
            </label>
            <input
              aria-label="Debit / credit note ref"
              className="input-field owner-focus"
              value={debitNoteById[r.id] ?? ''}
              onChange={(e) => setDebitNoteById((m) => ({ ...m, [r.id]: e.target.value }))}
              placeholder="DN / CN number"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                className="btn btn-owner h-9 flex-1"
                onClick={() => void acceptDiscounted(r)}
              >
                {busy ? 'Saving…' : 'Accept & add to stock'}
              </button>
              <button
                type="button"
                className="btn btn-ghost h-9"
                onClick={() => {
                  setDispositionOpenId(null)
                  setDispositionMode(null)
                }}
              >
                Cancel
              </button>
            </div>
          </>
        ) : returnOpen ? (
          <>
            <p className="text-sm font-medium text-primary">Send back to vendor</p>
            <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted">
              Return date *
            </label>
            <input
              aria-label="Return date"
              className="input-field owner-focus"
              type="date"
              value={returnDateById[r.id] ?? new Date().toISOString().slice(0, 10)}
              onChange={(e) => setReturnDateById((m) => ({ ...m, [r.id]: e.target.value }))}
            />
            <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted">
              Transporter / vehicle *
            </label>
            <input
              aria-label="Transporter / vehicle"
              className="input-field owner-focus"
              value={returnVehicleById[r.id] ?? ''}
              onChange={(e) => setReturnVehicleById((m) => ({ ...m, [r.id]: e.target.value }))}
              placeholder="Vehicle or transporter"
            />
            <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted">
              Notes
            </label>
            <textarea
              aria-label="Notes"
              className="input-field owner-focus min-h-[72px]"
              value={returnNotesById[r.id] ?? ''}
              onChange={(e) => setReturnNotesById((m) => ({ ...m, [r.id]: e.target.value }))}
              placeholder="Optional"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                className="btn btn-danger h-9 flex-1"
                onClick={() => void sendBack(r)}
              >
                {busy ? 'Saving…' : 'Confirm send back'}
              </button>
              <button
                type="button"
                className="btn btn-ghost h-9"
                onClick={() => {
                  setDispositionOpenId(null)
                  setDispositionMode(null)
                }}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={busy}
              className="btn w-full border border-owner bg-owner text-white disabled:opacity-40"
              onClick={() => {
                setDispositionOpenId(r.id)
                setDispositionMode('discount')
              }}
            >
              Accept at discount
            </button>
            <button
              type="button"
              disabled={busy}
              className="btn w-full border border-red-300 bg-panel text-red-600 disabled:opacity-40"
              onClick={() => {
                setDispositionOpenId(r.id)
                setDispositionMode('return')
                setReturnDateById((m) => ({
                  ...m,
                  [r.id]: m[r.id] || new Date().toISOString().slice(0, 10),
                }))
              }}
            >
              Send back to vendor
            </button>
          </div>
        )}
      </div>
    )
  }

  const sourceRows = tab === 'approved' ? approved : tab === 'rejected' ? rejected : queue
  const filter = useSmartFilter(sourceRows, {
    getSearchText: (r) => [
      r.material_type,
      r.vendor_name,
      r.receipt_number,
      r.po_number,
      approveStatusLabel(r.status),
    ],
    facets: [
      { key: 'material', label: 'Material', getValue: (r) => r.material_type },
      { key: 'vendor', label: 'Vendor', getValue: (r) => r.vendor_name },
      ...(tab === 'pending'
        ? [
            {
              key: 'status',
              label: 'Status',
              getValue: (r: Receipt) =>
                r.status === 'needs_info' ? 'needs_info' : 'awaiting_admin',
              formatValue: (id: string) =>
                PENDING_STATUS_OPTIONS.find((o) => o.id === id)?.label ?? id,
              options: [...PENDING_STATUS_OPTIONS],
            },
          ]
        : []),
    ],
  })

  const sortedRows = useMemo(() => {
    let rows = filter.filtered.filter((r) => inDateRange(r.received_date, dateFrom, dateTo))
    const dir = sortDir === 'asc' ? 1 : -1
    rows = [...rows].sort((a, b) => {
      let cmp = 0
      switch (sortCol) {
        case 'material':
          cmp = a.material_type.localeCompare(b.material_type)
          break
        case 'vendor':
          cmp = a.vendor_name.localeCompare(b.vendor_name)
          break
        case 'qty':
          cmp = Number(a.received_qty) - Number(b.received_qty)
          break
        case 'date':
          cmp = String(a.received_date ?? '').localeCompare(String(b.received_date ?? ''))
          break
        case 'status':
          cmp = a.status.localeCompare(b.status)
          break
        case 'receipt':
        default:
          cmp = a.receipt_number.localeCompare(b.receipt_number, undefined, { numeric: true })
          break
      }
      return cmp * dir || a.receipt_number.localeCompare(b.receipt_number)
    })
    return rows
  }, [filter.filtered, sortCol, sortDir, dateFrom, dateTo])

  function handleSort(col: RmQcSort) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir(col === 'qty' || col === 'date' || col === 'receipt' ? 'desc' : 'asc')
    }
  }

  useEffect(() => {
    filter.setSearch('')
    filter.clearAll()
    setDateFrom('')
    setDateTo('')
  }, [tab])

  return (
    <AppLayout>
      <div className="w-full p-4 md:p-8">
        <QcApproveShell kind="rm">

        <MobileTabs
          ariaLabel="RM QC queues"
          className="-mx-4 mb-4 bg-panel"
          active={tab}
          onChange={(key) => {
            setTab(key)
            setExpandedId(null)
            setRejectOpenId(null)
            setRequestOpenId(null)
            setDispositionOpenId(null)
            setDispositionMode(null)
          }}
          tabs={[
            { key: 'pending', label: 'Pending' },
            { key: 'rejected', label: 'Rejected' },
            { key: 'approved', label: 'Approved' },
          ]}
        />

        <div className="md:hidden">
          {loading ? (
            <SkeletonPanel />
          ) : sourceRows.length === 0 ? (
            <EmptyState
              className="rounded-xl bg-panel"
              title={
                tab === 'approved'
                  ? 'No approved receipts yet'
                  : tab === 'rejected'
                    ? 'No rejected lots awaiting disposition.'
                    : 'No lots awaiting approval'
              }
            />
          ) : (
            <>
              <MobileListToolbar
                filter={filter}
                placeholder="Search material, vendor, lot…"
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateChange={(from, to) => {
                  setDateFrom(from)
                  setDateTo(to)
                }}
                resultCount={sortedRows.length}
                noun={{ one: 'lot', many: 'lots' }}
                sortOptions={[
                  { col: 'material', label: 'Material', kind: 'text' },
                  { col: 'vendor', label: 'Vendor', kind: 'text' },
                  { col: 'receipt', label: 'Lot / GRN', kind: 'text' },
                  { col: 'qty', label: 'Qty', kind: 'number' },
                  { col: 'date', label: 'Date', kind: 'date' },
                  { col: 'status', label: 'Status', kind: 'text' },
                ]}
                sortCol={sortCol}
                sortDir={sortDir}
                onSort={handleSort}
              />
              {sortedRows.length === 0 ? (
                <EmptyState
                  className="rounded-xl bg-panel"
                  title="No lots match your search or filter."
                />
              ) : (
                <div className="space-y-3">
                  {sortedRows.map((r) => {
                    const isOpen = expandedId === r.id
                    const logs = logsById[r.id] ?? []
                    if (tab === 'approved') {
                      return (
                        <MobileCard
                          key={r.id}
                          id={r.receipt_number}
                          title={r.material_type}
                          subtitle={r.vendor_name}
                          aside={
                            <span className="block text-base font-medium tabular-nums text-owner">
                              {r.received_qty} {r.unit}
                            </span>
                          }
                          rows={[
                            { label: 'Date', value: r.received_date ?? '—' },
                            { label: 'PO', value: r.po_number ?? '—' },
                            {
                              label: 'Status',
                              value: (
                                <span className={qcStatusBadgeClass(r.status)}>
                                  {qcStatusLabel(r.status)}
                                </span>
                              ),
                            },
                            ...(r.accepted_price_per_unit != null
                              ? [
                                  {
                                    label: 'Discount',
                                    value: `₹${r.accepted_price_per_unit}/${r.unit}${
                                      r.debit_note_ref ? ` · ${r.debit_note_ref}` : ''
                                    }`,
                                  },
                                ]
                              : []),
                          ]}
                          footer={
                            <div className="flex flex-col gap-3">
                              <PrintStickerButton
                                printed={r.status === 'approved_printed'}
                                onClick={() => openRmSticker(r)}
                              />
                              <button
                                type="button"
                                className="btn w-full border border-text bg-panel text-primary"
                                onClick={() => toggleExpand(r.id)}
                              >
                                {isOpen ? 'Hide results' : 'View results'}
                              </button>
                              {isOpen ? (
                                <div className="space-y-3 text-left">
                                  {logsLoadingId === r.id ? (
                                    <p className="text-sm text-muted">Loading results…</p>
                                  ) : (
                                    <QcResultsTable logs={logs} />
                                  )}
                                </div>
                              ) : null}
                            </div>
                          }
                        />
                      )
                    }
                    if (tab === 'rejected') {
                      return (
                        <MobileCard
                          key={r.id}
                          id={r.receipt_number}
                          title={r.material_type}
                          subtitle={r.vendor_name}
                          aside={
                            <span className="block text-base font-medium tabular-nums text-owner">
                              {r.received_qty} {r.unit}
                            </span>
                          }
                          rows={[
                            { label: 'Price', value: `₹${r.received_price_per_unit}/${r.unit}` },
                            { label: 'PO', value: r.po_number ?? '—' },
                            { label: 'Date', value: r.received_date ?? '—' },
                          ]}
                          footer={
                            <div className="flex flex-col gap-3">
                              <button
                                type="button"
                                className="btn w-full border border-text bg-panel text-primary"
                                onClick={() => toggleExpand(r.id)}
                              >
                                {isOpen ? 'Hide details' : 'Open disposition'}
                              </button>
                              {isOpen ? (
                                <div className="space-y-3 text-left">
                                  {r.qc_notes ? (
                                    <div className="space-y-1">
                                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                                        Rejection reasons
                                      </p>
                                      <RejectReasonSummary qcNotes={r.qc_notes} />
                                    </div>
                                  ) : null}
                                  {logsLoadingId === r.id ? (
                                    <p className="text-sm text-muted">Loading results…</p>
                                  ) : (
                                    <QcResultsTable logs={logs} />
                                  )}
                                  {mobileDispositionPanel(r)}
                                </div>
                              ) : null}
                            </div>
                          }
                        />
                      )
                    }
                    const waitingLab = r.status === 'needs_info'
                    const canDecide = r.status === 'awaiting_admin'
                    const busy = actingId === r.id
                    return (
                      <MobileCard
                        key={r.id}
                        id={
                          <span className="flex items-center justify-between gap-3">
                            <span className="min-w-0 truncate">{r.receipt_number}</span>
                            <span className={`badge shrink-0 ${waitingLab ? 'badge-pmc' : 'badge-owner'}`}>
                              {waitingLab ? 'On lab' : 'Ready'}
                            </span>
                          </span>
                        }
                        title={r.material_type}
                        subtitle={r.vendor_name}
                        aside={
                          <span className="block text-base font-medium tabular-nums text-owner">
                            {r.received_qty} {r.unit}
                          </span>
                        }
                        rows={[
                          { label: 'PO', value: r.po_number ?? '—' },
                          { label: 'Ordered', value: `${r.ordered_qty} ${r.unit}` },
                          { label: 'Date', value: r.received_date ?? '—' },
                        ]}
                        footer={
                          <div className="flex flex-col gap-2">
                            <button
                              type="button"
                              className="btn w-full border border-text bg-panel text-primary"
                              onClick={() => toggleExpand(r.id)}
                            >
                              {isOpen ? 'Hide results' : 'View results'}
                            </button>
                            {isOpen ? (
                              logsLoadingId === r.id ? (
                                <p className="text-left text-sm text-muted">Loading results…</p>
                              ) : (
                                <QcResultsTable logs={logs} />
                              )
                            ) : null}
                            {isOpen && rejectOpenId === r.id ? mobileRejectPanel(r.id) : null}
                            {isOpen && requestOpenId === r.id ? mobileRequestPanel(r.id) : null}
                            {isOpen && rejectOpenId !== r.id && requestOpenId !== r.id ? (
                              <>
                                <button
                                  type="button"
                                  disabled={busy || !canDecide}
                                  className="btn w-full border border-owner bg-owner text-white disabled:opacity-40"
                                  onClick={() => void approve(r.id)}
                                >
                                  {busy ? 'Approving…' : 'Approve & add to stock'}
                                </button>
                                <button
                                  type="button"
                                  disabled={busy || !canDecide}
                                  className="btn w-full border border-red-300 bg-panel text-red-600 disabled:opacity-40"
                                  onClick={() => {
                                    setRejectOpenId(r.id)
                                    setRequestOpenId(null)
                                  }}
                                >
                                  Reject
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  className="btn w-full border border-text bg-panel text-primary disabled:opacity-40"
                                  onClick={() => {
                                    setRequestOpenId(r.id)
                                    setRejectOpenId(null)
                                    setRequestTypes([])
                                    setRequestNote('')
                                  }}
                                >
                                  Ask lab for more tests
                                </button>
                                {waitingLab ? (
                                  <p className="text-left text-xs text-pmc">
                                    Waiting for lab to complete requested parameters.
                                  </p>
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        }
                      />
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className="hidden md:block">
        <div className="folder-tabs" role="tablist" aria-label="RM QC queues">
          {(
            [
              { id: 'pending' as const, label: 'Pending' },
              { id: 'rejected' as const, label: 'Rejected' },
              { id: 'approved' as const, label: 'Approved' },
            ]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={tab === item.id ? 'folder-tab is-active' : 'folder-tab'}
              onClick={() => {
                setTab(item.id)
                setExpandedId(null)
                setRejectOpenId(null)
                setRequestOpenId(null)
                setDispositionOpenId(null)
                setDispositionMode(null)
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        {loading ? (
          <SkeletonPanel />
        ) : tab === 'approved' ? (
          approved.length === 0 ? (
            <EmptyState
              className="card"
              title="No approved receipts yet"
              description="Receipts you approve after lab QC will be listed here."
            />
          ) : (
            <div className="rounded-xl border border-border bg-panel shadow-sm">
              <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Already approved
                </p>
                <span className="rounded-full bg-owner/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-owner">
                  {approved.length}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[42rem] text-left text-sm">
                  <thead>
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Material</th>
                      <th className="px-4 py-2.5 font-semibold">Vendor</th>
                      <th className="px-4 py-2.5 font-semibold">Lot / GRN</th>
                      <th className="px-4 py-2.5 font-semibold">Qty</th>
                      <th className="px-4 py-2.5 font-semibold">Date</th>
                      <th className="px-4 py-2.5 font-semibold">Results</th>
                      <th className="px-2 py-2.5 text-right whitespace-nowrap">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {approved.map((r) => {
                      const logs = logsById[r.id] ?? []
                      const isOpen = expandedId === r.id
                      const logsBusy = logsLoadingId === r.id

                      return (
                        <Fragment key={r.id}>
                          <tr
                            className={`border-b border-border/60 last:border-b-0 ${
                              isOpen ? 'bg-owner/[0.06]' : 'hover:bg-surface/60'
                            }`}
                          >
                            <td className="px-4 py-3 font-medium text-primary">
                              {r.material_type}
                              {r.status === 'approved_printed' ? (
                                <span className={`ml-2 ${qcStatusBadgeClass(r.status)}`}>
                                  {qcStatusLabel(r.status)}
                                </span>
                              ) : r.accepted_price_per_unit != null ? (
                                <span className="ml-2 inline-flex rounded-full bg-owner/10 px-1.5 py-0.5 text-[10px] font-semibold text-owner">
                                  Discount
                                </span>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 text-muted">{r.vendor_name}</td>
                            <td className="px-4 py-3 font-mono text-[11px] text-muted">
                              {r.receipt_number}
                            </td>
                            <td className="px-4 py-3 tabular-nums text-muted">
                              {r.received_qty} {r.unit}
                            </td>
                            <td className="px-4 py-3 text-muted">{r.received_date ?? '—'}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex min-w-[1.5rem] justify-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                                  logs.length > 0
                                    ? 'bg-owner/12 text-owner'
                                    : 'bg-surface text-muted'
                                }`}
                              >
                                {isOpen && logsBusy ? '…' : logs.length}
                              </span>
                            </td>
                            <td className="px-2 py-3 text-right">
                              <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                className="btn h-8 shrink-0 whitespace-nowrap border border-text bg-panel px-3 text-xs text-primary"
                                onClick={() => openRmSticker(r)}
                              >
                                {r.status === 'approved_printed' ? 'Reprint' : 'Print'}
                              </button>
                              <button
                                type="button"
                                aria-label={isOpen ? 'Hide details' : 'View details'}
                                aria-expanded={isOpen}
                                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                                  isOpen
                                    ? 'bg-owner/15 text-owner'
                                    : 'text-muted hover:bg-layer-sm hover:text-owner'
                                }`}
                                onClick={() => toggleExpand(r.id)}
                              >
                                {isOpen ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                              </div>
                            </td>
                          </tr>

                          {isOpen && (
                            <tr className="border-b border-border/60 bg-surface/40 last:border-b-0">
                              <td colSpan={7} className="px-4 py-4">
                                <div className="space-y-4">
                                  <p className="text-xs text-muted">
                                    {r.received_qty} / {r.ordered_qty} {r.unit}
                                    <span className="mx-1.5 opacity-40">·</span>
                                    {r.received_date ?? '—'}
                                    {r.po_number ? (
                                      <>
                                        <span className="mx-1.5 opacity-40">·</span>
                                        PO {r.po_number}
                                      </>
                                    ) : null}
                                  </p>
                                  {r.accepted_price_per_unit != null ? (
                                    <p className="text-xs text-owner">
                                      Accepted at discount ₹{r.accepted_price_per_unit}/{r.unit}
                                      {r.debit_note_ref ? ` · DN/CN ${r.debit_note_ref}` : ''}
                                      <span className="text-muted">
                                        {' '}
                                        (was ₹{r.received_price_per_unit})
                                      </span>
                                    </p>
                                  ) : null}

                                  <div className="space-y-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                                      Lab results · {logsBusy ? '…' : logs.length}
                                    </p>
                                    {logsBusy ? (
                                      <p className="text-sm text-muted">Loading results…</p>
                                    ) : (
                                      <QcResultsTable logs={logs} />
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : tab === 'rejected' ? (
          rejected.length === 0 ? (
            <p className="text-sm text-muted">No rejected lots awaiting disposition.</p>
          ) : (
            <div className="rounded-xl border border-border bg-panel shadow-sm">
              <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Rejected — accept at discount or send back
                </p>
                <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-red-600">
                  {rejected.length}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[42rem] text-left text-sm">
                  <thead>
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Material</th>
                      <th className="px-4 py-2.5 font-semibold">Vendor</th>
                      <th className="px-4 py-2.5 font-semibold">Lot / GRN</th>
                      <th className="px-4 py-2.5 font-semibold">Qty</th>
                      <th className="px-4 py-2.5 font-semibold">Price</th>
                      <th className="px-4 py-2.5 font-semibold">Results</th>
                      <th className="w-12 px-2 py-2.5 text-right">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rejected.map((r) => {
                      const logs = logsById[r.id] ?? []
                      const busy = actingId === r.id
                      const isOpen = expandedId === r.id
                      const logsBusy = logsLoadingId === r.id
                      const discountOpen =
                        dispositionOpenId === r.id && dispositionMode === 'discount'
                      const returnOpen =
                        dispositionOpenId === r.id && dispositionMode === 'return'

                      return (
                        <Fragment key={r.id}>
                          <tr
                            className={`border-b border-border/60 last:border-b-0 ${
                              isOpen ? 'bg-owner/[0.06]' : 'hover:bg-surface/60'
                            }`}
                          >
                            <td className="px-4 py-3 font-medium text-primary">{r.material_type}</td>
                            <td className="px-4 py-3 text-muted">{r.vendor_name}</td>
                            <td className="px-4 py-3 font-mono text-[11px] text-muted">
                              {r.receipt_number}
                            </td>
                            <td className="px-4 py-3 tabular-nums text-muted">
                              {r.received_qty} {r.unit}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-muted">
                              ₹{r.received_price_per_unit}/{r.unit}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex min-w-[1.5rem] justify-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                                  logs.length > 0
                                    ? 'bg-owner/12 text-owner'
                                    : 'bg-surface text-muted'
                                }`}
                              >
                                {isOpen && logsBusy ? '…' : logs.length}
                              </span>
                            </td>
                            <td className="px-2 py-3 text-right">
                              <button
                                type="button"
                                aria-label={isOpen ? 'Hide details' : 'View details'}
                                aria-expanded={isOpen}
                                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                                  isOpen
                                    ? 'bg-owner/15 text-owner'
                                    : 'text-muted hover:bg-layer-sm hover:text-owner'
                                }`}
                                onClick={() => toggleExpand(r.id)}
                              >
                                {isOpen ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </td>
                          </tr>

                          {isOpen && (
                            <tr className="border-b border-border/60 bg-surface/40 last:border-b-0">
                              <td colSpan={7} className="px-4 py-4">
                                <div className="space-y-4">
                                  <p className="text-xs text-muted">
                                    {r.received_qty} / {r.ordered_qty} {r.unit}
                                    <span className="mx-1.5 opacity-40">·</span>
                                    {r.received_date ?? '—'}
                                    {r.po_number ? (
                                      <>
                                        <span className="mx-1.5 opacity-40">·</span>
                                        PO {r.po_number}
                                      </>
                                    ) : null}
                                    {r.po_price_per_unit != null ? (
                                      <>
                                        <span className="mx-1.5 opacity-40">·</span>
                                        PO ₹{r.po_price_per_unit}/{r.unit}
                                      </>
                                    ) : null}
                                  </p>

                                  {r.qc_notes ? (
                                    <div className="space-y-1">
                                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                                        Rejection reasons
                                      </p>
                                      <RejectReasonSummary qcNotes={r.qc_notes} />
                                    </div>
                                  ) : null}

                                  <div className="space-y-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                                      Lab results · {logsBusy ? '…' : logs.length}
                                    </p>
                                    {logsBusy ? (
                                      <p className="text-sm text-muted">Loading results…</p>
                                    ) : (
                                      <QcResultsTable logs={logs} />
                                    )}
                                  </div>

                                  {discountOpen ? (
                                    <div className="space-y-3 border-t border-border pt-4">
                                      <p className="text-sm font-medium text-primary">
                                        Accept at discounted price
                                      </p>
                                      <p className="text-xs text-muted">
                                        Original receive price ₹{r.received_price_per_unit}/{r.unit}
                                        {r.po_price_per_unit != null
                                          ? ` · PO ₹${r.po_price_per_unit}/${r.unit}`
                                          : ''}
                                      </p>
                                      <div className="grid gap-3 sm:grid-cols-2">
                                        <div>
                                          <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted">
                                            Discounted price / {r.unit} *
                                          </label>
                                          <input aria-label={`Discounted price per ${r.unit}`}
                                            className="input-field owner-focus"
                                            type="number"
                                            min="0.01"
                                            step="any"
                                            value={discountPriceById[r.id] ?? ''}
                                            onChange={(e) =>
                                              setDiscountPriceById((m) => ({
                                                ...m,
                                                [r.id]: e.target.value,
                                              }))
                                            }
                                          />
                                        </div>
                                        <div>
                                          <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted">
                                            Debit / credit note ref *
                                          </label>
                                          <input aria-label="Debit / credit note ref"
                                            className="input-field owner-focus"
                                            value={debitNoteById[r.id] ?? ''}
                                            onChange={(e) =>
                                              setDebitNoteById((m) => ({
                                                ...m,
                                                [r.id]: e.target.value,
                                              }))
                                            }
                                            placeholder="DN / CN number"
                                          />
                                        </div>
                                      </div>
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          disabled={busy}
                                          className="btn btn-owner h-9"
                                          onClick={() => void acceptDiscounted(r)}
                                        >
                                          {busy ? 'Saving…' : 'Accept & add to stock'}
                                        </button>
                                        <button
                                          type="button"
                                          className="btn btn-ghost h-9"
                                          onClick={() => {
                                            setDispositionOpenId(null)
                                            setDispositionMode(null)
                                          }}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : returnOpen ? (
                                    <div className="space-y-3 border-t border-border pt-4">
                                      <p className="text-sm font-medium text-primary">
                                        Send back to vendor
                                      </p>
                                      <div className="grid gap-3 sm:grid-cols-2">
                                        <div>
                                          <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted">
                                            Return date *
                                          </label>
                                          <input aria-label="Return date"
                                            className="input-field owner-focus"
                                            type="date"
                                            value={
                                              returnDateById[r.id] ??
                                              new Date().toISOString().slice(0, 10)
                                            }
                                            onChange={(e) =>
                                              setReturnDateById((m) => ({
                                                ...m,
                                                [r.id]: e.target.value,
                                              }))
                                            }
                                          />
                                        </div>
                                        <div>
                                          <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted">
                                            Transporter / vehicle *
                                          </label>
                                          <input aria-label="Transporter / vehicle"
                                            className="input-field owner-focus"
                                            value={returnVehicleById[r.id] ?? ''}
                                            onChange={(e) =>
                                              setReturnVehicleById((m) => ({
                                                ...m,
                                                [r.id]: e.target.value,
                                              }))
                                            }
                                            placeholder="Vehicle or transporter"
                                          />
                                        </div>
                                      </div>
                                      <div>
                                        <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted">
                                          Notes
                                        </label>
                                        <textarea aria-label="Notes"
                                          className="input-field owner-focus min-h-[72px]"
                                          value={returnNotesById[r.id] ?? ''}
                                          onChange={(e) =>
                                            setReturnNotesById((m) => ({
                                              ...m,
                                              [r.id]: e.target.value,
                                            }))
                                          }
                                          placeholder="Optional"
                                        />
                                      </div>
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          disabled={busy}
                                          className="btn btn-danger h-9"
                                          onClick={() => void sendBack(r)}
                                        >
                                          {busy ? 'Saving…' : 'Confirm send back'}
                                        </button>
                                        <button
                                          type="button"
                                          className="btn btn-ghost h-9"
                                          onClick={() => {
                                            setDispositionOpenId(null)
                                            setDispositionMode(null)
                                          }}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                                      <button
                                        type="button"
                                        disabled={busy}
                                        className="inline-flex h-10 items-center justify-center rounded-lg bg-owner px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                                        onClick={() => {
                                          setDispositionOpenId(r.id)
                                          setDispositionMode('discount')
                                        }}
                                      >
                                        Accept at discount
                                      </button>
                                      <button
                                        type="button"
                                        disabled={busy}
                                        className="inline-flex h-10 items-center justify-center rounded-lg border border-red-300/80 bg-panel px-4 text-sm font-medium text-red-600 hover:bg-red-500/5 disabled:opacity-40"
                                        onClick={() => {
                                          setDispositionOpenId(r.id)
                                          setDispositionMode('return')
                                          setReturnDateById((m) => ({
                                            ...m,
                                            [r.id]:
                                              m[r.id] || new Date().toISOString().slice(0, 10),
                                          }))
                                        }}
                                      >
                                        Send back to vendor
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : queue.length === 0 ? (
          <p className="text-sm text-muted">No receipts awaiting admin decision.</p>
        ) : (
          <div className="rounded-xl border border-border bg-panel shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                Pending approvals
              </p>
              <span className="rounded-full bg-owner/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-owner">
                {queue.length}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] text-left text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Material</th>
                    <th className="px-4 py-2.5 font-semibold">Vendor</th>
                    <th className="px-4 py-2.5 font-semibold">Lot / GRN</th>
                    <th className="px-4 py-2.5 font-semibold">Qty</th>
                    <th className="px-4 py-2.5 font-semibold">Results</th>
                    <th className="px-4 py-2.5 font-semibold">Status</th>
                    <th className="w-12 px-2 py-2.5 text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((r) => {
                    const logs = logsById[r.id] ?? []
                    const waitingLab = r.status === 'needs_info'
                    const canDecide = r.status === 'awaiting_admin'
                    const busy = actingId === r.id
                    const isOpen = expandedId === r.id
                    const rejectOpen = rejectOpenId === r.id
                    const requestOpen = requestOpenId === r.id
                    const selected = reasonsById[r.id] ?? []

                    return (
                      <Fragment key={r.id}>
                        <tr
                          className={`border-b border-border/60 last:border-b-0 ${
                            isOpen ? 'bg-owner/[0.06]' : 'hover:bg-surface/60'
                          }`}
                        >
                          <td className="px-4 py-3 font-medium text-primary">{r.material_type}</td>
                          <td className="px-4 py-3 text-muted">{r.vendor_name}</td>
                          <td className="px-4 py-3 font-mono text-[11px] text-muted">
                            {r.receipt_number}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-muted">
                            {r.received_qty} {r.unit}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex min-w-[1.5rem] justify-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                                logs.length > 0
                                  ? 'bg-owner/12 text-owner'
                                  : 'bg-surface text-muted'
                              }`}
                            >
                              {logs.length}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                waitingLab ? 'bg-pmc/10 text-pmc' : 'bg-owner/10 text-owner'
                              }`}
                            >
                              {waitingLab ? 'On lab' : 'Ready'}
                            </span>
                          </td>
                          <td className="px-2 py-3 text-right">
                            <button
                              type="button"
                              aria-label={isOpen ? 'Hide details' : 'View details'}
                              aria-expanded={isOpen}
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                                isOpen
                                  ? 'bg-owner/15 text-owner'
                                  : 'text-muted hover:bg-layer-sm hover:text-owner'
                              }`}
                              onClick={() => toggleExpand(r.id)}
                            >
                              {isOpen ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </td>
                        </tr>

                        {isOpen && (
                          <tr className="border-b border-border/60 bg-surface/40 last:border-b-0">
                            <td colSpan={7} className="px-4 py-4">
                              <div className="space-y-4">
                                <p className="text-xs text-muted">
                                  {r.received_qty} / {r.ordered_qty} {r.unit}
                                  <span className="mx-1.5 opacity-40">·</span>
                                  {r.received_date ?? '—'}
                                  {r.po_number ? (
                                    <>
                                      <span className="mx-1.5 opacity-40">·</span>
                                      PO {r.po_number}
                                    </>
                                  ) : null}
                                </p>

                                <div className="space-y-2">
                                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                                    Lab results · {logs.length}
                                  </p>
                                  <QcResultsTable logs={logs} />
                                </div>

                                {requestOpen ? (
                                  <div className="space-y-3 border-t border-border pt-4">
                                    <p className="text-sm font-medium text-primary">
                                      Request missing parameters
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {PARAM_TYPES.map((t) => {
                                        const on = requestTypes.includes(t.id)
                                        return (
                                          <button
                                            key={t.id}
                                            type="button"
                                            onClick={() =>
                                              setRequestTypes((cur) =>
                                                on
                                                  ? cur.filter((x) => x !== t.id)
                                                  : [...cur, t.id],
                                              )
                                            }
                                            className={`rounded-md px-2.5 py-1 text-xs ${
                                              on
                                                ? 'bg-owner/15 text-owner'
                                                : 'bg-layer-sm text-muted hover:text-primary'
                                            }`}
                                          >
                                            {t.label}
                                          </button>
                                        )
                                      })}
                                    </div>
                                    <input
                                      className="input-field owner-focus"
                                      placeholder="Note to lab (optional)"
                                      value={requestNote}
                                      onChange={(e) => setRequestNote(e.target.value)}
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        disabled={busy}
                                        className="btn btn-owner h-9"
                                        onClick={() => void requestParams(r.id)}
                                      >
                                        Send request
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-ghost h-9"
                                        onClick={() => setRequestOpenId(null)}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : rejectOpen ? (
                                  <div className="space-y-3 border-t border-border pt-4">
                                    <p className="text-sm font-medium text-primary">
                                      Reject criteria
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {REJECTION_CRITERIA.map((c) => {
                                        const on = selected.includes(c)
                                        return (
                                          <button
                                            key={c}
                                            type="button"
                                            onClick={() => toggleReason(r.id, c)}
                                            className={`rounded-md px-2.5 py-1 text-xs ${
                                              on
                                                ? 'bg-red-500/10 text-red-600'
                                                : 'bg-layer-sm text-muted hover:text-primary'
                                            }`}
                                          >
                                            {c}
                                          </button>
                                        )
                                      })}
                                    </div>
                                    {selected.includes('Other') && (
                                      <textarea
                                        className="input-field owner-focus min-h-[72px]"
                                        placeholder="Detail for Other"
                                        value={rejectDetailById[r.id] ?? ''}
                                        onChange={(e) =>
                                          setRejectDetailById((m) => ({
                                            ...m,
                                            [r.id]: e.target.value,
                                          }))
                                        }
                                      />
                                    )}
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        disabled={busy || selected.length === 0}
                                        className="btn btn-danger h-9 disabled:opacity-40"
                                        onClick={() => void reject(r.id)}
                                      >
                                        Confirm reject
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-ghost h-9"
                                        onClick={() => setRejectOpenId(null)}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <button
                                        type="button"
                                        disabled={busy || !canDecide}
                                        className="inline-flex h-10 items-center justify-center rounded-lg bg-owner px-4 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                                        onClick={() => void approve(r.id)}
                                        title={
                                          !canDecide
                                            ? 'Waiting for lab to finish requested tests'
                                            : 'Approve this receipt and create stock'
                                        }
                                      >
                                        {busy ? 'Approving…' : 'Approve & add to stock'}
                                      </button>
                                      <button
                                        type="button"
                                        disabled={busy || !canDecide}
                                        className="inline-flex h-10 items-center justify-center rounded-lg border border-red-300/80 bg-panel px-4 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/5 disabled:cursor-not-allowed disabled:opacity-40"
                                        onClick={() => {
                                          setRejectOpenId(r.id)
                                          setRequestOpenId(null)
                                        }}
                                        title={
                                          !canDecide
                                            ? 'Waiting for lab to finish requested tests'
                                            : 'Reject this receipt'
                                        }
                                      >
                                        Reject
                                      </button>
                                    </div>
                                    <button
                                      type="button"
                                      disabled={busy}
                                      className="inline-flex h-10 items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-owner disabled:opacity-40"
                                      onClick={() => {
                                        setRequestOpenId(r.id)
                                        setRejectOpenId(null)
                                        setRequestTypes([])
                                        setRequestNote('')
                                      }}
                                    >
                                      <MessageSquarePlus size={15} />
                                      Ask lab for more tests
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </div>
        </QcApproveShell>
      </div>
      {stickerReceipt ? (
        <QcRmStickerDrawer
          receipt={stickerReceipt}
          logs={logsById[stickerReceipt.id]}
          factoryId={factoryId}
          saving={stickerSaving}
          onClose={() => setStickerReceipt(null)}
          onPrint={printRmSticker}
        />
      ) : null}
    </AppLayout>
  )
}
