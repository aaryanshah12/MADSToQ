import { NextResponse } from 'next/server'

type State = { name: string }

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const country = (searchParams.get('country') ?? '').trim()
  if (!country) return NextResponse.json([])

  const res = await fetch('https://countriesnow.space/api/v0.1/countries/states', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ country }),
    next: { revalidate: 60 * 60 * 12 },
  })
  if (!res.ok) return NextResponse.json([])
  const json = (await res.json()) as any
  const data: State[] = (json?.data?.states ?? [])
    .map((s: any) => ({ name: s?.name ?? '' }))
    .filter((s: State) => s.name)
    .sort((a: State, b: State) => a.name.localeCompare(b.name))
  return NextResponse.json(data)
}

