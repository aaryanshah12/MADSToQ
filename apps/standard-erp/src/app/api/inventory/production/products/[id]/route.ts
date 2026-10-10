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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireProfile(request, ['owner', 'chemist'])
    if (auth.error) return auth.error

    const { id } = await context.params
    const product = await prisma.productionProduct.findUnique({
      where: { id },
      include: productInclude,
    })
    if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId: product.factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    return NextResponse.json({
      success: true,
      product: serializeProductionProduct(product),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** Owner updates product metadata and optionally replaces template defs (no batches yet). */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireProfile(request, ['owner'])
    if (auth.error) return auth.error

    const { id } = await context.params
    const existing = await prisma.productionProduct.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId: existing.factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const code =
      body.code != null ? String(body.code).trim().toUpperCase() : existing.code
    const name = body.name != null ? String(body.name).trim() : existing.name
    const kind = parseProductionKind(body.kind ?? existing.kind)
    const isActive =
      body.is_active !== undefined ? Boolean(body.is_active) : existing.isActive

    const hasTemplate =
      body.rms !== undefined || body.stages !== undefined || body.outputs !== undefined
    const hasFormulasOnly =
      !hasTemplate && Array.isArray(body.output_formulas)

    const sfgBatchCount = await prisma.productionBatch.count({
      where: { productId: id, kind: { not: 'fg' } },
    })
    const fgBatchCount = await prisma.productionBatch.count({
      where: { productId: id, kind: 'fg' },
    })
    if (hasTemplate && sfgBatchCount > 0 && fgBatchCount > 0) {
      return NextResponse.json(
        {
          error:
            'Cannot replace RMs/stages/outputs after both processes have batches. Update name/active, or use output_formulas.',
        },
        { status: 400 },
      )
    }

    if (hasTemplate && Array.isArray(body.outputs)) {
      for (const proc of ['sfg', 'fg'] as const) {
        const outputErr = validateSingleComputedOutputs(
          (body.outputs as OutputInput[]).filter(
            (o) => parseProductionKind(o.process, 'sfg') === proc,
          ),
        )
        if (outputErr) {
          return NextResponse.json({ error: `${proc}: ${outputErr}` }, { status: 400 })
        }
      }
    }
    if (hasFormulasOnly) {
      const formulas = body.output_formulas as OutputInput[]
      const outputErr = validateSingleComputedOutputs(formulas)
      if (outputErr) {
        return NextResponse.json({ error: outputErr }, { status: 400 })
      }
    }

    const product = await prisma.$transaction(async (tx) => {
      if (hasTemplate) {
        const rms = Array.isArray(body.rms) ? (body.rms as RmInput[]) : []
        const stages = Array.isArray(body.stages) ? (body.stages as StageInput[]) : []
        const outputs = Array.isArray(body.outputs) ? (body.outputs as OutputInput[]) : []

        const replace = async (proc: 'sfg' | 'fg') => {
          await tx.productionProcessStage.deleteMany({
            where: { productId: id, process: proc },
          })
          await tx.productionOutputField.deleteMany({
            where: { productId: id, process: proc },
          })
          await tx.productionProductRm.deleteMany({
            where: { productId: id, process: proc },
          })
          const procRms = rms.filter((r) => parseProductionKind(r.process, 'sfg') === proc)
          const procStages = stages.filter(
            (s) => parseProductionKind(s.process, 'sfg') === proc,
          )
          const procOutputs = outputs.filter(
            (o) => parseProductionKind(o.process, 'sfg') === proc,
          )
          if (procRms.length) {
            await tx.productionProductRm.createMany({
              data: procRms.map((r, i) => ({
                productId: id,
                materialName: String(r.material_name || '').trim(),
                unit: String(r.unit || 'Kg').trim() || 'Kg',
                sortOrder: Number(r.sort_order ?? i),
                allowMultiLot: Boolean(r.allow_multi_lot),
                lotRequired: r.lot_required !== false,
                maxLots: Math.min(10, Math.max(1, Number(r.max_lots ?? 2) || 2)),
                stockKind: parseRmInputKind(r.stock_kind),
                process: proc,
              })),
            })
          }
          const createdRms = await tx.productionProductRm.findMany({
            where: { productId: id, process: proc },
          })
          if (procStages.length) {
            await tx.productionProcessStage.createMany({
              data: procStages.map((s, i) => ({
                productId: id,
                name: String(s.name || '').trim(),
                sortOrder: Number(s.sort_order ?? i),
                captureStartDate: s.capture_start_date !== false,
                captureEndDate: s.capture_end_date !== false,
                captureStartTime: s.capture_start_time !== false,
                captureEndTime: s.capture_end_time !== false,
                captureStartTemp: s.capture_start_temp !== false,
                captureEndTemp: s.capture_end_temp !== false,
                captureIntegrity: Boolean(s.capture_integrity),
                process: proc,
                lotRmDefId: resolveLotRmDefId(s, createdRms),
              })),
            })
          }
          if (procOutputs.length) {
            await tx.productionOutputField.createMany({
              data: procOutputs.map((o, i) => {
                const sumOf = normalizeSumOf(o.sum_of)
                return {
                  productId: id,
                  name: String(o.name || '').trim(),
                  sortOrder: Number(o.sort_order ?? i),
                  isComputed: Boolean(o.is_computed) || sumOf.length > 0,
                  sumOf: sumOf.length > 0 ? sumOf : undefined,
                  requiresQc: o.requires_qc !== false,
                  isByproduct: Boolean(o.is_byproduct),
                  process: proc,
                }
              }),
            })
          }
        }

        if (sfgBatchCount === 0) await replace('sfg')
        if (fgBatchCount === 0) await replace('fg')
      } else if (hasFormulasOnly) {
        const formulas = body.output_formulas as OutputInput[]
        const existingOutputs = await tx.productionOutputField.findMany({
          where: { productId: id },
        })
        const byName = new Map(
          existingOutputs.map((o) => [o.name.trim().toLowerCase(), o] as const),
        )
        for (const f of formulas) {
          const name = String(f.name || '').trim()
          if (!name) continue
          const row = byName.get(name.toLowerCase())
          if (!row) continue
          const sumOf = normalizeSumOf(f.sum_of)
          await tx.productionOutputField.update({
            where: { id: row.id },
            data: {
              isComputed: Boolean(f.is_computed) || sumOf.length > 0,
              sumOf: sumOf.length > 0 ? sumOf : null,
              ...(f.requires_qc !== undefined
                ? { requiresQc: Boolean(f.requires_qc) }
                : {}),
              ...(f.is_byproduct !== undefined
                ? { isByproduct: Boolean(f.is_byproduct) }
                : {}),
            },
          })
        }
      }

      return tx.productionProduct.update({
        where: { id },
        data: {
          code,
          name,
          isActive,
          ...(body.kind != null ? { kind } : {}),
          ...(body.cas_number !== undefined
            ? { casNumber: optionalText(body.cas_number) }
            : {}),
          ...(body.coa_description_spec !== undefined
            ? { coaDescriptionSpec: optionalText(body.coa_description_spec) }
            : {}),
          ...(body.coa_identification_spec !== undefined
            ? { coaIdentificationSpec: optionalText(body.coa_identification_spec) }
            : {}),
          ...(body.coa_specific_gravity_spec !== undefined
            ? { coaSpecificGravitySpec: optionalText(body.coa_specific_gravity_spec) }
            : {}),
          ...(body.coa_water_spec !== undefined
            ? { coaWaterSpec: optionalText(body.coa_water_spec) }
            : {}),
          ...(body.coa_boiling_point_spec !== undefined
            ? { coaBoilingPointSpec: optionalText(body.coa_boiling_point_spec) }
            : {}),
          ...(body.coa_gc_purity_spec !== undefined
            ? { coaGcPuritySpec: optionalText(body.coa_gc_purity_spec) }
            : {}),
          ...(body.coa_conclusion !== undefined
            ? { coaConclusion: optionalText(body.coa_conclusion) }
            : {}),
          ...(body.coa_storage_condition !== undefined
            ? { coaStorageCondition: optionalText(body.coa_storage_condition) }
            : {}),
        },
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
