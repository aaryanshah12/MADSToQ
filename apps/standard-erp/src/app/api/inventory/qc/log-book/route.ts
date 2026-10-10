import { parsePageParams, prisma } from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireProfile, serializeInstrument, serializeLogEntry } from '@/lib/qc-api-helpers'

function dateOnly(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
}

/** Chronological instrument register of existing QC log entries. */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const factoryId = searchParams.get('factory_id')
    const instrumentId = searchParams.get('instrument_id')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    if (!factoryId || !instrumentId) {
      return NextResponse.json(
        { error: 'factory_id and instrument_id are required' },
        { status: 400 },
      )
    }

    const page = parsePageParams(searchParams)
    const values: unknown[] = [factoryId, instrumentId]
    const filters = ['e.factory_id = $1::uuid', 'e.instrument_id = $2::uuid']
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
      values.push(dateOnly(from))
      filters.push(`e.entry_date >= $${values.length}`)
    }
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      values.push(dateOnly(to))
      filters.push(`e.entry_date <= $${values.length}`)
    }
    const limit = page.all
      ? ''
      : ` LIMIT ${page.pageSize} OFFSET ${(page.page - 1) * page.pageSize}`

    const headerPromise = Promise.all([
      prisma.factory.findUnique({
        where: { id: factoryId },
        select: { id: true, name: true, companyAddress: true, location: true },
      }),
      prisma.qcInstrument.findFirst({
        where: { id: instrumentId, factoryId },
      }),
    ])
    const rowsPromise = prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT
         e.id, e.factory_id, e.instrument_id, e.result_kind, e.stage, e.subject_id,
         e.entry_date, e.sample_name, e.remarks, e.payload, e.created_by, e.created_at, e.updated_at,
         i.code AS instrument_code, i.name AS instrument_name, i.type AS instrument_type,
         CASE
           WHEN e.stage = 'rm' THEN (
             SELECT r.receipt_number FROM procurement_receipts r WHERE r.id = e.subject_id
           )
           WHEN e.stage IN ('sfg', 'fg') THEN (
             SELECT b.batch_no FROM production_batches b WHERE b.id = e.subject_id
           )
           ELSE NULL
         END AS subject_label,
         COUNT(*) OVER()::bigint AS total
       FROM qc_log_entries e
       JOIN qc_instruments i ON i.id = e.instrument_id
       WHERE ${filters.join(' AND ')}
       ORDER BY e.entry_date DESC, e.created_at DESC${limit}`,
      ...values,
    )

    const auth = await requireProfile(request, ['owner', 'lab_incharge'])
    if (auth.error) return auth.error
    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const [[factory, instrument], listed] = await Promise.all([headerPromise, rowsPromise])
    if (!factory || !instrument) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    let rows = listed
    let total = Number(rows[0]?.total ?? 0)
    if (rows.length === 0 && !page.all && page.page > 1) {
      const counted = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*)::bigint AS count FROM qc_log_entries e WHERE ${filters.join(' AND ')}`,
        ...values,
      )
      total = Number(counted[0]?.count ?? 0)
    }

    return NextResponse.json({
      success: true,
      factory: {
        id: factory.id,
        name: factory.name,
        company_address: factory.companyAddress ?? null,
        location: factory.location ?? null,
      },
      instrument: serializeInstrument(instrument),
      entries: rows.map((row) => ({
        ...serializeLogEntry({
          id: String(row.id),
          factoryId: String(row.factory_id),
          instrumentId: row.instrument_id == null ? null : String(row.instrument_id),
          resultKind: row.result_kind == null ? null : String(row.result_kind),
          stage: String(row.stage),
          subjectId: String(row.subject_id),
          entryDate: row.entry_date instanceof Date ? row.entry_date : new Date(String(row.entry_date)),
          sampleName: String(row.sample_name ?? ''),
          remarks: row.remarks == null ? null : String(row.remarks),
          payload: row.payload,
          createdBy: row.created_by == null ? null : String(row.created_by),
          createdAt: row.created_at instanceof Date ? row.created_at : new Date(String(row.created_at)),
          updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(String(row.updated_at)),
          instrument: {
            code: String(row.instrument_code ?? ''),
            name: String(row.instrument_name ?? ''),
            type: String(row.instrument_type ?? ''),
          },
        }),
        subject_label: row.subject_label == null ? null : String(row.subject_label),
      })),
      total,
      page: page.all ? 1 : page.page,
      pageSize: page.all ? total : page.pageSize,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
