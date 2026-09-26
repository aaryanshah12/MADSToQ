import type { PlotStatus } from '../lib/pricing'
import { addLocalDays, todayLocalISO } from '../lib/dates'

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'site_visit'
  | 'negotiation'
  | 'converted'
  | 'lost'

export type LeadSource =
  | 'walk_in'
  | 'referral'
  | 'website'
  | 'social'
  | 'broker'
  | 'other'

export type SocialPlatform =
  | 'facebook'
  | 'instagram'
  | 'linkedin'
  | 'youtube'
  | 'whatsapp'
  | 'other'

/** Extra fields captured based on lead source */
export interface LeadSourceDetails {
  /** walk_in */
  walkInLocation: string
  walkInAttendedBy: string
  /** referral */
  referredByName: string
  referredByPhone: string
  /** website */
  websitePage: string
  /** social */
  socialPlatform: SocialPlatform | ''
  socialHandle: string
  /** broker */
  brokerId: string | null
  brokerName: string
  /** other */
  otherDetail: string
}

export function createEmptyLeadSourceDetails(
  partial?: Partial<LeadSourceDetails>,
): LeadSourceDetails {
  return {
    walkInLocation: '',
    walkInAttendedBy: '',
    referredByName: '',
    referredByPhone: '',
    websitePage: '',
    socialPlatform: '',
    socialHandle: '',
    brokerId: null,
    brokerName: '',
    otherDetail: '',
    ...partial,
  }
}

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  whatsapp: 'WhatsApp',
  other: 'Other',
}

export function leadSourceSummary(
  source: LeadSource,
  details: LeadSourceDetails,
): string {
  switch (source) {
    case 'walk_in':
      return [details.walkInLocation, details.walkInAttendedBy]
        .filter(Boolean)
        .join(' · ')
    case 'referral':
      return details.referredByName
        ? `Via ${details.referredByName}${
            details.referredByPhone ? ` · ${details.referredByPhone}` : ''
          }`
        : ''
    case 'website':
      return details.websitePage || ''
    case 'social':
      return [
        details.socialPlatform
          ? SOCIAL_PLATFORM_LABELS[details.socialPlatform]
          : '',
        details.socialHandle,
      ]
        .filter(Boolean)
        .join(' · ')
    case 'broker':
      return details.brokerName || ''
    case 'other':
      return details.otherDetail || ''
    default:
      return ''
  }
}

export interface LeadRecord {
  id: string
  schemeId: string
  plotId: string | null
  name: string
  phone: string
  email: string
  source: LeadSource
  sourceDetails: LeadSourceDetails
  status: LeadStatus
  notes: string
  /**
   * Next contact reminder date (YYYY-MM-DD local).
   * Set when lead says “call after X days”.
   * While this is today/overdue, the call is still pending until Mark called.
   */
  followUpOn: string | null
  /** Note left when setting the call-back reminder. */
  followUpNote: string
  /** When sales last marked a call as done (ISO). */
  lastContactedAt: string | null
  lastContactedById: string | null
  lastContactedByName: string
  /** Optional outcome note from the last completed call. */
  lastContactNote: string
  createdAt: string
  updatedAt: string
}

export type LeadFormInput = Omit<LeadRecord, 'id' | 'createdAt' | 'updatedAt'>

export type BookingStatus =
  | 'reserved'
  | 'booked'
  | 'cancelled'
  | 'completed'

/** How the booking token was paid — drives land cheque/cash quota seed */
export type BookingTokenMode = 'cash' | 'cheque'

export const BOOKING_TOKEN_MODE_LABELS: Record<BookingTokenMode, string> = {
  cash: 'Cash',
  cheque: 'Cheque / UPI / NEFT',
}

export type BrokerOrgType = 'llp' | 'partnership' | 'sole' | 'other'
export type BrokerageType = 'percent' | 'amount'
export type AgencyRelation = 'parent' | 'sister' | 'associated' | 'none'

/** Master broker profile (reusable across bookings) */
export interface BrokerProfile {
  fullName: string
  firmName: string
  phone: string
  email: string
  orgType: BrokerOrgType
  licenseNumber: string
  gstNumber: string
  bankAccountName: string
  bankAccountNumber: string
  bankIfsc: string
  bankName: string
  associatedAgency: string
  agencyRelation: AgencyRelation
}

