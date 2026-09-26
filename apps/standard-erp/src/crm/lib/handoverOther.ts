import { normalizeScheme, type PlotRecord } from './pricing'
import type { OtherPaymentReceipt } from './otherPayments'
import type { HandoverOtherContext } from '../types/payments'
import type { SchemeRecord } from '../types/scheme'
import { bookingPlotIds, type BookingRecord } from '../types/sales'

/** Build handover other-payment context for a booking (or null if no scheme). */
export function buildHandoverOtherContext(
  booking: BookingRecord,
  scheme: SchemeRecord | null | undefined,
  plots: PlotRecord[],
  otherReceipts: OtherPaymentReceipt[],
): HandoverOtherContext | null {
  if (!scheme) return null
  const normalized = normalizeScheme(scheme)
  const plotSbuById: Record<string, string | number> = {}
  const plotLabelById: Record<string, string> = {}
  for (const plotId of bookingPlotIds(booking)) {
    const plot = plots.find((p) => p.id === plotId)
    const line = booking.plotLines?.find((l) => l.plotId === plotId)
    plotSbuById[plotId] =
      plot?.sbuAreaSqYards || line?.landPayment?.sbuAreaSqYards || 0
    plotLabelById[plotId] = plot
      ? `Plot ${plot.plotNumber}`
      : line?.landPayment?.plotNumber
        ? `Plot ${line.landPayment.plotNumber}`
        : plotId.slice(0, 8)
  }
  return {
    scheme: normalized,
    plotSbuById,
    plotLabelById,
    otherReceipts: otherReceipts.filter((r) => r.bookingId === booking.id),
  }
}
