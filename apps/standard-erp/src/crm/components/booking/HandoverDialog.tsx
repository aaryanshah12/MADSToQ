import { useEffect, useState } from 'react'
import { KeyRound, X } from 'lucide-react'
import type { BookingRecord } from '../../types/sales'
import { todayISO } from '../../types/sales'
import { Button, Field, Input, Textarea } from '../ui/Form'

export function HandoverDialog({
  booking,
  propertyLabel,
  actorName,
  onClose,
  onConfirm,
}: {
  booking: BookingRecord
  propertyLabel: string
  actorName: string
  onClose: () => void
  onConfirm: (input: { handoverDate: string; note: string }) => void
}) {
  const [handoverDate, setHandoverDate] = useState(
    booking.handoverDate || todayISO(),
  )
  const [note, setNote] = useState(booking.handoverNote || '')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = () => {
    if (!handoverDate) {
      setError('Pick a handover date')
      return
    }
    setError(null)
    onConfirm({ handoverDate, note: note.trim() })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-t-2xl border border-line bg-surface shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
              Plot handover
            </p>
            <h2 className="mt-1 font-display text-xl text-ink">
              {booking.customerName}
            </h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              {booking.bookingCode} · {propertyLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-2"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="rounded-xl border border-success/25 bg-success-soft/50 px-3 py-2.5 text-sm text-ink">
            Deal is fully paid. Confirm handover to mark the booking completed
            and plot(s) as sold.
          </div>

          <Field label="Handover date" required error={error || undefined}>
            <Input
              type="date"
              value={handoverDate}
              onChange={(e) => {
                setHandoverDate(e.target.value)
                setError(null)
              }}
            />
          </Field>

          <Field label="Notes">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Keys handed, docs signed, remarks…"
              rows={3}
            />
          </Field>

          <p className="text-[11px] text-ink-faint">
            Recorded as handed over by {actorName}. Admin can undo later if
            needed.
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" onClick={submit}>
              <KeyRound className="h-4 w-4" />
              Confirm handover
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
