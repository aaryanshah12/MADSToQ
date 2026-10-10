import { prisma } from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireOwnerFactoryAccess } from '@/lib/employee-api'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  try {
    const { id, docId } = await params
    const doc = await prisma.employeeDocument.findFirst({
      where: { id: docId, employeeId: id },
      include: { employee: { select: { factoryId: true } } },
    })
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    const access = await requireOwnerFactoryAccess(request, doc.employee.factoryId)
    if (access.error) return access.error

    const body = Buffer.from(doc.fileBytes)
    const safeName = doc.fileName.replace(/[^\w.\- ()]/g, '_') || 'document'
    const inline = new URL(request.url).searchParams.get('inline') === '1'
    const lower = safeName.toLowerCase()
    let mime = doc.mimeType || 'application/octet-stream'
    if (mime === 'application/octet-stream') {
      if (lower.endsWith('.pdf')) mime = 'application/pdf'
      else if (lower.endsWith('.png')) mime = 'image/png'
      else if (lower.endsWith('.webp')) mime = 'image/webp'
      else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mime = 'image/jpeg'
    }
    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        'Content-Type': mime,
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  try {
    const { id, docId } = await params
    const doc = await prisma.employeeDocument.findFirst({
      where: { id: docId, employeeId: id },
      include: { employee: { select: { factoryId: true } } },
    })
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    const access = await requireOwnerFactoryAccess(request, doc.employee.factoryId)
    if (access.error) return access.error

    await prisma.employeeDocument.delete({ where: { id: docId } })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
