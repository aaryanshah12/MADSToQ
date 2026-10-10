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
import { productionApi, qcLabApi } from '@/lib/api'
import QcLabResultForm, {
  FG_COA_CHECK_TYPES,
  QC_TYPE_LABEL,
  type QcInstrument,
  type QcLogEntry,
} from '@/components/inventory/QcLabResultForm'
import QcResultCard, { QcCoverageChips, firstCompletedQcType } from '@/components/inventory/QcResultCard'
import FgQcBatchesBrowser, {
  type FgQcHistoryRow,
} from '@/components/inventory/FgQcBatchesBrowser'
import { DateRangeChip, inDateRange } from '@/components/inventory/DateRangeChip'
import { MobileCard, MobileListToolbar, MobileSheet, MobileTabs } from '@/components/inventory/MobileList'
import { MgmtDrawer } from '@/components/inventory/MgmtDrawer'
import { QcPackStickerDrawer } from '@/components/inventory/QcStickerPrint'
import { printPackQcStickers } from '@/lib/qc-sticker-print'
import { parsePackStickerJob, type PackStickerJob } from '@/lib/qc-sticker'

type FgQcSnapshot = {
  batch_no?: string
  product_code?: string
  product_name?: string
  vessel?: string | null
  finished_products?: Array<{
    name: string
    qty: number
    unit?: string
    requires_qc?: boolean
  }>
  raw_materials?: Array<{
    material_name: string
    qty: number
    unit?: string
    lot_invoice?: string | null
    lot_slot?: number | null
  }>
}

/** Outputs included when the batch was sent for SFG QC. */
function finishesForQc(snap: FgQcSnapshot | null | undefined) {
  return (snap?.finished_products ?? []).filter((f) => f.requires_qc !== false)
}

function forQcSummary(
  finishes: Array<{ name: string; qty: number }>,
): string {
  if (finishes.length === 0) return '—'
  return finishes.map((f) => f.name).join(', ')
}


