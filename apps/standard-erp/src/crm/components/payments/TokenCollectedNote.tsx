import { formatCurrency } from '../../lib/schemes'
import {
  BOOKING_TOKEN_MODE_LABELS,
  type BookingTokenMode,
} from '../../types/sales'
import { chequeGstPercent, splitGrossBankAmount } from '../../lib/chequeGst'

/** Read-only: token from booking. Does not affect EMI / receipt math — quotas use mode separately. */
export function TokenCollectedNote({
  amount,
  mode,
  compact,
}: {
  amount: number
  mode?: BookingTokenMode | null
  compact?: boolean
}) {
  const token = Math.max(0, Math.round(Number(amount) || 0))
  if (token <= 0) return null

  const modeLabel =
    mode === 'cash' || mode === 'cheque'
      ? BOOKING_TOKEN_MODE_LABELS[mode]
      : null

  const chequeSplit =
    mode === 'cheque' ? splitGrossBankAmount(token, chequeGstPercent()) : null

  if (compact) {
    return (
      <p className="text-[11px] text-ink-faint">
        Token at booking{' '}
        <span className="font-semibold tabular-nums text-ink-muted">
          {formatCurrency(token)}
        </span>
        {modeLabel ? ` · ${modeLabel}` : ''}
        {chequeSplit
          ? ` · deal ${formatCurrency(chequeSplit.principal)} + GST ${formatCurrency(chequeSplit.gst)}`
          : ''}
        {' · '}
        already collected · not an EMI receipt
      </p>
    )
  }

  return (
    <div className="rounded-xl border border-dashed border-line bg-surface-2/40 px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          Token at booking
          {modeLabel ? ` · ${modeLabel}` : ''}
        </p>
        <p className="text-sm font-semibold tabular-nums text-ink">
          {formatCurrency(token)}
        </p>
      </div>
      {chequeSplit ? (
        <p className="mt-1 text-[11px] tabular-nums text-ink-muted">
          Toward deal {formatCurrency(chequeSplit.principal)} · GST{' '}
          {formatCurrency(chequeSplit.gst)} · counted on land cheque quota
        </p>
      ) : mode === 'cash' ? (
        <p className="mt-1 text-[11px] text-ink-muted">
          Counted on land cash quota
        </p>
      ) : null}
      <p className="mt-1 text-[11px] leading-snug text-ink-faint">
        Already collected when the booking was created. EMI schedule starts after
        this — shown for clarity only, not as a payment receipt.
      </p>
    </div>
  )
}
