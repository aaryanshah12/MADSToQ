import { NextResponse } from 'next/server'

type Country = { name: string; code?: string }

export const dynamic = 'force-dynamic'

let cached: { at: number; data: Country[] } | null = null
const TTL_MS = 1000 * 60 * 60 * 12 // 12 hours

export async function GET() {
  const now = Date.now()
  if (cached && now - cached.at < TTL_MS) return NextResponse.json(cached.data)

  // Primary source
  try {
    const res = await fetch('https://restcountries.com/v3.1/all?fields=name,cca2', {
      // cache is fine; we also keep our own cache
      next: { revalidate: 60 * 60 * 12 },
    })
    if (!res.ok) throw new Error(`restcountries status ${res.status}`)
    const json = (await res.json()) as any[]
    const data: Country[] = (json ?? [])
      .map((c: any) => ({ name: c?.name?.common ?? '', code: c?.cca2 ?? undefined }))
      .filter(c => c.name)
      .sort((a, b) => a.name.localeCompare(b.name))
    cached = { at: now, data }
    return NextResponse.json(data)
  } catch {
    // Fallback source
    const res = await fetch('https://countriesnow.space/api/v0.1/countries/iso', {
      next: { revalidate: 60 * 60 * 12 },
    })
    if (!res.ok) return NextResponse.json([], { status: 200 })
    const json = (await res.json()) as any
    const data: Country[] = (json?.data ?? [])
      .map((c: any) => ({ name: c?.name ?? '', code: c?.Iso2 ?? undefined }))
      .filter((c: Country) => c.name)
      .sort((a: Country, b: Country) => a.name.localeCompare(b.name))
    cached = { at: now, data }
    return NextResponse.json(data)
  }
}

