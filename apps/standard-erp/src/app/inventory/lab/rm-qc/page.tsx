'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CheckCircle2,
  Eye,
  EyeOff,
  FlaskConical,
  MoreVertical,
  Send,
} from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@madstoq/ui/erp-page-header'
import { useAuth } from '@/hooks/useAuth'
import { useInventoryFactory } from '@/contexts/InventoryFactoryContext'
import { useToast } from '@/components/providers/ToastProvider'
import { SkeletonPanel, SmartFilterBar, EmptyState, useConfirm, useSmartFilter } from '@/components/ui'
import { SortTh } from '@/components/inventory/SortTh'
import { procurementApi, qcLabApi } from '@/lib/api'
import ProcurementReceiptsBrowser, {
  type ProcurementReceiptRow,
} from '@/components/inventory/ProcurementReceiptsBrowser'
import QcLabResultForm, {
  QC_TYPE_LABEL,
  type QcInstrument,
  type QcLogEntry,
} from '@/components/inventory/QcLabResultForm'
import QcResultCard, { QcCoverageChips, firstCompletedQcType } from '@/components/inventory/QcResultCard'
import { DateRangeChip, inDateRange } from '@/components/inventory/DateRangeChip'
import { MobileCard, MobileListToolbar, MobileSheet, MobileTabs } from '@/components/inventory/MobileList'
import { MgmtDrawer } from '@/components/inventory/MgmtDrawer'
import { QcRmStickerDrawer } from '@/components/inventory/QcStickerPrint'
import { printRmQcSticker } from '@/lib/qc-sticker-print'
import type { RmQcStickerData } from '@/lib/qc-sticker'

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
  notes: string | null
  status: string
  supplier_invoice_no?: string | null
  vehicle_number?: string | null
}

type ParamRequest = {
  id: string
  requested_types: string[] | unknown
  note: string | null
  status: string
  created_at: string
}

type PendingStatus = 'pending_qc' | 'needs_info'

const PENDING_STATUS_OPTIONS: { id: PendingStatus; label: string }[] = [
  { id: 'pending_qc', label: 'Pending' },
  { id: 'needs_info', label: 'Needs info' },
]

type QcSort = 'material' | 'vendor' | 'receipt' | 'qty' | 'results' | 'status'

function pendingStatus(status: string): PendingStatus {
  return status === 'needs_info' ? 'needs_info' : 'pending_qc'
}

function pendingStatusLabel(status: string) {
  return pendingStatus(status) === 'needs_info' ? 'needs info' : 'pending'
}

