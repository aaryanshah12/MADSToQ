/** Timed washes inside the "Washing of crude" stage, taken from the SFG → FG recipe. */

export type CrudeWashStep = {
  material_name: string
  start_date: string | null
  start_time: string | null
  end_date: string | null
  end_time: string | null
}

export function isCrudeWashStage(name: string | null | undefined): boolean {
  return (name || '').trim().toLowerCase() === 'washing of crude'
}

/** Sulphuric acid, caustic soda solution, and soda ash — not the crude SFG input. */
export function isCrudeWashMaterial(name: string): boolean {
  const n = name.trim().toLowerCase()
  if (!n || n.includes('semi-finished') || n === 'crude') return false
  if (n.includes('sulphuric') || n.includes('sulfuric')) return true
  if (n === 's.acid' || n === 's. acid' || n === 's acid') return true
  if (n.includes('caustic')) return true
  if (n.includes('soda ash')) return true
  return false
}

export function crudeWashMaterials(
  rms: Array<{
    material_name?: string | null
    sort_order?: number | null
    stock_kind?: string | null
    process?: string | null
  }>,
  process?: string | null,
): string[] {
  const seen = new Set<string>()
  const names: string[] = []
  const rows = [...rms]
    .filter((r) => (r.stock_kind || 'rm') !== 'sfg')
    .filter((r) => !process || !r.process || r.process === process)
    .filter((r) => isCrudeWashMaterial(r.material_name || ''))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  for (const row of rows) {
    const name = (row.material_name || '').trim()
    const key = name.toLowerCase()
    if (!name || seen.has(key)) continue
    seen.add(key)
    names.push(name)
  }
  return names
}

export function crudeWashKey(logId: string, materialName: string): string {
  return `${logId}::${materialName.trim().toLowerCase()}`
}

export function alignCrudeWashSteps(
  saved: CrudeWashStep[] | null | undefined,
  materials: string[],
): CrudeWashStep[] {
  const byName = new Map(
    (saved || []).map((step) => [step.material_name.trim().toLowerCase(), step]),
  )
  return materials.map((material_name) => {
    const prev = byName.get(material_name.toLowerCase())
    return {
      material_name,
      start_date: prev?.start_date || null,
      start_time: prev?.start_time || null,
      end_date: prev?.end_date || null,
      end_time: prev?.end_time || null,
    }
  })
}

export function washStartFilled(step: CrudeWashStep): boolean {
  return Boolean(step.start_date && step.start_time)
}

export function washEndFilled(step: CrudeWashStep): boolean {
  return Boolean(step.end_date && step.end_time)
}

/** Stage window is the first wash start through the last wash end. */
export function rollupCrudeWash(steps: CrudeWashStep[]): {
  start_date: string | null
  start_time: string | null
  end_date: string | null
  end_time: string | null
} {
  const first = steps[0]
  const last = steps[steps.length - 1]
  if (!first || !last) {
    return { start_date: null, start_time: null, end_date: null, end_time: null }
  }
  const allEnded = steps.every(washEndFilled)
  return {
    start_date: first.start_date,
    start_time: first.start_time,
    end_date: allEnded ? last.end_date : null,
    end_time: allEnded ? last.end_time : null,
  }
}
