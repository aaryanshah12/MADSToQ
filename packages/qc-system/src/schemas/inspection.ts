import { z } from 'zod'

export const qcInstrumentTypeSchema = z.enum([
  'density',
  'boiling_point',
  'karl_fisher',
  'gc',
])
export type QcInstrumentType = z.infer<typeof qcInstrumentTypeSchema>

export const qcStageSchema = z.enum(['rm', 'sfg', 'fg'])
export type QcStage = z.infer<typeof qcStageSchema>

export const densityPayloadSchema = z.object({
  tare_g: z.number(),
  gross_g: z.number(),
  volume_ml: z.number().positive(),
  net_g: z.number().optional(),
  density: z.number().optional(),
})

export const boilingPointPayloadSchema = z.object({
  result_c: z.number(),
})

export const karlFisherPayloadSchema = z.object({
  water_factor_1: z.number(),
  water_factor_2: z.number(),
  water_factor_3: z.number(),
  average_factor: z.number().optional(),
  inject_volume_ml: z.number().optional(),
  density: z.number().optional(),
  result_pct: z.number().optional(),
})

export const gcPayloadSchema = z.object({
  method: z.string().optional(),
  file_no: z.string().optional(),
  rt_min: z.number().optional(),
  percentage: z.number().optional(),
})

export function computeDensityFields(payload: {
  tare_g: number
  gross_g: number
  volume_ml: number
}) {
  const net_g = Math.round((payload.gross_g - payload.tare_g) * 1000) / 1000
  const density =
    payload.volume_ml !== 0
      ? Math.round((net_g / payload.volume_ml) * 10000) / 10000
      : 0
  return { ...payload, net_g, density }
}

export function computeKarlFisherFields(payload: {
  water_factor_1: number
  water_factor_2: number
  water_factor_3: number
  inject_volume_ml?: number
  density?: number
  result_pct?: number
}) {
  const average_factor =
    Math.round(
      ((payload.water_factor_1 + payload.water_factor_2 + payload.water_factor_3) / 3) * 10000,
    ) / 10000
  return { ...payload, average_factor }
}

/** Legacy stub — kept for package exports */
export const qcInspectionSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  referenceType: z.enum(['production_batch', 'inventory_item']),
  referenceId: z.string(),
  result: z.enum(['pass', 'fail', 'pending']),
  notes: z.string().optional(),
})

export type QcInspection = z.infer<typeof qcInspectionSchema>
