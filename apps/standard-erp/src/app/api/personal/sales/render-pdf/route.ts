import { NextRequest, NextResponse } from 'next/server'
import { getSalesContext } from '@madstoq/sales-system/server'
import { renderDocumentPdf } from '@madstoq/sales-system/pdf'
import type { SalesDocument } from '@madstoq/sales-system/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await getSalesContext()
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const id = req.nextUrl.searchParams.get('document_id')
  if (!id) return NextResponse.json({ error: 'document_id required' }, { status: 400 })

  const { data: doc, error } = await ctx.supabase
    .from('sales_documents')
    .select('*')
    .eq('id', id)
    .eq('org_id', ctx.org.id)
    .single()
  if (error || !doc) return NextResponse.json({ error: error?.message ?? 'Not found' }, { status: 404 })

  try {
    const pdfBytes = await renderDocumentPdf(doc as SalesDocument, ctx.org)
    return new NextResponse(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${(doc.doc_number || 'document').replace(/[^A-Za-z0-9._-]/g, '_')}.pdf"`,
      },
    })
  } catch (e: any) {
    console.error('render-pdf error:', e)
    return NextResponse.json({ error: e.message ?? 'PDF render failed' }, { status: 500 })
  }
}
