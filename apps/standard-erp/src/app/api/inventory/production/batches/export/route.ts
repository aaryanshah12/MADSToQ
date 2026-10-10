import {
  prisma,
  serializeProductionBatch,
  serializeProductionProduct,
} from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireProfile } from '@/lib/qc-api-helpers'

const productInclude = {
  rms: { orderBy: { sortOrder: 'asc' as const } },
  stages: { orderBy: { sortOrder: 'asc' as const } },
  outputs: { orderBy: { sortOrder: 'asc' as const } },
}

const batchExportInclude = {
  creator: { select: { fullName: true } },
  rmLines: true,
  stageLogs: true,
  outputs: true,
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireProfile(request, [
      'owner',
      'chemist',
      'lab_incharge',
      'plant_supervisor',
    ])
    if (auth.error) return auth.error

    const { searchParams } = new URL(request.url)
    const factoryId = searchParams.get('factory_id')
    const productId = searchParams.get('product_id')
    if (!factoryId) {
      return NextResponse.json({ error: 'factory_id is required' }, { status: 400 })
    }

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const factory = await prisma.factory.findUnique({
      where: { id: factoryId },
      select: { name: true },
    })

    const products = await prisma.productionProduct.findMany({
      where: {
        factoryId,
        ...(productId ? { id: productId } : {}),
      },
      include: productInclude,
      orderBy: [{ code: 'asc' }, { name: 'asc' }],
    })

    if (products.length === 0) {
      return NextResponse.json({
        success: true,
        factory_name: factory?.name ?? null,
        products: [],
      })
    }

    const batches = await prisma.productionBatch.findMany({
      where: {
        factoryId,
        productId: { in: products.map((p) => p.id) },
      },
      include: batchExportInclude,
      orderBy: [{ mfgDate: 'asc' }, { createdAt: 'asc' }],
    })

    const batchesByProduct = new Map<string, typeof batches>()
    for (const b of batches) {
      const list = batchesByProduct.get(b.productId) ?? []
      list.push(b)
      batchesByProduct.set(b.productId, list)
    }

    const groups = products
      .map((product) => {
        const rows = batchesByProduct.get(product.id) ?? []
        if (rows.length === 0) return null
        return {
          product: serializeProductionProduct(product),
          batches: rows.map((b) =>
            serializeProductionBatch({
              ...b,
              product: { code: product.code, name: product.name },
            }),
          ),
        }
      })
      .filter((g): g is NonNullable<typeof g> => g != null)

    return NextResponse.json({
      success: true,
      factory_name: factory?.name ?? null,
      products: groups,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
