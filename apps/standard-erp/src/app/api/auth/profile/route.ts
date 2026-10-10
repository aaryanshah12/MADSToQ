import '@/load-root-env'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withAuthenticatedDb } from '@madstoq/database'
import { loadProfile } from "@madstoq/inventory-system/services";

export async function GET(request: NextRequest) {
  try {
    const result = await withAuthenticatedDb(request, async ({ user }) => {
      return loadProfile(user.id);
    })
    if (result instanceof NextResponse) return result
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ profile: result.profile })
  } catch (error) {
    console.error('GET /api/auth/profile failed', error)
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 503 })
  }
}
