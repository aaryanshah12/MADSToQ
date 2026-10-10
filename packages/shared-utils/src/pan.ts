/**
 * Indian PAN (10 chars): 5 letters + 4 digits + 1 letter
 * e.g. AACFA7569G
 */
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/

export function normalizePan(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase()
}

export function isValidPan(value: string): boolean {
  return PAN_REGEX.test(normalizePan(value))
}

export function assertValidPan(value: string): string {
  const pan = normalizePan(value)
  if (!pan) throw new Error('PAN number is required')
  if (!PAN_REGEX.test(pan)) {
    throw new Error('Invalid PAN number. Use format AAAAA9999A (e.g. AACFA7569G).')
  }
  return pan
}
