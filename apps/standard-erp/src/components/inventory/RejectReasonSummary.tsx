'use client'

import { useState } from 'react'

/** Parses `Rejected: a; b. Detail: …` from QC reject notes. */
export function parseRejectNotes(qcNotes: string | null | undefined): {
  reasons: string[]
  detail: string | null
} {
  if (!qcNotes?.trim()) return { reasons: [], detail: null }
  const raw = qcNotes.trim()
  const withoutPrefix = raw.replace(/^Rejected:\s*/i, '')
  const detailMatch = withoutPrefix.match(/^(.*?)\.\s*Detail:\s*(.+)$/s)
  const reasonsPart = (detailMatch ? detailMatch[1] : withoutPrefix).trim()
  const detail = detailMatch ? detailMatch[2].trim() : null
  const reasons = reasonsPart
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
  return { reasons, detail }
}

/** Compact reject reasons for table QC-reason column. */
export default function RejectReasonSummary({
  qcNotes,
}: {
  qcNotes: string | null | undefined
}) {
  const [open, setOpen] = useState(false)
  const { reasons, detail } = parseRejectNotes(qcNotes)
  if (reasons.length === 0 && !detail) return null

  const visible = open ? reasons : reasons.slice(0, 2)
  const hiddenCount = reasons.length - visible.length

  return (
    <div className="min-w-[12rem] max-w-[20rem]">
      {reasons.length > 0 && (
        <ul className="space-y-0.5 text-xs leading-snug text-primary">
          {visible.map((reason) => (
            <li key={reason} className="truncate" title={reason}>
              {reason}
            </li>
          ))}
        </ul>
      )}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-0.5 text-[11px] text-pmc hover:underline"
        >
          +{hiddenCount} more
        </button>
      )}
      {open && reasons.length > 2 && (
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-0.5 ml-2 text-[11px] text-muted hover:underline"
        >
          Show less
        </button>
      )}
      {detail && (
        <p
          className="mt-1.5 border-t border-border/60 pt-1.5 text-[11px] leading-snug text-muted"
          title={detail}
        >
          {detail}
        </p>
      )}
    </div>
  )
}
