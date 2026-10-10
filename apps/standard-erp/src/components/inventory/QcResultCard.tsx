'use client'

import { Check, Circle, Pencil, Trash2, AlertCircle } from 'lucide-react'
import {
  formatPayloadSummary,
  payloadDetailRows,
  QC_TYPE_LABEL,
  type QcLogEntry,
} from '@/components/inventory/QcLabResultForm'

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

export default function QcResultCard({
  log,
  onEdit,
  onDelete,
  readOnly = false,
}: {
  log: QcLogEntry
  onEdit?: () => void
  onDelete?: () => void
  readOnly?: boolean
}) {
  const type = log.instrument_type
  const allDetails = payloadDetailRows(type, log.payload || {})
  const details = allDetails.length > 1 ? allDetails : []
  const missing = hasMissingFields(type, log.payload || {})
  const typeLabel = QC_TYPE_LABEL[type || ''] || type || 'Test'
  const summary = formatPayloadSummary(type, log.payload || {})

  return (
    <article
      className={`rounded-xl border bg-panel px-4 py-3.5 shadow-sm ${
        missing
          ? 'border-amber-400/50 border-l-[3px] border-l-amber-500 bg-amber-500/[0.07]'
          : 'border-border/80'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-chemist/12 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-chemist">
              {typeLabel}
            </span>
            {missing && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                <AlertCircle size={11} strokeWidth={2.25} />
                Incomplete fields
              </span>
            )}
            {log.instrument_code ? (
              <span className="font-mono text-[11px] text-muted">{log.instrument_code}</span>
            ) : null}
          </div>

          <p className="text-[15px] font-semibold tabular-nums leading-snug text-primary">
            {summary}
          </p>

          <p className="text-[11px] text-muted">
            {log.entry_date}
            {log.sample_name ? ` · ${log.sample_name}` : ''}
            {log.remarks ? ` · ${log.remarks}` : ''}
          </p>

          {details.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {details.map((d) => {
                const empty = d.value === '—' || d.value === 'not entered'
                return (
                  <span
                    key={d.label}
                    className={`inline-flex items-baseline gap-1 rounded-md px-2 py-1 text-[11px] ${
                      empty
                        ? 'bg-amber-500/10 text-amber-800'
                        : 'bg-surface text-muted'
                    }`}
                  >
                    <span className="font-medium opacity-80">{d.label}</span>
                    <span
                      className={`font-semibold tabular-nums ${
                        empty ? 'text-amber-800' : 'text-primary'
                      }`}
                    >
                      {d.value}
                    </span>
                  </span>
                )
              })}
            </div>
          )}
        </div>

        {!readOnly && (onEdit || onDelete) && (
          <div className="flex shrink-0 gap-1">
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-muted transition-colors hover:border-chemist/30 hover:bg-chemist/10 hover:text-chemist"
                title="Edit"
                aria-label="Edit result"
              >
                <Pencil size={15} />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-muted transition-colors hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-600"
                title="Delete"
                aria-label="Delete result"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

export function qcTypesInSequence(instruments: { type: string }[]) {
  return [...new Set(instruments.map((i) => i.type))]
}

/** First completed test in instrument sequence (Density before Karl Fisher, etc.). */
export function firstCompletedQcType(
  instruments: { type: string }[],
  logs: QcLogEntry[],
): string | null {
  const done = new Set(logs.map((l) => l.instrument_type).filter(Boolean) as string[])
  for (const t of qcTypesInSequence(instruments)) {
    if (done.has(t)) return t
  }
  return logs[0]?.instrument_type ?? null
}

export function QcCoverageChips({
  instruments,
  logs,
  activeType,
  onSelect,
  extraTypes = [],
}: {
  instruments: { type: string }[]
  logs: QcLogEntry[]
  activeType?: string | null
  onSelect?: (type: string) => void
  extraTypes?: string[]
}) {
  const types = qcTypesInSequence(instruments)
  for (const extra of extraTypes) {
    if (!types.includes(extra)) types.push(extra)
  }
  const done = new Set(logs.map((l) => l.instrument_type).filter(Boolean))
  const selectable = Boolean(onSelect)

  return (
    <div className="flex flex-wrap gap-1.5" role={selectable ? 'tablist' : undefined} aria-label={selectable ? 'QC tests' : undefined}>
      {types.map((t) => {
        const ok = done.has(t)
        const on = activeType === t
        const className = `inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${
          on
            ? 'bg-chemist text-white'
            : ok
              ? 'bg-chemist/12 text-chemist ring-1 ring-inset ring-chemist/25'
              : 'bg-surface text-muted ring-1 ring-inset ring-border'
        }`
        if (selectable) {
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={on}
              disabled={!ok}
              onClick={() => {
                if (ok) onSelect?.(t)
              }}
              className={`${className} disabled:cursor-default`}
            >
              {ok ? <Check size={12} strokeWidth={2.5} /> : <Circle size={10} strokeWidth={2} />}
              {QC_TYPE_LABEL[t] || t}
            </button>
          )
        }
        return (
          <span
            key={t}
            className={className}
          >
            {ok ? <Check size={12} strokeWidth={2.5} /> : <Circle size={10} strokeWidth={2} />}
            {QC_TYPE_LABEL[t] || t}
          </span>
        )
      })}
    </div>
  )
}
