/** Normalize thrown values from IO PostgREST shim and services into Error messages. */
export function toRpcErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const msg = (err as { message: unknown }).message
    if (typeof msg === 'string' && msg.trim()) return msg
  }
  if (typeof err === 'string' && err.trim()) return err
  return 'Internal server error'
}

export function logRpcError(route: string, action: string | undefined, err: unknown) {
  const message = toRpcErrorMessage(err)
  console.error(`[rpc:${route}] action=${action ?? '(missing)'} error=${message}`, err)
}
