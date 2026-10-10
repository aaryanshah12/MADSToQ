import {
  poLogoCandidates,
  type PoLogoBytes,
  type ProcurementPoDocData,
} from '@/lib/procurement-po-format'

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  const b64 =
    typeof Buffer !== 'undefined'
      ? Buffer.from(bytes).toString('base64')
      : btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''))
  return `data:${mime};base64,${b64}`
}

function mimeToExt(mime: string, url: string): 'png' | 'jpeg' {
  if (mime.includes('jpeg') || mime.includes('jpg') || /\.jpe?g(\?|$)/i.test(url)) return 'jpeg'
  return 'png'
}

async function tryReadPublicFile(relUrl: string): Promise<PoLogoBytes | null> {
  if (typeof window !== 'undefined') return null
  if (!relUrl.startsWith('/')) return null
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    const file = path.join(process.cwd(), 'public', relUrl.replace(/^\//, '').split('?')[0])
    const buf = await fs.readFile(file)
    const bytes = new Uint8Array(buf)
    const extension = mimeToExt('', relUrl)
    const mime = extension === 'jpeg' ? 'image/jpeg' : 'image/png'
    return { bytes, extension, dataUrl: bytesToDataUrl(bytes, mime) }
  } catch {
    return null
  }
}

async function tryFetchLogo(url: string): Promise<PoLogoBytes | null> {
  try {
    const href =
      url.startsWith('http') || typeof window !== 'undefined'
        ? url
        : `${process.env.AUTH_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'}${url}`
    const res = await fetch(href)
    if (!res.ok) return null
    const bytes = new Uint8Array(await res.arrayBuffer())
    if (bytes.byteLength < 32) return null
    const mime = res.headers.get('content-type') || 'image/png'
    const extension = mimeToExt(mime, url)
    return { bytes, extension, dataUrl: bytesToDataUrl(bytes, mime.split(';')[0] || 'image/png') }
  } catch {
    return null
  }
}

/** Load the first letterhead image that exists (browser fetch or server public/). Server-only. */
export async function loadPoLogo(
  data: Pick<ProcurementPoDocData, 'logoUrl' | 'companyName' | 'factoryId'>,
): Promise<PoLogoBytes | null> {
  if (data.logoUrl?.startsWith('data:image/')) {
    return null
  }
  for (const url of poLogoCandidates(data)) {
    const fromDisk = await tryReadPublicFile(url)
    if (fromDisk) return fromDisk
    const fromNet = await tryFetchLogo(url)
    if (fromNet) return fromNet
  }
  return null
}
