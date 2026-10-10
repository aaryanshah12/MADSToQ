import {
  parseProductionKind,
  parseRmInputKind,
  prisma,
  serializeProductionProduct,
} from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireProfile } from '@/lib/qc-api-helpers'
import { validateSingleComputedOutputs } from '@/lib/production-output-totals'

const productInclude = {
  rms: { orderBy: { sortOrder: 'asc' as const } },
  stages: { orderBy: { sortOrder: 'asc' as const } },
  outputs: { orderBy: { sortOrder: 'asc' as const } },
}

async function assertFactoryAccess(profileId: string, factoryId: string) {
  return prisma.profileFactory.findFirst({
    where: { profileId, factoryId },
  })
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireProfile(request, ['owner', 'chemist'])
    if (auth.error) return auth.error

    const { searchParams } = new URL(request.url)
    const factoryId = searchParams.get('factory_id')
    const activeOnly = searchParams.get('active') !== 'false'
    if (!factoryId) {
      return NextResponse.json({ error: 'factory_id is required' }, { status: 400 })
    }

    const link = await assertFactoryAccess(auth.profile.id, factoryId)
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const products = await prisma.productionProduct.findMany({
      where: {
        factoryId,
        ...(activeOnly ? { isActive: true } : {}),
      },
      include: productInclude,
      orderBy: { code: 'asc' },
    })

    return NextResponse.json({
      success: true,
      products: products.map(serializeProductionProduct),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

type RmInput = {
  material_name?: string
  unit?: string
  sort_order?: number
  allow_multi_lot?: boolean
  lot_required?: boolean
  max_lots?: number
  stock_kind?: string
  process?: string
}

type StageInput = {
  name?: string
  sort_order?: number
  capture_start_date?: boolean
  capture_end_date?: boolean
  capture_start_time?: boolean
  capture_end_time?: boolean
  capture_start_temp?: boolean
  capture_end_temp?: boolean
  capture_integrity?: boolean
  process?: string
  lot_rm_material_name?: string | null
  lot_rm_def_id?: string | null
}

type OutputInput = {
  name?: string
  sort_order?: number
  is_computed?: boolean
  sum_of?: unknown
  requires_qc?: boolean
  is_byproduct?: boolean
  process?: string
}

function optionalText(raw: unknown): string | null {
  const text = String(raw ?? '').trim()
  return text || null
}

function normalizeSumOf(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw) {
    const name = String(item || '').trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out
}

function resolveLotRmDefId(
  stage: StageInput,
  rms: Array<{ id: string; materialName: string; allowMultiLot: boolean }>,
): string | null {
  const byId = stage.lot_rm_def_id ? String(stage.lot_rm_def_id) : ''
  if (byId && rms.some((r) => r.id === byId && r.allowMultiLot)) return byId
  const byName = String(stage.lot_rm_material_name || '')
    .trim()
    .toLowerCase()
  if (byName) {
    const hit = rms.find(
      (r) => r.allowMultiLot && r.materialName.toLowerCase() === byName,
    )
    if (hit) return hit.id
  }
  const stageName = String(stage.name || '').toLowerCase()
  const contained = rms.find(
    (r) =>
      r.allowMultiLot &&
      r.materialName.trim() &&
      stageName.includes(r.materialName.toLowerCase()),
  )
  return contained?.id ?? null
}

/** Owner creates a product template (RMs + stages + outputs). */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireProfile(request, ['owner'])
    if (auth.error) return auth.error

    const body = await request.json()
    const factoryId = String(body.factory_id || '')
    const code = String(body.code || '').trim().toUpperCase()
    const name = String(body.name || '').trim()
    if (!factoryId || !code || !name) {
      return NextResponse.json(
        { error: 'factory_id, code, and name are required' },
        { status: 400 },
      )
    }

    const link = await assertFactoryAccess(auth.profile.id, factoryId)
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const kind = parseProductionKind(body.kind, 'sfg')
    const rms = Array.isArray(body.rms) ? (body.rms as RmInput[]) : []
    const stages = Array.isArray(body.stages) ? (body.stages as StageInput[]) : []
    const outputs = Array.isArray(body.outputs) ? (body.outputs as OutputInput[]) : []

    for (const proc of ['sfg', 'fg'] as const) {
      const outputErr = validateSingleComputedOutputs(
        outputs.filter((o) => parseProductionKind(o.process, 'sfg') === proc),
      )
      if (outputErr) {
        return NextResponse.json({ error: `${proc}: ${outputErr}` }, { status: 400 })
      }
    }

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.productionProduct.create({
        data: {
          factoryId,
          code,
          name,
          kind,
          casNumber: optionalText(body.cas_number),
          coaDescriptionSpec: optionalText(body.coa_description_spec),
          coaIdentificationSpec: optionalText(body.coa_identification_spec),
          coaSpecificGravitySpec: optionalText(body.coa_specific_gravity_spec),
          coaWaterSpec: optionalText(body.coa_water_spec),
          coaBoilingPointSpec: optionalText(body.coa_boiling_point_spec),
          coaGcPuritySpec: optionalText(body.coa_gc_purity_spec),
          coaConclusion: optionalText(body.coa_conclusion),
          coaStorageCondition: optionalText(body.coa_storage_condition),
          isActive: body.is_active !== false,
          rms: {
            create: rms.map((r, i) => ({
              materialName: String(r.material_name || '').trim(),
              unit: String(r.unit || 'Kg').trim() || 'Kg',
              sortOrder: Number(r.sort_order ?? i),
              allowMultiLot: Boolean(r.allow_multi_lot),
              lotRequired: r.lot_required !== false,
              maxLots: Math.min(
                10,
                Math.max(1, Number(r.max_lots ?? 2) || 2),
              ),
              stockKind: parseRmInputKind(r.stock_kind),
              process: parseProductionKind(r.process, 'sfg'),
            })),
          },
          outputs: {
            create: outputs.map((o, i) => {
              const sumOf = normalizeSumOf(o.sum_of)
              return {
                name: String(o.name || '').trim(),
                sortOrder: Number(o.sort_order ?? i),
                isComputed: Boolean(o.is_computed) || sumOf.length > 0,
                sumOf: sumOf.length > 0 ? sumOf : null,
                requiresQc: o.requires_qc !== false,
                isByproduct: Boolean(o.is_byproduct),
                process: parseProductionKind(o.process, 'sfg'),
              }
            }),
          },
        },
        include: { rms: true },
      })

      if (stages.length) {
        const createdRms = await tx.productionProductRm.findMany({
          where: { productId: created.id },
        })
        await tx.productionProcessStage.createMany({
          data: stages.map((s, i) => ({
            productId: created.id,
            name: String(s.name || '').trim(),
            sortOrder: Number(s.sort_order ?? i),
            captureStartDate: s.capture_start_date !== false,
            captureEndDate: s.capture_end_date !== false,
            captureStartTime: s.capture_start_time !== false,
            captureEndTime: s.capture_end_time !== false,
            captureStartTemp: s.capture_start_temp !== false,
            captureEndTemp: s.capture_end_temp !== false,
            captureIntegrity: Boolean(s.capture_integrity),
            process: parseProductionKind(s.process, 'sfg'),
            lotRmDefId: resolveLotRmDefId(
              s,
              createdRms.filter(
                (r) => parseProductionKind(r.process, 'sfg') === parseProductionKind(s.process, 'sfg'),
              ),
            ),
          })),
        })
      }

      return tx.productionProduct.findUniqueOrThrow({
        where: { id: created.id },
        include: productInclude,
      })
    })

    return NextResponse.json({
      success: true,
      product: serializeProductionProduct(product),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('Unique constraint') || message.includes('unique')) {
      return NextResponse.json(
        { error: 'A product with this code already exists for the factory' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
