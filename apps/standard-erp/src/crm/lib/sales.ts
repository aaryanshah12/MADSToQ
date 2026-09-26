import { browserStorage } from './storage'
import {
  createEmptyBrokerInfo,
  createEmptyConstructionPayment,
  createEmptyLandPayment,
  createEmptyLeadSourceDetails,
  createEmptyPaymentPlanOverride,
  normalizeBookingRecord,
  type BookingRecord,
  type LeadRecord,
} from '../types/sales'

const LEADS_KEY = 'plotcrm.leads.v1'
const BOOKINGS_KEY = 'plotcrm.bookings.v1'

export function loadLeads(): LeadRecord[] {
  try {
    const raw = browserStorage()?.getItem(LEADS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as LeadRecord[]
    if (!Array.isArray(parsed)) return []
    return parsed.map((l) => ({
      ...l,
      followUpOn: l.followUpOn || null,
      followUpNote: l.followUpNote || '',
      lastContactedAt: l.lastContactedAt || null,
      lastContactedById: l.lastContactedById || null,
      lastContactedByName: l.lastContactedByName || '',
      lastContactNote: l.lastContactNote || '',
      sourceDetails: createEmptyLeadSourceDetails(l.sourceDetails),
    }))
  } catch {
    return []
  }
}

export function saveLeads(leads: LeadRecord[]): void {
  browserStorage()?.setItem(LEADS_KEY, JSON.stringify(leads))
}

export function loadBookings(): BookingRecord[] {
  try {
    const raw = browserStorage()?.getItem(BOOKINGS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as BookingRecord[]
    if (!Array.isArray(parsed)) return []
    return parsed.map((b) =>
      normalizeBookingRecord({
        ...b,
        salesPerson: b.salesPerson ?? '',
        viaBroker: b.viaBroker ?? false,
        brokerId: b.brokerId ?? null,
        broker: { ...createEmptyBrokerInfo(), ...(b.broker ?? {}) },
        propertyRegistration: b.propertyRegistration ?? true,
        landPayment: {
          ...createEmptyLandPayment(),
          ...(b.landPayment ?? {}),
        },
        constructionPayment: {
          ...createEmptyConstructionPayment(),
          ...(b.constructionPayment ?? {}),
        },
        landPaymentPlanId: b.landPaymentPlanId ?? b.paymentPlanId ?? null,
        constructionPaymentPlanId: b.constructionPaymentPlanId ?? null,
        paymentPlanId: b.landPaymentPlanId ?? b.paymentPlanId ?? null,
        landPaymentPlanCustom: b.landPaymentPlanCustom ?? false,
        landPaymentPlanOverride: b.landPaymentPlanOverride
          ? createEmptyPaymentPlanOverride(b.landPaymentPlanOverride)
          : null,
        constructionPaymentPlanCustom:
          b.constructionPaymentPlanCustom ?? false,
        constructionPaymentPlanOverride: b.constructionPaymentPlanOverride
          ? createEmptyPaymentPlanOverride(b.constructionPaymentPlanOverride)
          : null,
        landInstallmentDueDate:
          b.landInstallmentDueDate ||
          b.constructionInstallmentDueDate ||
          b.bookingDate ||
          '',
        constructionInstallmentDueDate:
          b.constructionInstallmentDueDate ||
          b.landInstallmentDueDate ||
          '',
        handoverAt: b.handoverAt || null,
        handoverDate: b.handoverDate || null,
        handoverById: b.handoverById || null,
        handoverByName: b.handoverByName || '',
        handoverNote: b.handoverNote || '',
        bookingAmountMode:
          b.bookingAmountMode === 'cash' || b.bookingAmountMode === 'cheque'
            ? b.bookingAmountMode
            : null,
      }),
    )
  } catch {
    return []
  }
}

export function saveBookings(bookings: BookingRecord[]): void {
  browserStorage()?.setItem(BOOKINGS_KEY, JSON.stringify(bookings))
}

export function generateBookingCode(existing: BookingRecord[]): string {
  const year = new Date().getFullYear()
  const seq =
    existing
      .map((b) => {
        const m = b.bookingCode.match(/BK-\d{4}-(\d+)/i)
        return m ? Number(m[1]) : 0
      })
      .reduce((max, n) => Math.max(max, n), 0) + 1
  return `BK-${year}-${String(seq).padStart(4, '0')}`
}
