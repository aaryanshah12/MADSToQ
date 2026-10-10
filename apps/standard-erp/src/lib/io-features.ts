/** Server-side IO module toggles (API routes, RPC). Client UI uses useIoFeatures() from IoFeaturesContext. */

export type IoDisabledModule = 'domestic' | 'international'

export function envIoEnabled(name: string, defaultEnabled = true): boolean {
  const raw = process.env[name]
  if (raw === undefined || String(raw).trim() === '') return defaultEnabled
  const s = String(raw).trim().toLowerCase()
  if (['0', 'false', 'no', 'off', 'n'].includes(s)) return false
  if (['1', 'true', 'yes', 'on', 'y'].includes(s)) return true
  return defaultEnabled
}

export function isIoModuleEnabled(module: IoDisabledModule): boolean {
  if (module === 'domestic') return envIoEnabled('NEXT_PUBLIC_IO_ENABLE_DOMESTIC', true)
  return envIoEnabled('NEXT_PUBLIC_IO_ENABLE_INTERNATIONAL', true)
}

export function assertIoModuleEnabled(module: IoDisabledModule): void {
  if (!isIoModuleEnabled(module)) {
    const label = module === 'domestic' ? 'Domestic' : 'International'
    throw new Error(`${label} is not enabled for this deployment`)
  }
}
