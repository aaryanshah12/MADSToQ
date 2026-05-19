import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'

type TemplateSlot = 'label' | 'letter-head' | 'customer-print'
const SLOTS: TemplateSlot[] = ['label', 'letter-head', 'customer-print']
const DEFAULTS: Record<TemplateSlot, string> = {
  label: '/Label.pdf',
  'letter-head': '/letter-head.pdf',
  'customer-print': '',
}

type TemplateManifest = {
  files: string[]
  selected: Record<TemplateSlot, string>
}

const FILE_DIR = path.join(process.cwd(), 'public', 'io-pdfs')
const MANIFEST_PATH = path.join(FILE_DIR, 'templates.json')

async function readManifest(): Promise<TemplateManifest> {
  try {
    const raw = await readFile(MANIFEST_PATH, 'utf8')
    const parsed = JSON.parse(raw) as TemplateManifest
    return {
      files: Array.isArray(parsed.files) ? parsed.files : [],
      selected: {
        label: parsed?.selected?.label || DEFAULTS.label,
        'letter-head': parsed?.selected?.['letter-head'] || DEFAULTS['letter-head'],
        'customer-print': parsed?.selected?.['customer-print'] || DEFAULTS['customer-print'],
      },
    }
  } catch {
    return { files: [], selected: { ...DEFAULTS } }
  }
}

async function writeManifest(m: TemplateManifest) {
  await mkdir(FILE_DIR, { recursive: true })
  await writeFile(MANIFEST_PATH, JSON.stringify(m, null, 2), 'utf8')
}

export async function GET() {
  try {
    const manifest = await readManifest()
    return NextResponse.json(manifest)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData()
    const action = (fd.get('action') as string | null) || 'upload'

    if (action === 'assign') {
      const slot = fd.get('slot') as TemplateSlot | null
      const filePath = (fd.get('filePath') as string | null) || ''
      if (!slot || !SLOTS.includes(slot)) {
        return NextResponse.json({ error: 'Invalid slot' }, { status: 400 })
      }
      if (!filePath.startsWith('/')) {
        return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
      }
      const manifest = await readManifest()
      manifest.selected[slot] = filePath
      await writeManifest(manifest)
      return NextResponse.json({ ok: true, selected: manifest.selected })
    }

    const file = fd.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'File required' }, { status: 400 })
    if (file.type !== 'application/pdf') return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 })

    await mkdir(FILE_DIR, { recursive: true })
    const bytes = await file.arrayBuffer()
    const sanitized = file.name.toLowerCase().replace(/[^a-z0-9._-]/g, '-')
    const stampedName = `${Date.now()}-${sanitized.endsWith('.pdf') ? sanitized : `${sanitized}.pdf`}`
    const dest = path.join(FILE_DIR, stampedName)
    await writeFile(dest, Buffer.from(bytes))
    const webPath = `/io-pdfs/${stampedName}`

    const manifest = await readManifest()
    manifest.files = Array.from(new Set([webPath, ...manifest.files]))
    await writeManifest(manifest)
    return NextResponse.json({ ok: true, filePath: webPath, files: manifest.files, selected: manifest.selected })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