export interface BrokerRecord extends BrokerProfile {
  id: string
  createdAt: string
  updatedAt: string
}

/** Snapshot on booking + deal brokerage */
export interface BrokerInfo extends BrokerProfile {
  brokerageType: BrokerageType
  brokerageValue: string
}

export const BROKER_ORG_LABELS: Record<BrokerOrgType, string> = {
  llp: 'LLP',
  partnership: 'Partnership',
  sole: 'Sole proprietorship',
  other: 'Other',
}

export const AGENCY_RELATION_LABELS: Record<AgencyRelation, string> = {
  none: 'None',
  associated: 'Associated agency',
  parent: 'Parent company',
  sister: 'Sister company',
}

export function createEmptyBrokerProfile(): BrokerProfile {
  return {
    fullName: '',
    firmName: '',
    phone: '',
    email: '',
    orgType: 'sole',
    licenseNumber: '',
    gstNumber: '',
    bankAccountName: '',
    bankAccountNumber: '',
    bankIfsc: '',
    bankName: '',
    associatedAgency: '',
    agencyRelation: 'none',
  }
}

export function createEmptyBrokerInfo(): BrokerInfo {
  return {
    ...createEmptyBrokerProfile(),
    brokerageType: 'percent',
    brokerageValue: '',
  }
}

export function brokerRecordToInfo(
  broker: BrokerRecord,
  brokerage?: Pick<BrokerInfo, 'brokerageType' | 'brokerageValue'>,
): BrokerInfo {
  return {
    fullName: broker.fullName,
    firmName: broker.firmName,
    phone: broker.phone,
    email: broker.email,
    orgType: broker.orgType,
    licenseNumber: broker.licenseNumber,
    gstNumber: broker.gstNumber,
    bankAccountName: broker.bankAccountName,
    bankAccountNumber: broker.bankAccountNumber,
    bankIfsc: broker.bankIfsc,
    bankName: broker.bankName,
    associatedAgency: broker.associatedAgency,
    agencyRelation: broker.agencyRelation,
    brokerageType: brokerage?.brokerageType ?? 'percent',
    brokerageValue: brokerage?.brokerageValue ?? '',
  }
}

/** Land payment config captured in booking wizard (compulsory) */
export interface LandPaymentConfig {
  configured: boolean
  bookingDate: string
  plotNumber: string
  sbuAreaSqYards: string
  /** ₹ per sq.yd — editable; defaults from scheme */
  basicRate: string
  /** Plot facing road width used for premium (13 / 12 / 9) */
  facingRoadWidth?: 13 | 12 | 9 | null
  /** Scheme premium label e.g. "15%" */
  roadPremiumLabel?: string
  /** Resolved road-width premium amount */
  roadPremiumAmount?: number
  /** Garden-facing premium when plot is garden facing */
  gardenPremiumAmount?: number
  /** Resolved development charge amount (fixed from scheme rules) */
  developmentChargeAmount: number
  /** Scheme raw development charge string for display */
  developmentChargeLabel: string
  basicAmount: number
  totalValue: number
}

/** Construction payment — optional on booking */
export interface ConstructionPaymentConfig {
  included: boolean
  configured: boolean
  bookingDate: string
  plotNumber: string
  sbuAreaSqYards: string
  unitType: '1bhk' | '2bhk' | '3bhk' | '4bhk' | ''
  unitLabel: string
  unitAreaSqYards: string
  constructionRate: string
  totalValue: number
  notes: string
  /** @deprecated use totalValue */
  amount: number
}

export function createEmptyLandPayment(): LandPaymentConfig {
  return {
    configured: false,
    bookingDate: '',
    plotNumber: '',
    sbuAreaSqYards: '',
    basicRate: '',
    facingRoadWidth: null,
    roadPremiumLabel: '',
    roadPremiumAmount: 0,
    gardenPremiumAmount: 0,
    developmentChargeAmount: 0,
    developmentChargeLabel: '',
    basicAmount: 0,
    totalValue: 0,
  }
}

export function createEmptyConstructionPayment(): ConstructionPaymentConfig {
  return {
    included: false,
    configured: false,
    bookingDate: '',
    plotNumber: '',
    sbuAreaSqYards: '',
    unitType: '',
    unitLabel: '',
    unitAreaSqYards: '',
    constructionRate: '',
    totalValue: 0,
    notes: '',
    amount: 0,
  }
}

