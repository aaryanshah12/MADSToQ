/**
 * Indian GSTIN (15 chars):
 * 2-digit state + 10-char PAN + entity + 'Z' + checksum
 * e.g. 24AAAAA0000A1Z5
 */
export const GSTIN_REGEX =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

export function normalizeGstin(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase()
}

export function isValidGstin(value: string): boolean {
  return GSTIN_REGEX.test(normalizeGstin(value))
}

export function assertValidGstin(value: string): string {
  const gstin = normalizeGstin(value)
  if (!gstin) throw new Error('GST number is required')
  if (!GSTIN_REGEX.test(gstin)) {
    throw new Error(
      'Invalid GST number. Use a valid 15-character GSTIN (e.g. 24AAAAA0000A1Z5).',
    )
  }
  return gstin
}
