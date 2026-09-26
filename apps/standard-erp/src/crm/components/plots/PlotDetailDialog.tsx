import { X } from 'lucide-react'
import {
  calculatePlotPrice,
  type PlotRecord,
  type PlotStatus,
} from '../../lib/pricing'
import { formatCurrency, formatNumber } from '../../lib/schemes'
import type { SchemeRecord } from '../../types/scheme'
import type { BookingRecord } from '../../types/sales'
import { Button } from '../ui/Form'

const STATUS_LABELS: Record<PlotStatus, string> = {
  available: 'Available',
  reserved: 'Reserved',
  booked: 'Booked',
  sold: 'Sold',
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value?.trim()) return null
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className="text-sm font-medium text-ink sm:text-right">{value}</dd>
    </div>
  )
}

export function PlotDetailDialog({
  open,
  onClose,
  plot,
  scheme,
  booking,
}: {
  open: boolean
  onClose: () => void
  plot: PlotRecord
  scheme: SchemeRecord
  booking?: BookingRecord | null
}) {
  if (!open) return null

  const price = calculatePlotPrice(scheme, plot)
  const roadLabel =
    plot.facingRoadWidth != null
      ? `${plot.facingRoadWidth} m${
          price?.roadPremiumLabel ? ` · ${price.roadPremiumLabel}` : ''
        }`
      : 'Not set'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-line bg-surface shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
              Plot details
            </p>
            <h2 className="mt-1 font-display text-2xl text-ink">
              Plot {plot.plotNumber}
            </h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              {scheme.schemeName || scheme.schemeCode} · {plot.blockName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-4">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Inventory
            </h3>
            <dl className="mt-2 space-y-2">
              <DetailRow label="Plot number" value={plot.plotNumber} />
              <DetailRow label="Block" value={plot.blockName || '—'} />
              <DetailRow
                label="Status"
                value={STATUS_LABELS[plot.status] || plot.status}
              />
              <DetailRow
                label="Carpet area"
                value={
                  plot.carpetAreaSqM
                    ? `${formatNumber(plot.carpetAreaSqM)} sq.m`
                    : '—'
                }
              />
              <DetailRow
                label="SBU area"
                value={
                  plot.sbuAreaSqYards
                    ? `${formatNumber(plot.sbuAreaSqYards)} sq.yd`
                    : '—'
                }
              />
              <DetailRow label="Facing road" value={roadLabel} />
              <DetailRow
                label="Garden facing"
                value={plot.isGardenFacing ? 'Yes' : 'No'}
              />
            </dl>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Price breakdown
            </h3>
            {price ? (
              <dl className="mt-2 space-y-2">
                <DetailRow
                  label="Base rate"
                  value={`${formatCurrency(price.baseRate)} /sq.yd`}
                />
                <DetailRow
                  label="Base amount"
                  value={`${formatCurrency(price.baseAmount)} (${formatNumber(String(price.areaSqYards))} × ${formatCurrency(price.baseRate)})`}
                />
                <DetailRow
                  label={`Road premium (${price.roadPremiumLabel || '0'})`}
                  value={formatCurrency(price.roadPremiumAmount)}
                />
                {price.gardenPremiumAmount > 0 && (
                  <DetailRow
                    label="Garden premium"
                    value={formatCurrency(price.gardenPremiumAmount)}
                  />
                )}
                {price.developmentChargeAmount > 0 && (
                  <DetailRow
                    label="Development charge"
                    value={formatCurrency(price.developmentChargeAmount)}
                  />
                )}
                {price.plcCharges > 0 && (
                  <DetailRow
                    label="PLC"
                    value={formatCurrency(price.plcCharges)}
                  />
                )}
                {price.maintenanceCharges > 0 && (
                  <DetailRow
                    label="Maintenance"
                    value={formatCurrency(price.maintenanceCharges)}
                  />
                )}
                <div className="flex flex-col gap-0.5 border-t border-line pt-2 sm:flex-row sm:justify-between sm:gap-4">
                  <dt className="text-xs font-semibold text-ink-faint">
                    Estimated total
                  </dt>
                  <dd className="text-base font-semibold tabular-nums text-ink sm:text-right">
                    {formatCurrency(price.total)}
                  </dd>
                </div>
                <p className="text-[11px] text-ink-muted">
                  Land estimate from scheme rates. GST on cheque is applied in
                  the payment plan, not here.
                </p>
              </dl>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">
                Scheme base rate or plot SBU is not set yet.
              </p>
            )}
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Scheme rates
            </h3>
            <dl className="mt-2 space-y-2">
              <DetailRow
                label="13 m premium"
                value={scheme.roadWidthPremiums?.road13m || '—'}
              />
              <DetailRow
                label="12 m premium"
                value={scheme.roadWidthPremiums?.road12m || '—'}
              />
              <DetailRow
                label="9 m premium"
                value={scheme.roadWidthPremiums?.road9m || '—'}
              />
              <DetailRow
                label="Garden premium"
                value={scheme.gardenFacingPremium || '—'}
              />
              <DetailRow
                label="Development charge"
                value={scheme.developmentCharge || '—'}
              />
            </dl>
          </section>

          {booking && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Active booking
              </h3>
              <dl className="mt-2 space-y-2">
                <DetailRow label="Customer" value={booking.customerName} />
                <DetailRow label="Booking" value={booking.bookingCode} />
                <DetailRow label="Phone" value={booking.customerPhone || '—'} />
                <DetailRow
                  label="Sales person"
                  value={booking.salesPerson || '—'}
                />
                <DetailRow
                  label="Booking status"
                  value={booking.status}
                />
              </dl>
            </section>
          )}

          <div className="pt-1">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
