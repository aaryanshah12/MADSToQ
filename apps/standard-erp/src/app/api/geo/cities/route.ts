import { NextResponse } from 'next/server'

type City = { name: string }

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const country = (searchParams.get('country') ?? '').trim()
  const state = (searchParams.get('state') ?? '').trim()
  if (!country || !state) return NextResponse.json([])

  const res = await fetch('https://countriesnow.space/api/v0.1/countries/state/cities', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ country, state }),
    next: { revalidate: 60 * 60 * 12 },
  })
  if (!res.ok) return NextResponse.json([])
  const json = (await res.json()) as any
  const data: City[] = (json?.data ?? [])
    .map((name: any) => ({ name: String(name ?? '').trim() }))
    .filter((c: City) => c.name)
    .sort((a: City, b: City) => a.name.localeCompare(b.name))
  return NextResponse.json(data)
}

