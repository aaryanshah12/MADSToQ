'use client'

import { Fragment, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Eye, EyeOff, MessageSquarePlus } from 'lucide-react'
import { EmptyState, SkeletonPanel, useSmartFilter } from '@/components/ui'
import AppLayout from '@/components/layout/AppLayout'
import QcApproveShell from '@/components/inventory/QcApproveShell'
import { useAuth } from '@/hooks/useAuth'
import { useInventoryFactory } from '@/contexts/InventoryFactoryContext'
import { useToast } from '@/components/providers/ToastProvider'
import { productionApi, qcLabApi } from '@/lib/api'
import QcResultsTable from '@/components/inventory/QcResultsTable'
import type { QcLogEntry } from '@/components/inventory/QcLabResultForm'
import { inDateRange } from '@/components/inventory/DateRangeChip'
import { MobileCard, MobileListToolbar, MobileTabs } from '@/components/inventory/MobileList'
import {
  PrintStickerButton,
  QcPackStickerDrawer,
} from '@/components/inventory/QcStickerPrint'
import { printPackQcStickers } from '@/lib/qc-sticker-print'
import { parsePackStickerJob, qcStatusBadgeClass, qcStatusLabel, type PackStickerJob } from '@/lib/qc-sticker'

const REJECTION_CRITERIA = [
  'Assay / purity out of spec',
  'Wrong material or grade',
  'Contamination / foreign matter',
  'Moisture / appearance fail',
  'Boiling range / GC fail',
  'Color / clarity fail',
  'Qty / weight discrepancy',
  'Other',
] as const

const PARAM_TYPES = [
  { id: 'density', label: 'Density' },
  { id: 'boiling_point', label: 'Boiling point' },
  { id: 'karl_fisher', label: 'Karl Fisher' },
  { id: 'gc', label: 'GC' },
] as const

type FgQcSnapshot = {
  product_code?: string
  product_name?: string
  vessel?: string | null
  finished_products?: Array<{
    name: string
    qty: number
    unit?: string
    requires_qc?: boolean
  }>
}

type FgBatch = {
  id: string
  batch_no: string
  product_code: string | null
  product_name: string | null
  vessel: string | null
  qc_status: string
  qc_sent_at: string | null
  qc_snapshot: FgQcSnapshot | null
  completed_at: string | null
  created_by_name: string | null
  mfg_date?: string | null
  purity?: number | null
  sticker_printed_at?: string | null
  sticker_data?: unknown
}

function finishesForQc(snap: FgQcSnapshot | null | undefined) {
  return (snap?.finished_products ?? []).filter((f) => f.requires_qc !== false)
}

type FgQcSort = 'batch' | 'product' | 'vessel' | 'forQc' | 'date' | 'status'

const PENDING_STATUS_OPTIONS = [
  { id: 'awaiting_admin', label: 'Ready' },
  { id: 'needs_info', label: 'On lab' },
] as const

function approveStatusLabel(status: string) {
  if (status === 'needs_info') return 'on lab'
  if (status === 'awaiting_admin') return 'ready'
  return status.replaceAll('_', ' ')
}

export default function OwnerFgQcPage() {
  return (
    <Suspense fallback={<SkeletonPanel className="m-4 md:m-8" />}>
      <OwnerFgQcPageInner />
    </Suspense>
  )
}

