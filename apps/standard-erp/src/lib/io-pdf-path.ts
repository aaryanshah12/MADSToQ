import { access, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

let cachedPublicRoot: string | null = null

/** Resolve apps/standard-erp/public whether Next runs from app dir or monorepo root. */
export function resolvePublicRoot(): string {
  if (cachedPublicRoot) return cachedPublicRoot
  const candidates = [
    path.join(process.cwd(), 'public'),
    path.join(process.cwd(), 'apps/standard-erp/public'),
  ]
  for (const dir of candidates) {
    if (existsSync(path.join(dir, 'Label.pdf')) || existsSync(path.join(dir, 'letter-head.pdf'))) {
      cachedPublicRoot = dir
      return dir
    }
  }
  cachedPublicRoot = candidates[0]
  return cachedPublicRoot
}

/** Map a web path (e.g. /Label.pdf, /io-pdfs/foo.pdf) to a file under public/. */
export function resolvePdfDiskPath(webPath: string): string | null {
  if (!webPath || !webPath.startsWith('/') || webPath.includes('..')) return null
  const rel = webPath.replace(/^\//, '')
  return path.join(resolvePublicRoot(), rel)
}

export async function pdfExistsOnDisk(webPath: string): Promise<boolean> {
  const disk = resolvePdfDiskPath(webPath)
  if (!disk) return false
  try {
    await access(disk)
    return true
  } catch {
    return false
  }
}

/** Case-insensitive match for default template names (Label.pdf vs label.pdf). */
export async function resolvePdfWebPath(webPath: string): Promise<string | null> {
  if (await pdfExistsOnDisk(webPath)) return webPath
  const root = resolvePublicRoot()
  const rel = webPath.replace(/^\//, '')
  const dir = path.dirname(rel)
  const base = path.basename(rel)
  if (!base.toLowerCase().endsWith('.pdf')) return null
  const searchDir = dir === '.' ? root : path.join(root, dir)
  try {
    const entries = await readdir(searchDir)
    const hit = entries.find((e) => e.toLowerCase() === base.toLowerCase())
    if (hit) return dir === '.' ? `/${hit}` : `/${dir}/${hit}`.replace(/\\/g, '/')
  } catch {
    return null
  }
  return null
}
