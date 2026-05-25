import { NextRequest, NextResponse } from 'next/server'
import { withAuthenticatedDb } from '@madstoq/database'
import * as io from '@madstoq/io-system/services'
import type { IOPdfSlot } from '@madstoq/io-system/services'

function factoryIdFrom(req: NextRequest, fd?: FormData): string | null {
  const fromQuery = req.nextUrl.searchParams.get('factoryId')
  if (fromQuery) return fromQuery
  if (fd) return (fd.get('factoryId') as string | null) || null
  return null
}

export async function GET(req: NextRequest) {
  const factoryId = factoryIdFrom(req)
  if (!factoryId) {
    return NextResponse.json({ error: 'factoryId is required' }, { status: 400 })
  }
  return withAuthenticatedDb(req, async () => {
    try {
      const manifest = await io.fetchPdfConfig(factoryId)
      return NextResponse.json(manifest)
    } catch (e: any) {
      return NextResponse.json({ error: e.message ?? 'Failed to load PDF config' }, { status: 403 })
    }
  })
}

export async function POST(req: NextRequest) {
  return withAuthenticatedDb(req, async () => {
    const fd = await req.formData()
    const factoryId = factoryIdFrom(req, fd)
    if (!factoryId) {
      return NextResponse.json({ error: 'factoryId is required' }, { status: 400 })
    }

    const action = (fd.get('action') as string | null) || 'upload'

    if (action === 'assign') {
      const slot = fd.get('slot') as IOPdfSlot | null
      const filePath = (fd.get('filePath') as string | null) || ''
      if (!slot) {
        return NextResponse.json({ error: 'Invalid slot' }, { status: 400 })
      }
      try {
        await io.assignPdfConfig(factoryId, slot, filePath)
        const cfg = await io.fetchPdfConfig(factoryId)
        return NextResponse.json({ ok: true, selected: cfg.selected })
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 })
      }
    }

    const file = fd.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'File required' }, { status: 400 })
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 })
    }

    try {
      const bytes = await file.arrayBuffer()
      const data = await io.saveUploadedPdf(factoryId, bytes, file.name)
      return NextResponse.json({ ok: true, ...data })
    } catch (e: any) {
      const code = e?.code
      if (code === 'EROFS' || code === 'EPERM' || code === 'EACCES') {
        return NextResponse.json(
          {
            error:
              'Cannot save uploaded PDF on this server (read-only filesystem). Use default templates in public/ or deploy with writable storage.',
          },
          { status: 503 },
        )
      }
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
  })
}
