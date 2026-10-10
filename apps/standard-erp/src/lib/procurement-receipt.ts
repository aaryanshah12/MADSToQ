/** Receipt statuses that still occupy ordered PO qty (replacement not yet bookable). */
export const RECEIPT_STATUSES_OCCUPYING_PO_QTY = [
  'approved',
  'approved_printed',
  'pending_qc',
  'awaiting_admin',
  'needs_info',
  'rejected',
] as const

export function receiptOccupiesPoQty(status: string): boolean {
  return (RECEIPT_STATUSES_OCCUPYING_PO_QTY as readonly string[]).includes(status)
}

export function receiptCountsAsApprovedQty(status: string): boolean {
  return status === 'approved' || status === 'approved_printed'
}

export function receiptIsQcApproved(status: string): boolean {
  return status === 'approved' || status === 'approved_printed'
}

export function receiptCountsAsPendingQty(status: string): boolean {
  return (
    status === 'pending_qc' ||
    status === 'awaiting_admin' ||
    status === 'needs_info'
  )
}

export function receiptCountsAsRejectedHoldQty(status: string): boolean {
  return status === 'rejected'
}
