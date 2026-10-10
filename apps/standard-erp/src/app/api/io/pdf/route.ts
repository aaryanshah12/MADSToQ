import { readFile } from 'fs/promises'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'

const IO_PDF_DIR = path.join(process.cwd(), 'public', 'io-pdfs')

/** Serve uploaded IO PDFs (runtime files under public/io-pdfs are not always reachable as static assets on Render). */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('path') ?? ''
  if (!raw.startsWith('/io-pdfs/') || raw.includes('..')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }
  const name = path.basename(raw)
  const filePath = path.join(IO_PDF_DIR, name)
  try {
    const buf = await readFile(filePath)
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'private, max-age=60',
      },
    })
  } catch {
    return NextResponse.json({ error: 'PDF not found' }, { status: 404 })
  }
}