type FgBatch = {
  id: string
  batch_no: string
  product_code: string | null
  product_name: string | null
  vessel: string | null
  status: string
  qc_status: string
  qc_sent_at: string | null
  qc_snapshot: FgQcSnapshot | null
  completed_at: string | null
  created_by_name: string | null
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

function productCode(b: FgBatch) {
  return b.product_code || b.qc_snapshot?.product_code || '—'
}

type QcSort = 'batch' | 'product' | 'vessel' | 'forQc' | 'results' | 'status'

function pendingStatus(status: string): PendingStatus {
  return status === 'needs_info' ? 'needs_info' : 'pending_qc'
}

function pendingStatusLabel(status: string) {
  return pendingStatus(status) === 'needs_info' ? 'needs info' : 'pending'
}

export default function LabFgQcPage() {
  const { profile, loading: authLoading } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const { factoryId: ctxFactoryId } = useInventoryFactory()
  const factoryId = ctxFactoryId || profile?.factories?.[0]?.id || ''
  const [queue, setQueue] = useState<FgBatch[]>([])
  const [history, setHistory] = useState<FgQcHistoryRow[]>([])
  const [instruments, setInstruments] = useState<QcInstrument[]>([])
  const [logsById, setLogsById] = useState<Record<string, QcLogEntry[]>>({})
  const [reqsById, setReqsById] = useState<Record<string, ParamRequest[]>>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [formOpenId, setFormOpenId] = useState<string | null>(null)
  const [submitId, setSubmitId] = useState<string | null>(null)
  const [editingLog, setEditingLog] = useState<QcLogEntry | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeQcTypeById, setActiveQcTypeById] = useState<Record<string, string>>({})
  const [menuId, setMenuId] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)
  const [tab, setTab] = useState<'queue' | 'all'>('queue')
  const [qcKind, setQcKind] = useState<'sfg' | 'fg'>('sfg')
  const fgChecks = qcKind === 'fg' ? [...FG_COA_CHECK_TYPES] : []
  const [sortCol, setSortCol] = useState<QcSort>('batch')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [stickerBatch, setStickerBatch] = useState<FgQcHistoryRow | null>(null)
  const [stickerSaving, setStickerSaving] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
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

  const reload = useCallback(
    async (opts?: { silent?: boolean }) => {
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

      const [instRes, queueRes] = await Promise.all([
        qcLabApi.listInstruments(factoryId),
        productionApi.listBatches(factoryId, {
          qc_status: 'pending_qc,needs_info',
          kind: qcKind,
        }),
      ])
      if (instRes.error) toast.error(instRes.error)
      if (queueRes.error) toast.error(queueRes.error)

      const labQueue = ((queueRes.batches ?? []) as FgBatch[]).sort((a, b) => {
        if (a.qc_status === b.qc_status) {
          const ta = a.qc_sent_at ? new Date(a.qc_sent_at).getTime() : 0
          const tb = b.qc_sent_at ? new Date(b.qc_sent_at).getTime() : 0
          return tb - ta
        }
        if (a.qc_status === 'needs_info') return -1
        if (b.qc_status === 'needs_info') return 1
        return 0
      })

      setQueue(labQueue)
      setHistoryLoaded(false)
      setInstruments((instRes.instruments ?? []) as QcInstrument[])
      if (!silent) {
        setLoading(false)
      }

      const ids = labQueue.map((b) => b.id)
      const [logsRes, reqsRes] = await Promise.all([
        qcLabApi.listLogs(factoryId, ids, qcKind),
        qcLabApi.listParamRequests(factoryId, ids, 'sfg'),
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
        if (prev && labQueue.some((b) => b.id === prev)) return prev
        return null
      })
      setFormOpenId((prev) => {
        if (prev && labQueue.some((b) => b.id === prev)) return prev
        return null
      })
    },
    [factoryId, qcKind],
  )

  useEffect(() => {
    if (tab !== 'all' || !factoryId || historyLoaded) return
    let cancelled = false
    setHistoryLoading(true)
    void productionApi.listBatches(factoryId, { qc_status: 'sent', kind: qcKind }).then((res) => {
      if (cancelled) return
      if (res.error) toast.error(res.error)
      setHistory((res.batches ?? []) as FgQcHistoryRow[])
      setHistoryLoaded(true)
      setHistoryLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [tab, factoryId, historyLoaded, toast, qcKind])

  useEffect(() => {
    setHistoryLoaded(false)
    setHistory([])
    setDateFrom('')
    setDateTo('')
  }, [qcKind])

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  async function printPackSticker(job: PackStickerJob) {
    if (!stickerBatch) return false
    setStickerSaving(true)
    const result = await productionApi.printPackSticker({ id: stickerBatch.id, sticker: job })
    setStickerSaving(false)
    if (result.error) {
      toast.error(result.error)
      return false
    }
    const saved = parsePackStickerJob(result.sticker ?? result.batch?.sticker_data) ?? job
    const ok = printPackQcStickers(saved.labels.length ? saved.labels : job.labels)
    if (!ok) toast.error('Allow pop-ups to print the drum labels')
    setHistory((rows) =>
      rows.map((r) =>
        r.id === stickerBatch.id
          ? { ...r, qc_status: 'approved_printed', sticker_data: saved }
          : r,
      ),
    )
    setStickerBatch(null)
    return true
  }

  const filter = useSmartFilter(queue, {
    getSearchText: (b) => [
      b.batch_no,
      productCode(b),
      b.product_name || b.qc_snapshot?.product_name,
      b.vessel || b.qc_snapshot?.vessel,
      forQcSummary(finishesForQc(b.qc_snapshot)),
      pendingStatusLabel(b.qc_status),
    ],
    facets: [
      { key: 'product', label: 'Product', getValue: (b) => productCode(b) },
      {
        key: 'status',
        label: 'Status',
        getValue: (b) => pendingStatus(b.qc_status),
        formatValue: (id) => PENDING_STATUS_OPTIONS.find((o) => o.id === id)?.label ?? id,
        options: PENDING_STATUS_OPTIONS,
      },
    ],
  })

  useEffect(() => {
    filter.setSearch('')
    filter.clearAll()
  }, [qcKind])

  const sortedQueue = useMemo(() => {
    let rows = filter.filtered.filter((b) =>
      inDateRange(b.qc_sent_at || b.completed_at, dateFrom, dateTo),
    )

    const dir = sortDir === 'asc' ? 1 : -1
    rows = [...rows].sort((a, b) => {
      const snapA = a.qc_snapshot
      const snapB = b.qc_snapshot
      let cmp = 0
      switch (sortCol) {
        case 'product':
          cmp = productCode(a).localeCompare(productCode(b))
          break
        case 'vessel':
          cmp = (a.vessel || snapA?.vessel || '').localeCompare(b.vessel || snapB?.vessel || '')
          break
        case 'forQc':
          cmp = forQcSummary(finishesForQc(snapA)).localeCompare(forQcSummary(finishesForQc(snapB)))
          break
        case 'results':
          cmp = (logsById[a.id]?.length ?? 0) - (logsById[b.id]?.length ?? 0)
          break
        case 'status':
          cmp = a.qc_status.localeCompare(b.qc_status)
          break
        case 'batch':
        default:
          cmp = a.batch_no.localeCompare(b.batch_no, undefined, { numeric: true })
          break
      }
      return cmp * dir || a.batch_no.localeCompare(b.batch_no)
    })
    return rows
  }, [filter.filtered, sortCol, sortDir, logsById, dateFrom, dateTo])

  function handleSort(col: QcSort) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir(col === 'results' || col === 'batch' ? 'desc' : 'asc')
    }
  }

  function sampleDefault(batch: FgBatch) {
    const finished = finishesForQc(batch.qc_snapshot)
    if (finished[0]?.name) return finished[0].name
    return (
      batch.product_name ||
      batch.qc_snapshot?.product_name ||
      batch.product_code ||
      batch.qc_snapshot?.product_code ||
      batch.batch_no
    )
  }

  async function saveLog(
    batch: FgBatch,
    data: {
      id?: string
      instrument_id?: string
      result_kind?: 'description' | 'identification'
      entry_date: string
      sample_name: string
      remarks?: string
      payload: Record<string, unknown>
    },
  ) {
    setSavingId(batch.id)
    const res = await qcLabApi.saveLog({
      ...data,
      factory_id: factoryId,
      subject_id: batch.id,
      stage: qcKind,
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

  async function removeLog(batchId: string, logId: string) {
    const ok = await confirm({
      title: 'Delete lab result?',
      body: 'The recorded QC values for this test will be removed from the batch. This cannot be undone.',
      confirmLabel: 'Delete result',
      destructive: true,
    })
    if (!ok) return
    setSavingId(batchId)
    const res = await qcLabApi.deleteLog(logId)
    setSavingId(null)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success('Lab result removed')
    await reload({ silent: true })
  }

  async function submit(batchId: string) {
    setSavingId(batchId)
    const res = await qcLabApi.submitBatch(batchId, qcKind)
    setSavingId(null)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success('Submitted for admin review')
    setSubmitId(null)
    await reload({ silent: true })
  }

  const formBatch = formOpenId ? queue.find((b) => b.id === formOpenId) ?? null : null
  const submitBatch = submitId ? queue.find((b) => b.id === submitId) ?? null : null

  return (
    <AppLayout>
      <div className="w-full p-4 md:p-8">
        <div className="mb-8 hidden lg:block">
        <PageHeader
          title={qcKind === 'fg' ? 'FG QC Lab' : 'SFG QC Lab'}
          subtitle={
            qcKind === 'fg'
              ? 'Lab Incharge · enter finished-goods results, then submit for admin approval'
              : 'Lab Incharge · enter semi-finished results, then submit for admin approval'
          }
          accent="chemist"
        />
        </div>

        <div className="md:hidden">
          <MobileTabs
            ariaLabel="QC lab"
            active={qcKind}
            onChange={setQcKind}
            tabs={[
              { key: 'sfg', label: 'SFG QC' },
              { key: 'fg', label: 'FG QC' },
            ]}
          />
          <MobileTabs
            ariaLabel={`${qcKind === 'fg' ? 'FG' : 'SFG'} QC sections`}
            active={tab}
            onChange={setTab}
            tabs={[
              { key: 'queue', label: 'Pending' },
              { key: 'all', label: 'All' },
            ]}
          />
          {tab === 'all' ? (
            <FgQcBatchesBrowser
              batches={history}
              loading={historyLoading}
              emptyMessage={qcKind === 'fg' ? 'No FG QC batches yet.' : 'No SFG QC batches yet.'}
              factoryId={factoryId}
              stage={qcKind}
              onPrintSticker={setStickerBatch}
            />
          ) : loading ? (
            <p className="py-4 text-sm text-muted">Loading…</p>
          ) : instruments.length === 0 ? (
            <p className="py-4 text-sm text-muted">
              No QC instruments configured for this factory. Run Ananta seed / add instruments.
            </p>
          ) : queue.length === 0 ? (
            <EmptyState
              className="rounded-xl bg-panel"
              title={
                qcKind === 'fg'
                  ? 'No finished goods waiting on lab entry.'
                  : 'No semi-finished goods waiting on lab entry.'
              }
            />
          ) : (
            <>
              <MobileListToolbar
                filter={filter}
                placeholder="Search batch, product, vessel…"
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateChange={(from, to) => {
                  setDateFrom(from)
                  setDateTo(to)
                }}
                resultCount={sortedQueue.length}
                noun={{ one: 'batch', many: 'batches' }}
                sortOptions={[
                  { col: 'batch', label: 'Batch', kind: 'text' },
                  { col: 'product', label: 'Product', kind: 'text' },
                  { col: 'vessel', label: 'Vessel', kind: 'text' },
                  { col: 'forQc', label: 'For QC', kind: 'text' },
                  { col: 'results', label: 'Results', kind: 'number' },
                  { col: 'status', label: 'Status', kind: 'text' },
                ]}
                sortCol={sortCol}
                sortDir={sortDir}
                onSort={handleSort}
              />
              {sortedQueue.length === 0 ? (
                <EmptyState className="rounded-xl bg-panel" title="No batches match your search or filter." />
              ) : (
                <div className="space-y-3">
                  {sortedQueue.map((b) => {
                    const logs = logsById[b.id] ?? []
                    const needs = b.qc_status === 'needs_info'
                    const busy = savingId === b.id
                    const canSubmit = logs.length > 0 && !busy
                    const finishedSummary = forQcSummary(finishesForQc(b.qc_snapshot))
                    const isOpen = expandedId === b.id
                    const openReqs = (reqsById[b.id] ?? []).filter((x) => x.status === 'open')
                    const selectedType =
                      activeQcTypeById[b.id] ?? firstCompletedQcType(instruments, logs)
                    const selectedLog = logs.find((l) => l.instrument_type === selectedType) ?? null
                    return (
                      <MobileCard
                        key={b.id}
                        id={
                          <span className="flex items-center justify-between gap-3">
                            <span className="min-w-0 truncate">{b.batch_no}</span>
                            <span className={`badge shrink-0 ${needs ? 'badge-pmc' : 'badge-chemist'}`}>
                              {needs ? 'Needs info' : 'Pending'}
                            </span>
                          </span>
                        }
                        title={b.product_name || productCode(b)}
                        subtitle={b.vessel || finishedSummary}
                        aside={
                          <>
                            <span className="block text-base font-medium tabular-nums text-chemist">
                              {logs.length}
                            </span>
                            <span className="block text-[10px] uppercase tracking-wider text-muted">
                              tests
                            </span>
                          </>
                        }
                        expanded={isOpen}
                        onToggleExpand={() => {
                          setExpandedId(isOpen ? null : b.id)
                        }}
                        details={
                          <div className="space-y-3 text-left">
                            <p className="text-xs text-muted">
                              {productCode(b)}
                              {b.vessel ? ` · ${b.vessel}` : ''}
                              {finishedSummary !== '—' ? ` · ${finishedSummary}` : ''}
                            </p>
                            {openReqs.length > 0 ? (
                              <div className="rounded-lg border border-pmc/25 bg-pmc/5 px-3 py-2 text-xs">
                                <p className="font-medium text-pmc">Admin asked for more results</p>
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
                            ) : null}
                            {instruments.length > 0 ? (
                              <QcCoverageChips
                                instruments={instruments}
                                extraTypes={fgChecks}
                                logs={logs}
                                activeType={selectedType}
                                onSelect={(type) => {
                                  setActiveQcTypeById((m) => ({ ...m, [b.id]: type }))
                                }}
                              />
                            ) : null}
                            {selectedLog ? (
                              <QcResultCard
                                key={selectedLog.id}
                                log={selectedLog}
                                onEdit={() => {
                                  setFormOpenId(b.id)
                                  setEditingLog(selectedLog)
                                }}
                                onDelete={() => void removeLog(b.id, selectedLog.id)}
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
                                setFormOpenId(b.id)
                              }}
                            >
                              Add test
                            </button>
                            <button
                              type="button"
                              disabled={!canSubmit}
                              className="btn min-w-0 flex-1 border border-chemist bg-chemist px-3 text-white disabled:opacity-40"
                              onClick={() => setSubmitId(b.id)}
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
          {formBatch ? (
            <MgmtDrawer
              title={editingLog ? 'Edit result' : 'Add test'}
              eyebrow={formBatch.batch_no}
              subtitle={formBatch.product_name || productCode(formBatch)}
              onClose={() => {
                setFormOpenId(null)
                setEditingLog(null)
              }}
            >
              <QcLabResultForm
                key={editingLog?.id ?? `m-new-${formBatch.id}`}
                instruments={instruments}
                extraTypes={fgChecks}
                sampleDefault={sampleDefault(formBatch)}
                existing={editingLog}
                lockType={Boolean(editingLog)}
                excludeTypes={
                  editingLog
                    ? undefined
                    : (logsById[formBatch.id] ?? [])
                        .map((l) => l.instrument_type)
                        .filter((t): t is string => Boolean(t))
                }
                saving={savingId === formBatch.id}
                onSave={(data) => saveLog(formBatch, data)}
                onCancel={() => {
                  setFormOpenId(null)
                  setEditingLog(null)
                }}
              />
            </MgmtDrawer>
          ) : null}
        </div>
        {submitBatch && typeof document !== 'undefined'
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
                      disabled={savingId === submitBatch.id}
                      className="btn min-w-0 flex-1 border border-chemist bg-chemist text-white disabled:opacity-40"
                      onClick={() => void submit(submitBatch.id)}
                    >
                      {savingId === submitBatch.id ? 'Submitting…' : 'Confirm'}
                    </button>
                  </>
                }
              >
                <p className="text-sm text-primary">
                  Submit {submitBatch.batch_no}
                  {submitBatch.product_name ? ` (${submitBatch.product_name})` : ''} to admin for
                  review?
                </p>
                <p className="mt-2 text-sm text-muted">
                  {(logsById[submitBatch.id] ?? []).length} recorded test
                  {(logsById[submitBatch.id] ?? []).length === 1 ? '' : 's'} will be sent. You cannot
                  add tests until they review it.
                </p>
              </MobileSheet>,
              document.body,
            )
          : null}

        <div className="hidden md:block">
        <div className="folder-tabs" role="tablist" aria-label="QC lab">
          {(
            [
              { key: 'sfg' as const, label: 'SFG QC' },
              { key: 'fg' as const, label: 'FG QC' },
            ] as const
          ).map((t) => {
            const on = qcKind === t.key
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={on}
                className={on ? 'folder-tab is-active' : 'folder-tab'}
                onClick={() => setQcKind(t.key)}
              >
                {t.label}
              </button>
            )
          })}
        </div>
        <section className="folder-panel overflow-hidden">
        <div
          className="flex gap-1 border-b border-border px-4"
          role="tablist"
          aria-label={`${qcKind === 'fg' ? 'FG' : 'SFG'} QC sections`}
        >
          {(
            [
              { key: 'queue' as const, label: 'Pending QC' },
              { key: 'all' as const, label: 'All batches' },
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
                className={`-mb-px border-b-2 px-3 py-2.5 text-sm transition-colors ${
                  on
                    ? 'border-chemist font-medium text-primary'
                    : 'border-transparent text-muted hover:text-primary'
                }`}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        {tab === 'all' ? (
          <div className="p-4">
          <FgQcBatchesBrowser
            batches={history}
            loading={historyLoading}
            emptyMessage={qcKind === 'fg' ? 'No FG QC batches yet.' : 'No SFG QC batches yet.'}
            factoryId={factoryId}
            stage={qcKind}
            onPrintSticker={setStickerBatch}
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
          <p className="p-4 text-sm text-muted">
            {qcKind === 'fg'
              ? 'No finished goods waiting on lab entry.'
              : 'No semi-finished goods waiting on lab entry.'}
          </p>
        ) : (
          <>
            <div className="border-b border-border p-4">
              <SmartFilterBar
                filter={filter}
                placeholder="Search batch, product, vessel…"
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
              <p className="p-4 text-sm text-muted">No batches match your search or filter.</p>
            ) : (
            <div className="overflow-x-auto">
              <table className="data-table min-w-[40rem]">
                <thead>
                  <tr>
                    <SortTh label="Batch" col="batch" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="chemist" />
                    <SortTh label="Product" col="product" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="chemist" />
                    <SortTh label="Vessel" col="vessel" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="chemist" />
                    <SortTh label="For QC" col="forQc" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="chemist" />
                    <SortTh label="Results" col="results" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="chemist" />
                    <SortTh label="Status" col="status" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} accent="chemist" />
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedQueue.map((b) => {
                    const logs = logsById[b.id] ?? []
                    const needs = b.qc_status === 'needs_info'
                    const busy = savingId === b.id
                    const isOpen = expandedId === b.id
                    const openReqs = (reqsById[b.id] ?? []).filter((x) => x.status === 'open')
                    const canSubmit = logs.length > 0 && !busy
                    const snap = b.qc_snapshot
                    const finished = finishesForQc(snap)
                    const finishedSummary = forQcSummary(finished)

                    return (
                      <Fragment key={b.id}>
                        <tr
                          className={`border-b border-border/60 last:border-b-0 ${
                            isOpen ? 'bg-chemist/[0.05]' : 'hover:bg-surface/60'
                          }`}
                        >
                          <td className="px-4 py-3 font-medium text-primary">{b.batch_no}</td>
                          <td className="px-4 py-3 text-muted">
                            {b.product_code || snap?.product_code || '—'}
                            {(b.product_name || snap?.product_name) && (
                              <span className="block text-[11px] text-muted/80">
                                {b.product_name || snap?.product_name}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted">
                            {b.vessel || snap?.vessel || '—'}
                          </td>
                          <td className="max-w-[16rem] px-4 py-3">
                            {finished.length === 0 ? (
                              <span className="text-[11px] text-muted">—</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {finished.map((f, i) => (
                                  <span
                                    key={`${f.name}-${i}`}
                                    className="inline-flex max-w-full truncate rounded-md bg-chemist/10 px-1.5 py-0.5 text-[11px] font-medium text-chemist"
                                    title={`${f.name}: ${Number(f.qty).toFixed(3)} ${f.unit || 'Kg'}`}
                                  >
                                    {f.name}
                                  </span>
                                ))}
                              </div>
                            )}
                            <span className="sr-only">{finishedSummary}</span>
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
                              aria-expanded={menuId === b.id}
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                                menuId === b.id
                                  ? 'bg-chemist/15 text-chemist'
                                  : 'text-muted hover:bg-layer-sm hover:text-primary'
                              }`}
                              onClick={(e) => {
                                if (menuId === b.id) {
                                  closeMenu()
                                  return
                                }
                                openMenu(b.id, e.currentTarget)
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
                                <div className="grid gap-3 text-xs text-muted sm:grid-cols-2">
                                  <div>
                                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider">
                                      Semi-finished products for QC
                                    </p>
                                    {finished.length === 0 ? (
                                      <p>—</p>
                                    ) : (
                                      <ul className="space-y-0.5">
                                        {finished.map((f, i) => (
                                          <li key={`${f.name}-${i}`}>
                                            {f.name}: {Number(f.qty).toFixed(3)}{' '}
                                            {f.unit || 'Kg'}
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                  <div>
                                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider">
                                      RM lots
                                    </p>
                                    {(snap?.raw_materials ?? []).length === 0 ? (
                                      <p>—</p>
                                    ) : (
                                      <ul className="space-y-0.5">
                                        {(snap?.raw_materials ?? []).map((r, i) => (
                                          <li key={`${r.material_name}-${i}`}>
                                            {r.material_name}
                                            {r.lot_invoice ? ` · ${r.lot_invoice}` : ''}:{' '}
                                            {Number(r.qty).toFixed(3)} {r.unit || 'Kg'}
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                </div>

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
                                  <QcCoverageChips instruments={instruments} extraTypes={fgChecks} logs={logs} />
                                )}

                                {logs.length > 0 && (
                                  <div className="space-y-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                                      Results · {logs.length}
                                    </p>
                                    <div className="space-y-2">
                                      {logs.map((log) =>
                                        formOpenId === b.id && editingLog?.id === log.id ? (
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
                                              instruments={instruments} extraTypes={fgChecks}
                                              sampleDefault={sampleDefault(b)}
                                              existing={editingLog}
                                              lockType
                                              saving={savingId === b.id}
                                              onSave={(data) => saveLog(b, data)}
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
                                                    setExpandedId(b.id)
                                                    setFormOpenId(b.id)
                                                    setEditingLog(log)
                                                  }
                                            }
                                            onDelete={
                                              formOpenId
                                                ? undefined
                                                : () => void removeLog(b.id, log.id)
                                            }
                                          />
                                        ),
                                      )}
                                    </div>
                                  </div>
                                )}

                                {logs.length === 0 && formOpenId !== b.id && (
                                  <p className="text-sm text-muted">
                                    No lab results yet. Use Add test to enter results.
                                  </p>
                                )}

                                {formOpenId === b.id && !editingLog && (
                                  <div
                                    id="qc-inline-editor"
                                    className="rounded-xl border border-chemist/35 bg-panel p-4"
                                  >
                                    <p className="mb-3 text-sm font-semibold text-primary">
                                      Add lab result
                                    </p>
                                    <QcLabResultForm
                                      key={`new-${b.id}`}
                                      instruments={instruments} extraTypes={fgChecks}
                                      sampleDefault={sampleDefault(b)}
                                      existing={null}
                                      excludeTypes={logs
                                        .map((l) => l.instrument_type)
                                        .filter((t): t is string => Boolean(t))}
                                      saving={savingId === b.id}
                                      onSave={(data) => saveLog(b, data)}
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

                        {menuId === b.id &&
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
                                  if (isOpen && formOpenId !== b.id) {
                                    setExpandedId(null)
                                    setFormOpenId(null)
                                    setEditingLog(null)
                                    return
                                  }
                                  setExpandedId(b.id)
                                  setFormOpenId(null)
                                  setEditingLog(null)
                                }}
                              >
                                {isOpen && formOpenId !== b.id ? (
                                  <EyeOff size={14} className="text-muted" />
                                ) : (
                                  <Eye size={14} className="text-muted" />
                                )}
                                {isOpen && formOpenId !== b.id
                                  ? 'Hide details'
                                  : 'View details'}
                              </button>
                              <button
                                type="button"
                                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs text-primary hover:bg-surface"
                                onClick={() => {
                                  closeMenu()
                                  setExpandedId(b.id)
                                  setEditingLog(null)
                                  setFormOpenId(b.id)
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
                                  void submit(b.id)
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
      {stickerBatch ? (
        <QcPackStickerDrawer
          batch={stickerBatch}
          logs={logsById[stickerBatch.id]}
          factoryId={factoryId}
          saving={stickerSaving}
          onClose={() => setStickerBatch(null)}
          onPrint={printPackSticker}
        />
      ) : null}
    </AppLayout>
  )
}
