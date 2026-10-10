/**
 * Ananta Fine Chem ERP bootstrap (full stack after SQL schema).
 * Login username: ananta@123 — contact email: ANANTA_USER_EMAIL (password reset)
 *
 *   cd database
 *   # Use Ananta URLs (do not overwrite VIB .env):
 *   set -a && source .env.ananta && set +a
 *   pnpm db:seed:ananta
 *
 * Or one-shot: pnpm db:setup:ananta
 */
import '../scripts/load-env.js'
import bcrypt from 'bcryptjs'
import { PrismaClient, ProfileRole, UserRole } from '../src/generated/client'

const prisma = new PrismaClient()

const CLIENT_SLUG = process.env.CLIENT_SLUG ?? 'ananta'
const CLIENT_NAME = process.env.CLIENT_NAME ?? 'Ananta Fine Chem'
const USER_USERNAME = (process.env.ANANTA_USER_USERNAME ?? 'ananta@123').trim()
const USER_EMAIL = (
  process.env.ANANTA_USER_EMAIL ?? 'mansibusa814@gmail.com'
)
  .trim()
  .toLowerCase()
const USER_PASSWORD = process.env.ANANTA_USER_PASSWORD ?? 'ananta@123'
const USER_NAME = process.env.ANANTA_USER_NAME ?? 'Ananta Owner'
const FACTORY_NAME = process.env.ANANTA_FACTORY_NAME ?? 'Ananta Fine Chem'
const FACTORY_LOCATION = process.env.ANANTA_FACTORY_LOCATION ?? 'India'
const IO_PREFIX = process.env.ANANTA_IO_PREFIX ?? 'AFC'

/** Stable IDs so re-run is idempotent (users.id must equal profiles.id). */
const USER_ID = '00000000-0000-4000-8000-000000000011'
const FACTORY_ID = '00000000-0000-4000-8000-000000000012'
const CHEMIST_ID = '00000000-0000-4000-8000-000000000014'
const CHEMIST_USERNAME = (process.env.ANANTA_CHEMIST_USERNAME ?? 'ananta.chemist').trim()
const CHEMIST_EMAIL = (
  process.env.ANANTA_CHEMIST_EMAIL ?? 'ananta.chemist@madstoq.local'
)
  .trim()
  .toLowerCase()
const CHEMIST_NAME = process.env.ANANTA_CHEMIST_NAME ?? 'Ananta Chemist'

const ACCOUNTANT_ID = '00000000-0000-4000-8000-000000000015'
const ACCOUNTANT_USERNAME = (process.env.ANANTA_ACCOUNTANT_USERNAME ?? 'ananta.accountant').trim()
const ACCOUNTANT_EMAIL = (
  process.env.ANANTA_ACCOUNTANT_EMAIL ?? 'ananta.accountant@madstoq.local'
)
  .trim()
  .toLowerCase()
const ACCOUNTANT_NAME = process.env.ANANTA_ACCOUNTANT_NAME ?? 'Ananta Accountant'

const LAB_ID = '00000000-0000-4000-8000-000000000016'
const LAB_USERNAME = (process.env.ANANTA_LAB_USERNAME ?? 'ananta.lab').trim()
const LAB_EMAIL = (process.env.ANANTA_LAB_EMAIL ?? 'ananta.lab@madstoq.local')
  .trim()
  .toLowerCase()
const LAB_NAME = process.env.ANANTA_LAB_NAME ?? 'Ananta Lab Incharge'

const WAREHOUSE_ID = '00000000-0000-4000-8000-000000000017'
const WAREHOUSE_USERNAME = (process.env.ANANTA_WAREHOUSE_USERNAME ?? 'ananta.warehouse').trim()
const WAREHOUSE_EMAIL = (
  process.env.ANANTA_WAREHOUSE_EMAIL ?? 'ananta.warehouse@madstoq.local'
)
  .trim()
  .toLowerCase()
const WAREHOUSE_NAME = process.env.ANANTA_WAREHOUSE_NAME ?? 'Ananta Warehouse Manager'

const IO_DOC_TYPES = ['inward', 'outward', 'quotation'] as const

type SeedRm = {
  materialName: string
  unit?: string
  allowMultiLot?: boolean
  lotRequired?: boolean
  maxLots?: number
  stockKind?: 'rm' | 'sfg'
}

type SeedStage = {
  name: string
  captureIntegrity?: boolean
}

type SeedOutput = {
  name: string
  /** Sibling output names that sum into this field (makes it computed / read-only). */
  sumOf?: string[]
  requiresQc?: boolean
  isByproduct?: boolean
}

type SeedProduct = {
  code: string
  name: string
  kind?: 'sfg' | 'fg'
  rms: SeedRm[]
  stages: SeedStage[]
  outputs: SeedOutput[]
}

const S_ACID = 'SULPHURIC ACID'

