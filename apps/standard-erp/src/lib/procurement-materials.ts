/** Known chemical RM HSN codes used when a factory catalog entry has no HSN. */
export const DEFAULT_MATERIAL_HSN: Record<string, string> = {
  Oleum: '28070010',
  Sulphur: '25030010',
  PNT: '29042090',
  Caustic: '28151110',
}

export type MaterialCatalogEntry = { name: string; hsn: string }

/** Normalize factory.materials JSON (string[] or {name,hsn}[]) into catalog entries. */
export function parseMaterialCatalog(raw: unknown): MaterialCatalogEntry[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? (() => {
          try {
            const parsed = JSON.parse(raw)
            return Array.isArray(parsed) ? parsed : []
          } catch {
            return []
          }
        })()
      : []

  return list
    .map((item): MaterialCatalogEntry | null => {
      if (typeof item === 'string' && item.trim()) {
        const name = item.trim()
        return { name, hsn: DEFAULT_MATERIAL_HSN[name] ?? '' }
      }
      if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>
        const name = String(o.name ?? o.material ?? '').trim()
        if (!name) return null
        const hsn = String(o.hsn ?? o.hsnCode ?? o.hsn_code ?? DEFAULT_MATERIAL_HSN[name] ?? '').trim()
        return { name, hsn }
      }
      return null
    })
    .filter((x): x is MaterialCatalogEntry => Boolean(x))
}

export function resolveMaterialHsn(materialType: string, factoryMaterials?: unknown): string {
  const name = materialType.trim()
  const fromCatalog = parseMaterialCatalog(factoryMaterials).find(
    (m) => m.name.toLowerCase() === name.toLowerCase(),
  )
  if (fromCatalog?.hsn) return fromCatalog.hsn
  return DEFAULT_MATERIAL_HSN[name] ?? ''
}
