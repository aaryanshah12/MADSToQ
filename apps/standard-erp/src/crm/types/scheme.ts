export type ProjectStatus = 'Planning' | 'Active' | 'Sold Out' | 'Completed'
export type SchemePublishStatus = 'draft' | 'published'
export type AreaUnit = 'Sq. Yard' | 'Sq. Meter' | 'Acre'

/** Facing road widths used for preferential pricing (Scott: 13 / 12 / 9 m). */
export const ROAD_WIDTH_TIERS = [13, 12, 9] as const
export type RoadWidthMeters = (typeof ROAD_WIDTH_TIERS)[number]

export interface RoadWidthPremiumTier {
  /** Premium for plots facing ~13 m road — use "15%" or ₹/sq.yd amount */
  road13m: string
  road12m: string
  road9m: string
}

export const DEFAULT_ROAD_WIDTH_PREMIUMS: RoadWidthPremiumTier = {
  road13m: '15%',
  road12m: '10%',
  road9m: '0',
}

export const CONSTRUCTION_UNIT_KEYS = ['1bhk', '2bhk', '3bhk', '4bhk'] as const
export type ConstructionUnitKey = (typeof CONSTRUCTION_UNIT_KEYS)[number]

export interface ConstructionUnitType {
  label: string
  /** Built-up / construction area in sq. yards */
  areaSqYards: string
  /** Construction rate ₹ per sq. yard */
  ratePerSqYard: string
}

export const DEFAULT_CONSTRUCTION_UNITS: Record<
  ConstructionUnitKey,
  ConstructionUnitType
> = {
  '1bhk': { label: '1 BHK', areaSqYards: '155', ratePerSqYard: '' },
  '2bhk': { label: '2 BHK', areaSqYards: '300', ratePerSqYard: '' },
  '3bhk': { label: '3 BHK', areaSqYards: '450', ratePerSqYard: '' },
  '4bhk': { label: '4 BHK', areaSqYards: '600', ratePerSqYard: '' },
}

export function createDefaultConstructionUnits(): Record<
  ConstructionUnitKey,
  ConstructionUnitType
> {
  return {
    '1bhk': { ...DEFAULT_CONSTRUCTION_UNITS['1bhk'] },
    '2bhk': { ...DEFAULT_CONSTRUCTION_UNITS['2bhk'] },
    '3bhk': { ...DEFAULT_CONSTRUCTION_UNITS['3bhk'] },
    '4bhk': { ...DEFAULT_CONSTRUCTION_UNITS['4bhk'] },
  }
}

export const AMENITY_KEYS = [
  'internalRoads',
  'waterSupply',
  'undergroundDrainage',
  'electricity',
  'streetLights',
  'compoundWall',
  'securityGate',
  'garden',
  'clubHouse',
  'cctv',
  'undergroundCabling',
] as const

export type AmenityKey = (typeof AMENITY_KEYS)[number]

export const AMENITY_LABELS: Record<AmenityKey, string> = {
  internalRoads: 'Internal Roads',
  waterSupply: 'Water Supply',
  undergroundDrainage: 'Underground Drainage',
  electricity: 'Electricity',
  streetLights: 'Street Lights',
  compoundWall: 'Compound Wall',
  securityGate: 'Security Gate',
  garden: 'Garden',
  clubHouse: 'Club House',
  cctv: 'CCTV',
  undergroundCabling: 'Underground Cabling',
}

export const DOCUMENT_KEYS = [
  'layoutPlan',
  'brochure',
  'reraCertificate',
  'naOrder',
  'titleClearance',
  'priceList',
  'otherDocuments',
] as const

export type DocumentKey = (typeof DOCUMENT_KEYS)[number]

export const DOCUMENT_LABELS: Record<DocumentKey, string> = {
  layoutPlan: 'Layout Plan',
  brochure: 'Brochure',
  reraCertificate: 'RERA Certificate',
  naOrder: 'NA Order',
  titleClearance: 'Title Clearance',
  priceList: 'Price List',
  otherDocuments: 'Other Documents',
}

export interface UploadedFileMeta {
  name: string
  size: number
  type: string
  uploadedAt: string
}

export interface SchemeFormData {
  // Step 1
  schemeName: string
  schemeCode: string
  developerCompany: string
  projectStatus: ProjectStatus
  launchDate: string
  description: string

  // Step 2
  country: string
  state: string
  district: string
  taluka: string
  village: string
  surveyNumbers: string
  tpNumber: string
  fpNumber: string
  fullAddress: string
  googleMapsLink: string
  latitude: string
  longitude: string

  // Step 3
  totalLandArea: string
  areaUnit: AreaUnit
  saleableArea: string
  commonArea: string
  numberOfBlocks: string
  totalNumberOfPlots: string

  // Step 4
  amenities: Record<AmenityKey, boolean>
  internalRoadWidth: string
  mainRoadWidth: string
  otherAmenities: string