export default function ChemistRmQcPage() {
  const { profile, loading: authLoading } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const { factoryId: ctxFactoryId } = useInventoryFactory()
  const factoryId = ctxFactoryId || profile?.factories?.[0]?.id || ''
  const [queue, setQueue] = useState<Receipt[]>([])
  const [history, setHistory] = useState<ProcurementReceiptRow[]>([])
  const [instruments, setInstruments] = useState<QcInstrument[]>([])
  const [logsById, setLogsById] = useState<Record<string, QcLogEntry[]>>({})
  const [reqsById, setReqsById] = useState<Record<string, ParamRequest[]>>({})
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [formOpenId, setFormOpenId] = useState<string | null>(null)
  const [submitId, setSubmitId] = useState<string | null>(null)
  const [editingLog, setEditingLog] = useState<QcLogEntry | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeQcTypeById, setActiveQcTypeById] = useState<Record<string, string>>({})
  const [menuId, setMenuId] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)
  const [tab, setTab] = useState<'queue' | 'all'>('queue')
  const [sortCol, setSortCol] = useState<QcSort>('receipt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [stickerReceipt, setStickerReceipt] = useState<ProcurementReceiptRow | null>(null)
  const [stickerSaving, setStickerSaving] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)


  useEffect(() => {
    if (!menuId) return
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        const t = e.target as HTMLElement
        if (t.closest('[data-qc-menu-trigger]')) return
        setMenuId(null)
        setMenuPos(null)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMenuId(null)
        setMenuPos(null)
      }
    }
    function onScroll() {
      setMenuId(null)
      setMenuPos(null)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [menuId])

  function openMenu(id: string, el: HTMLElement) {
    const rect = el.getBoundingClientRect()
    setMenuId(id)
    setMenuPos({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    })
  }

  function closeMenu() {
    setMenuId(null)
    setMenuPos(null)
  }

  useEffect(() => {
    if (!formOpenId) return
    const t = window.setTimeout(() => {
      document.getElementById('qc-inline-editor')?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
    }, 50)
    return () => window.clearTimeout(t)
  }, [formOpenId, editingLog?.id])

  const reload = useCallback(async (opts?: { silent?: boolean }) => {
    if (!factoryId) {
      setQueue([])
      setHistory([])
      setLoading(false)
      setHistoryLoading(false)
      return
    }
    const silent = opts?.silent === true
    if (!silent) {
      setLoading(true)
    }
        const [queueRes, instRes] = await Promise.all([
      procurementApi.listReceipts(factoryId, 'pending_qc,needs_info'),
      qcLabApi.listInstruments(factoryId),
    ])
    if (queueRes.error) toast.error(queueRes.error)
    if (instRes.error) toast.error(instRes.error)
    const labQueue = ((queueRes.receipts ?? []) as Receipt[]).sort((a, b) => {
      if (a.status === b.status) return 0
      if (a.status === 'needs_info') return -1
      if (b.status === 'needs_info') return 1
      return 0
    })
    setQueue(labQueue)
    setHistoryLoaded(false)
    setInstruments((instRes.instruments ?? []) as QcInstrument[])
    if (!silent) {
      setLoading(false)
    }

    const ids = labQueue.map((r) => r.id)
    const [logsRes, reqsRes] = await Promise.all([
      qcLabApi.listLogs(factoryId, ids, 'rm'),
      qcLabApi.listParamRequests(factoryId, ids, 'rm'),
    ])
    const logMap: Record<string, QcLogEntry[]> = {}
    const reqMap: Record<string, ParamRequest[]> = {}
    for (const id of ids) {
      logMap[id] = []
      reqMap[id] = []
    }
    for (const entry of (logsRes.entries ?? []) as QcLogEntry[]) {
      const sid = (entry as QcLogEntry & { subject_id?: string }).subject_id
      if (sid) (logMap[sid] ??= []).push(entry)
    }
    for (const req of (reqsRes.requests ?? []) as (ParamRequest & { subject_id?: string })[]) {
      if (req.subject_id) (reqMap[req.subject_id] ??= []).push(req)
    }
    setLogsById(logMap)
    setReqsById(reqMap)
    setExpandedId((prev) => {
      if (prev && labQueue.some((r) => r.id === prev)) return prev
      return null
    })
    setFormOpenId((prev) => {
      if (prev && labQueue.some((r) => r.id === prev)) return prev
      return null
    })
  }, [factoryId])

  useEffect(() => {
    if (tab !== 'all' || !factoryId || historyLoaded) return
    let cancelled = false
    setHistoryLoading(true)
    void procurementApi.listReceipts(factoryId).then((res) => {
      if (cancelled) return
      if (res.error) toast.error(res.error)
      setHistory((res.receipts ?? []) as unknown as ProcurementReceiptRow[])
      setHistoryLoaded(true)
      setHistoryLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [tab, factoryId, historyLoaded, toast])

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

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
    setHistory((rows) =>
      rows.map((r) =>
        r.id === stickerReceipt.id
          ? { ...r, status: 'approved_printed', sticker_data: sticker }
          : r,
      ),
    )
    setStickerReceipt(null)
    return true
  }

  const filter = useSmartFilter(queue, {
    getSearchText: (r) => [
      r.material_type,
      r.vendor_name,
      r.receipt_number,
      r.po_number,
      pendingStatusLabel(r.status),
    ],
    facets: [
      { key: 'material', label: 'Material', getValue: (r) => r.material_type },
      {
        key: 'status',
        label: 'Status',
        getValue: (r) => pendingStatus(r.status),
        formatValue: (id) => PENDING_STATUS_OPTIONS.find((o) => o.id === id)?.label ?? id,
        options: PENDING_STATUS_OPTIONS,
      },
    ],
  })

  const sortedQueue = useMemo(() => {
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
        case 'results':
          cmp = (logsById[a.id]?.length ?? 0) - (logsById[b.id]?.length ?? 0)
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
  }, [filter.filtered, sortCol, sortDir, logsById, dateFrom, dateTo])

  function handleSort(col: QcSort) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir(col === 'qty' || col === 'results' || col === 'receipt' ? 'desc' : 'asc')
    }
  }

  async function saveLog(
    receipt: Receipt,
    data: {
      id?: string
      instrument_id: string
      entry_date: string
      sample_name: string
      remarks?: string
      payload: Record<string, unknown>
    },
  ) {
    setSavingId(receipt.id)
        const res = await qcLabApi.saveLog({
      ...data,
      factory_id: factoryId,
      subject_id: receipt.id,
      stage: 'rm',
    })
    setSavingId(null)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success('Lab result saved')
    setFormOpenId(null)
    setEditingLog(null)
    await reload({ silent: true })
  }

  async function removeLog(receiptId: string, logId: string) {
    const ok = await confirm({
      title: 'Delete lab result?',
      body: 'The recorded QC values for this test will be removed from the receipt. This cannot be undone.',
      confirmLabel: 'Delete result',
      destructive: true,
    })
    if (!ok) return
    setSavingId(receiptId)
        const res = await qcLabApi.deleteLog(logId)
    setSavingId(null)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success('Lab result removed')
    await reload({ silent: true })
  }

  async function submit(receiptId: string) {
    setSavingId(receiptId)
        const res = await qcLabApi.submitReceipt(receiptId)
    setSavingId(null)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success('Submitted for admin review')
    setSubmitId(null)
    await reload({ silent: true })
  }

  const formReceipt = formOpenId ? queue.find((r) => r.id === formOpenId) ?? null : null
  const submitReceipt = submitId ? queue.find((r) => r.id === submitId) ?? null : null

  return (
    <AppLayout>
      <div className="w-full p-4 md:p-8">
        <div className="mb-8 hidden lg:block">
        <PageHeader
          title="RM QC Lab"
          subtitle="Lab Incharge · enter lab results, then submit for admin approval"
          accent="chemist"
        />
        </div>

        <div className="md:hidden">
          <MobileTabs
            ariaLabel="RM QC Lab"
            active={tab}
            onChange={setTab}
            tabs={[
              { key: 'queue', label: 'Pending' },
              { key: 'all', label: 'All' },
            ]}
          />
          {tab === 'all' ? (
            <ProcurementReceiptsBrowser
              receipts={history}
              loading={historyLoading}
              accent="chemist"
              factoryId={factoryId}
              onPrintSticker={setStickerReceipt}
            />
          ) : loading ? (
            <p className="py-4 text-sm text-muted">Loading…</p>
          ) : instruments.length === 0 ? (
            <p className="py-4 text-sm text-muted">
              No QC instruments configured for this factory. Run Ananta seed / add instruments.
            </p>
          ) : queue.length === 0 ? (
            <EmptyState className="rounded-xl bg-panel" title="No receipts waiting on lab entry." />
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
                resultCount={sortedQueue.length}
                noun={{ one: 'lot', many: 'lots' }}
                sortOptions={[
                  { col: 'material', label: 'Material', kind: 'text' },
                  { col: 'vendor', label: 'Vendor', kind: 'text' },
                  { col: 'receipt', label: 'Lot / GRN', kind: 'text' },
                  { col: 'qty', label: 'Qty', kind: 'number' },
                  { col: 'results', label: 'Results', kind: 'number' },
                  { col: 'status', label: 'Status', kind: 'text' },
                ]}
                sortCol={sortCol}
                sortDir={sortDir}
                onSort={handleSort}
              />
              {sortedQueue.length === 0 ? (
                <EmptyState className="rounded-xl bg-panel" title="No receipts match your search or filter." />
              ) : (
                <div className="space-y-3">
                  {sortedQueue.map((r) => {
                    const logs = logsById[r.id] ?? []
                    const needs = r.status === 'needs_info'
                    const busy = savingId === r.id
                    const isOpen = expandedId === r.id
                    const canSubmit = logs.length > 0 && !busy
                    const selectedType =
                      activeQcTypeById[r.id] ?? firstCompletedQcType(instruments, logs)
                    const selectedLog = logs.find((l) => l.instrument_type === selectedType) ?? null
                    return (
                      <MobileCard
                        key={r.id}
                        id={
                          <span className="flex items-center justify-between gap-3">
                            <span className="min-w-0 truncate">{r.receipt_number}</span>
                            <span
                              className={`badge shrink-0 ${needs ? 'badge-pmc' : 'badge-chemist'}`}
                            >
                              {needs ? 'Needs info' : 'Pending'}
                            </span>
                          </span>
                        }
                        title={r.material_type}
                        subtitle={r.vendor_name}
                        aside={
                          <>
                            <span className="block text-base font-medium tabular-nums text-chemist">
                              {r.received_qty} {r.unit}
                            </span>
                            <span className="block text-[10px] uppercase tracking-wider text-muted">
                              {logs.length} tests
                            </span>
                          </>
                        }
                        expanded={isOpen}
                        onToggleExpand={() => {
                          setExpandedId(isOpen ? null : r.id)
                        }}
                        details={
                          <div className="space-y-3 text-left">
                            <p className="text-xs text-muted">
                              Ordered {r.ordered_qty} {r.unit}
                              {' · '}
                              Received {r.received_qty} {r.unit}
                              {' · '}
                              {r.received_date ?? '—'}
                              {r.po_number ? ` · PO ${r.po_number}` : ''}
                            </p>
                            {(reqsById[r.id] ?? []).filter((x) => x.status === 'open').length > 0 ? (
                              <div className="rounded-lg border border-pmc/25 bg-pmc/5 px-3 py-2 text-xs">
                                <p className="font-medium text-pmc">Admin asked for more results</p>
                                {(reqsById[r.id] ?? [])
                                  .filter((x) => x.status === 'open')
                                  .map((req) => (
                                    <p key={req.id} className="mt-0.5 text-muted">
                                      {(Array.isArray(req.requested_types)
                                        ? req.requested_types
                                        : []
                                      ).join(', ')}
                                      {req.note ? ` — ${req.note}` : ''}
                                    </p>
                                  ))}
                              </div>
                            ) : null}
                            {instruments.length > 0 ? (
                              <QcCoverageChips
                                instruments={instruments}
                                logs={logs}
                                activeType={selectedType}
                                onSelect={(type) => {
                                  setActiveQcTypeById((m) => ({ ...m, [r.id]: type }))
                                }}
                              />
                            ) : null}
                            {selectedLog ? (
                              <QcResultCard
                                key={selectedLog.id}
                                log={selectedLog}
                                onEdit={() => {
                                  setFormOpenId(r.id)
                                  setEditingLog(selectedLog)
                                }}
                                onDelete={() => void removeLog(r.id, selectedLog.id)}
                              />
                            ) : (
                              <p className="text-sm text-muted">
                                No lab results yet. Use Add test to enter results.
                              </p>
                            )}
                          </div>
                        }
                        footer={
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="btn min-w-0 flex-1 border border-text bg-panel px-3 text-primary"
                              onClick={() => {
                                setEditingLog(null)
                                setFormOpenId(r.id)
                              }}
                            >
                              Add test
                            </button>
                            <button
                              type="button"
                              disabled={!canSubmit}
                              className="btn min-w-0 flex-1 border border-chemist bg-chemist px-3 text-white disabled:opacity-40"
                              onClick={() => setSubmitId(r.id)}
                            >
                              Submit for review
                            </button>
                          </div>
                        }
                      />
                    )
                  })}
                </div>
              )}
            </>
          )}
          {formReceipt ? (
            <MgmtDrawer
              title={editingLog ? 'Edit result' : 'Add test'}
              eyebrow={formReceipt.receipt_number}
              subtitle={`${formReceipt.material_type} · ${formReceipt.vendor_name}`}
              onClose={() => {
                setFormOpenId(null)
                setEditingLog(null)
              }}
            >
              <QcLabResultForm
                key={editingLog?.id ?? `m-new-${formReceipt.id}`}
                instruments={instruments}
                sampleDefault={formReceipt.material_type}
                existing={editingLog}
                lockType={Boolean(editingLog)}
                excludeTypes={
                  editingLog
                    ? undefined
                    : (logsById[formReceipt.id] ?? [])
                        .map((l) => l.instrument_type)
                        .filter((t): t is string => Boolean(t))
                }
                saving={savingId === formReceipt.id}
                onSave={(data) => saveLog(formReceipt, data)}
                onCancel={() => {
                  setFormOpenId(null)
                  setEditingLog(null)
                }}
              />
            </MgmtDrawer>
          ) : null}
        </div>
        {submitReceipt && typeof document !== 'undefined'
          ? createPortal(
              <MobileSheet
                title="Submit for review?"
                onClose={() => setSubmitId(null)}
                footer={
                  <>
                    <button
                      type="button"
                      className="btn min-w-0 flex-1 border border-text bg-panel text-primary"
                      onClick={() => setSubmitId(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={savingId === submitReceipt.id}
                      className="btn min-w-0 flex-1 border border-chemist bg-chemist text-white disabled:opacity-40"
                      onClick={() => void submit(submitReceipt.id)}
                    >
                      {savingId === submitReceipt.id ? 'Submitting…' : 'Confirm'}
                    </button>
                  </>
                }
              >
                <p className="text-sm text-primary">
                  Submit {submitReceipt.material_type} ({submitReceipt.receipt_number}) to admin for
                  review?
                </p>
                <p className="mt-2 text-sm text-muted">
                  {(logsById[submitReceipt.id] ?? []).length} recorded test
                  {(logsById[submitReceipt.id] ?? []).length === 1 ? '' : 's'} will be sent. You
                  cannot add tests until they review it.
                </p>
              </MobileSheet>,
              document.body,
            )
          : null}

        <div className="hidden md:block">
        <div className="folder-tabs" role="tablist" aria-label="RM QC Lab">
          {(
            [
              { key: 'queue' as const, label: 'Pending QC' },
              { key: 'all' as const, label: 'All receipts' },
            ] as const
          ).map((t) => {
            const on = tab === t.key
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t.key)}
                className={on ? 'folder-tab is-active' : 'folder-tab'}
              >
                {t.label}
              </button>
            )
          })}
        </div>
        <section className="folder-panel overflow-hidden">
        {tab === 'all' ? (
          <div className="p-4">
          <ProcurementReceiptsBrowser
            receipts={history}
            loading={historyLoading}
            accent="chemist"
            factoryId={factoryId}
            onPrintSticker={setStickerReceipt}
          />
          </div>
        ) : loading ? (
          <div className="p-4">
          <SkeletonPanel />
          </div>
        ) : instruments.length === 0 ? (
          <p className="p-4 text-sm text-muted">
            No QC instruments configured for this factory. Run Ananta seed / add instruments.
          </p>
        ) : queue.length === 0 ? (
          <p className="p-4 text-sm text-muted">No receipts waiting on lab entry.</p>
        ) : (
          <>
            <div className="border-b border-border p-4">
              <SmartFilterBar
                filter={filter}
                placeholder="Search material, vendor, lot…"
                accent="chemist"
                chipExtras={
                  <DateRangeChip
                    from={dateFrom}
                    to={dateTo}
                    onChange={(from, to) => {
                      setDateFrom(from)
                      setDateTo(to)
                    }}
                  />
                }
              />
            </div>
            {sortedQueue.length === 0 ? (
              <p className="p-4 text-sm text-muted">No receipts match your search or filter.</p>
            ) : (
            <div className="overflow-x-auto">
              <table className="data-table min-w-[40rem]">
                <thead>
                  <tr>
                    <SortTh label="Material" col="material" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="chemist" />
                    <SortTh label="Vendor" col="vendor" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="chemist" />
                    <SortTh label="Lot / GRN" col="receipt" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="chemist" />
                    <SortTh label="Qty" col="qty" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="chemist" />
                    <SortTh label="Results" col="results" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="chemist" />
                    <SortTh label="Status" col="status" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="chemist" />
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedQueue.map((r) => {
                    const logs = logsById[r.id] ?? []
                    const needs = r.status === 'needs_info'
                    const busy = savingId === r.id
                    const isOpen = expandedId === r.id
                    const openReqs = (reqsById[r.id] ?? []).filter((x) => x.status === 'open')
                    const canSubmit = logs.length > 0 && !busy

                    return (
                      <Fragment key={r.id}>
                        <tr
                          className={`border-b border-border/60 last:border-b-0 ${
                            isOpen ? 'bg-chemist/[0.05]' : 'hover:bg-surface/60'
                          }`}
                        >
                          <td className="px-4 py-3 font-medium text-primary">
                            {r.material_type}
                          </td>
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
                                  ? 'bg-chemist/12 text-chemist'
                                  : 'bg-surface text-muted'
                              }`}
                            >
                              {logs.length}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                needs
                                  ? 'bg-pmc/10 text-pmc'
                                  : 'bg-chemist/10 text-chemist'
                              }`}
                            >
                              {needs ? 'Needs info' : 'Pending'}
                            </span>
                          </td>
                          <td className="px-2 py-3 text-right">
                            <button
                              type="button"
                              data-qc-menu-trigger
                              aria-label="Row actions"
                              aria-expanded={menuId === r.id}
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                                menuId === r.id
                                  ? 'bg-chemist/15 text-chemist'
                                  : 'text-muted hover:bg-layer-sm hover:text-primary'
                              }`}
                              onClick={(e) => {
                                if (menuId === r.id) {
                                  closeMenu()
                                  return
                                }
                                openMenu(r.id, e.currentTarget)
                              }}
                            >
                              <MoreVertical size={16} />
                            </button>
                          </td>
                        </tr>

                        {isOpen && (
                          <tr className="border-b border-border/60 bg-surface/40 last:border-b-0">
                            <td colSpan={7} className="px-4 py-4">
                              <div className="space-y-4">
                                <p className="text-xs text-muted">
                                  Ordered {r.ordered_qty} {r.unit}
                                  <span className="mx-1.5 opacity-40">·</span>
                                  Received {r.received_qty} {r.unit}
                                  <span className="mx-1.5 opacity-40">·</span>
                                  {r.received_date ?? '—'}
                                  {r.po_number ? (
                                    <>
                                      <span className="mx-1.5 opacity-40">·</span>
                                      PO {r.po_number}
                                    </>
                                  ) : null}
                                </p>

                                {openReqs.length > 0 && (
                                  <div className="rounded-lg border border-pmc/25 bg-pmc/5 px-3 py-2 text-xs">
                                    <p className="font-medium text-pmc">
                                      Admin asked for more results
                                    </p>
                                    {openReqs.map((req) => (
                                      <p key={req.id} className="mt-0.5 text-muted">
                                        {(Array.isArray(req.requested_types)
                                          ? req.requested_types
                                          : []
                                        ).join(', ')}
                                        {req.note ? ` — ${req.note}` : ''}
                                      </p>
                                    ))}
                                  </div>
                                )}

                                {instruments.length > 0 && (
                                  <QcCoverageChips instruments={instruments} logs={logs} />
                                )}

                                {logs.length > 0 && (
                                  <div className="space-y-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                                      Results · {logs.length}
                                    </p>
                                    <div className="space-y-2">
                                      {logs.map((log) =>
                                        formOpenId === r.id && editingLog?.id === log.id ? (
                                          <div
                                            key={log.id}
                                            id="qc-inline-editor"
                                            className="rounded-xl border border-chemist/35 bg-panel p-4"
                                          >
                                            <p className="mb-3 text-sm font-semibold text-primary">
                                              Edit result
                                              <span className="ml-2 text-xs font-normal text-muted">
                                                {log.instrument_type
                                                  ? QC_TYPE_LABEL[log.instrument_type] ||
                                                    log.instrument_type
                                                  : ''}
                                              </span>
                                            </p>
                                            <QcLabResultForm
                                              key={log.id}
                                              instruments={instruments}
                                              sampleDefault={r.material_type}
                                              existing={editingLog}
                                              lockType
                                              saving={savingId === r.id}
                                              onSave={(data) => saveLog(r, data)}
                                              onCancel={() => {
                                                setFormOpenId(null)
                                                setEditingLog(null)
                                              }}
                                            />
                                          </div>
                                        ) : (
                                          <QcResultCard
                                            key={log.id}
                                            log={log}
                                            onEdit={
                                              formOpenId
                                                ? undefined
                                                : () => {
                                                    setExpandedId(r.id)
                                                    setFormOpenId(r.id)
                                                    setEditingLog(log)
                                                  }
                                            }
                                            onDelete={
                                              formOpenId
                                                ? undefined
                                                : () => void removeLog(r.id, log.id)
                                            }
                                          />
                                        ),
                                      )}
                                    </div>
                                  </div>
                                )}

                                {logs.length === 0 && formOpenId !== r.id && (
                                  <p className="text-sm text-muted">
                                    No lab results yet. Use Add test to enter results.
                                  </p>
                                )}

                                {formOpenId === r.id && !editingLog && (
                                  <div
                                    id="qc-inline-editor"
                                    className="rounded-xl border border-chemist/35 bg-panel p-4"
                                  >
                                    <p className="mb-3 text-sm font-semibold text-primary">
                                      Add lab result
                                    </p>
                                    <QcLabResultForm
                                      key={`new-${r.id}`}
                                      instruments={instruments}
                                      sampleDefault={r.material_type}
                                      existing={null}
                                      excludeTypes={logs
                                        .map((l) => l.instrument_type)
                                        .filter((t): t is string => Boolean(t))}
                                      saving={savingId === r.id}
                                      onSave={(data) => saveLog(r, data)}
                                      onCancel={() => {
                                        setFormOpenId(null)
                                        setEditingLog(null)
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}

                        {menuId === r.id &&
                          menuPos &&
                          typeof document !== 'undefined' &&
                          createPortal(
                            <div
                              ref={menuRef}
                              className="fixed z-[80] w-48 overflow-hidden rounded-xl border border-border bg-panel py-1 shadow-xl"
                              style={{ top: menuPos.top, right: menuPos.right }}
                            >
                              <button
                                type="button"
                                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs text-primary hover:bg-surface"
                                onClick={() => {
                                  closeMenu()
                                  if (isOpen && formOpenId !== r.id) {
                                    setExpandedId(null)
                                    setFormOpenId(null)
                                    setEditingLog(null)
                                    return
                                  }
                                  setExpandedId(r.id)
                                  setFormOpenId(null)
                                  setEditingLog(null)
                                }}
                              >
                                {isOpen && formOpenId !== r.id ? (
                                  <EyeOff size={14} className="text-muted" />
                                ) : (
                                  <Eye size={14} className="text-muted" />
                                )}
                                {isOpen && formOpenId !== r.id ? 'Hide details' : 'View details'}
                              </button>
                              <button
                                type="button"
                                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs text-primary hover:bg-surface"
                                onClick={() => {
                                  closeMenu()
                                  setExpandedId(r.id)
                                  setEditingLog(null)
                                  setFormOpenId(r.id)
                                }}
                              >
                                <FlaskConical size={14} className="text-muted" />
                                Add test
                              </button>
                              <div className="my-1 border-t border-border/70" />
                              <button
                                type="button"
                                disabled={!canSubmit}
                                title={
                                  logs.length === 0
                                    ? 'Add at least one result first'
                                    : undefined
                                }
                                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-chemist hover:bg-chemist/10 disabled:cursor-not-allowed disabled:opacity-40"
                                onClick={() => {
                                  closeMenu()
                                  void submit(r.id)
                                }}
                              >
                                {busy ? (
                                  <Send size={14} className="opacity-60" />
                                ) : (
                                  <CheckCircle2 size={14} />
                                )}
                                {busy ? 'Submitting…' : 'Submit for admin'}
                              </button>
                            </div>,
                            document.body,
                          )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
            )}
          </>
        )}
        </section>
        </div>
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
