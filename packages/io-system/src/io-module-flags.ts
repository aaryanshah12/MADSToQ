/** Server-side IO module toggles (NEXT_PUBLIC_* on Render / .env.local). */

function envEnabled(name: string, defaultEnabled = true): boolean {
  const raw = process.env[name]
  if (raw === undefined || String(raw).trim() === '') return defaultEnabled
  const s = String(raw).trim().toLowerCase()
  if (['0', 'false', 'no', 'off', 'n'].includes(s)) return false
  if (['1', 'true', 'yes', 'on', 'y'].includes(s)) return true
  return defaultEnabled
}

export function isIoDomesticEnabled(): boolean {
  return envEnabled('NEXT_PUBLIC_IO_ENABLE_DOMESTIC', true)
}

export function isIoInternationalEnabled(): boolean {
  return envEnabled('NEXT_PUBLIC_IO_ENABLE_INTERNATIONAL', true)
}
