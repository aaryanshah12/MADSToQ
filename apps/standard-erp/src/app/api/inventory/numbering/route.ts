import {
  getInventoryNumberingConfig,
  previewInventoryDocNumber,
  previewSfgBatchNumber,
  prisma,
  saveInventoryNumberingConfig,
  type InventoryDocType,
  type InventoryNumberingRow,
} from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireProfile } from '@/lib/qc-api-helpers'

function serializeConfig(cfg: Record<InventoryDocType, InventoryNumberingRow>) {
  return {
    po: {
      prefix: cfg.po.prefix,
      number_format: cfg.po.numberFormat,
      pad_width: cfg.po.padWidth,
      example: previewInventoryDocNumber(cfg.po),
    },
    lot: {
      prefix: cfg.lot.prefix,
      number_format: cfg.lot.numberFormat,
      pad_width: cfg.lot.padWidth,
      example: previewInventoryDocNumber(cfg.lot),
    },
    batch: {
      prefix: cfg.batch.prefix,
      number_format: cfg.batch.numberFormat,
      pad_width: cfg.batch.padWidth,
      example: previewInventoryDocNumber(cfg.batch, 1),
    },
    sale: {
      prefix: cfg.sale.prefix,
      number_format: cfg.sale.numberFormat,
      pad_width: cfg.sale.padWidth,
      example: previewInventoryDocNumber(cfg.sale),
    },
    coa: {
      prefix: cfg.coa.prefix,
      number_format: cfg.coa.numberFormat,
      pad_width: cfg.coa.padWidth,
      example: previewInventoryDocNumber(cfg.coa),
    },
    sfg_example: previewSfgBatchNumber('CODE', 1),
  }
}

function parseRow(
  raw: Record<string, unknown> | undefined,
  fallback: InventoryNumberingRow,
): InventoryNumberingRow {
  return {
    prefix: String(raw?.prefix ?? fallback.prefix).trim() || fallback.prefix,
    numberFormat: fallback.numberFormat,
    padWidth: Number(raw?.pad_width ?? raw?.padWidth ?? fallback.padWidth) || 0,
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireProfile(request, ['owner', 'accountant'])
    if (auth.error) return auth.error

    const factoryId = new URL(request.url).searchParams.get('factory_id')
    if (!factoryId) {
      return NextResponse.json({ error: 'factory_id is required' }, { status: 400 })
    }

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const cfg = await getInventoryNumberingConfig(factoryId)
    return NextResponse.json({ success: true, config: serializeConfig(cfg) })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireProfile(request, ['owner'])
    if (auth.error) return auth.error

    const body = await request.json()
    const factoryId = String(body.factory_id || '')
    if (!factoryId) {
      return NextResponse.json({ error: 'factory_id is required' }, { status: 400 })
    }

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const existing = await getInventoryNumberingConfig(factoryId)
    const values: Record<InventoryDocType, InventoryNumberingRow> = {
      po: parseRow(body.po, { ...existing.po, numberFormat: 'slash_seq_fy' }),
      lot: parseRow(body.lot, { ...existing.lot, numberFormat: 'slash_seq_fy' }),
      batch: {
        ...parseRow(body.batch, existing.batch),
        numberFormat: 'seq_slash_prefix_fy',
      },
      sale: parseRow(body.sale, { ...existing.sale, numberFormat: 'slash_seq_fy' }),
      coa: parseRow(body.coa, { ...existing.coa, numberFormat: 'slash_seq_fy' }),
    }

    const cfg = await saveInventoryNumberingConfig(factoryId, values)
    return NextResponse.json({ success: true, config: serializeConfig(cfg) })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