/** Per-plot land + construction details on a multi-plot booking */
export interface BookingPlotLine {
  plotId: string
  landPayment: LandPaymentConfig
  constructionPayment: ConstructionPaymentConfig
}

export function createEmptyPlotLine(plotId: string): BookingPlotLine {
  return {
    plotId,
    landPayment: createEmptyLandPayment(),
    constructionPayment: createEmptyConstructionPayment(),
  }
}

export function bookingPlotIds(booking: {
  plotIds?: string[] | null
  plotId?: string | null
  plotLines?: Array<{ plotId: string }> | null
}): string[] {
  if (Array.isArray(booking.plotLines) && booking.plotLines.length > 0) {
    return booking.plotLines.map((l) => l.plotId).filter(Boolean)
  }
  if (Array.isArray(booking.plotIds) && booking.plotIds.length > 0) {
    return booking.plotIds.filter(Boolean)
  }
  if (booking.plotId) return [booking.plotId]
  return []
}

export function primaryPlotId(booking: {
  plotIds?: string[] | null
  plotId?: string | null
  plotLines?: Array<{ plotId: string }> | null
}): string {
  return bookingPlotIds(booking)[0] || ''
}

export function rollupLandPayment(
  lines: BookingPlotLine[],
): LandPaymentConfig {
  const configured = lines.filter((l) => l.landPayment?.configured)
  if (configured.length === 0) return createEmptyLandPayment()
  const first = configured[0].landPayment
  const totalValue = configured.reduce(
    (s, l) => s + (Number(l.landPayment.totalValue) || 0),
    0,
  )
  const basicAmount = configured.reduce(
    (s, l) => s + (Number(l.landPayment.basicAmount) || 0),
    0,
  )
  const developmentChargeAmount = configured.reduce(
    (s, l) => s + (Number(l.landPayment.developmentChargeAmount) || 0),
    0,
  )
  const roadPremiumAmount = configured.reduce(
    (s, l) => s + (Number(l.landPayment.roadPremiumAmount) || 0),
    0,
  )
  const gardenPremiumAmount = configured.reduce(
    (s, l) => s + (Number(l.landPayment.gardenPremiumAmount) || 0),
    0,
  )
  return {
    ...createEmptyLandPayment(),
    configured: true,
    bookingDate: first.bookingDate,
    plotNumber: configured.map((l) => l.landPayment.plotNumber).filter(Boolean).join(', '),
    sbuAreaSqYards: String(
      configured.reduce(
        (s, l) => s + (Number(l.landPayment.sbuAreaSqYards) || 0),
        0,
      ),
    ),
    basicRate: first.basicRate,
    facingRoadWidth: configured.length === 1 ? first.facingRoadWidth ?? null : null,
    roadPremiumLabel:
      configured.length === 1 ? first.roadPremiumLabel || '' : '',
    roadPremiumAmount,
    gardenPremiumAmount,
    developmentChargeAmount,
    developmentChargeLabel: first.developmentChargeLabel,
    basicAmount,
    totalValue,
  }
}

export function rollupConstructionPayment(
  lines: BookingPlotLine[],
): ConstructionPaymentConfig {
  const included = lines.filter(
    (l) =>
      l.constructionPayment?.included || l.constructionPayment?.configured,
  )
  if (included.length === 0) return createEmptyConstructionPayment()
  const first = included[0].constructionPayment
  const totalValue = included.reduce(
    (s, l) => s + (Number(l.constructionPayment.totalValue) || 0),
    0,
  )
  const unitLabels = included
    .map((l) => {
      const c = l.constructionPayment
      const type = c.unitType || c.unitLabel
      return type ? String(type).toUpperCase() : ''
    })
    .filter(Boolean)
  return {
    ...createEmptyConstructionPayment(),
    included: true,
    configured: included.every((l) => l.constructionPayment.configured),
    bookingDate: first.bookingDate,
    plotNumber: included
      .map((l) => l.constructionPayment.plotNumber)
      .filter(Boolean)
      .join(', '),
    sbuAreaSqYards: String(
      included.reduce(
        (s, l) => s + (Number(l.constructionPayment.sbuAreaSqYards) || 0),
        0,
      ),
    ),
    unitType: included.length === 1 ? first.unitType : '',
    unitLabel: unitLabels.join(' + ') || first.unitLabel,
    unitAreaSqYards: String(
      included.reduce(
        (s, l) => s + (Number(l.constructionPayment.unitAreaSqYards) || 0),
        0,
      ),
    ),
    constructionRate: first.constructionRate,
    totalValue,
    notes: first.notes,
    amount: totalValue,
  }
}

