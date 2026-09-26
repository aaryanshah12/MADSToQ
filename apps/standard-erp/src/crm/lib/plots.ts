import { browserStorage } from './storage'
import type { PlotRecord } from './pricing'
import { uid } from './schemes'

const STORAGE_KEY = 'plotcrm.plots.v1'

export function loadPlots(): PlotRecord[] {
  try {
    const raw = browserStorage()?.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PlotRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function savePlots(plots: PlotRecord[]): void {
  browserStorage()?.setItem(STORAGE_KEY, JSON.stringify(plots))
}

/** Scott Phase-1 availability sample (road width assigned later from masterplan). */
export const SCOTT_PHASE1_AVAILABILITY: Array<{
  plotNumber: string
  carpetAreaSqM: string
  sbuAreaSqYards: string
}> = [
  { plotNumber: '1', carpetAreaSqM: '847.74', sbuAreaSqYards: '1584' },
  { plotNumber: '2', carpetAreaSqM: '570.01', sbuAreaSqYards: '1065' },
  { plotNumber: '3', carpetAreaSqM: '602.65', sbuAreaSqYards: '1126' },
  { plotNumber: '4', carpetAreaSqM: '579.04', sbuAreaSqYards: '1082' },
  { plotNumber: '22', carpetAreaSqM: '892.51', sbuAreaSqYards: '1668' },
  { plotNumber: '34', carpetAreaSqM: '764.21', sbuAreaSqYards: '1428' },
  { plotNumber: '35', carpetAreaSqM: '768.40', sbuAreaSqYards: '1436' },
  { plotNumber: '39', carpetAreaSqM: '955.94', sbuAreaSqYards: '1786' },
  { plotNumber: '43B', carpetAreaSqM: '613.31', sbuAreaSqYards: '1146' },
  { plotNumber: '47', carpetAreaSqM: '843.10', sbuAreaSqYards: '1576' },
  { plotNumber: '48', carpetAreaSqM: '861.46', sbuAreaSqYards: '1610' },
  { plotNumber: '51', carpetAreaSqM: '1047', sbuAreaSqYards: '1957' },
  { plotNumber: '52', carpetAreaSqM: '1182.8', sbuAreaSqYards: '2210' },
  { plotNumber: '184', carpetAreaSqM: '834.94', sbuAreaSqYards: '1560' },
  { plotNumber: '185', carpetAreaSqM: '889.54', sbuAreaSqYards: '1662' },
  { plotNumber: '187', carpetAreaSqM: '811.88', sbuAreaSqYards: '1517' },
  { plotNumber: '188', carpetAreaSqM: '866.71', sbuAreaSqYards: '1620' },
  { plotNumber: '189', carpetAreaSqM: '703.11', sbuAreaSqYards: '1314' },
  { plotNumber: '190', carpetAreaSqM: '409.30', sbuAreaSqYards: '765' },
]

export function buildScottPlots(schemeId: string): PlotRecord[] {
  const now = new Date().toISOString()
  return SCOTT_PHASE1_AVAILABILITY.map((row) => ({
    id: uid(),
    schemeId,
    blockName: 'Phase 1',
    plotNumber: row.plotNumber,
    carpetAreaSqM: row.carpetAreaSqM,
    sbuAreaSqYards: row.sbuAreaSqYards,
    facingRoadWidth: null,
    isGardenFacing: false,
    status: 'available' as const,
    createdAt: now,
    updatedAt: now,
  }))
}
