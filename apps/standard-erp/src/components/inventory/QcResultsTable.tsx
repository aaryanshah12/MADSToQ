'use client'

import { Fragment, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  formatPayloadSummary,
  payloadDetailRows,
  QC_TYPE_LABEL,
  type QcLogEntry,
} from '@/components/inventory/QcLabResultForm'
import QcResultCard, {
  QcCoverageChips,
  firstCompletedQcType,
} from '@/components/inventory/QcResultCard'

const QC_TYPE_SEQUENCE = ['description', 'identification', 'density', 'boiling_point', 'karl_fisher', 'gc'] as const

function hasMissingFields(type: string | null, payload: Record<string, unknown>) {
  if (type === 'karl_fisher') {
    return payload.result_pct == null || payload.result_pct === ''
  }
  if (type === 'gc') {
    return (
      (payload.percentage == null || payload.percentage === '') &&
      (payload.rt_min == null || payload.rt_min === '')
    )
  }
  return false
}

function instrumentsFromLogs(logs: QcLogEntry[]) {
  const present = new Set(
    logs.map((l) => l.instrument_type).filter((t): t is string => Boolean(t)),
  )
  const ordered = QC_TYPE_SEQUENCE.filter((t) => present.has(t))
  for (const t of present) {
    if (!ordered.includes(t as (typeof QC_TYPE_SEQUENCE)[number])) ordered.push(t)
  }
  return ordered.map((type) => ({ type }))
}

/** Admin review table — one row per lab test, expand for field details. */
export default function QcResultsTable({ logs }: { logs: QcLogEntry[] }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [activeType, setActiveType] = useState<string | null>(null)

  if (logs.length === 0) {
    return <p className="text-sm text-muted">No results on file.</p>
  }

  const instruments = instrumentsFromLogs(logs)
  const selectedType = activeType ?? firstCompletedQcType(instruments, logs)
  const selectedLog = logs.find((l) => l.instrument_type === selectedType) ?? logs[0]

  return (
    <>
      <div className="space-y-3 md:hidden">
        {instruments.length > 1 ? (
          <QcCoverageChips
            instruments={instruments}
            logs={logs}
            activeType={selectedType}
            onSelect={setActiveType}
          />
        ) : null}
        {selectedLog ? <QcResultCard log={selectedLog} readOnly /> : null}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-border bg-panel md:block">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr>
              <th className="px-3.5 py-2.5 font-semibold">Test</th>
              <th className="px-3.5 py-2.5 font-semibold">Instrument</th>
              <th className="px-3.5 py-2.5 font-semibold">Result</th>
              <th className="px-3.5 py-2.5 font-semibold">Date</th>
              <th className="w-10 px-2 py-2.5">
                <span className="sr-only">Expand</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const type = log.instrument_type
              const typeLabel = QC_TYPE_LABEL[type || ''] || type || 'Test'
              const summary = formatPayloadSummary(type, log.payload || {})
              const details = payloadDetailRows(type, log.payload || {})
              const missing = hasMissingFields(type, log.payload || {})
              const open = openId === log.id
              const hasDetails = details.length > 0

              return (
                <Fragment key={log.id}>
                  <tr
                    className={`border-b border-border/60 last:border-b-0 ${
                      missing ? 'bg-amber-500/[0.05]' : open ? 'bg-surface/60' : 'hover:bg-surface/40'
                    }`}
                  >
                    <td className="px-3.5 py-2.5">
                      <span className="inline-flex rounded-full bg-chemist/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-chemist">
                        {typeLabel}
                      </span>
                      {missing && (
                        <span className="ml-1.5 text-[10px] font-medium text-amber-700">
                          Incomplete
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 font-mono text-[11px] text-muted">
                      {log.instrument_code || '—'}
                    </td>
                    <td className="px-3.5 py-2.5 font-medium tabular-nums text-primary">
                      {summary}
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-2.5 text-[11px] text-muted">
                      {log.entry_date}
                      {log.sample_name ? (
                        <span className="mt-0.5 block max-w-[8rem] truncate">{log.sample_name}</span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      {hasDetails && (
                        <button
                          type="button"
                          aria-label={open ? 'Collapse details' : 'Expand details'}
                          aria-expanded={open}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-layer-sm hover:text-primary"
                          onClick={() => setOpenId((cur) => (cur === log.id ? null : log.id))}
                        >
                          <ChevronDown
                            size={16}
                            className={`transition-transform ${open ? 'rotate-180' : ''}`}
                          />
                        </button>
                      )}
                    </td>
                  </tr>
                  {open && hasDetails && (
                    <tr className="border-b border-border/60 bg-surface/50 last:border-b-0">
                      <td colSpan={5} className="px-3.5 py-3">
                        <dl className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                          {details.map((d) => {
                            const empty = d.value === '—' || d.value === 'not entered'
                            return (
                              <div key={d.label} className="rounded-lg bg-panel px-2.5 py-2">
                                <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                                  {d.label}
                                </dt>
                                <dd
                                  className={`mt-0.5 text-sm font-medium tabular-nums ${
                                    empty ? 'text-amber-700' : 'text-primary'
                                  }`}
                                >
                                  {d.value}
                                </dd>
                              </div>
                            )
                          })}
                        </dl>
                        {log.remarks ? (
                          <p className="mt-2 text-[11px] text-muted">Remark · {log.remarks}</p>
                        ) : null}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
