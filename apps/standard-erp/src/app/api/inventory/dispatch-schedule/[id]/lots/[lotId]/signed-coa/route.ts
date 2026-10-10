import { prisma } from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { DISPATCH_SCHEDULE_ROLES } from '@/lib/dispatch-schedule'
import { requireProfile } from '@/lib/qc-api-helpers'

const MAX_SIGNED_COA_BYTES = 8 * 1024 * 1024
const UPLOAD_ROLES = ['owner', 'lab_incharge'] as const

async function loadLot(saleId: string, lotId: string, profileId: string) {
  const sale = await prisma.dispatchSchedule.findUnique({
    where: { id: saleId },
    select: { id: true, factoryId: true },
  })
  if (!sale) return { error: NextResponse.json({ error: 'Sale not found' }, { status: 404 }) }
  const link = await prisma.profileFactory.findFirst({
    where: { profileId, factoryId: sale.factoryId },
    select: { id: true },
  })
  if (!link) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  const lot = await prisma.dispatchScheduleLot.findFirst({
    where: { id: lotId, saleId },
    select: { id: true, coaNo: true },
  })
  if (!lot) return { error: NextResponse.json({ error: 'Lot not found on this sale' }, { status: 404 }) }
  return { sale, lot }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lotId: string }> },
) {
  try {
    const auth = await requireProfile(request, [...DISPATCH_SCHEDULE_ROLES])
    if (auth.error) return auth.error
    const { id, lotId } = await params
    const loaded = await loadLot(id, lotId, auth.profile.id)
    if (loaded.error) return loaded.error

    const file = await prisma.dispatchScheduleLotSignedCoa.findUnique({
      where: { lotId },
    })
    if (!file) return NextResponse.json({ error: 'Signed COA not uploaded' }, { status: 404 })

    const body = Buffer.from(file.fileBytes)
    const safeName = file.fileName.replace(/[^\w.\- ()]/g, '_') || 'signed-coa.pdf'
    const inline = new URL(request.url).searchParams.get('inline') === '1'
    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(body.length),
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${safeName}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lotId: string }> },
) {
  try {
    const auth = await requireProfile(request, [...UPLOAD_ROLES])
    if (auth.error) return auth.error
    const { id, lotId } = await params
    const loaded = await loadLot(id, lotId, auth.profile.id)
    if (loaded.error) return loaded.error
    if (!loaded.lot.coaNo) {
      return NextResponse.json({ error: 'Generate the COA before uploading a signed copy' }, { status: 400 })
    }

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }
    if (file.size > MAX_SIGNED_COA_BYTES) {
      return NextResponse.json({ error: 'File must be 8 MB or smaller' }, { status: 400 })
    }
    const fileName = file.name.replace(/[/\\]/g, '_').slice(0, 180) || 'signed-coa.pdf'
    const isPdf = file.type === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      return NextResponse.json({ error: 'Only a PDF file is allowed' }, { status: 400 })
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    const row = await prisma.dispatchScheduleLotSignedCoa.upsert({
      where: { lotId },
      create: {
        lotId,
        fileName,
        mimeType: 'application/pdf',
        sizeBytes: bytes.length,
        fileBytes: bytes,
        uploadedBy: auth.profile.id,
      },
      update: {
        fileName,
        mimeType: 'application/pdf',
        sizeBytes: bytes.length,
        fileBytes: bytes,
        uploadedBy: auth.profile.id,
        uploadedAt: new Date(),
      },
      select: {
        fileName: true,
        uploadedAt: true,
        uploader: { select: { fullName: true } },
      },
    })

    return NextResponse.json({
      success: true,
      signed_coa_file_name: row.fileName,
      signed_coa_uploaded_at: row.uploadedAt.toISOString(),
      signed_coa_uploaded_by_name: row.uploader?.fullName ?? null,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
