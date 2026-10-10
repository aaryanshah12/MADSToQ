import {
  EMPLOYEE_DOC_TYPES,
  isAllowedEmployeeDocMime,
  MAX_EMPLOYEE_DOC_BYTES,
  mimeFromFileName,
  prisma,
  serializeEmployeeDocument,
  textOrNull,
} from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireOwnerFactoryAccess } from '@/lib/employee-api'

const metaSelect = {
  id: true,
  employeeId: true,
  docType: true,
  title: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  uploadedBy: true,
  createdAt: true,
} as const

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { id: true, factoryId: true },
    })
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

    const access = await requireOwnerFactoryAccess(request, employee.factoryId)
    if (access.error) return access.error

    const rows = await prisma.employeeDocument.findMany({
      where: { employeeId: id },
      select: metaSelect,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      documents: rows.map(serializeEmployeeDocument),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { id: true, factoryId: true },
    })
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

    const access = await requireOwnerFactoryAccess(request, employee.factoryId)
    if (access.error) return access.error

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }
    if (file.size > MAX_EMPLOYEE_DOC_BYTES) {
      return NextResponse.json({ error: 'File must be 5 MB or smaller' }, { status: 400 })
    }

    const docType = String(form.get('doc_type') || '').trim()
    if (!EMPLOYEE_DOC_TYPES.includes(docType as (typeof EMPLOYEE_DOC_TYPES)[number])) {
      return NextResponse.json({ error: 'Invalid doc_type' }, { status: 400 })
    }

    const fileName = file.name.replace(/[/\\]/g, '_').slice(0, 180) || 'document'
    const mimeType = mimeFromFileName(fileName, file.type)
    if (!isAllowedEmployeeDocMime(mimeType, fileName)) {
      return NextResponse.json({ error: 'Only PDF, JPEG, PNG, or WebP files are allowed' }, { status: 400 })
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    const row = await prisma.employeeDocument.create({
      data: {
        employeeId: id,
        docType,
        title: textOrNull(form.get('title')),
        fileName,
        mimeType,
        sizeBytes: bytes.length,
        fileBytes: bytes,
        uploadedBy: access.profile.id,
      },
      select: metaSelect,
    })

    return NextResponse.json({
      success: true,
      document: serializeEmployeeDocument(row),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