/** True when at least one plot has construction configured. */
export function bookingHasConstruction(booking: {
  plotLines?: Array<{
    constructionPayment?: { configured?: boolean } | null
  }> | null
  constructionPayment?: { configured?: boolean } | null
}): boolean {
  if (Array.isArray(booking.plotLines) && booking.plotLines.length > 0) {
    return booking.plotLines.some((l) => l.constructionPayment?.configured)
  }
  return Boolean(booking.constructionPayment?.configured)
}

export function constructionPlotCount(lines: BookingPlotLine[]): number {
  return lines.filter((l) => l.constructionPayment?.configured).length
}

/** Loose booking shape accepted by normalize / construction helpers. */
export type BookingNormalizeInput = {
  plotId?: string | null
  plotIds?: string[] | null
  plotLines?: Array<{
    plotId: string
    landPayment?: Partial<LandPaymentConfig> | null
    constructionPayment?: Partial<ConstructionPaymentConfig> | null
  }> | null
  landPayment?: Partial<LandPaymentConfig> | null
  constructionPayment?: Partial<ConstructionPaymentConfig> | null
  status?: string
}

/** Plot lines that still need construction configured. */
export function plotsMissingConstruction(
  booking: BookingNormalizeInput,
): BookingPlotLine[] {
  const normalized = normalizeBookingRecord(booking)
  return normalized.plotLines.filter((l) => !l.constructionPayment?.configured)
}

/** True when at least one selected plot still lacks construction. */
export function canAddConstructionToBooking(
  booking: BookingNormalizeInput,
): boolean {
  if (booking.status === 'cancelled') return false
  return plotsMissingConstruction(booking).length > 0
}

/** Ensure plotLines / plotIds / rollup land+construction are consistent. */
export function normalizeBookingRecord<T extends BookingNormalizeInput>(
  b: T,
): Omit<
  T,
  'plotId' | 'plotIds' | 'plotLines' | 'landPayment' | 'constructionPayment'
> & {
  plotIds: string[]
  plotId: string
  plotLines: BookingPlotLine[]
  landPayment: LandPaymentConfig
  constructionPayment: ConstructionPaymentConfig
} {
  let plotLines: BookingPlotLine[] = Array.isArray(b.plotLines)
    ? b.plotLines.map((l) => ({
        plotId: l.plotId,
        landPayment: {
          ...createEmptyLandPayment(),
          ...(l.landPayment ?? {}),
        },
        constructionPayment: {
          ...createEmptyConstructionPayment(),
          ...(l.constructionPayment ?? {}),
        },
      }))
    : []

  if (plotLines.length === 0) {
    const ids =
      Array.isArray(b.plotIds) && b.plotIds.length > 0
        ? b.plotIds.filter(Boolean)
        : b.plotId
          ? [b.plotId]
          : []
    if (ids.length > 0) {
      plotLines = ids.map((plotId, i) => {
        if (i === 0 && (b.landPayment || b.constructionPayment)) {
          return {
            plotId,
            landPayment: {
              ...createEmptyLandPayment(),
              ...(b.landPayment ?? {}),
            },
            constructionPayment: {
              ...createEmptyConstructionPayment(),
              ...(b.constructionPayment ?? {}),
            },
          }
        }
        return createEmptyPlotLine(plotId)
      })
    }
  }

  const plotIds = plotLines.map((l) => l.plotId).filter(Boolean)
  const landPayment = rollupLandPayment(plotLines)
  const constructionPayment = rollupConstructionPayment(plotLines)

  return {
    ...b,
    plotIds,
    plotId: plotIds[0] || b.plotId || '',
    plotLines,
    landPayment:
      plotLines.length > 0
        ? landPayment
        : { ...createEmptyLandPayment(), ...(b.landPayment ?? {}) },
    constructionPayment:
      plotLines.length > 0
        ? constructionPayment
        : {
            ...createEmptyConstructionPayment(),
            ...(b.constructionPayment ?? {}),
          },
  }
}