/** Stage I (RM → SFG) from PRODUCTION RECORD ANANTA.xlsx. Stage II is separate. */
const ANANTA_PRODUCTION_PRODUCTS: SeedProduct[] = [
  {
    code: 'NPBR',
    name: 'AFC NPBR',
    rms: [
      { materialName: 'NPA' },
      { materialName: 'Sulphur' },
      { materialName: 'Bromine', allowMultiLot: true, maxLots: 2 },
    ],
    stages: [
      { name: 'Bromine addition' },
      { name: 'Reflux' },
      { name: 'Distillation' },
      { name: 'H. Cut material' },
    ],
    outputs: [
      { name: 'NPBR Crude' },
      { name: 'NPBR H-C' },
      { name: 'NPBR Finish', sumOf: ['NPBR Crude', 'NPBR H-C'] },
    ],
  },
  {
    code: '2BB',
    name: '2 BB',
    rms: [
      { materialName: 'SBA' },
      { materialName: 'HBR' },
      { materialName: S_ACID },
    ],
    stages: [
      { name: 'S.Acid addition' },
      { name: 'Reflux' },
      { name: 'Distillation' },
      { name: 'H. Cut material' },
    ],
    outputs: [
      { name: '2BB Crude' },
      { name: '2BB H-C' },
      { name: '2BB Total', sumOf: ['2BB Crude', '2BB H-C'] },
    ],
  },
  {
    code: 'EDBR',
    name: 'EDBR',
    rms: [
      { materialName: 'MEG' },
      { materialName: 'Sulphur' },
      { materialName: 'Bromine' },
    ],
    stages: [
      { name: 'Bromine addition' },
      { name: 'Reflux' },
      { name: 'Distillation' },
      { name: 'V-5 Distillation' },
    ],
    outputs: [
      { name: 'EDBR Crude' },
      { name: 'EDBR H-C' },
      { name: 'EDBR Bottom' },
      { name: 'EDBR Total', sumOf: ['EDBR Crude', 'EDBR H-C', 'EDBR Bottom'] },
    ],
  },
  {
    code: 'NBBR',
    name: 'NBBR',
    rms: [
      { materialName: 'NBA' },
      { materialName: 'Sulphur' },
      { materialName: 'Bromine' },
    ],
    stages: [
      { name: 'Bromine addition' },
      { name: 'Reflux' },
      { name: 'Distillation' },
      { name: 'H. Cut material' },
    ],
    outputs: [
      { name: 'NBBR Crude' },
      { name: 'NBBR H-C' },
      { name: 'NBBR Finish', sumOf: ['NBBR Crude', 'NBBR H-C'] },
    ],
  },
  {
    code: 'IPBR',
    name: 'IPBR',
    rms: [
      { materialName: 'IPA' },
      { materialName: 'HBR' },
      { materialName: S_ACID },
    ],
    stages: [
      { name: 'S.Acid addition' },
      { name: 'Reflux' },
      { name: 'Distillation' },
      { name: 'H. Cut material' },
    ],
    outputs: [
      { name: 'IPBR Crude' },
      { name: 'IPBR H-C' },
      { name: 'IPBR Total Yield', sumOf: ['IPBR Crude', 'IPBR H-C'] },
    ],
  },
  {
    code: 'ALLYLBR',
    name: 'Allyl BR',
    rms: [
      { materialName: 'Allyl Alcohol' },
      { materialName: 'HBR' },
      { materialName: S_ACID },
    ],
    stages: [
      { name: 'S.Acid addition' },
      { name: 'Free stirring' },
      { name: 'Reflux' },
      { name: 'Distillation' },
      { name: 'H. Cut material' },
    ],
    outputs: [
      { name: 'Allyl BR Crude' },
      { name: 'Allyl H-C' },
      { name: 'Allyl Total Yield', sumOf: ['Allyl BR Crude', 'Allyl H-C'] },
    ],
  },
  {
    code: 'DBP',
    name: '1.33 DBP',
    rms: [
      { materialName: 'Water' },
      { materialName: 'Sulphur' },
      { materialName: 'Bromine' },
      { materialName: '1.33 RM' },
      { materialName: S_ACID },
    ],
    stages: [
      { name: 'Bromine addition' },
      { name: 'Free stirring' },
      { name: 'Cooling' },
      { name: 'Add 1.33 RM' },
      { name: 'Addition S. Acid' },
      { name: 'Reflux' },
      { name: 'Distillation' },
      { name: 'HC' },
    ],
    outputs: [
      { name: '1.33 Crude' },
      { name: '1.33 H-C' },
      { name: '1.33 Finish', sumOf: ['1.33 Crude', '1.33 H-C'] },
    ],
  },
]

const ANANTA_EXTRA_MATERIALS: Array<{ name: string; hsn?: string }> = [
  { name: 'NPA' },
  { name: 'Bromine' },
  { name: 'SBA' },
  { name: 'HBR' },
  { name: S_ACID },
  { name: 'MEG' },
  { name: 'NBA' },
  { name: 'IPA' },
  { name: 'Allyl Alcohol' },
  { name: 'Water' },
  { name: '1.33 RM' },
  { name: 'Caustic soda solution' },
  { name: 'Soda ash' },
]

/** Old seed names → Excel Stage I names, per product. */
const SFG_RM_ALIASES: Record<string, Record<string, string[]>> = {
  '2BB': { SBA: ['benzene'], HBR: ['bromine'], [S_ACID]: ['sulphuric acid', 's.acid'] },
  EDBR: { MEG: ['edc'] },
  NBBR: { NBA: ['nitrobenzene'] },
  IPBR: { HBR: ['bromine', 'hbr'], [S_ACID]: ['sulphuric acid'] },
  ALLYLBR: { HBR: ['bromine'], [S_ACID]: ['sulphuric acid'] },
  DBP: { Water: ['phenol'] },
}

const CRUDE_SFG: SeedRm = {
  materialName: 'Crude / semi-finished',
  allowMultiLot: true,
  maxLots: 3,
  stockKind: 'sfg',
}

/** Stage II from product BMRs (Finish Goods Manufacturing). Not Stage I. */
function stageIiWash(opts: { sulphuric: boolean }): Pick<SeedProduct, 'rms' | 'stages' | 'outputs'> {
  const rms: SeedRm[] = [CRUDE_SFG]
  if (opts.sulphuric) rms.push({ materialName: S_ACID, stockKind: 'rm' })
  rms.push(
    { materialName: 'Caustic soda solution', stockKind: 'rm' },
    { materialName: 'Soda ash', stockKind: 'rm' },
  )
  return {
    rms,
    stages: [
      { name: 'Washing of crude' },
      { name: 'Filter integrity', captureIntegrity: true },
      { name: 'Filtration' },
    ],
    outputs: [
      { name: 'Finished goods', requiresQc: true },
      { name: 'NaBr by-product', requiresQc: false, isByproduct: true },
      { name: 'SD', requiresQc: false, isByproduct: true },
      { name: 'HBr', requiresQc: false, isByproduct: true },
      { name: 'HC', requiresQc: false, isByproduct: true },
    ],
  }
}

function stageIiEdbr(): Pick<SeedProduct, 'rms' | 'stages' | 'outputs'> {
  return {
    rms: [
      CRUDE_SFG,
      { materialName: S_ACID, stockKind: 'rm' },
      { materialName: 'Water', stockKind: 'rm' },
      { materialName: 'Soda ash', stockKind: 'rm' },
    ],
    stages: [
      { name: 'Redistill of crude' },
      { name: 'Acid wash' },
      { name: 'Water wash' },
      { name: 'Add soda ash and water' },
      { name: 'Filter integrity', captureIntegrity: true },
    ],
    outputs: [
      { name: 'Finished goods', requiresQc: true },
      { name: 'High cut', requiresQc: false, isByproduct: true },
      { name: 'SD', requiresQc: false, isByproduct: true },
      { name: 'HBr', requiresQc: false, isByproduct: true },
      { name: 'HC', requiresQc: false, isByproduct: true },
    ],
  }
}