function OwnerFgQcPageInner() {
  const { profile, loading: authLoading } = useAuth()
  const toast = useToast()
  const searchParams = useSearchParams()
  const { factoryId: ctxFactoryId } = useInventoryFactory()
  const factoryId = ctxFactoryId || profile?.factories?.[0]?.id || ''
  const [queue, setQueue] = useState<FgBatch[]>([])
  const [approved, setApproved] = useState<FgBatch[]>([])
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
  const [tab, setTab] = useState<'pending' | 'approved'>('pending')
  const [sortCol, setSortCol] = useState<FgQcSort>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [qcKind, setQcKind] = useState<'sfg' | 'fg'>('sfg')

  useEffect(() => {
    setQcKind(searchParams.get('kind') === 'fg' ? 'fg' : 'sfg')
  }, [searchParams])
  const [logsLoadingId, setLogsLoadingId] = useState<string | null>(null)
  const [stickerBatch, setStickerBatch] = useState<FgBatch | null>(null)
  const [stickerSaving, setStickerSaving] = useState(false)

  const reload = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!factoryId) {
        setQueue([])
        setApproved([])
        setLoading(false)
        return
      }
      const silent = opts?.silent === true
      if (!silent) setLoading(true)

      const [waitingRes, doneRes] = await Promise.all([
        productionApi.listBatches(factoryId, {
          status: 'completed',
          qc_status: 'awaiting_admin,needs_info',
          kind: qcKind,
        }),
        productionApi.listBatches(factoryId, {
          status: 'completed',
          qc_status: 'approved,approved_printed',
          kind: qcKind,
        }),
      ])
      const err = waitingRes.error || doneRes.error
      if (err) toast.error(err)

      const waiting = ((waitingRes.batches ?? []) as FgBatch[]).sort((a, b) => {
        if (a.qc_status === b.qc_status) return 0
        if (a.qc_status === 'awaiting_admin') return -1
        if (b.qc_status === 'awaiting_admin') return 1
        return 0
      })
      const approvedRows = ((doneRes.batches ?? []) as FgBatch[]).sort((a, b) => {
        const ta = a.completed_at ? new Date(a.completed_at).getTime() : 0
        const tb = b.completed_at ? new Date(b.completed_at).getTime() : 0
        return tb - ta
      })

      setQueue(waiting)
      setApproved(approvedRows)
      if (!silent) setLoading(false)

      const ids = waiting.map((b) => b.id)
      const logs = await qcLabApi.listLogs(factoryId, ids, qcKind)
      const logMap: Record<string, QcLogEntry[]> = {}
      for (const id of ids) logMap[id] = []
      for (const entry of (logs.entries ?? []) as QcLogEntry[]) {
        const sid = (entry as QcLogEntry & { subject_id?: string }).subject_id
        if (sid) (logMap[sid] ??= []).push(entry)
      }
      setLogsById((prev) => ({ ...prev, ...logMap }))
      setExpandedId((prev) => {
        if (!prev) return null
        if (waiting.some((b) => b.id === prev) || approvedRows.some((b) => b.id === prev)) {
          return prev
        }
        return null
      })
    },
    [factoryId, qcKind],
  )

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  async function ensureLogs(batchId: string) {
    if (logsById[batchId]) return
    setLogsLoadingId(batchId)
    const logs = await qcLabApi.listLogs(factoryId, batchId, qcKind)
    setLogsById((prev) => ({
      ...prev,
      [batchId]: (logs.entries ?? []) as QcLogEntry[],
    }))
    setLogsLoadingId(null)
  }

  function toggleExpand(id: string) {
    setExpandedId((cur) => {
      if (cur === id) {
        setRejectOpenId(null)
        setRequestOpenId(null)
        return null
      }
      setRejectOpenId(null)
      setRequestOpenId(null)
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
    const result = await productionApi.qcBatch({ id, action: 'approve' })
    setActingId(null)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('SFG QC approved')
    setExpandedId(null)
    await reload({ silent: true })
  }

  function openPackSticker(b: FgBatch) {
    setStickerBatch(b)
    void ensureLogs(b.id)
  }

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
    setStickerBatch(null)
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
    const result = await productionApi.qcBatch({
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
    toast.success('SFG QC rejected — moved to warehouse as rejected stock')
    setRejectOpenId(null)
    setExpandedId(null)
    await reload({ silent: true })
  }

  async function requestParams(id: string) {
    if (requestTypes.length === 0) {
      toast.error('Select at least one parameter to request')
      return
    }
    setActingId(id)
    const result = await qcLabApi.requestParams({
      batch_id: id,
      stage: qcKind,
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

  function batchLabel(b: FgBatch) {
    return (
      b.product_code ||
      b.qc_snapshot?.product_code ||
      '—'
    )
  }

  function finishesForBatch(b: FgBatch) {
    return finishesForQc(b.qc_snapshot)
  }

  const sourceRows = tab === 'approved' ? approved : queue
  const filter = useSmartFilter(sourceRows, {
    getSearchText: (b) => [
      b.batch_no,
      batchLabel(b),
      b.product_name,
      b.qc_snapshot?.product_name,
      b.vessel,
      b.qc_snapshot?.vessel,
      finishesForBatch(b)
        .map((f) => f.name)
        .join(' '),
      approveStatusLabel(b.qc_status),
    ],
    facets: [
      { key: 'product', label: 'Product', getValue: (b) => batchLabel(b) },
      {
        key: 'vessel',
        label: 'Vessel',
        getValue: (b) => b.vessel || b.qc_snapshot?.vessel || '—',
      },
      ...(tab === 'pending'
        ? [
            {
              key: 'status',
              label: 'Status',
              getValue: (b: FgBatch) =>
                b.qc_status === 'needs_info' ? 'needs_info' : 'awaiting_admin',
              formatValue: (id: string) =>
                PENDING_STATUS_OPTIONS.find((o) => o.id === id)?.label ?? id,
              options: [...PENDING_STATUS_OPTIONS],
            },
          ]
        : []),
    ],
  })

  const sortedRows = useMemo(() => {
    let rows = filter.filtered.filter((b) =>
      inDateRange(b.qc_sent_at || b.completed_at, dateFrom, dateTo),
    )
    const dir = sortDir === 'asc' ? 1 : -1
    rows = [...rows].sort((a, b) => {
      let cmp = 0
      switch (sortCol) {
        case 'product':
          cmp = batchLabel(a).localeCompare(batchLabel(b))
          break
        case 'vessel':
          cmp = (a.vessel || a.qc_snapshot?.vessel || '').localeCompare(
            b.vessel || b.qc_snapshot?.vessel || '',
          )
          break
        case 'forQc':
          cmp = finishesForBatch(a)
            .map((f) => f.name)
            .join(', ')
            .localeCompare(finishesForBatch(b).map((f) => f.name).join(', '))
          break
        case 'date':
          cmp = String(a.qc_sent_at || a.completed_at || '').localeCompare(
            String(b.qc_sent_at || b.completed_at || ''),
          )
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
  }, [filter.filtered, sortCol, sortDir, dateFrom, dateTo])

  function handleSort(col: FgQcSort) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir(col === 'date' || col === 'batch' ? 'desc' : 'asc')
    }
  }

  useEffect(() => {
    filter.setSearch('')
    filter.clearAll()
    setDateFrom('')
    setDateTo('')
  }, [qcKind, tab])

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
            placeholder="Detail notes (required for Other)"
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
            Send to lab
          </button>
          <button
            type="button"
            className="btn btn-ghost h-9"
            onClick={() => {
              setRequestOpenId(null)
              setRequestTypes([])
              setRequestNote('')
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <AppLayout>
      <div className="w-full p-4 md:p-8">
        <QcApproveShell kind={qcKind}>

        <MobileTabs
          ariaLabel="SFG / FG QC queues"
          className="-mx-4 mb-4 bg-panel"
          active={tab}
          onChange={(key) => {
            setTab(key)
            setExpandedId(null)
            setRejectOpenId(null)
            setRequestOpenId(null)
          }}
          tabs={[
            { key: 'pending', label: 'Pending' },
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
                  ? 'No approved batches yet'
                  : qcKind === 'fg'
                    ? 'No FG batches awaiting decision'
                    : 'No SFG batches awaiting decision'
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
                resultCount={sortedRows.length}
                noun={{ one: 'batch', many: 'batches' }}
                sortOptions={[
                  { col: 'batch', label: 'Batch', kind: 'text' },
                  { col: 'product', label: 'Product', kind: 'text' },
                  { col: 'vessel', label: 'Vessel', kind: 'text' },
                  { col: 'forQc', label: 'For QC', kind: 'text' },
                  { col: 'date', label: 'Sent', kind: 'date' },
                  { col: 'status', label: 'Status', kind: 'text' },
                ]}
                sortCol={sortCol}
                sortDir={sortDir}
                onSort={handleSort}
              />
              {sortedRows.length === 0 ? (
                <EmptyState
                  className="rounded-xl bg-panel"
                  title="No batches match your search or filter."
                />
              ) : (
                <div className="space-y-3">
                  {sortedRows.map((b) => {
                    const isOpen = expandedId === b.id
                    const logs = logsById[b.id] ?? []
                    const finished = finishesForBatch(b)
                    if (tab === 'approved') {
                      return (
                        <MobileCard
                          key={b.id}
                          id={b.batch_no}
                          title={batchLabel(b)}
                          subtitle={b.product_name || b.qc_snapshot?.product_name || undefined}
                          rows={[
                            {
                              label: 'For QC',
                              value:
                                finished.length === 0 ? '—' : finished.map((f) => f.name).join(', '),
                            },
                            {
                              label: 'Status',
                              value: (
                                <span className={qcStatusBadgeClass(b.qc_status)}>
                                  {qcStatusLabel(b.qc_status)}
                                </span>
                              ),
                            },
                          ]}
                          footer={
                            <div className="flex flex-col gap-3">
                              <PrintStickerButton
                                generate
                                printed={b.qc_status === 'approved_printed'}
                                onClick={() => openPackSticker(b)}
                              />
                              <button
                                type="button"
                                className="btn w-full border border-text bg-panel text-primary"
                                onClick={() => toggleExpand(b.id)}
                              >
                                {isOpen ? 'Hide results' : 'View results'}
                              </button>
                              {isOpen ? (
                                logsLoadingId === b.id ? (
                                  <p className="text-left text-sm text-muted">Loading results…</p>
                                ) : (
                                  <QcResultsTable logs={logs} />
                                )
                              ) : null}
                            </div>
                          }
                        />
                      )
                    }
                    const waitingLab = b.qc_status === 'needs_info'
                    const canDecide = b.qc_status === 'awaiting_admin'
                    const busy = actingId === b.id
                    return (
                      <MobileCard
                        key={b.id}
                        id={
                          <span className="flex items-center justify-between gap-3">
                            <span className="min-w-0 truncate">{b.batch_no}</span>
                            <span
                              className={`badge shrink-0 ${waitingLab ? 'badge-pmc' : 'badge-owner'}`}
                            >
                              {waitingLab ? 'On lab' : 'Ready'}
                            </span>
                          </span>
                        }
                        title={batchLabel(b)}
                        subtitle={b.product_name || b.qc_snapshot?.product_name || undefined}
                        rows={[
                          {
                            label: 'For QC',
                            value:
                              finished.length === 0 ? '—' : finished.map((f) => f.name).join(', '),
                          },
                          {
                            label: 'Vessel',
                            value: b.vessel || b.qc_snapshot?.vessel || '—',
                          },
                        ]}
                        footer={
                          <div className="flex flex-col gap-2">
                            <button
                              type="button"
                              className="btn w-full border border-text bg-panel text-primary"
                              onClick={() => toggleExpand(b.id)}
                            >
                              {isOpen ? 'Hide results' : 'View results'}
                            </button>
                            {isOpen ? (
                              logsLoadingId === b.id ? (
                                <p className="text-left text-sm text-muted">Loading results…</p>
                              ) : (
                                <QcResultsTable logs={logs} />
                              )
                            ) : null}
                            {isOpen && rejectOpenId === b.id ? mobileRejectPanel(b.id) : null}
                            {isOpen && requestOpenId === b.id ? mobileRequestPanel(b.id) : null}
                            {isOpen && rejectOpenId !== b.id && requestOpenId !== b.id ? (
                              <>
                                <button
                                  type="button"
                                  disabled={busy || !canDecide}
                                  className="btn w-full border border-owner bg-owner text-white disabled:opacity-40"
                                  onClick={() => void approve(b.id)}
                                >
                                  {busy ? 'Approving…' : 'Approve'}
                                </button>
                                <button
                                  type="button"
                                  disabled={busy || !canDecide}
                                  className="btn w-full border border-red-300 bg-panel text-red-600 disabled:opacity-40"
                                  onClick={() => {
                                    setRejectOpenId(b.id)
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
                                    setRequestOpenId(b.id)
                                    setRejectOpenId(null)
                                    setRequestTypes([])
                                    setRequestNote('')
                                  }}
                                >
                                  Request params
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
        <div className="folder-tabs" role="tablist" aria-label="SFG / FG QC queues">
          {(
            [
              { id: 'pending' as const, label: 'Pending' },
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
              title="No approved SFG batches yet"
              description="Batches you approve after semi-finished QC will be listed here."
            />
          ) : (
            <div className="rounded-xl border border-border bg-panel shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[42rem] text-left text-sm">
                  <thead>
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Batch</th>
                      <th className="px-4 py-2.5 font-semibold">Product</th>
                      <th className="px-4 py-2.5 font-semibold">For QC</th>
                      <th className="px-4 py-2.5 font-semibold">Results</th>
                      <th className="px-2 py-2.5 text-right whitespace-nowrap">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {approved.map((b) => {
                      const logs = logsById[b.id] ?? []
                      const isOpen = expandedId === b.id
                      const logsBusy = logsLoadingId === b.id
                      const finished = finishesForBatch(b)
                      return (
                        <Fragment key={b.id}>
                          <tr
                            className={`border-b border-border/60 last:border-b-0 ${
                              isOpen ? 'bg-owner/[0.06]' : 'hover:bg-surface/60'
                            }`}
                          >
                            <td className="px-4 py-3 font-medium text-primary">{b.batch_no}</td>
                            <td className="px-4 py-3 text-muted">{batchLabel(b)}</td>
                            <td className="max-w-[16rem] px-4 py-3">
                              {finished.length === 0 ? (
                                <span className="text-[11px] text-muted">—</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {finished.map((f, i) => (
                                    <span
                                      key={`${f.name}-${i}`}
                                      className="inline-flex max-w-full truncate rounded-md bg-owner/10 px-1.5 py-0.5 text-[11px] font-medium text-owner"
                                      title={`${f.name}: ${Number(f.qty).toFixed(3)} ${f.unit || 'Kg'}`}
                                    >
                                      {f.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex min-w-[1.5rem] justify-center rounded-md bg-owner/12 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-owner">
                                {isOpen && logsBusy ? '…' : logs.length}
                              </span>
                            </td>
                            <td className="px-2 py-3 text-right">
                              <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                className="btn h-8 shrink-0 whitespace-nowrap border border-text bg-panel px-3 text-xs text-primary"
                                onClick={() => openPackSticker(b)}
                              >
                                {b.qc_status === 'approved_printed' ? 'Reprint' : 'Generate'}
                              </button>
                              <button
                                type="button"
                                aria-label={isOpen ? 'Hide details' : 'View details'}
                                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${
                                  isOpen
                                    ? 'bg-owner/15 text-owner'
                                    : 'text-muted hover:bg-layer-sm hover:text-owner'
                                }`}
                                onClick={() => toggleExpand(b.id)}
                              >
                                {isOpen ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                              </div>
                            </td>
                          </tr>
                          {isOpen && (
                            <tr className="border-b border-border/60 bg-surface/40 last:border-b-0">
                              <td colSpan={5} className="px-4 py-4">
                                {logsBusy ? (
                                  <p className="text-sm text-muted">Loading results…</p>
                                ) : (
                                  <QcResultsTable logs={logs} />
                                )}
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
          <p className="text-sm text-muted">No FG batches awaiting admin decision.</p>
        ) : (
          <div className="rounded-xl border border-border bg-panel shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] text-left text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Batch</th>
                    <th className="px-4 py-2.5 font-semibold">Product</th>
                    <th className="px-4 py-2.5 font-semibold">For QC</th>
                    <th className="px-4 py-2.5 font-semibold">Results</th>
                    <th className="px-4 py-2.5 font-semibold">Status</th>
                    <th className="w-12 px-2 py-2.5 text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((b) => {
                    const logs = logsById[b.id] ?? []
                    const waitingLab = b.qc_status === 'needs_info'
                    const canDecide = b.qc_status === 'awaiting_admin'
                    const busy = actingId === b.id
                    const isOpen = expandedId === b.id
                    const rejectOpen = rejectOpenId === b.id
                    const requestOpen = requestOpenId === b.id
                    const selected = reasonsById[b.id] ?? []
                    const finished = finishesForBatch(b)

                    return (
                      <Fragment key={b.id}>
                        <tr
                          className={`border-b border-border/60 last:border-b-0 ${
                            isOpen ? 'bg-owner/[0.06]' : 'hover:bg-surface/60'
                          }`}
                        >
                          <td className="px-4 py-3 font-medium text-primary">{b.batch_no}</td>
                          <td className="px-4 py-3 text-muted">{batchLabel(b)}</td>
                          <td className="max-w-[16rem] px-4 py-3">
                            {finished.length === 0 ? (
                              <span className="text-[11px] text-muted">—</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {finished.map((f, i) => (
                                  <span
                                    key={`${f.name}-${i}`}
                                    className="inline-flex max-w-full truncate rounded-md bg-owner/10 px-1.5 py-0.5 text-[11px] font-medium text-owner"
                                    title={`${f.name}: ${Number(f.qty).toFixed(3)} ${f.unit || 'Kg'}`}
                                  >
                                    {f.name}
                                  </span>
                                ))}
                              </div>
                            )}
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
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${
                                isOpen
                                  ? 'bg-owner/15 text-owner'
                                  : 'text-muted hover:bg-layer-sm hover:text-owner'
                              }`}
                              onClick={() => toggleExpand(b.id)}
                            >
                              {isOpen ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </td>
                        </tr>

                        {isOpen && (
                          <tr className="border-b border-border/60 bg-surface/40 last:border-b-0">
                            <td colSpan={6} className="px-4 py-4">
                              <div className="space-y-4">
                                <p className="text-xs text-muted">
                                  Vessel {b.vessel || b.qc_snapshot?.vessel || '—'}
                                  {b.product_name || b.qc_snapshot?.product_name
                                    ? ` · ${b.product_name || b.qc_snapshot?.product_name}`
                                    : ''}
                                  {b.created_by_name ? ` · ${b.created_by_name}` : ''}
                                </p>

                                <div>
                                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                                    Semi-finished products for QC
                                  </p>
                                  {finished.length === 0 ? (
                                    <p className="text-xs text-muted">—</p>
                                  ) : (
                                    <ul className="space-y-0.5 text-xs text-muted">
                                      {finished.map((f, i) => (
                                        <li key={`${f.name}-${i}`}>
                                          {f.name}: {Number(f.qty).toFixed(3)}{' '}
                                          {f.unit || 'Kg'}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>

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
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => void requestParams(b.id)}
                                        className="rounded-lg bg-owner px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                                      >
                                        Send to lab
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRequestOpenId(null)
                                          setRequestTypes([])
                                          setRequestNote('')
                                        }}
                                        className="rounded-lg border border-border px-3 py-1.5 text-xs"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : rejectOpen ? (
                                  <div className="space-y-3 border-t border-border pt-4">
                                    <p className="text-sm font-medium text-primary">
                                      Rejection criteria
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {REJECTION_CRITERIA.map((reason) => {
                                        const on = selected.includes(reason)
                                        return (
                                          <button
                                            key={reason}
                                            type="button"
                                            onClick={() => toggleReason(b.id, reason)}
                                            className={`rounded-md px-2.5 py-1 text-xs ${
                                              on
                                                ? 'bg-red-500/15 text-red-700'
                                                : 'bg-layer-sm text-muted hover:text-primary'
                                            }`}
                                          >
                                            {reason}
                                          </button>
                                        )
                                      })}
                                    </div>
                                    <textarea
                                      className="input-field owner-focus min-h-[4rem]"
                                      placeholder="Detail notes (required for Other)"
                                      value={rejectDetailById[b.id] ?? ''}
                                      onChange={(e) =>
                                        setRejectDetailById((m) => ({
                                          ...m,
                                          [b.id]: e.target.value,
                                        }))
                                      }
                                    />
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => void reject(b.id)}
                                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                                      >
                                        Confirm reject
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setRejectOpenId(null)}
                                        className="rounded-lg border border-border px-3 py-1.5 text-xs"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                                    {canDecide && (
                                      <>
                                        <button
                                          type="button"
                                          disabled={busy || logs.length === 0}
                                          onClick={() => void approve(b.id)}
                                          className="rounded-lg bg-owner px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                                        >
                                          Approve
                                        </button>
                                        <button
                                          type="button"
                                          disabled={busy}
                                          onClick={() => {
                                            setRequestOpenId(null)
                                            setRejectOpenId(b.id)
                                          }}
                                          className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700"
                                        >
                                          Reject
                                        </button>
                                      </>
                                    )}
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => {
                                        setRejectOpenId(null)
                                        setRequestOpenId(b.id)
                                        setRequestTypes([])
                                        setRequestNote('')
                                      }}
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium"
                                    >
                                      <MessageSquarePlus size={14} />
                                      Request params
                                    </button>
                                    {waitingLab && (
                                      <p className="w-full text-xs text-pmc">
                                        Waiting for lab to complete requested parameters.
                                      </p>
                                    )}
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