/** Booking-level override of scheme payment plan terms */
export interface BookingPaymentPlanOverride {
  name: string
  months: string
  chequePaymentPercent: string
  /** Always 5 — not user-editable */
  chequeGstPercent: string
}

export function createEmptyPaymentPlanOverride(
  from?: Partial<BookingPaymentPlanOverride> | null,
): BookingPaymentPlanOverride {
  return {
    name: from?.name || 'Custom plan',
    months: from?.months || '12',
    chequePaymentPercent: from?.chequePaymentPercent ?? '50',
    chequeGstPercent: '5',
  }
}

export interface BookingRecord {
  id: string
  bookingCode: string
  schemeId: string
  /** @deprecated Prefer plotIds / plotLines — kept as plotIds[0] for compat */
  plotId: string
  /** All plots on this booking (same scheme) */
  plotIds: string[]
  /** Per-plot land + construction details */
  plotLines: BookingPlotLine[]
  leadId: string | null
  customerName: string
  customerPhone: string
  customerEmail: string
  /** Who took / owns this booking */
  salesPerson: string
  /** Booking originated through a broker */
  viaBroker: boolean
  brokerId: string | null
  broker: BrokerInfo
  /** Whether property registration is included / required for this booking */
  propertyRegistration: boolean
  /** Rolled-up land totals from plotLines (used by EMI schedule) */
  landPayment: LandPaymentConfig
  /** Rolled-up construction totals from plotLines */
  constructionPayment: ConstructionPaymentConfig
  /** Scheme payment plan for land */
  landPaymentPlanId: string | null
  /** Scheme payment plan for construction */
  constructionPaymentPlanId: string | null
  /** @deprecated Use landPaymentPlanId */
  paymentPlanId: string | null
  /** When true, land uses landPaymentPlanOverride instead of scheme master values */
  landPaymentPlanCustom: boolean
  /** Customized land plan terms for this booking */
  landPaymentPlanOverride: BookingPaymentPlanOverride | null
  /** When true, construction uses constructionPaymentPlanOverride */
  constructionPaymentPlanCustom: boolean
  /** Customized construction plan terms for this booking */
  constructionPaymentPlanOverride: BookingPaymentPlanOverride | null
  /** First installment due date — same for land and construction */
  landInstallmentDueDate: string
  /** Kept in sync with landInstallmentDueDate when construction is included */
  constructionInstallmentDueDate: string
  bookingAmount: string
  /**
   * How the token / booking amount was collected.
   * cash → counts against land cash quota
   * cheque → amount is GST-inclusive; full take counts against land cheque quota
   * null/undefined → legacy bookings (not attributed to quotas)
   */
  bookingAmountMode: BookingTokenMode | null
  quotedPrice: string
  bookingDate: string
  validUntil: string
  status: BookingStatus
  notes: string
  /** When the plot was handed over to the client (ISO datetime). */
  handoverAt: string | null
  /** Handover calendar date (YYYY-MM-DD local). */
  handoverDate: string | null
  handoverById: string | null
  handoverByName: string
  handoverNote: string
  createdAt: string
  updatedAt: string
}

export type BookingFormInput = Omit<
  BookingRecord,
  'id' | 'bookingCode' | 'createdAt' | 'updatedAt'
>

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  site_visit: 'Site Visit',
  negotiation: 'Negotiation',
  converted: 'Converted',
  lost: 'Lost',
}

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  walk_in: 'Walk-in',
  referral: 'Referral',
  website: 'Website',
  social: 'Social',
  broker: 'Broker',
  other: 'Other',
}

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  reserved: 'Reserved',
  booked: 'Booked',
  cancelled: 'Cancelled',
  completed: 'Completed',
}

export function bookingStatusToPlotStatus(
  status: BookingStatus,
): PlotStatus | null {
  if (status === 'reserved') return 'reserved'
  if (status === 'booked') return 'booked'
  if (status === 'completed') return 'sold'
  if (status === 'cancelled') return 'available'
  return null
}

export function addDays(isoDate: string, days: number): string {
  return addLocalDays(isoDate, days)
}

export function todayISO(): string {
  return todayLocalISO()
}
