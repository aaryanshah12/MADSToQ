/**
 * Indian mobile number: optional +91 / 91 / 0, then 10 digits starting 6–9.
 * Examples: 9876543210, +919876543210, 0919876543210
 */
export const INDIAN_MOBILE_REGEX = /^(?:\+?91[\-\s]?|0)?[6-9]\d{9}$/

export function normalizeIndianMobile(value: string): string {
  return value.replace(/[\s\-()]/g, '')
}

/** Returns 10-digit national number, or null if invalid. */
export function toIndianMobileDigits(value: string): string | null {
  const raw = normalizeIndianMobile(value)
  if (!INDIAN_MOBILE_REGEX.test(raw)) return null
  const digits = raw.replace(/^\+?91/, '').replace(/^0/, '')
  return /^[6-9]\d{9}$/.test(digits) ? digits : null
}

export function isValidIndianMobile(value: string): boolean {
  if (!value.trim()) return false
  return toIndianMobileDigits(value) != null
}

export function assertValidIndianMobile(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error('Contact number is required')
  const digits = toIndianMobileDigits(trimmed)
  if (!digits) {
    throw new Error(
      'Invalid contact number. Use a valid 10-digit Indian mobile (starts with 6–9).',
    )
  }
  return digits
}
