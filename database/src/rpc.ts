import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withAuthenticatedDb } from './api-auth'
import { logRpcError, toRpcErrorMessage } from './rpc-errors'

export type RpcHandler = (params: Record<string, unknown>) => Promise<unknown>

function rpcErrorStatus(err: unknown, message: string): number {
  if (typeof err === 'object' && err !== null && 'status' in err) {
    const status = (err as { status: unknown }).status
    if (typeof status === 'number' && status >= 400 && status < 600) return status
  }
  if (message.includes('Not signed in') || message.includes('Unauthorized')) return 401
  return 500
}

export function createRpcRoute(handlers: Record<string, RpcHandler>, routeName?: string) {
  return async function POST(request: NextRequest) {
    const route = routeName ?? new URL(request.url).pathname.split('/').filter(Boolean).pop() ?? 'rpc'
    let action: string | undefined

    try {
      const body = await request.json()
      action = body?.action as string | undefined
      const params = (body?.params ?? {}) as Record<string, unknown>

      if (!action || !handlers[action]) {
        return NextResponse.json({ error: `Unknown action: ${action ?? '(missing)'}` }, { status: 400 })
      }

      const result = await withAuthenticatedDb(request, async () => handlers[action!](params))

      if (result instanceof NextResponse) return result
      return NextResponse.json({ data: result })
    } catch (err: unknown) {
      logRpcError(route, action, err)
      const message = toRpcErrorMessage(err)
      const status = rpcErrorStatus(err, message)
      return NextResponse.json({ error: message }, { status })
    }
  }
}
