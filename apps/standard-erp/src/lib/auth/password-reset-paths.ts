/** Allowlisted app paths for password-reset return URLs. */

const MODULES = [
  {
    root: '/inward-outward',
    login: '/inward-outward/login',
    reset: '/inward-outward/reset-password',
  },
  {
    root: '/inventory',
    login: '/inventory/login',
    reset: '/inventory/reset-password',
  },
  {
    root: '/personal/sales',
    login: '/personal/sales/login',
    reset: '/personal/sales/reset-password',
  },
  {
    root: '/pmc',
    login: '/pmc',
    reset: '/pmc/reset-password',
  },
] as const

const DEFAULT_LOGIN = MODULES[0].login

function isUnder(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}/`)
}

export function sanitizeReturnTo(raw: string | null | undefined, fallback = DEFAULT_LOGIN): string {
  if (!raw) return fallback
  const path = raw.split('?')[0]?.split('#')[0] ?? ''
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || path.includes('://')) {
    return fallback
  }
  return MODULES.some((mod) => isUnder(path, mod.root)) ? path : fallback
}

export function resetPathForReturn(returnTo: string): string {
  const safe = sanitizeReturnTo(returnTo)
  return MODULES.find((mod) => isUnder(safe, mod.root))?.reset ?? MODULES[0].reset
}