function stageIiRedistillWash(): Pick<SeedProduct, 'rms' | 'stages' | 'outputs'> {
  return {
    rms: [
      CRUDE_SFG,
      { materialName: 'Water', stockKind: 'rm' },
      { materialName: 'Soda ash', stockKind: 'rm' },
    ],
    stages: [
      { name: 'Redistill batch' },
      { name: 'Washing with water' },
      { name: 'Add soda ash and water' },
      { name: 'Filter integrity', captureIntegrity: true },
    ],
    outputs: [
      { name: 'Finished goods', requiresQc: true },
      { name: 'High cut', requiresQc: false, isByproduct: true },
      { name: 'SD', requiresQc: false, isByproduct: true },
      { name: 'HBr', requiresQc: false, isByproduct: true },
      { name: 'HC', requiresQc: false, isByproduct: true },
    ],
  }
}

const STAGE_II_BY_CODE: Record<string, Pick<SeedProduct, 'rms' | 'stages' | 'outputs'>> = {
  '2BB': stageIiWash({ sulphuric: false }),
  ALLYLBR: stageIiWash({ sulphuric: false }),
  IPBR: stageIiWash({ sulphuric: false }),
  DBP: stageIiWash({ sulphuric: false }),
  NBBR: stageIiWash({ sulphuric: true }),
  NPBR: stageIiWash({ sulphuric: true }),
  EDBR: stageIiEdbr(),
  BENZYLBR: stageIiRedistillWash(),
  DBB: stageIiRedistillWash(),
  DBH: stageIiRedistillWash(),
}

const STAGE_II_ONLY_PRODUCTS: Array<{ code: string; name: string }> = [
  { code: 'BENZYLBR', name: 'Benzyl BR' },
  { code: 'DBB', name: '1.4 DBB' },
  { code: 'DBH', name: '1.6 DBH' },
]

function fgRecipeForCode(code: string): Pick<SeedProduct, 'rms' | 'stages' | 'outputs'> {
  return STAGE_II_BY_CODE[code] ?? stageIiWash({ sulphuric: true })
}

function fgProductFromSfg(sfg: SeedProduct): SeedProduct {
  const fg = fgRecipeForCode(sfg.code)
  return {
    code: `${sfg.code}-FG`,
    name: `${sfg.name} finished`,
    kind: 'fg',
    rms: fg.rms,
    stages: fg.stages,
    outputs: fg.outputs,
  }
}

const ANANTA_FG_PRODUCTS: SeedProduct[] =
  ANANTA_PRODUCTION_PRODUCTS.map(fgProductFromSfg)

async function syncOutputFormulas(
  productId: string,
  outputs: SeedOutput[],
  opts?: { appendMissing?: boolean },
) {
  const existing = await prisma.productionOutputField.findMany({
    where: { productId },
    orderBy: { sortOrder: 'asc' },
  })
  const byName = new Map(existing.map((o) => [o.name.trim().toLowerCase(), o]))

  if (opts?.appendMissing) {
    let nextOrder = existing.reduce((m, o) => Math.max(m, o.sortOrder), -1) + 1
    for (const o of outputs) {
      const key = o.name.trim().toLowerCase()
      if (byName.has(key)) continue
      const created = await prisma.productionOutputField.create({
        data: {
          productId,
          name: o.name.trim(),
          sortOrder: nextOrder++,
          isComputed: Boolean(o.sumOf?.length),
          sumOf: o.sumOf?.length ? o.sumOf : null,
        },
      })
      byName.set(key, created)
      const openBatches = await prisma.productionBatch.findMany({
        where: { productId, status: { in: ['draft', 'in_progress'] } },
        select: { id: true },
      })
      if (openBatches.length) {
        await prisma.productionBatchOutput.createMany({
          data: openBatches.map((b) => ({
            batchId: b.id,
            outputFieldId: created.id,
            qty: 0,
          })),
          skipDuplicates: true,
        })
      }
    }
  }

  for (const o of outputs) {
    const row = byName.get(o.name.trim().toLowerCase())
    if (!row) continue
    const sumOf = o.sumOf?.length ? o.sumOf : null
    await prisma.productionOutputField.update({
      where: { id: row.id },
      data: {
        isComputed: Boolean(sumOf?.length),
        sumOf,
      },
    })
  }

  // Legacy finish names still on some products
  const legacyFormulas: Array<{ name: string; sumOf: string[] }> = [
    { name: '2BB Finish', sumOf: ['2BB Crude', '2BB H-C'] },
    { name: 'EDBR Finish', sumOf: ['EDBR Crude', 'EDBR H-C', 'EDBR Bottom'] },
    { name: 'NBBR Finish', sumOf: ['NBBR Crude', 'NBBR H-C'] },
    { name: 'IPBR Finish', sumOf: ['IPBR Crude', 'IPBR H-C'] },
    { name: 'Allyl BR Finish', sumOf: ['Allyl BR Crude', 'Allyl H-C'] },
    { name: 'DBP Finish', sumOf: ['DBP Crude', 'DBP H-C'] },
    { name: '1.33 Finish', sumOf: ['1.33 Crude', '1.33 H-C'] },
  ]
  for (const legacy of legacyFormulas) {
    const row = byName.get(legacy.name.toLowerCase())
    if (!row) continue
    await prisma.productionOutputField.update({
      where: { id: row.id },
      data: { isComputed: true, sumOf: legacy.sumOf },
    })
  }
}

