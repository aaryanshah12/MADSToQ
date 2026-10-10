import { getSessionUserId, prisma } from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export type ErpRole =
  | 'owner'
  | 'inputer'
  | 'chemist'
  | 'accountant'
  | 'warehouse_manager'
  | 'lab_incharge'
  | 'plant_supervisor'

export async function requireProfile(request: NextRequest, roles?: ErpRole[]) {
  const userId = await getSessionUserId(request)
  if (!userId) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const factoryId = new URL(request.url).searchParams.get('factory_id')
  // Profile and factory links travel together. Later findFirst/findMany for this
  // user hit the 30s read cache instead of another round trip to the database.
  const [profile] = await Promise.all([
    prisma.profile.findUnique({
      where: { id: userId },
      select: { id: true, role: true, fullName: true, isActive: true },
    }),
    prisma.profileFactory.findMany({ where: { profileId: userId } }),
    factoryId
      ? prisma.profileFactory.findFirst({ where: { profileId: userId, factoryId } })
      : Promise.resolve(null),
  ])
  if (!profile || !profile.isActive) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (roles && !roles.includes(profile.role as ErpRole)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { profile }
}

/** Split a comma-separated query value; de-dupe and cap length. */
export function parseCsvParam(value: string | null, max = 200): string[] {
  if (!value) return []
  const ids = [...new Set(value.split(',').map((s) => s.trim()).filter(Boolean))]
  return ids.slice(0, max)
}

export function serializeInstrument(row: {
  id: string
  factoryId: string
  code: string
  name: string
  type: string
  isActive: boolean
  docMeta?: unknown
}) {
  return {
    id: row.id,
    factory_id: row.factoryId,
    code: row.code,
    name: row.name,
    type: row.type,
    is_active: row.isActive,
    doc_meta: row.docMeta ?? null,
  }
}

export function serializeLogEntry(row: {
  id: string
  factoryId: string
  instrumentId: string | null
  resultKind?: string | null
  stage: string
  subjectId: string
  entryDate: Date
  sampleName: string
  remarks: string | null
  payload: unknown
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
  instrument?: { code: string; name: string; type: string } | null
}) {
  return {
    id: row.id,
    factory_id: row.factoryId,
    instrument_id: row.instrumentId,
    stage: row.stage,
    subject_id: row.subjectId,
    entry_date: row.entryDate.toISOString().slice(0, 10),
    sample_name: row.sampleName,
    remarks: row.remarks,
    payload: row.payload,
    created_by: row.createdBy,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    instrument_code: row.instrument?.code ?? null,
    instrument_name: row.instrument?.name ?? null,
    instrument_type: row.instrument?.type ?? row.resultKind ?? null,
  }
}

export function serializeParamRequest(row: {
  id: string
  factoryId: string
  stage: string
  subjectId: string
  requestedTypes: unknown
  note: string | null
  status: string
  requestedBy: string | null
  createdAt: Date
  closedAt: Date | null
}) {
  return {
    id: row.id,
    factory_id: row.factoryId,
    stage: row.stage,
    subject_id: row.subjectId,
    requested_types: row.requestedTypes,
    note: row.note,
    status: row.status,
    requested_by: row.requestedBy,
    created_at: row.createdAt.toISOString(),
    closed_at: row.closedAt?.toISOString() ?? null,
  }
}
