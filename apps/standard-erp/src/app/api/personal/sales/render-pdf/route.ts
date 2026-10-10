import { NextRequest, NextResponse } from 'next/server'
import { getSalesContext } from '@madstoq/sales-system/server'
import { fetchSalesDocument } from '@madstoq/sales-system/db-queries'
import { renderDocumentPdf } from '@madstoq/sales-system/pdf'
import type { SalesDocument } from '@madstoq/sales-system/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await getSalesContext(req)
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const id = req.nextUrl.searchParams.get('document_id')
  if (!id) return NextResponse.json({ error: 'document_id required' }, { status: 400 })

  const doc = await fetchSalesDocument(ctx.db, ctx.org.id, id)
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const pdfBytes = await renderDocumentPdf(doc as SalesDocument, ctx.org)
    return new NextResponse(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${(doc.doc_number || 'document').replace(/[^A-Za-z0-9._-]/g, '_')}.pdf"`,
      },
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'PDF render failed'
    console.error('render-pdf error:', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
