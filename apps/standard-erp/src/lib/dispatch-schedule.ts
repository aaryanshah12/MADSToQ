export const DISPATCH_SCHEDULE_INCLUDE = {
  customer: { select: { name: true, gstNumber: true, companyAddress: true } },
  creator: { select: { fullName: true } },
  invoicer: { select: { fullName: true } },
  picker: { select: { fullName: true } },
  coaIssuer: { select: { fullName: true } },
  dispatcher: { select: { fullName: true } },
  lots: {
    include: {
      coaIssuer: { select: { fullName: true } },
      signedCoa: {
        select: {
          fileName: true,
          uploadedAt: true,
          uploader: { select: { fullName: true } },
        },
      },
    },
  },
} as const

export const DISPATCH_SCHEDULE_ROLES = [
  'owner',
  'accountant',
  'warehouse_manager',
  'lab_incharge',
] as const

export function parsePreferredBatches(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map((v) => String(v).trim()).filter(Boolean))]
}
