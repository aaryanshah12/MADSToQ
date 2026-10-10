/** Home picker + optional `/` redirect when a client only offers some modules. */

export type HomeModuleId = 'inventory' | 'io' | 'pmc' | 'sales'

export type HomeModule = {
  id: HomeModuleId
  href: string
  label: string
}

const ALL_HOME_MODULES: HomeModule[] = [
  { id: 'inventory', href: '/inventory/login', label: 'Inventory' },
  { id: 'io', href: '/inward-outward/login', label: 'Inward / Outward' },
  { id: 'pmc', href: '/pmc', label: 'PMC' },
  { id: 'sales', href: '/personal/sales/login', label: 'Sales' },
]

function envEnabled(name: string, defaultEnabled = true): boolean {
  const raw = process.env[name]
  if (raw === undefined || String(raw).trim() === '') return defaultEnabled
  const s = String(raw).trim().toLowerCase()
  if (['0', 'false', 'no', 'off', 'n'].includes(s)) return false
  if (['1', 'true', 'yes', 'on', 'y'].includes(s)) return true
  return defaultEnabled
}

const FLAG: Record<HomeModuleId, string> = {
  inventory: 'NEXT_PUBLIC_MODULE_INVENTORY',
  io: 'NEXT_PUBLIC_MODULE_IO',
  pmc: 'NEXT_PUBLIC_MODULE_PMC',
  sales: 'NEXT_PUBLIC_MODULE_SALES',
}

export function isHomeModuleEnabled(id: HomeModuleId): boolean {
  return envEnabled(FLAG[id], true)
}

export function enabledHomeModules(): HomeModule[] {
  return ALL_HOME_MODULES.filter((m) => isHomeModuleEnabled(m.id))
}
