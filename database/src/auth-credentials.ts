const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Trim; usernames are case-sensitive (e.g. vib@123). */
export function normalizeUsername(value: string): string {
  return value.trim()
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function isValidEmail(value: string): boolean {
  const normalized = normalizeEmail(value)
  return normalized.length > 0 && EMAIL_RE.test(normalized)
}

export function parseEmail(value: string): string | null {
  const normalized = normalizeEmail(value)
  return isValidEmail(normalized) ? normalized : null
}
