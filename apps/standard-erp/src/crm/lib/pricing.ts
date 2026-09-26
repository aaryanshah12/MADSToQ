import type {
  RoadWidthMeters,
  RoadWidthPremiumTier,
  SchemeFormData,
  SchemeRecord,
} from '../types/scheme'
import {
  CONSTRUCTION_UNIT_KEYS,
  createDefaultConstructionUnits,
  DEFAULT_ROAD_WIDTH_PREMIUMS,
  normalizeOtherPaymentFields,
  normalizePaymentPlans,
  ROAD_WIDTH_TIERS,
  syncLegacyPaymentPlanFields,
} from '../types/scheme'

export type PlotStatus = 'available' | 'reserved' | 'booked' | 'sold'

export interface PlotRecord {
  id: string
  schemeId: string
  blockName: string
  plotNumber: string
  carpetAreaSqM: string
  sbuAreaSqYards: string
  facingRoadWidth: RoadWidthMeters | null
  isGardenFacing: boolean
  status: PlotStatus
  createdAt: string
  updatedAt: string
}

export interface PlotFormInput {
  schemeId: string
  blockName: string
  plotNumber: string
  carpetAreaSqM: string
  sbuAreaSqYards: string
  facingRoadWidth: RoadWidthMeters | null
  isGardenFacing: boolean
  status: PlotStatus
}

export function normalizeScheme(raw: SchemeRecord): SchemeRecord {
  const legacy = raw as SchemeRecord & { cornerPlotPremium?: string }
  const defaults = createDefaultConstructionUnits()
  const units = raw.constructionUnits ?? defaults
  return {
    ...raw,
    developmentCharge:
      raw.developmentCharge ?? legacy.cornerPlotPremium ?? '',
    roadWidthPremiums: {
      ...DEFAULT_ROAD_WIDTH_PREMIUMS,
      ...(raw.roadWidthPremiums ?? {}),
    },
    constructionUnits: Object.fromEntries(
      CONSTRUCTION_UNIT_KEYS.map((key) => [
        key,
        {
          ...defaults[key],
          ...(units[key] ?? {}),
          areaSqYards:
            units[key]?.areaSqYards || defaults[key].areaSqYards,
        },
      ]),
    ) as SchemeRecord['constructionUnits'],
    paymentPlans: normalizePaymentPlans(raw),
    ...syncLegacyPaymentPlanFields(normalizePaymentPlans(raw)),
    ...normalizeOtherPaymentFields(raw),
  }
}

export function roadPremiumForWidth(
  tiers: RoadWidthPremiumTier | undefined,
  width: RoadWidthMeters | null,
): string {
  if (!width || !tiers) return '0'
  if (width === 13) return tiers.road13m || '0'
  if (width === 12) return tiers.road12m || '0'
  return tiers.road9m || '0'
}

/**
 * Parse premium strings like "15%", "500" (₹/sq.yd), or flat when unitArea is omitted.
 * Percentage applies to `baseAmount`. Absolute values are treated as ₹ per sq.yard × area
 * when `areaSqYards` is provided; otherwise as a flat ₹ amount.
 */
export function resolvePremiumAmount(
  premium: string,
  baseAmount: number,
  areaSqYards?: number,
): number {
  const raw = premium.trim()
  if (!raw || raw === '0') return 0

  if (raw.endsWith('%')) {
    const pct = Number(raw.slice(0, -1))
    if (!Number.isFinite(pct)) return 0
    return (baseAmount * pct) / 100
  }

  const n = Number(raw.replace(/,/g, ''))
  if (!Number.isFinite(n)) return 0
  if (areaSqYards !== undefined && areaSqYards > 0) return n * areaSqYards
  return n
}

export interface PlotPriceBreakdown {
  areaSqYards: number
  baseRate: number
  baseAmount: number
  roadWidth: RoadWidthMeters | null
  roadPremiumLabel: string
  roadPremiumAmount: number
  developmentChargeAmount: number
  gardenPremiumAmount: number
  plcCharges: number
  maintenanceCharges: number
  subtotal: number
  gstApplicable: boolean
  gstAmount: number
  total: number
}

export function calculatePlotPrice(
  scheme: SchemeFormData,
  plot: Pick<
    PlotRecord,
    'sbuAreaSqYards' | 'facingRoadWidth' | 'isGardenFacing'
  >,
): PlotPriceBreakdown | null {
  const areaSqYards = Number(plot.sbuAreaSqYards)
  const baseRate = Number(scheme.baseRatePerSqYard)
  if (!Number.isFinite(areaSqYards) || areaSqYards <= 0) return null
  if (!Number.isFinite(baseRate) || baseRate <= 0) return null

  const baseAmount = areaSqYards * baseRate
  const roadPremiumLabel = roadPremiumForWidth(
    scheme.roadWidthPremiums,
    plot.facingRoadWidth,
  )
  const roadPremiumAmount = resolvePremiumAmount(
    roadPremiumLabel,
    baseAmount,
    areaSqYards,
  )
  const developmentChargeAmount = resolvePremiumAmount(
    scheme.developmentCharge || '',
    baseAmount,
    areaSqYards,
  )
  const gardenPremiumAmount = plot.isGardenFacing
    ? resolvePremiumAmount(scheme.gardenFacingPremium, baseAmount, areaSqYards)
    : 0
  const plcCharges = Number(scheme.plcCharges) || 0
  const maintenanceCharges = Number(scheme.maintenanceCharges) || 0

  const subtotal =
    baseAmount +
    roadPremiumAmount +
    developmentChargeAmount +
    gardenPremiumAmount +
    plcCharges +
    maintenanceCharges

  // GST is not part of plot/land estimate — it is applied via payment-plan
  // cheque GST % at collection time.
  return {
    areaSqYards,
    baseRate,
    baseAmount,
    roadWidth: plot.facingRoadWidth,
    roadPremiumLabel,
    roadPremiumAmount,
    developmentChargeAmount,
    gardenPremiumAmount,
    plcCharges,
    maintenanceCharges,
    subtotal,
    gstApplicable: scheme.gstApplicable,
    gstAmount: 0,
    total: subtotal,
  }
}

export function isRoadWidth(value: number): value is RoadWidthMeters {
  return (ROAD_WIDTH_TIERS as readonly number[]).includes(value)
}
