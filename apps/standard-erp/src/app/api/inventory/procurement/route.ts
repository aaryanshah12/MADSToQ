import { pageDocumentRows, parsePageParams, prisma, serializeProcurementPo } from '@madstoq/database'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const factoryId = searchParams.get('factory_id')
    if (!factoryId) {
      return NextResponse.json({ error: 'factory_id is required' }, { status: 400 })
    }

    const statuses = (searchParams.get('status') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const extraSql = statuses.length
      ? `d.status IN (${statuses.map(() => '?').join(', ')})`
      : undefined
    const page = parsePageParams(searchParams)
    const listed = await pageDocumentRows(prisma, 'procurement_purchase_orders', {
      factoryIds: [factoryId],
      q: searchParams.get('q'),
      from: searchParams.get('from'),
      to: searchParams.get('to'),
      extraSql,
      extraValues: statuses,
    }, page)

    return NextResponse.json({
      success: true,
      orders: listed.rows.map((row) => serializeProcurementPo(row as Parameters<typeof serializeProcurementPo>[0])),
      total: listed.total,
      page: listed.page,
      pageSize: listed.pageSize,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