  // Step 5
  baseRatePerSqYard: string
  /** Flat ₹ / ₹ per sq.yd / % of base — applied to every plot */
  developmentCharge: string
  /** @deprecated Prefer roadWidthPremiums — kept for older drafts */
  mainRoadPremium: string
  roadWidthPremiums: RoadWidthPremiumTier
  gardenFacingPremium: string
  plcCharges: string
  maintenanceCharges: string
  gstApplicable: boolean
  /** Construction unit master: 1–4 BHK areas + rates */
  constructionUnits: Record<ConstructionUnitKey, ConstructionUnitType>

  /** Club deposit — fixed ₹ per plot, cash only */
  clubDepositAmount: string
  /** One-time maintenance — ₹/sq.yd × plot SBU, cash only */
  oneTimeMaintenanceRate: string
  /** How many development / maintenance phases this scheme has */
  totalPhases: string
  /** Active phase (1…totalPhases) for running-maintenance dues */
  currentPhase: string
  /** Running maintenance ₹ / month / sq.yd per phase (cheque + 18% GST) */
  runningMaintenanceRates: string[]
  /** Months to collect per phase (typically 6 / 12 / 24); amount = rate × SBU × months */
  runningMaintenanceMonths: string[]

  // Step 6
  minimumBookingAmount: string
  bookingValidityDays: string
  reservationValidity: string
  cancellationCharges: string
  installmentAvailable: boolean
  /** Named payment plans (Plan 1, Plan 2, …) */
  paymentPlans: SchemePaymentPlan[]
  /** @deprecated Use paymentPlans[0] */
  paymentPlanMonths: string
  /** @deprecated Use paymentPlans[0] */
  chequePaymentPercent: string
  /** @deprecated Use paymentPlans[0] */
  chequeGstPercent: string

  // Step 7
  documents: Record<DocumentKey, UploadedFileMeta | null>
}

export interface SchemePaymentPlan {
  id: string
  name: string
  /** Plan duration in months */
  months: string
  /** % of plan value collected by cheque */
  chequePaymentPercent: string
  /** GST % applied only on cheque amount (default 5) */
  chequeGstPercent: string
}

export interface SchemeRecord extends SchemeFormData {
  id: string
  publishStatus: SchemePublishStatus
  createdAt: string
  updatedAt: string
}

export const createEmptyAmenities = (): Record<AmenityKey, boolean> =>
  Object.fromEntries(AMENITY_KEYS.map((k) => [k, false])) as Record<
    AmenityKey,
    boolean
  >

export const createEmptyDocuments = (): Record<
  DocumentKey,
  UploadedFileMeta | null
> =>
  Object.fromEntries(DOCUMENT_KEYS.map((k) => [k, null])) as Record<
    DocumentKey,
    UploadedFileMeta | null
  >

export const createEmptyScheme = (schemeCode = ''): SchemeFormData => ({
  schemeName: '',
  schemeCode,
  developerCompany: '',
  projectStatus: 'Planning',
  launchDate: '',
  description: '',
  country: 'India',
  state: '',
  district: '',
  taluka: '',
  village: '',
  surveyNumbers: '',
  tpNumber: '',
  fpNumber: '',
  fullAddress: '',
  googleMapsLink: '',
  latitude: '',
  longitude: '',
  totalLandArea: '',
  areaUnit: 'Sq. Yard',
  saleableArea: '',
  commonArea: '',
  numberOfBlocks: '',
  totalNumberOfPlots: '',
  amenities: createEmptyAmenities(),
  internalRoadWidth: '',
  mainRoadWidth: '',
  otherAmenities: '',
  baseRatePerSqYard: '',
  developmentCharge: '',
  mainRoadPremium: '',
  roadWidthPremiums: { ...DEFAULT_ROAD_WIDTH_PREMIUMS },
  gardenFacingPremium: '',
  plcCharges: '',
  maintenanceCharges: '',
  gstApplicable: true,
  constructionUnits: createDefaultConstructionUnits(),
  clubDepositAmount: '',
  oneTimeMaintenanceRate: '',
  totalPhases: '1',
  currentPhase: '1',
  runningMaintenanceRates: [''],
  runningMaintenanceMonths: ['12'],
  minimumBookingAmount: '',
  bookingValidityDays: '15',
  reservationValidity: '7',
  cancellationCharges: '',
  installmentAvailable: true,
  paymentPlans: createDefaultPaymentPlans(),
  paymentPlanMonths: '12',
  chequePaymentPercent: '50',
  chequeGstPercent: '5',
  documents: createEmptyDocuments(),
})

/** Fixed GST % on land/construction cheque share */
export const FIXED_CHEQUE_GST_PERCENT = '5'

/** GST % on running maintenance (cheque / UPI / NEFT only) */
export const RUNNING_MAINTENANCE_GST_PERCENT = '18'

/** Common collection periods for running maintenance */
export const RUNNING_MAINTENANCE_MONTH_OPTIONS = [6, 12, 24] as const

export function normalizePhaseCount(raw: string | number | undefined): number {
  const n = Math.floor(Number(raw) || 0)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(50, n)
}

export function normalizeCurrentPhase(
  current: string | number | undefined,
  totalPhases: number,
): number {
  const n = Math.floor(Number(current) || 0)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(totalPhases, n)
}

