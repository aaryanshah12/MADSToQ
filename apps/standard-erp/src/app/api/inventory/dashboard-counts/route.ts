import { prisma, queryStockBalance } from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireProfile } from '@/lib/qc-api-helpers'
import { RECEIPT_STATUSES_OCCUPYING_PO_QTY } from '@/lib/procurement-receipt'

/**
 * Badge counts for warehouse / lab / accountant homes.
 * Uses prisma.count (and a remaining-lot filter) instead of downloading full lists.
 */
export async function GET(request: NextRequest) {
  try {
    const factoryId = new URL(request.url).searchParams.get('factory_id')
    if (!factoryId) {
      return NextResponse.json({ error: 'factory_id is required' }, { status: 400 })
    }

    const countsPromise = Promise.all([
      prisma.warehouseIssueRequest.count({
        where: { factoryId, status: { in: ['pending', 'partial'] } },
      }),
      prisma.procurementReceipt.count({
        where: { factoryId, status: { in: ['pending_qc', 'needs_info'] } },
      }),
      prisma.productionBatch.count({
        where: {
          factoryId,
          status: 'completed',
          qcStatus: { in: ['pending_qc', 'needs_info'] },
        },
      }),
      prisma.procurementReceipt.count({
        where: { factoryId, status: 'pending_qc' },
      }),
      countOpenPosToReceive(factoryId),
      queryStockBalance({ factoryIds: [factoryId] }),
    ])

    const auth = await requireProfile(request, [
      'owner',
      'warehouse_manager',
      'chemist',
      'lab_incharge',
      'accountant',
      'plant_supervisor',
    ])
    if (auth.error) return auth.error

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const [
      warehouseOpenRequests,
      labRmPending,
      labSfgPending,
      accountantPendingQc,
      openPos,
      balances,
    ] = await countsPromise

    return NextResponse.json({
      success: true,
      warehouse_open_requests: warehouseOpenRequests,
      warehouse_stock_lots: balances.filter((b) => b.tons_remaining > 1e-9).length,
      lab_rm_pending: labRmPending,
      lab_sfg_pending: labSfgPending,
      accountant_pending_qc: accountantPendingQc,
      accountant_open_pos: openPos,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function countOpenPosToReceive(factoryId: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ count: number }[]>(
    `SELECT COUNT(*)::int AS count
     FROM procurement_purchase_orders po
     LEFT JOIN (
       SELECT po_id, SUM(received_qty) AS qty
       FROM procurement_receipts
       WHERE factory_id = $1::uuid
         AND status = ANY($2::text[])
       GROUP BY po_id
     ) r ON r.po_id = po.id
     WHERE po.factory_id = $1::uuid
       AND po.status IN ('issued', 'partial')
       AND po.qty - COALESCE(r.qty, 0) > 0.0000001`,
    factoryId,
    [...RECEIPT_STATUSES_OCCUPYING_PO_QTY],
  )
  return Number(rows[0]?.count ?? 0)
}
