import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withAuthenticatedDb } from './api-auth'
import type { AuthUser } from './db-context'
import type { SupabaseClient } from '@supabase/supabase-js'

export type RpcHandler = (params: Record<string, unknown>) => Promise<unknown>

export function createRpcRoute(handlers: Record<string, RpcHandler>) {
  return async function POST(request: NextRequest) {
    try {
      const body = await request.json()
      const action = body?.action as string | undefined
      const params = (body?.params ?? {}) as Record<string, unknown>

      if (!action || !handlers[action]) {
        return NextResponse.json({ error: `Unknown action: ${action ?? '(missing)'}` }, { status: 400 })
      }

      const result = await withAuthenticatedDb(request, async (ctx: { user: AuthUser; db: SupabaseClient }) =>
        handlers[action](params)
      )

      if (result instanceof NextResponse) return result
      return NextResponse.json({ data: result })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal server error'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }
}