/** Resize / pad running-maintenance rates to match totalPhases. */
export function normalizeRunningMaintenanceRates(
  rates: string[] | undefined,
  totalPhases: number,
): string[] {
  const total = normalizePhaseCount(totalPhases)
  const src = Array.isArray(rates) ? rates : []
  const next: string[] = []
  for (let i = 0; i < total; i++) {
    next.push(src[i] != null ? String(src[i]) : '')
  }
  return next
}

/** Resize / pad months-to-collect per phase (default 12). */
export function normalizeRunningMaintenanceMonths(
  months: string[] | undefined,
  totalPhases: number,
): string[] {
  const total = normalizePhaseCount(totalPhases)
  const src = Array.isArray(months) ? months : []
  const next: string[] = []
  for (let i = 0; i < total; i++) {
    const raw = src[i] != null ? String(src[i]) : '12'
    const n = Math.floor(Number(raw) || 0)
    next.push(String(n >= 1 ? n : 12))
  }
  return next
}

export function normalizeOtherPaymentFields(
  raw: Partial<SchemeFormData>,
): Pick<
  SchemeFormData,
  | 'clubDepositAmount'
  | 'oneTimeMaintenanceRate'
  | 'totalPhases'
  | 'currentPhase'
  | 'runningMaintenanceRates'
  | 'runningMaintenanceMonths'
> {
  const totalPhases = String(normalizePhaseCount(raw.totalPhases))
  const total = normalizePhaseCount(totalPhases)
  const currentPhase = String(
    normalizeCurrentPhase(raw.currentPhase, total),
  )
  return {
    clubDepositAmount: raw.clubDepositAmount ?? '',
    oneTimeMaintenanceRate: raw.oneTimeMaintenanceRate ?? '',
    totalPhases,
    currentPhase,
    runningMaintenanceRates: normalizeRunningMaintenanceRates(
      raw.runningMaintenanceRates,
      total,
    ),
    runningMaintenanceMonths: normalizeRunningMaintenanceMonths(
      raw.runningMaintenanceMonths,
      total,
    ),
  }
}

export function createPaymentPlan(
  index = 1,
  overrides: Partial<SchemePaymentPlan> = {},
): SchemePaymentPlan {
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `plan-${Date.now()}-${index}`,
    name: `Plan ${index}`,
    months: '12',
    chequePaymentPercent: '50',
    ...overrides,
    chequeGstPercent: FIXED_CHEQUE_GST_PERCENT,
  }
}

export function createDefaultPaymentPlans(): SchemePaymentPlan[] {
  return [createPaymentPlan(1, { id: 'plan-default' })]
}

export function normalizePaymentPlans(
  raw: Pick<
    SchemeFormData,
    | 'paymentPlans'
    | 'paymentPlanMonths'
    | 'chequePaymentPercent'
    | 'chequeGstPercent'
  >,
): SchemePaymentPlan[] {
  if (Array.isArray(raw.paymentPlans) && raw.paymentPlans.length > 0) {
    return raw.paymentPlans.map((p, i) => ({
      ...createPaymentPlan(i + 1),
      ...p,
      name: p.name || `Plan ${i + 1}`,
      months: p.months || '12',
      chequePaymentPercent: p.chequePaymentPercent ?? '50',
      chequeGstPercent: FIXED_CHEQUE_GST_PERCENT,
    }))
  }
  return [
    createPaymentPlan(1, {
      id: 'plan-default',
      months: raw.paymentPlanMonths || '12',
      chequePaymentPercent: raw.chequePaymentPercent ?? '50',
      chequeGstPercent: FIXED_CHEQUE_GST_PERCENT,
    }),
  ]
}

/** Keep legacy single-plan fields in sync with the first plan. */
export function syncLegacyPaymentPlanFields(
  plans: SchemePaymentPlan[],
): Pick<
  SchemeFormData,
  'paymentPlanMonths' | 'chequePaymentPercent' | 'chequeGstPercent'
> {
  const first = plans[0] ?? createPaymentPlan(1)
  return {
    paymentPlanMonths: first.months,
    chequePaymentPercent: first.chequePaymentPercent,
    chequeGstPercent: FIXED_CHEQUE_GST_PERCENT,
  }
}

/** Split a payment-plan amount into cheque (+GST) and cash (no GST). */
export function calcChequeCashSplit(
  totalAmount: number,
  chequePercent: number,
  chequeGstPercent = 5,
) {
  // Cheque share must be at least 50% of the split base
  const pct = Math.min(100, Math.max(50, chequePercent))
  const gstPct = Math.max(0, chequeGstPercent)
  const chequeBase = (totalAmount * pct) / 100
  const cashAmount = totalAmount - chequeBase
  const chequeGst = (chequeBase * gstPct) / 100
  const chequeTotal = chequeBase + chequeGst
  return {
    chequePercent: pct,
    cashPercent: 100 - pct,
    chequeBase,
    chequeGst,
    chequeTotal,
    cashAmount,
    planAmount: totalAmount,
    payableTotal: chequeTotal + cashAmount,
  }
}
