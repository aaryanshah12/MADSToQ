import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireProfile } from '@/lib/qc-api-helpers'

/** COA numbers are issued when the lab allocates lots with the Tally invoice and drum count. */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireProfile(request, ['lab_incharge', 'owner', 'accountant'])
    if (auth.error) return auth.error

    return NextResponse.json(
      {
        error:
          'COA is generated when the lab allocates lots and enters the Tally invoice and drum count.',
      },
      { status: 400 },
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