function normName(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

function isSulphuricName(s: string) {
  const n = normName(s)
  return n.includes('sulphuric') || n.includes('sulfuric') || n === 's.acid' || n === 's. acid'
}

async function linkInProcessLotStages(productId: string) {
  const rms = await prisma.productionProductRm.findMany({
    where: { productId, process: 'sfg' },
  })
  const stages = await prisma.productionProcessStage.findMany({
    where: { productId, process: 'sfg' },
  })
  for (const stage of stages) {
    const match = rms.find(
      (r) =>
        r.allowMultiLot &&
        stage.name.toLowerCase().includes(r.materialName.toLowerCase()),
    )
    await prisma.productionProcessStage.update({
      where: { id: stage.id },
      data: { lotRmDefId: match?.id ?? null },
    })
  }
}

async function upsertSfgFromExcel(productId: string, tpl: SeedProduct) {
  const aliases = SFG_RM_ALIASES[tpl.code] ?? {}
  const existingRms = await prisma.productionProductRm.findMany({
    where: { productId, process: 'sfg' },
  })
  const claimed = new Set<string>()

  const takeExisting = (desired: string) => {
    const want = normName(desired)
    const aliasList = (aliases[desired] ?? []).map(normName)
    const hit = existingRms.find((r) => {
      if (claimed.has(r.id)) return false
      const have = normName(r.materialName)
      if (have === want) return true
      if (aliasList.includes(have)) return true
      if (isSulphuricName(desired) && isSulphuricName(r.materialName)) return true
      return false
    })
    if (hit) claimed.add(hit.id)
    return hit
  }

  for (const [i, r] of tpl.rms.entries()) {
    const data = {
      materialName: r.materialName,
      unit: r.unit ?? 'Kg',
      sortOrder: i,
      allowMultiLot: Boolean(r.allowMultiLot),
      lotRequired: r.lotRequired !== false,
      maxLots: r.maxLots ?? 2,
      stockKind: 'rm' as const,
      process: 'sfg' as const,
    }
    const row = takeExisting(r.materialName)
    if (row) {
      await prisma.productionProductRm.update({ where: { id: row.id }, data })
    } else {
      await prisma.productionProductRm.create({
        data: { productId, ...data },
      })
    }
  }

  for (const row of existingRms) {
    if (claimed.has(row.id)) continue
    const used = await prisma.productionBatchRmLine.count({ where: { rmDefId: row.id } })
    if (used === 0) {
      await prisma.productionProductRm.delete({ where: { id: row.id } })
    }
  }

  const existingStages = await prisma.productionProcessStage.findMany({
    where: { productId, process: 'sfg' },
    orderBy: { sortOrder: 'asc' },
  })
  const claimedStages = new Set<string>()
  for (const [i, s] of tpl.stages.entries()) {
    const want = normName(s.name)
    let hit = existingStages.find(
      (row) => !claimedStages.has(row.id) && normName(row.name) === want,
    )
    if (!hit) {
      hit = existingStages.find(
        (row) =>
          !claimedStages.has(row.id) &&
          (normName(row.name).includes(want) || want.includes(normName(row.name))),
      )
    }
    if (!hit && existingStages[i] && !claimedStages.has(existingStages[i].id)) {
      hit = existingStages[i]
    }
    const data = {
      name: s.name,
      sortOrder: i,
      captureIntegrity: Boolean(s.captureIntegrity),
      captureStartTemp: true,
      captureEndTemp: true,
      process: 'sfg' as const,
    }
    if (hit) {
      claimedStages.add(hit.id)
      await prisma.productionProcessStage.update({ where: { id: hit.id }, data })
    } else {
      await prisma.productionProcessStage.create({
        data: { productId, ...data },
      })
    }
  }
  for (const row of existingStages) {
    if (claimedStages.has(row.id)) continue
    const used = await prisma.productionBatchStageLog.count({ where: { stageId: row.id } })
    if (used === 0) {
      await prisma.productionProcessStage.delete({ where: { id: row.id } })
    }
  }

  const existingOut = await prisma.productionOutputField.findMany({
    where: { productId, process: 'sfg' },
  })
  const claimedOut = new Set<string>()
  for (const [i, o] of tpl.outputs.entries()) {
    const want = normName(o.name)
    const hit = existingOut.find(
      (row) => !claimedOut.has(row.id) && normName(row.name) === want,
    )
    const data = {
      name: o.name,
      sortOrder: i,
      isComputed: Boolean(o.sumOf?.length),
      sumOf: o.sumOf?.length ? o.sumOf : null,
      requiresQc: o.isByproduct ? false : o.requiresQc !== false,
      isByproduct: Boolean(o.isByproduct) || o.requiresQc === false,
      process: 'sfg' as const,
    }
    if (hit) {
      claimedOut.add(hit.id)
      await prisma.productionOutputField.update({ where: { id: hit.id }, data })
    } else {
      await prisma.productionOutputField.create({
        data: { productId, ...data },
      })
    }
  }
  for (const row of existingOut) {
    if (claimedOut.has(row.id)) continue
    const used = await prisma.productionBatchOutput.count({
      where: { outputFieldId: row.id },
    })
    if (used === 0) {
      await prisma.productionOutputField.delete({ where: { id: row.id } })
    }
  }

  await linkInProcessLotStages(productId)
}

async function seedAnantaProductionTemplates(factoryId: string) {
  const templates = ANANTA_PRODUCTION_PRODUCTS
  for (const tpl of templates) {
    const existing = await prisma.productionProduct.findUnique({
      where: { factoryId_code: { factoryId, code: tpl.code } },
    })

    if (existing) {
      await prisma.productionProduct.update({
        where: { id: existing.id },
        data: { name: tpl.name, isActive: true, kind: 'sfg' },
      })
      await upsertSfgFromExcel(existing.id, tpl)
      await stripMisplacedFgInputsFromSfg(existing.id)
      continue
    }

    const created = await prisma.productionProduct.create({
      data: {
        factoryId,
        code: tpl.code,
        name: tpl.name,
        kind: 'sfg',
        isActive: true,
        rms: {
          create: tpl.rms.map((r, i) => ({
            materialName: r.materialName,
            unit: r.unit ?? 'Kg',
            sortOrder: i,
            allowMultiLot: Boolean(r.allowMultiLot),
            lotRequired: r.lotRequired !== false,
            maxLots: r.maxLots ?? 2,
            stockKind: 'rm',
            process: 'sfg',
          })),
        },
        stages: {
          create: tpl.stages.map((s, i) => ({
            name: s.name,
            sortOrder: i,
            captureIntegrity: Boolean(s.captureIntegrity),
            captureStartTemp: true,
            captureEndTemp: true,
            process: 'sfg',
          })),
        },
        outputs: {
          create: tpl.outputs.map((o, i) => ({
            name: o.name,
            sortOrder: i,
            isComputed: Boolean(o.sumOf?.length),
            sumOf: o.sumOf?.length ? o.sumOf : null,
            requiresQc: o.isByproduct ? false : o.requiresQc !== false,
            isByproduct: Boolean(o.isByproduct) || o.requiresQc === false,
            process: 'sfg',
          })),
        },
      },
    })
    await linkInProcessLotStages(created.id)
  }
  await mergeSplitFgProductsIntoParents(factoryId)
  await seedFgProcessOnSfgProducts(factoryId)
  for (const tpl of templates) {
    const product = await prisma.productionProduct.findUnique({
      where: { factoryId_code: { factoryId, code: tpl.code } },
    })
    if (product) {
      await stripMisplacedFgInputsFromSfg(product.id)
    }
  }
  console.log(
    `Seeded ${ANANTA_PRODUCTION_PRODUCTS.length} products with RM→SFG and SFG→FG processes.`,
  )
}

async function stripMisplacedFgInputsFromSfg(productId: string) {
  const sfgRms = await prisma.productionProductRm.findMany({
    where: { productId, process: 'sfg' },
  })
  for (const row of sfgRms) {
    const n = row.materialName.trim().toLowerCase()
    const isWash =
      n.includes('semi-finished') ||
      n.includes('caustic soda') ||
      n === 'soda ash'
    if (!isWash) continue
    const used = await prisma.productionBatchRmLine.count({
      where: { rmDefId: row.id },
    })
    if (used > 0) {
      await prisma.productionProductRm.update({
        where: { id: row.id },
        data: { process: 'fg', stockKind: n.includes('semi') ? 'sfg' : row.stockKind },
      })
    } else {
      await prisma.productionProductRm.delete({ where: { id: row.id } })
    }
  }
}

async function upsertFgFromBmr(
  productId: string,
  fg: Pick<SeedProduct, 'rms' | 'stages' | 'outputs'>,
) {
  const existingRms = await prisma.productionProductRm.findMany({
    where: { productId, process: 'fg' },
  })
  const claimed = new Set<string>()
  const takeExisting = (desired: string, stockKind: 'rm' | 'sfg') => {
    const want = normName(desired)
    const hit = existingRms.find((r) => {
      if (claimed.has(r.id)) return false
      const have = normName(r.materialName)
      if (have === want) return true
      if (stockKind === 'sfg' && (r.stockKind === 'sfg' || have.includes('crude'))) return true
      if (isSulphuricName(desired) && isSulphuricName(r.materialName)) return true
      return false
    })
    if (hit) claimed.add(hit.id)
    return hit
  }

  for (const [i, r] of fg.rms.entries()) {
    const stockKind = r.stockKind === 'sfg' ? 'sfg' : 'rm'
    const data = {
      materialName: r.materialName,
      unit: r.unit ?? 'Kg',
      sortOrder: i,
      allowMultiLot: Boolean(r.allowMultiLot) || stockKind === 'sfg',
      lotRequired: r.lotRequired !== false,
      maxLots: r.maxLots ?? (stockKind === 'sfg' ? 3 : 2),
      stockKind,
      process: 'fg' as const,
    }
    const row = takeExisting(r.materialName, stockKind)
    if (row) {
      await prisma.productionProductRm.update({ where: { id: row.id }, data })
    } else {
      await prisma.productionProductRm.create({ data: { productId, ...data } })
    }
  }
  for (const row of existingRms) {
    if (claimed.has(row.id)) continue
    const used = await prisma.productionBatchRmLine.count({ where: { rmDefId: row.id } })
    if (used === 0) await prisma.productionProductRm.delete({ where: { id: row.id } })
  }

  const existingStages = await prisma.productionProcessStage.findMany({
    where: { productId, process: 'fg' },
    orderBy: { sortOrder: 'asc' },
  })
  const claimedStages = new Set<string>()
  for (const [i, s] of fg.stages.entries()) {
    const want = normName(s.name)
    let hit = existingStages.find(
      (row) => !claimedStages.has(row.id) && normName(row.name) === want,
    )
    if (!hit && existingStages[i] && !claimedStages.has(existingStages[i].id)) {
      hit = existingStages[i]
    }
    const integrityOnly = Boolean(s.captureIntegrity)
    const data = {
      name: s.name,
      sortOrder: i,
      captureIntegrity: integrityOnly,
      captureStartDate: !integrityOnly,
      captureEndDate: !integrityOnly,
      captureStartTime: !integrityOnly,
      captureEndTime: !integrityOnly,
      captureStartTemp: false,
      captureEndTemp: false,
      process: 'fg' as const,
    }
    if (hit) {
      claimedStages.add(hit.id)
      await prisma.productionProcessStage.update({ where: { id: hit.id }, data })
    } else {
      await prisma.productionProcessStage.create({ data: { productId, ...data } })
    }
  }
  for (const row of existingStages) {
    if (claimedStages.has(row.id)) continue
    // Timed bookkeeping steps with no quantity. Drop them, including logs on open batches.
    if (
      normName(row.name) === normName('By-product collection') ||
      normName(row.name) === normName('Collect in vessel') ||
      normName(row.name) === normName('Finish received')
    ) {
      await prisma.productionBatchStageLog.deleteMany({ where: { stageId: row.id } })
    }
    const used = await prisma.productionBatchStageLog.count({ where: { stageId: row.id } })
    if (used === 0) await prisma.productionProcessStage.delete({ where: { id: row.id } })
  }

  const existingOut = await prisma.productionOutputField.findMany({
    where: { productId, process: 'fg' },
  })
  const claimedOut = new Set<string>()
  for (const [i, o] of fg.outputs.entries()) {
    const want = normName(o.name)
    const hit = existingOut.find(
      (row) =>
        !claimedOut.has(row.id) &&
        (normName(row.name) === want ||
          (want.includes('finished') && normName(row.name).includes('finished')) ||
          (want.includes('by-product') && normName(row.name).includes('by-product'))),
    )
    const data = {
      name: o.name,
      sortOrder: i,
      isComputed: Boolean(o.sumOf?.length),
      sumOf: o.sumOf?.length ? o.sumOf : null,
      requiresQc: o.isByproduct ? false : o.requiresQc !== false,
      isByproduct: Boolean(o.isByproduct) || o.requiresQc === false,
      process: 'fg' as const,
    }
    if (hit) {
      claimedOut.add(hit.id)
      await prisma.productionOutputField.update({ where: { id: hit.id }, data })
    } else {
      await prisma.productionOutputField.create({ data: { productId, ...data } })
    }
  }
  for (const row of existingOut) {
    if (claimedOut.has(row.id)) continue
    const used = await prisma.productionBatchOutput.count({
      where: { outputFieldId: row.id },
    })
    if (used === 0) await prisma.productionOutputField.delete({ where: { id: row.id } })
  }
}

async function seedFgProcessOnSfgProducts(factoryId: string) {
  for (const extra of STAGE_II_ONLY_PRODUCTS) {
    const found = await prisma.productionProduct.findUnique({
      where: { factoryId_code: { factoryId, code: extra.code } },
    })
    if (!found) {
      await prisma.productionProduct.create({
        data: {
          factoryId,
          code: extra.code,
          name: extra.name,
          kind: 'sfg',
          isActive: true,
        },
      })
    } else {
      await prisma.productionProduct.update({
        where: { id: found.id },
        data: { name: extra.name, isActive: true },
      })
    }
  }

  const products = await prisma.productionProduct.findMany({
    where: { factoryId, code: { not: { endsWith: '-FG' } } },
    select: { id: true, code: true },
  })
  for (const product of products) {
    await upsertFgFromBmr(product.id, fgRecipeForCode(product.code))
  }
}

async function mergeSplitFgProductsIntoParents(factoryId: string) {
  const splits = await prisma.productionProduct.findMany({
    where: { factoryId, code: { endsWith: '-FG' } },
    include: {
      rms: true,
      stages: true,
      outputs: true,
      _count: { select: { batches: true } },
    },
  })
  for (const fg of splits) {
    if (fg._count.batches > 0) continue
    const parentCode = fg.code.replace(/-FG$/i, '')
    const parent = await prisma.productionProduct.findUnique({
      where: { factoryId_code: { factoryId, code: parentCode } },
    })
    if (!parent) {
      await prisma.productionProduct.delete({ where: { id: fg.id } })
      continue
    }
    await prisma.productionProductRm.deleteMany({
      where: { productId: parent.id, process: 'fg' },
    })
    await prisma.productionProcessStage.deleteMany({
      where: { productId: parent.id, process: 'fg' },
    })
    await prisma.productionOutputField.deleteMany({
      where: { productId: parent.id, process: 'fg' },
    })
    if (fg.rms.length) {
      await prisma.productionProductRm.createMany({
        data: fg.rms.map((r) => ({
          productId: parent.id,
          materialName: r.materialName,
          unit: r.unit,
          sortOrder: r.sortOrder,
          allowMultiLot: r.allowMultiLot,
          lotRequired: r.lotRequired,
          maxLots: r.maxLots,
          stockKind: r.stockKind === 'sfg' ? 'sfg' : 'rm',
          process: 'fg',
        })),
      })
    }
    if (fg.stages.length) {
      await prisma.productionProcessStage.createMany({
        data: fg.stages.map((s) => ({
          productId: parent.id,
          name: s.name,
          sortOrder: s.sortOrder,
          captureStartDate: s.captureStartDate,
          captureEndDate: s.captureEndDate,
          captureStartTime: s.captureStartTime,
          captureEndTime: s.captureEndTime,
          captureStartTemp: s.captureStartTemp,
          captureEndTemp: s.captureEndTemp,
          captureIntegrity: s.captureIntegrity,
          process: 'fg',
        })),
      })
    }
    if (fg.outputs.length) {
      await prisma.productionOutputField.createMany({
        data: fg.outputs.map((o) => ({
          productId: parent.id,
          name: o.name,
          sortOrder: o.sortOrder,
          isComputed: o.isComputed,
          sumOf: o.sumOf ?? undefined,
          requiresQc: o.requiresQc,
          isByproduct: Boolean(o.isByproduct),
          process: 'fg',
        })),
      })
    }
    await prisma.productionProduct.delete({ where: { id: fg.id } })
  }
}

async function seedDiscountFgCustomer(factoryId: string) {
  const name = 'Discount FG sales'
  const existing = await prisma.customer.findFirst({
    where: { factoryId, name },
  })
  if (existing) return
  await prisma.customer.create({
    data: {
      factoryId,
      name,
      isActive: true,
    },
  })
  console.log('Created customer "Discount FG sales" for rejected FG.')
}

async function mergeFactoryMaterials(
  factoryId: string,
  extras: Array<{ name: string; hsn?: string }>,
) {
  const factory = await prisma.factory.findUnique({ where: { id: factoryId } })
  if (!factory) throw new Error(`Factory ${factoryId} not found`)
  const current = Array.isArray(factory.materials) ? factory.materials : []
  const rows: Array<{ name: string; hsn?: string }> = []
  const seen = new Set<string>()
  for (const raw of [...current, ...extras]) {
    const name =
      typeof raw === 'string'
        ? raw.trim()
        : String((raw as { name?: string })?.name ?? '').trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const hsn =
      typeof raw === 'object' && raw && 'hsn' in raw
        ? String((raw as { hsn?: string }).hsn ?? '').trim()
        : ''
    rows.push(hsn ? { name, hsn } : { name })
  }
  await prisma.factory.update({
    where: { id: factoryId },
    data: { materials: rows },
  })
}

/** Materials + FG products + discount customer (does not reset users). */
export async function applyAnantaProductionMasters(factoryId = FACTORY_ID) {
  await mergeFactoryMaterials(factoryId, [
    { name: 'Oleum', hsn: '28070010' },
    { name: 'Sulphur', hsn: '25030010' },
    { name: 'PNT', hsn: '29042090' },
    { name: 'Caustic', hsn: '28151110' },
    ...ANANTA_EXTRA_MATERIALS,
  ])
  await seedAnantaProductionTemplates(factoryId)
  await seedDiscountFgCustomer(factoryId)
}

async function seedIoMaster() {
  await prisma.$executeRaw`
    INSERT INTO io_countries (name, code)
    SELECT 'India', 'IN'
    WHERE NOT EXISTS (SELECT 1 FROM io_countries WHERE name = 'India')
  `
  await prisma.$executeRaw`
    INSERT INTO io_states (country_id, name, code)
    SELECT c.id, 'Gujarat', 'GJ'
    FROM io_countries c
    WHERE c.name = 'India'
      AND NOT EXISTS (
        SELECT 1 FROM io_states s
        WHERE s.country_id = c.id AND s.name = 'Gujarat'
      )
  `
  for (const city of ['Ahmedabad', 'Surat']) {
    await prisma.$executeRaw`
      INSERT INTO io_cities (state_id, name)
      SELECT s.id, ${city}
      FROM io_states s
      JOIN io_countries c ON c.id = s.country_id
      WHERE c.name = 'India' AND s.name = 'Gujarat'
        AND NOT EXISTS (
          SELECT 1 FROM io_cities ci
          WHERE ci.state_id = s.id AND ci.name = ${city}
        )
    `
  }
  const units = [
    { name: 'Kilogram', abbreviation: 'Kg' },
    { name: 'Metric Ton', abbreviation: 'MT' },
    { name: 'Number', abbreviation: 'Nos' },
  ]
  for (const u of units) {
    await prisma.$executeRaw`
      INSERT INTO io_units (name, abbreviation)
      SELECT ${u.name}, ${u.abbreviation}
      WHERE NOT EXISTS (SELECT 1 FROM io_units WHERE name = ${u.name})
    `
  }
}

export async function seedAnanta() {
  const passwordHash = await bcrypt.hash(USER_PASSWORD, 12)

  try {
    const client = await prisma.client.upsert({
      where: { slug: CLIENT_SLUG },
      update: { name: CLIENT_NAME, isActive: true },
      create: { slug: CLIENT_SLUG, name: CLIENT_NAME, isActive: true },
    })

    const legacy = await prisma.user.findFirst({
      where: {
        OR: [{ email: USER_USERNAME }, { username: USER_USERNAME }, { id: USER_ID }],
      },
    })

    if (legacy && legacy.email === USER_USERNAME) {
      await prisma.user.update({
        where: { id: legacy.id },
        data: { username: USER_USERNAME, email: USER_EMAIL },
      })
      await prisma.profile.updateMany({
        where: { id: legacy.id },
        data: { email: USER_EMAIL },
      })
    }

    await prisma.user.upsert({
      where: { email: USER_EMAIL },
      update: {
        id: USER_ID,
        username: USER_USERNAME,
        name: USER_NAME,
        passwordHash,
        role: UserRole.OWNER,
        clientId: client.id,
        isActive: true,
      },
      create: {
        id: USER_ID,
        username: USER_USERNAME,
        email: USER_EMAIL,
        name: USER_NAME,
        passwordHash,
        role: UserRole.OWNER,
        clientId: client.id,
        isActive: true,
      },
    })

    const factoryMaterials = [
      { name: 'Oleum', hsn: '28070010' },
      { name: 'Sulphur', hsn: '25030010' },
      { name: 'PNT', hsn: '29042090' },
      { name: 'Caustic', hsn: '28151110' },
      ...ANANTA_EXTRA_MATERIALS,
    ]

    const factory = await prisma.factory.upsert({
      where: { id: FACTORY_ID },
      update: {
        name: FACTORY_NAME,
        location: FACTORY_LOCATION,
        companyAddress: 'Plot No. 202, 203, 204, Phase-I, Near Water tank, GIDC Chhatral',
        isActive: true,
        materials: factoryMaterials,
      },
      create: {
        id: FACTORY_ID,
        name: FACTORY_NAME,
        location: FACTORY_LOCATION,
        companyAddress: 'Plot No. 202, 203, 204, Phase-I, Near Water tank, GIDC Chhatral',
        isActive: true,
        materials: factoryMaterials,
      },
    })

    await prisma.profile.upsert({
      where: { id: USER_ID },
      update: {
        fullName: USER_NAME,
        email: USER_EMAIL,
        role: ProfileRole.owner,
        isActive: true,
      },
      create: {
        id: USER_ID,
        fullName: USER_NAME,
        email: USER_EMAIL,
        role: ProfileRole.owner,
        isActive: true,
      },
    })

    await prisma.profileFactory.upsert({
      where: {
        profileId_factoryId: { profileId: USER_ID, factoryId: FACTORY_ID },
      },
      update: {},
      create: { profileId: USER_ID, factoryId: FACTORY_ID },
    })

    // Chemist — plant batches: issue RM from warehouse, usage, product IO
    await prisma.user.upsert({
      where: { email: CHEMIST_EMAIL },
      update: {
        id: CHEMIST_ID,
        username: CHEMIST_USERNAME,
        name: CHEMIST_NAME,
        passwordHash,
        role: UserRole.OPERATOR,
        clientId: client.id,
        isActive: true,
      },
      create: {
        id: CHEMIST_ID,
        username: CHEMIST_USERNAME,
        email: CHEMIST_EMAIL,
        name: CHEMIST_NAME,
        passwordHash,
        role: UserRole.OPERATOR,
        clientId: client.id,
        isActive: true,
      },
    })

    await prisma.profile.upsert({
      where: { id: CHEMIST_ID },
      update: {
        fullName: CHEMIST_NAME,
        email: CHEMIST_EMAIL,
        role: ProfileRole.chemist,
        isActive: true,
      },
      create: {
        id: CHEMIST_ID,
        fullName: CHEMIST_NAME,
        email: CHEMIST_EMAIL,
        role: ProfileRole.chemist,
        isActive: true,
      },
    })

    await prisma.profileFactory.upsert({
      where: {
        profileId_factoryId: { profileId: CHEMIST_ID, factoryId: FACTORY_ID },
      },
      update: {},
      create: { profileId: CHEMIST_ID, factoryId: FACTORY_ID },
    })

    // Accountant — receive material against PO (pending QC)
    await prisma.user.upsert({
      where: { email: ACCOUNTANT_EMAIL },
      update: {
        id: ACCOUNTANT_ID,
        username: ACCOUNTANT_USERNAME,
        name: ACCOUNTANT_NAME,
        passwordHash,
        role: UserRole.OPERATOR,
        clientId: client.id,
        isActive: true,
      },
      create: {
        id: ACCOUNTANT_ID,
        username: ACCOUNTANT_USERNAME,
        email: ACCOUNTANT_EMAIL,
        name: ACCOUNTANT_NAME,
        passwordHash,
        role: UserRole.OPERATOR,
        clientId: client.id,
        isActive: true,
      },
    })

    await prisma.profile.upsert({
      where: { id: ACCOUNTANT_ID },
      update: {
        fullName: ACCOUNTANT_NAME,
        email: ACCOUNTANT_EMAIL,
        role: ProfileRole.accountant,
        isActive: true,
      },
      create: {
        id: ACCOUNTANT_ID,
        fullName: ACCOUNTANT_NAME,
        email: ACCOUNTANT_EMAIL,
        role: ProfileRole.accountant,
        isActive: true,
      },
    })

    await prisma.profileFactory.upsert({
      where: {
        profileId_factoryId: { profileId: ACCOUNTANT_ID, factoryId: FACTORY_ID },
      },
      update: {},
      create: { profileId: ACCOUNTANT_ID, factoryId: FACTORY_ID },
    })

    // Lab incharge — RM / SFG / FG / sample QC (reuses former plant id slot when present)
    {
      const byId = await prisma.user.findUnique({ where: { id: LAB_ID } })
      if (byId) {
        await prisma.user.update({
          where: { id: LAB_ID },
          data: {
            username: LAB_USERNAME,
            email: LAB_EMAIL,
            name: LAB_NAME,
            passwordHash,
            role: UserRole.OPERATOR,
            clientId: client.id,
            isActive: true,
          },
        })
      } else {
        await prisma.user.upsert({
          where: { email: LAB_EMAIL },
          update: {
            username: LAB_USERNAME,
            name: LAB_NAME,
            passwordHash,
            role: UserRole.OPERATOR,
            clientId: client.id,
            isActive: true,
          },
          create: {
            id: LAB_ID,
            username: LAB_USERNAME,
            email: LAB_EMAIL,
            name: LAB_NAME,
            passwordHash,
            role: UserRole.OPERATOR,
            clientId: client.id,
            isActive: true,
          },
        })
      }

      const labUser = await prisma.user.findFirstOrThrow({
        where: { OR: [{ id: LAB_ID }, { email: LAB_EMAIL }] },
      })

      await prisma.profile.upsert({
        where: { id: labUser.id },
        update: {
          fullName: LAB_NAME,
          email: LAB_EMAIL,
          role: ProfileRole.lab_incharge,
          isActive: true,
        },
        create: {
          id: labUser.id,
          fullName: LAB_NAME,
          email: LAB_EMAIL,
          role: ProfileRole.lab_incharge,
          isActive: true,
        },
      })

      await prisma.profileFactory.upsert({
        where: {
          profileId_factoryId: { profileId: labUser.id, factoryId: FACTORY_ID },
        },
        update: {},
        create: { profileId: labUser.id, factoryId: FACTORY_ID },
      })
    }

    // Fold any leftover plant_supervisor → chemist
    await prisma.$executeRawUnsafe(`
      UPDATE profiles SET role = 'chemist', updated_at = now()
      WHERE role::text = 'plant_supervisor'
    `)

    // Warehouse manager — buy requests + stock + release to plant
    await prisma.user.upsert({
      where: { email: WAREHOUSE_EMAIL },
      update: {
        id: WAREHOUSE_ID,
        username: WAREHOUSE_USERNAME,
        name: WAREHOUSE_NAME,
        passwordHash,
        role: UserRole.OPERATOR,
        clientId: client.id,
        isActive: true,
      },
      create: {
        id: WAREHOUSE_ID,
        username: WAREHOUSE_USERNAME,
        email: WAREHOUSE_EMAIL,
        name: WAREHOUSE_NAME,
        passwordHash,
        role: UserRole.OPERATOR,
        clientId: client.id,
        isActive: true,
      },
    })

    await prisma.profile.upsert({
      where: { id: WAREHOUSE_ID },
      update: {
        fullName: WAREHOUSE_NAME,
        email: WAREHOUSE_EMAIL,
        role: ProfileRole.warehouse_manager,
        isActive: true,
      },
      create: {
        id: WAREHOUSE_ID,
        fullName: WAREHOUSE_NAME,
        email: WAREHOUSE_EMAIL,
        role: ProfileRole.warehouse_manager,
        isActive: true,
      },
    })

    await prisma.profileFactory.upsert({
      where: {
        profileId_factoryId: { profileId: WAREHOUSE_ID, factoryId: FACTORY_ID },
      },
      update: {},
      create: { profileId: WAREHOUSE_ID, factoryId: FACTORY_ID },
    })

    const instruments = [
      {
        code: 'DENSITY-01',
        name: 'Density apparatus',
        type: 'density',
        docMeta: {
          log_title: 'LOG BOOK FOR DENSITY',
          annexure: 'I',
          form_code: 'IN/04/F/01/00',
          id_line: '',
        },
      },
      {
        code: 'C/MAP-01',
        name: 'Boiling point apparatus',
        type: 'boiling_point',
        docMeta: {
          log_title: 'LOG BOOK FOR BOILING POINT APPARATUS',
          annexure: 'I',
          form_code: 'IN/05/F/01/01',
        },
      },
      {
        code: '01/413',
        name: 'Karl Fisher',
        type: 'karl_fisher',
        docMeta: {
          log_title: 'LOG BOOK FOR KARL FISHER',
          annexure: 'I',
          form_code: 'IN/03/F/01/01',
          id_line: 'INSTRUMENT ID:01/413',
        },
      },
      {
        code: 'GC-01',
        name: 'Gas Chromatography #01',
        type: 'gc',
        docMeta: {
          log_title: 'LOG BOOK FOR GAS CHROMATOGRAPHY',
          annexure: 'I',
          form_code: 'IN/02/F/01/00',
          id_line: 'GC INSTRUMENT NO. # 01',
        },
      },
      {
        code: 'GC-02',
        name: 'Gas Chromatography #02',
        type: 'gc',
        docMeta: {
          log_title: 'LOG BOOK FOR GAS CHROMATOGRAPHY',
          annexure: 'I',
          form_code: 'IN/02/F/01/00',
          id_line: 'GC INSTRUMENT NO. # 02',
        },
      },
    ] as const
    for (const inst of instruments) {
      await prisma.qcInstrument.upsert({
        where: {
          factoryId_code: { factoryId: FACTORY_ID, code: inst.code },
        },
        update: {
          name: inst.name,
          type: inst.type,
          isActive: true,
          docMeta: inst.docMeta,
        },
        create: {
          factoryId: FACTORY_ID,
          code: inst.code,
          name: inst.name,
          type: inst.type,
          isActive: true,
          docMeta: inst.docMeta,
        },
      })
    }

    for (const docType of IO_DOC_TYPES) {
      await prisma.$executeRaw`
        INSERT INTO io_numbering_config (factory_id, doc_type, prefix, suffix, number_format)
        VALUES (${FACTORY_ID}::uuid, ${docType}, ${IO_PREFIX}, '', 'slash_pad3')
        ON CONFLICT (factory_id, doc_type) DO UPDATE SET
          prefix = EXCLUDED.prefix,
          number_format = EXCLUDED.number_format,
          updated_at = now()
      `
    }

    for (const row of [
      { docType: 'po', prefix: 'AFC/PO', format: 'slash_seq_fy' },
      { docType: 'lot', prefix: 'AFC/RM', format: 'slash_seq_fy' },
      { docType: 'batch', prefix: 'AFC', format: 'seq_slash_prefix_fy' },
    ] as const) {
      await prisma.$executeRaw`
        INSERT INTO inventory_numbering_config (factory_id, doc_type, prefix, number_format, pad_width, updated_at)
        VALUES (${FACTORY_ID}::uuid, ${row.docType}, ${row.prefix}, ${row.format}, 0, now())
        ON CONFLICT (factory_id, doc_type) DO UPDATE SET
          prefix = EXCLUDED.prefix,
          number_format = EXCLUDED.number_format,
          pad_width = EXCLUDED.pad_width,
          updated_at = now()
      `
    }

    await seedAnantaProductionTemplates(FACTORY_ID)
    await seedDiscountFgCustomer(FACTORY_ID)
    await seedIoMaster()

    console.log('Ananta Fine Chem seed complete:', {
      clientSlug: CLIENT_SLUG,
      loginUsername: USER_USERNAME,
      contactEmail: USER_EMAIL,
      chemistEmail: CHEMIST_EMAIL,
      chemistUsername: CHEMIST_USERNAME,
      accountantEmail: ACCOUNTANT_EMAIL,
      accountantUsername: ACCOUNTANT_USERNAME,
      labEmail: LAB_EMAIL,
      labUsername: LAB_USERNAME,
      warehouseEmail: WAREHOUSE_EMAIL,
      warehouseUsername: WAREHOUSE_USERNAME,
      factory: factory.name,
      factoryId: factory.id,
      ioPrefix: IO_PREFIX,
    })
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  await seedAnanta()
}

const isMain =
  typeof process.argv[1] === 'string' && process.argv[1].includes('seed-ananta')

if (isMain) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
