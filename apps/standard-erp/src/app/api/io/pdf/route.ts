import { readFile } from 'fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import { withAuthenticatedDb } from '@madstoq/database'
import * as io from '@madstoq/io-system/services'
import { pdfExistsOnDisk, resolvePdfDiskPath, resolvePdfWebPath } from '@/lib/io-pdf-path'

const PUBLIC_DEFAULTS = ['/Label.pdf', '/letter-head.pdf']

export async function GET(req: NextRequest) {
  const webPath = req.nextUrl.searchParams.get('path') || ''
  const factoryId = req.nextUrl.searchParams.get('factoryId') || ''

  if (!webPath.startsWith('/') || webPath.includes('..')) {
    return NextResponse.json({ error: 'Invalid PDF path' }, { status: 400 })
  }

  return withAuthenticatedDb(req, async () => {
    if (factoryId) {
      await io.assertFactoryAccess(factoryId)
      const cfg = await io.fetchPdfConfig(factoryId)
      const allowed = new Set([
        cfg.selected.label,
        cfg.selected['letter-head'],
        cfg.selected['customer-print'],
        ...cfg.files,
        ...PUBLIC_DEFAULTS,
      ].filter(Boolean))
      if (!allowed.has(webPath)) {
        return NextResponse.json({ error: 'PDF not configured for this factory' }, { status: 403 })
      }
    } else if (!PUBLIC_DEFAULTS.includes(webPath)) {
      return NextResponse.json({ error: 'factoryId is required for custom PDF paths' }, { status: 400 })
    }

    const resolvedPath = (await resolvePdfWebPath(webPath)) || webPath
    const disk = resolvePdfDiskPath(resolvedPath)
    if (!disk || !(await pdfExistsOnDisk(resolvedPath))) {
      return NextResponse.json({ error: `PDF not found: ${webPath}` }, { status: 404 })
    }
    const bytes = await readFile(disk)
    return new NextResponse(bytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'private, max-age=60',
      },
    })
  })
}
