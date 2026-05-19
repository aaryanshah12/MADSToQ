import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withAuthenticatedDb } from '@madstoq/database'
import * as inventory from '@madstoq/inventory-system/services'

export async function GET(request: NextRequest) {
  const result = await withAuthenticatedDb(request, async ({ user }) => {
    return inventory.loadProfile(user.id)
  })
  if (result instanceof NextResponse) return result
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ profile: result.profile })
}
