import type { Factory } from '@/types'

export type BillShipParty = {
  key: string
  label: string
  block: string
}

export function factoryAddressBlock(factory: Factory | null | undefined): string {
  if (!factory) return ''
  const lines = [
    factory.name,
    factory.company_address?.trim() || factory.location?.trim() || undefined,
    factory.gst_number ? `GSTN No : ${factory.gst_number}` : undefined,
  ].filter(Boolean)
  return lines.join('\n')
}

/** Bill To / Ship To options — factories from Management only (active). */
export function buildBillShipParties(factories: Factory[]): BillShipParty[] {
  return factories
    .filter((f) => f.is_active !== false)
    .map((f) => ({
      key: `factory:${f.id}`,
      label: f.location ? `${f.name} — ${f.location}` : f.name,
      block: factoryAddressBlock(f),
    }))
}

export function resolvePartyBlock(
  key: string,
  parties: BillShipParty[],
  fallback = '',
): string {
  return parties.find((p) => p.key === key)?.block || fallback
}
